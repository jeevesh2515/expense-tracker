/**
 * Core calculation library: splitting, payment tracking, balance netting.
 *
 * Money is always integer cents (bigint-compatible). All math is integer
 * arithmetic; rounding rules are explicit and deterministic.
 *
 * Rounding strategy for unequal cents:
 *   - Floor divide the total, then distribute the remainder cents (1 by 1)
 *     to the participants sorted by `name` ascending — the first N get +1.
 *   - This is deterministic, fair, and order-independent of UI input.
 *   - Convention matches industry leaders (Splitwise etc.).
 */

export type ShareType = "equal" | "exact" | "percentage";

export type SplitParticipant = {
  personId: string;
  name: string;
  /** Only used when shareType is `exact` or `percentage`. */
  value?: number;
};

export type ComputedSplit = {
  personId: string;
  shareType: ShareType;
  shareValue: number;
  owedAmountCents: number;
};

export type PersonBalanceLine = {
  personId: string;
  owed: number; // total cents this person owes across this txn's splits
  paid: number; // total cents they have already paid
  remaining: number; // owed - paid (may be negative if overpaid)
  status: "paid" | "partial" | "unpaid";
};

export type ProjectPersonBalance = {
  personId: string;
  name: string;
  /** Positive = others owe this person. Negative = this person owes others. */
  netCents: number;
  /** Total cents this person owes across all transactions. */
  totalOutflowCents: number;
  /** Total cents owed TO this person across all transactions. */
  totalInflowCents: number;
};

export type PairBalance = {
  fromPersonId: string;
  fromName: string;
  toPersonId: string;
  toName: string;
  /** Positive number: `from` owes `to` this many cents. */
  cents: number;
};

/* -------------------------------------------------------------------------- */
/* Splitters                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Distribute `remainder` (0..participants-1) one cent at a time to the first
 * `remainder` participants of the alphabetically-sorted list.
 */
function distributeRemainder(
  baseCents: number,
  remainder: number,
  sortedParticipants: SplitParticipant[],
): ComputedSplit[] {
  return sortedParticipants.map((p, idx) => ({
    personId: p.personId,
    shareType: "equal" as const,
    shareValue: 0,
    owedAmountCents: baseCents + (idx < remainder ? 1 : 0),
  }));
}

/**
 * Equal split. Sums to exactly `totalCents` by construction.
 *
 * Throws if totalCents < 0 or participants.length === 0.
 */
export function splitEqual(
  totalCents: number,
  participants: SplitParticipant[],
): ComputedSplit[] {
  if (totalCents < 0) throw new Error("Total cannot be negative");
  if (participants.length === 0) throw new Error("No participants");
  const sorted = [...participants].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
  const base = Math.floor(totalCents / sorted.length);
  const remainder = totalCents - base * sorted.length;
  return distributeRemainder(base, remainder, sorted);
}

/**
 * Exact-amount split. Validates that the sum equals the total.
 * Returns the entries unchanged if the breakdown matches.
 */
export function splitExact(
  totalCents: number,
  participants: SplitParticipant[],
): ComputedSplit[] {
  if (totalCents < 0) throw new Error("Total cannot be negative");
  if (participants.length === 0) throw new Error("No participants");
  let sum = 0;
  for (const p of participants) {
    if (p.value == null || p.value < 0) {
      throw new Error(`Invalid exact amount for participant`);
    }
    sum += p.value;
  }
  if (sum !== totalCents) {
    throw new Error(
      `Exact amounts (${sum}) do not sum to total (${totalCents}). ` +
        `Difference: ${sum - totalCents} cents.`,
    );
  }
  return participants.map((p) => ({
    personId: p.personId,
    shareType: "exact" as const,
    shareValue: p.value!,
    owedAmountCents: p.value!,
  }));
}

/**
 * Percentage split using integer basis points (1 bp = 0.01%).
 * Validates that the basis points sum to exactly 10000.
 */
export function splitPercentage(
  totalCents: number,
  participants: SplitParticipant[],
): ComputedSplit[] {
  if (totalCents < 0) throw new Error("Total cannot be negative");
  if (participants.length === 0) throw new Error("No participants");
  let totalBp = 0;
  for (const p of participants) {
    if (p.value == null || p.value < 0) {
      throw new Error(`Invalid percentage for participant`);
    }
    totalBp += p.value;
  }
  if (totalBp !== 10000) {
    throw new Error(
      `Percentages must sum to 10000 bp (100%). Got ${totalBp} bp.`,
    );
  }
  // Compute owed cents per person as floor(total * bp / 10000), then
  // distribute remainder cents to the first N participants alphabetically.
  const rows = participants.map((p) => ({
    personId: p.personId,
    name: p.name,
    shareValue: p.value!,
    owedAmountCents: Math.floor((totalCents * p.value!) / 10000),
  }));
  const sum = rows.reduce((s, r) => s + r.owedAmountCents, 0);
  const remainder = totalCents - sum;
  const sorted = [...rows].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
  for (let i = 0; i < remainder; i++) {
    sorted[i].owedAmountCents += 1;
  }
  return rows
    .map((r) => {
      const updated = sorted.find((s) => s.personId === r.personId)!;
      return {
        personId: r.personId,
        shareType: "percentage" as const,
        shareValue: r.shareValue,
        owedAmountCents: updated.owedAmountCents,
      };
    })
    .sort((a, b) => {
      // Preserve participants input order for output.
      const ai = participants.findIndex((p) => p.personId === a.personId);
      const bi = participants.findIndex((p) => p.personId === b.personId);
      return ai - bi;
    });
}

/**
 * Dispatch to the right splitter based on shareType. All participants must
 * have the same shareType (one transaction = one mode).
 */
export function computeSplits(
  totalCents: number,
  shareType: ShareType,
  participants: SplitParticipant[],
): ComputedSplit[] {
  switch (shareType) {
    case "equal":
      return splitEqual(totalCents, participants);
    case "exact":
      return splitExact(totalCents, participants);
    case "percentage":
      return splitPercentage(totalCents, participants);
  }
}

export type BalancedPercentage = {
  personId: string;
  name: string;
  /** Always defined after `balancePercentages`: integer basis points in [0, 10000]. */
  value: number;
};

/**
 * Normalize percentage basis points so they sum to exactly 10000 (100%).
 *
 * Common UX trap: typing "33.33" three times yields 9999 bp, which the
 * strict splitter rejects. This helper absorbs the rounding remainder into
 * the LAST participant (preserving input order) so the user always sees a
 * saveable form. The auto-balance is small (≤ N-1 bp = a tenth of a cent
 * per person for typical N) and is the only way to make the common
 * 3-way, 6-way, 9-way equal splits submit successfully.
 *
 * Returns participants with `value` updated. Throws if any per-person value
 * is outside [0, 10000] bp (e.g. negative or > 100%). Refuses to silently
 * coerce garbage input like "200%" into "100%" — that's a user mistake, not
 * a rounding issue.
 */
export function balancePercentages(
  participants: SplitParticipant[],
): BalancedPercentage[] {
  if (participants.length === 0) return [];
  for (const p of participants) {
    if (p.value == null || p.value < 0 || p.value > 10000) {
      throw new Error(
        "Each percentage must be between 0% and 100%. Sum must equal 100%.",
      );
    }
  }
  let total = 0;
  for (const p of participants) total += p.value!;
  const remainder = 10000 - total;
  if (remainder === 0) {
    // Always return a fresh array of fresh objects so callers can safely
    // diff before/after and never observe identity-mixed results.
    return participants.map((p) => ({
      personId: p.personId,
      name: p.name,
      value: p.value!,
    }));
  }
  // Last participant absorbs the entire remainder so the bp sum is exact.
  // If remainder is negative (over-100%), the same person loses the bp.
  const last = participants.length - 1;
  const out: BalancedPercentage[] = participants.map((p, i) =>
    i === last
      ? { personId: p.personId, name: p.name, value: p.value! + remainder }
      : { personId: p.personId, name: p.name, value: p.value! },
  );
  // Defensive: refuse to produce any value out of [0, 10000] bp range.
  for (const p of out) {
    if (p.value < 0 || p.value > 10000) {
      throw new Error(
        "Percentages must be between 0% and 100% per person and sum to 100%.",
      );
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Per-transaction payment tracking                                          */
/* -------------------------------------------------------------------------- */

/**
 * Given a transaction and its splits + payments, compute per-person row.
 */
export function computeTransactionBalances(params: {
  splits: { personId: string; owedAmountCents: number }[];
  payments: { personId: string; amountCents: number }[];
}): PersonBalanceLine[] {
  const map = new Map<string, PersonBalanceLine>();
  for (const s of params.splits) {
    const cur = map.get(s.personId);
    const owed = s.owedAmountCents;
    map.set(s.personId, {
      personId: s.personId,
      owed: (cur?.owed ?? 0) + owed,
      paid: cur?.paid ?? 0,
      remaining: owed - (cur?.paid ?? 0),
      status: "unpaid",
    });
  }
  for (const p of params.payments) {
    const cur = map.get(p.personId);
    if (!cur) {
      // A payment from someone who has no split = overpayment against a
      // deleted split. We still record it as a balance line.
      map.set(p.personId, {
        personId: p.personId,
        owed: 0,
        paid: p.amountCents,
        remaining: -p.amountCents,
        status: "paid",
      });
      continue;
    }
    const paid = cur.paid + p.amountCents;
    const remaining = cur.owed - paid;
    map.set(p.personId, {
      ...cur,
      paid,
      remaining,
      status: remaining <= 0 ? "paid" : paid > 0 ? "partial" : "unpaid",
    });
  }
  // Recompute status from totals (handles edge cases where paid === owed exactly)
  for (const [, v] of map) {
    v.status =
      v.remaining <= 0 ? "paid" : v.paid > 0 ? "partial" : "unpaid";
  }
  return Array.from(map.values());
}

/* -------------------------------------------------------------------------- */
/* Project-wide balance netting                                              */
/* -------------------------------------------------------------------------- */

/**
 * Compute the project-wide balance summary given all constituent data.
 *
 * Per-person net (cents, signed):
 *   inflow = +amount others owe this person (sum of splits for txns they
 *            paid, excluding their own consumption) − payments received
 *            against those txns (since receiving payment reduces what's
 *            still owed).
 *   outflow = +amount this person owes others (sum of their splits on txns
 *            paid by others) − payments they have made (since paying
 *            reduces their debt).
 *   net = inflow − outflow.
 *     net > 0 → others owe this person.
 *     net < 0 → this person owes others.
 *
 * Overflow math safety: paid-down debt can drive one of (inflow, outflow)
 * negative. This simply reflects "you're owed" / "you've prepaid" and is
 * handled by the pair-balance collapse below.
 *
 * Pair balances:
 *   For each unordered pair (X, Y), signed `xOwesY` tracks X's net debt
 *   to Y. Splits increase the debt direction; payments reduce it. After
 *   the loop, the signed xOwesY is converted to a directional pair by
 *   collapsing negative values.
 */
export function computeProjectBalances(params: {
  people: { id: string; name: string }[];
  transactions: { id: string; paidById: string }[];
  /** All splits across all transactions. */
  splits: { transactionId: string; personId: string; owedAmountCents: number }[];
  /** Optional payments (pass [] when none). */
  payments?: { transactionId: string; personId: string; amountCents: number }[];
}): { people: ProjectPersonBalance[]; pairs: PairBalance[] } {
  const payments = params.payments ?? [];
  const peopleById = new Map(params.people.map((p) => [p.id, p]));
  const txnPaidBy = new Map(params.transactions.map((t) => [t.id, t.paidById]));

  // ---- per-person totals --------------------------------------------------
  const totals = new Map<string, { inflow: number; outflow: number; name: string }>();
  for (const p of params.people) {
    totals.set(p.id, { inflow: 0, outflow: 0, name: p.name });
  }

  // Splits: borrower B owes payer P `s` cents (skip payer's own share).
  for (const s of params.splits) {
    const payerId = txnPaidBy.get(s.transactionId);
    if (!payerId || !totals.has(s.personId)) continue;
    if (s.personId === payerId) continue; // payer's own share: net unaffected
    totals.get(payerId)!.inflow += s.owedAmountCents;
    totals.get(s.personId)!.outflow += s.owedAmountCents;
  }

  // Payments: payor X pays $p on txn T (paid_by Y). X's debt to Y drops by $p.
  for (const p of payments) {
    const payerId = txnPaidBy.get(p.transactionId);
    if (!payerId || !totals.has(p.personId)) continue;
    if (p.personId === payerId) continue; // self-payment: no-op
    totals.get(payerId)!.inflow -= p.amountCents;
    totals.get(p.personId)!.outflow -= p.amountCents;
  }

  const peopleResult: ProjectPersonBalance[] = Array.from(totals.entries()).map(
    ([id, t]) => ({
      personId: id,
      name: peopleById.get(id)?.name ?? "Unknown",
      netCents: t.inflow - t.outflow,
      totalInflowCents: t.inflow,
      totalOutflowCents: t.outflow,
    }),
  );

  // ---- pair balances ------------------------------------------------------
  // For each ordered pair (xId, yId) with xId < yId, xOwesY is signed.
  // Splits: borrower B owes payer P → modifies xOwesY by ±s.
  // Payments: payor X pays $p to txn-payer Y → reduces X's debt to Y by $p.
  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const pairMap = new Map<
    string,
    { xId: string; xName: string; yId: string; yName: string; xOwesY: number }
  >();
  for (const a of params.people) {
    for (const b of params.people) {
      if (a.id < b.id) {
        pairMap.set(pairKey(a.id, b.id), {
          xId: a.id,
          xName: a.name,
          yId: b.id,
          yName: b.name,
          xOwesY: 0,
        });
      }
    }
  }

  const applySplit = (borrower: string, payer: string, cents: number) => {
    const row = pairMap.get(pairKey(borrower < payer ? borrower : payer, borrower < payer ? payer : borrower))!;
    // xId = min(payer, borrower), yId = max(...). If borrower is x, then x owes y.
    if (borrower === row.xId) row.xOwesY += cents;
    else row.xOwesY -= cents;
  };

  const applyPayment = (payor: string, receiver: string, cents: number) => {
    const row = pairMap.get(pairKey(payor < receiver ? payor : receiver, payor < receiver ? receiver : payor))!;
    // Reducing payor's debt to receiver. If payor is x, xOwesY -= cents.
    if (payor === row.xId) row.xOwesY -= cents;
    else row.xOwesY += cents;
  };

  for (const s of params.splits) {
    const payerId = txnPaidBy.get(s.transactionId);
    if (!payerId || s.personId === payerId) continue;
    applySplit(s.personId, payerId, s.owedAmountCents);
  }
  for (const p of payments) {
    const txnPayerId = txnPaidBy.get(p.transactionId);
    if (!txnPayerId || p.personId === txnPayerId) continue;
    applyPayment(p.personId, txnPayerId, p.amountCents);
  }

  const pairs: PairBalance[] = [];
  for (const row of pairMap.values()) {
    if (row.xOwesY > 0) {
      pairs.push({
        fromPersonId: row.xId,
        fromName: row.xName,
        toPersonId: row.yId,
        toName: row.yName,
        cents: row.xOwesY,
      });
    } else if (row.xOwesY < 0) {
      pairs.push({
        fromPersonId: row.yId,
        fromName: row.yName,
        toPersonId: row.xId,
        toName: row.xName,
        cents: -row.xOwesY,
      });
    }
  }
  pairs.sort((a, b) => b.cents - a.cents);

  return { people: peopleResult, pairs };
}

/* -------------------------------------------------------------------------- */
/* Settlement simplification (greedy min-cashflow)                            */
/* -------------------------------------------------------------------------- */

/**
 * Reduce the list of pair balances to a minimum set of transfers using a
 * greedy max-debtor / max-creditor algorithm. Each transfer represents one
 * person paying another; result is at most N-1 transfers for N people.
 */
export function simplifySettlements(
  balances: ProjectPersonBalance[],
): { fromId: string; fromName: string; toId: string; toName: string; cents: number }[] {
  const debtors = balances
    .filter((b) => b.netCents < 0)
    .map((b) => ({ id: b.personId, name: b.name, cents: -b.netCents }))
    .sort((a, b) => b.cents - a.cents);
  const creditors = balances
    .filter((b) => b.netCents > 0)
    .map((b) => ({ id: b.personId, name: b.name, cents: b.netCents }))
    .sort((a, b) => b.cents - a.cents);

  const transfers: {
    fromId: string;
    fromName: string;
    toId: string;
    toName: string;
    cents: number;
  }[] = [];

  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const amount = Math.min(d.cents, c.cents);
    if (amount > 0) {
      transfers.push({
        fromId: d.id,
        fromName: d.name,
        toId: c.id,
        toName: c.name,
        cents: amount,
      });
      d.cents -= amount;
      c.cents -= amount;
    }
    if (d.cents === 0) i++;
    if (c.cents === 0) j++;
  }
  return transfers;
}
