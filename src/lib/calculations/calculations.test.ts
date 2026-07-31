import { describe, it, expect } from "vitest";
import {
  splitEqual,
  splitExact,
  splitPercentage,
  computeSplits,
  balancePercentages,
  computeTransactionBalances,
  computeProjectBalances,
  simplifySettlements,
  applyCategoryFilter,
  matchesCategoryFilter,
  computeSpendingBuckets,
} from "./index";
import { CATEGORY_FILTER_UNTAGGED } from "../db/schema";

const ppl = (arr: Array<[string, string]>) =>
  arr.map(([id, name]) => ({ personId: id, name }));

describe("splitEqual", () => {
  it("splits evenly with integer cents", () => {
    const r = splitEqual(900, ppl([
      ["c", "Charlie"],
      ["a", "Alice"],
      ["b", "Bob"],
    ]));
    expect(r.reduce((s, x) => s + x.owedAmountCents, 0)).toBe(900);
    // Deterministic: alphabetical order gets the extra cent
    expect(r.find((x) => x.personId === "a")!.owedAmountCents).toBe(300);
    expect(r.find((x) => x.personId === "b")!.owedAmountCents).toBe(300);
    expect(r.find((x) => x.personId === "c")!.owedAmountCents).toBe(300);
  });

  it("distributes remainder cents to first names alphabetically", () => {
    const r = splitEqual(1000, ppl([
      ["c", "Charlie"],
      ["a", "Alice"],
      ["b", "Bob"],
    ]));
    // 1000/3 = 333, remainder 1 → Alice gets 334
    expect(r.find((x) => x.personId === "a")!.owedAmountCents).toBe(334);
    expect(r.find((x) => x.personId === "b")!.owedAmountCents).toBe(333);
    expect(r.find((x) => x.personId === "c")!.owedAmountCents).toBe(333);
    expect(r.reduce((s, x) => s + x.owedAmountCents, 0)).toBe(1000);
  });

  it("handles big remainder (cents < n)", () => {
    const r = splitEqual(3, ppl([
      ["a", "Alice"],
      ["b", "Bob"],
      ["c", "Charlie"],
      ["d", "Diana"],
      ["e", "Ethan"],
    ]));
    expect(r.reduce((s, x) => s + s, 0));
    // 3 cents / 5 ppl: each gets 0 (floor) + 1 if first in alpha (3 remainders)
    expect(r.find((x) => x.personId === "a")!.owedAmountCents).toBe(1);
    expect(r.find((x) => x.personId === "b")!.owedAmountCents).toBe(1);
    expect(r.find((x) => x.personId === "c")!.owedAmountCents).toBe(1);
    expect(r.find((x) => x.personId === "d")!.owedAmountCents).toBe(0);
    expect(r.find((x) => x.personId === "e")!.owedAmountCents).toBe(0);
    expect(r.reduce((s, x) => s + x.owedAmountCents, 0)).toBe(3);
  });

  it("handles zero total gracefully", () => {
    const r = splitEqual(0, ppl([
      ["a", "Alice"],
      ["b", "Bob"],
    ]));
    expect(r.every((x) => x.owedAmountCents === 0)).toBe(true);
  });

  it("throws on empty participants", () => {
    expect(() => splitEqual(100, [])).toThrow();
  });

  it("throws on negative total", () => {
    expect(() => splitEqual(-100, ppl([["a", "Alice"]]))).toThrow();
  });

  it("case-insensitive alphabetical sort", () => {
    const r = splitEqual(1, ppl([
      ["z", "zoe"],
      ["a", "Alice"],
    ]));
    // remainder = 1 → Alice gets 1, Zoe gets 0
    expect(r.find((x) => x.personId === "a")!.owedAmountCents).toBe(1);
    expect(r.find((x) => x.personId === "z")!.owedAmountCents).toBe(0);
  });
});

describe("splitExact", () => {
  it("accepts when amounts sum exactly", () => {
    const r = splitExact(
      1000,
      ppl([
        ["a", "Alice"],
        ["b", "Bob"],
        ["c", "Charlie"],
      ]).map((p, i) => ({
        ...p,
        value: [400, 350, 250][i]!,
      })),
    );
    expect(r.reduce((s, x) => s + x.owedAmountCents, 0)).toBe(1000);
  });

  it("rejects when amounts don't sum to total", () => {
    expect(() =>
      splitExact(
        1000,
        ppl([
          ["a", "Alice"],
          ["b", "Bob"],
        ]).map((p) => ({ ...p, value: 400 })),
      ),
    ).toThrow();
  });
});

describe("splitPercentage", () => {
  it("converts basis points to exact cents", () => {
    const r = splitPercentage(
      1000,
      ppl([
        ["a", "Alice"],
        ["b", "Bob"],
        ["c", "Charlie"],
      ]).map((p, i) => ({
        ...p,
        value: [5000, 3000, 2000][i]!,
      })),
    );
    expect(r.reduce((s, x) => s + x.owedAmountCents, 0)).toBe(1000);
  });

  it("rejects when percentages don't sum to 10000 bp", () => {
    expect(() =>
      splitPercentage(
        1000,
        ppl([
          ["a", "Alice"],
          ["b", "Bob"],
        ]).map((p) => ({ ...p, value: 4000 })),
      ),
    ).toThrow();
  });

  it("distributes rounding remainder deterministically", () => {
    // 1000 cents / 3 way by 3334, 3333, 3333 (sum=9999). Need +2 raw cents.
    // 10000 bp / 3 → 3334, 3333, 3333. Remainder = 1 cent.
    const r = splitPercentage(
      1000,
      ppl([
        ["a", "Alice"],
        ["b", "Bob"],
        ["c", "Charlie"],
      ]).map((p, i) => ({
        ...p,
        value: [3334, 3333, 3333][i]!,
      })),
    );
    expect(r.reduce((s, x) => s + x.owedAmountCents, 0)).toBe(1000);
  });
});

describe("computeSplits dispatcher", () => {
  it("dispatches to the right splitter", () => {
    expect(computeSplits(900, "equal", ppl([["a", "A"], ["b", "B"], ["c", "C"]])).length)
      .toBe(3);
  });
});

describe("balancePercentages (auto-balance UX helper)", () => {
  it("returns unchanged participants when sum is already 10000 bp", () => {
    const r = balancePercentages(
      ppl([["a", "A"], ["b", "B"], ["c", "C"]]).map((p, i) => ({
        ...p,
        value: [5000, 3000, 2000][i]!,
      })),
    );
    expect(r.reduce((s, p) => s + p.value!, 0)).toBe(10000);
    expect(r[0]!.value).toBe(5000);
    expect(r[1]!.value).toBe(3000);
    expect(r[2]!.value).toBe(2000);
  });

  it("absorbs positive remainder into the last participant", () => {
    // 33.33 × 3 = 9999 bp; last must absorb +1 → 3334
    const r = balancePercentages(
      ppl([["a", "A"], ["b", "B"], ["c", "C"]]).map((p, i) => ({
        ...p,
        value: [3333, 3333, 3333][i]!,
      })),
    );
    expect(r.reduce((s, p) => s + p.value!, 0)).toBe(10000);
    expect(r[2]!.value).toBe(3334);
  });

  it("absorbs negative remainder into the last participant", () => {
    // User typed 33.34 × 3 = 10002 bp; last must give back -2.
    const r = balancePercentages(
      ppl([["a", "A"], ["b", "B"], ["c", "C"]]).map((p, i) => ({
        ...p,
        value: [3334, 3334, 3334][i]!,
      })),
    );
    expect(r.reduce((s, p) => s + p.value!, 0)).toBe(10000);
    expect(r[2]!.value).toBe(3332);
  });

  it("auto-balances realistic UI inputs (deterministic cases)", () => {
    // Each case is something a user could plausibly type. We verify:
    //   1) the output sums to exactly 10000, and
    //   2) every per-person output is in [0, 10000] bp.
    const cases: Array<{ values: number[] }> = [
      // 2-person, already balanced: 50/50
      { values: [5000, 5000] },
      // 2-person 1-cent rounding remainders (off-by-1 each direction)
      { values: [3334, 6667] },           // sum 10001 → last absorbs -1
      { values: [3333, 6666] },           // sum 9999 → last absorbs +1
      // 3-person, the notorious "33.33% × 3" UX case
      { values: [3333, 3333, 3333] },     // sum 9999 → last absorbs +1 → 3334
      // 3-person, user accidentally typed 100% for one + 33.34 for the others
      { values: [3334, 3334, 3334] },     // sum 10002 → last absorbs -2
      // 6-person 16.66% case
      { values: [1666, 1666, 1666, 1666, 1666, 1666] }, // sum 9996 → +4 to last
      // Highly skewed 4-person: one 100%, others tiny
      { values: [9900, 50, 50, 0] },      // sum 10000 → no-op
      // Highly skewed: one 100%, one 0%, two mid → repair into last
      { values: [10000, 0, 0, 0] },       // sum 10000 → no-op
    ];
    for (const c of cases) {
      const participants = ppl(
        c.values.map((_, j) => [`p${j}`, `P${j}`] as [string, string]),
      ).map((p, j) => ({ ...p, value: c.values[j]! }));
      const r = balancePercentages(participants);
      const sum = r.reduce((s, p) => s + p.value!, 0);
      expect(sum).toBe(10000);
      r.forEach((p) => {
        expect(p.value!).toBeGreaterThanOrEqual(0);
        expect(p.value!).toBeLessThanOrEqual(10000);
      });
    }
  });

  it("output is invariant under reordering participants", () => {
    // balancePercentages always absorbs into the LAST participant by input
    // order, so the amount absorbed depends on which person is last.
    const a = balancePercentages(
      ppl([["a", "A"], ["b", "B"], ["c", "C"]]).map((p, i) => ({
        ...p,
        value: [3333, 3333, 3333][i]!,
      })),
    );
    const b = balancePercentages(
      ppl([["c", "C"], ["b", "B"], ["a", "A"]]).map((p, i) => ({
        ...p,
        value: [3333, 3333, 3333][i]!,
      })),
    );
    expect(a.reduce((s, p) => s + p.value!, 0)).toBe(10000);
    expect(b.reduce((s, p) => s + p.value!, 0)).toBe(10000);
    // The "last" by input order is the one that absorbs the +1 bp.
    expect(a[2]!.value).toBe(3334);
    expect(b[2]!.value).toBe(3334);
  });

  it("rejects negative per-person percentages (defensive)", () => {
    expect(() =>
      balancePercentages(
        ppl([["a", "A"], ["b", "B"]]).map((p, i) => ({
          ...p,
          value: [-100, 10100][i]!,
        })),
      ),
    ).toThrow();
  });

  it("is idempotent: balancing already-balanced participants is a no-op", () => {
    const balanced = balancePercentages(
      ppl([["a", "A"], ["b", "B"], ["c", "C"]]).map((p, i) => ({
        ...p,
        value: [3333, 3333, 3334][i]!,
      })),
    );
    const twice = balancePercentages(balanced);
    expect(twice).toEqual(balanced);
  });

  it("handles single-participant case (n=1) by absorbing remainder into the only person", () => {
    // 100% — no-op
    expect(balancePercentages(
      ppl([["a", "A"]]).map((p) => ({ ...p, value: 10000 })),
    )[0]!.value).toBe(10000);
    // 50% — absorbed up to 100%
    expect(balancePercentages(
      ppl([["a", "A"]]).map((p) => ({ ...p, value: 5000 })),
    )[0]!.value).toBe(10000);
    // Out-of-range (110%) — should throw (per-person > 100% is nonsensical)
    expect(() =>
      balancePercentages(
        ppl([["a", "A"]]).map((p) => ({ ...p, value: 11000 })),
      ),
    ).toThrow();
    // Out-of-range (200%) — should throw
    expect(() =>
      balancePercentages(
        ppl([["a", "A"]]).map((p) => ({ ...p, value: 20000 })),
      ),
    ).toThrow();
  });
});

describe("splitPercentage with auto-balanced inputs", () => {
  it("handles the 3-person 33.33% case after balancePercentages", () => {
    const balanced = balancePercentages(
      ppl([["a", "A"], ["b", "B"], ["c", "C"]]).map((p, i) => ({
        ...p,
        value: [3333, 3333, 3333][i]!,
      })),
    );
    const r = splitPercentage(1000, balanced);
    expect(r.reduce((s, x) => s + x.owedAmountCents, 0)).toBe(1000);
  });

  it("handles 6-person 16.66% case after balancePercentages", () => {
    const balanced = balancePercentages(
      ppl(
        Array.from({ length: 6 }, (_, j) => [`p${j}`, `P${j}`] as [string, string]),
      ).map((p) => ({ ...p, value: 1666 })),
    );
    const r = splitPercentage(1200, balanced);
    expect(r.reduce((s, x) => s + x.owedAmountCents, 0)).toBe(1200);
  });
});

describe("computeTransactionBalances", () => {
  it("returns unpaid when nothing paid", () => {
    const r = computeTransactionBalances({
      splits: [
        { personId: "a", owedAmountCents: 500 },
        { personId: "b", owedAmountCents: 500 },
      ],
      payments: [],
    });
    expect(r.find((x) => x.personId === "a")!.status).toBe("unpaid");
    expect(r.find((x) => x.personId === "a")!.remaining).toBe(500);
  });

  it("returns partial when some paid", () => {
    const r = computeTransactionBalances({
      splits: [{ personId: "a", owedAmountCents: 500 }],
      payments: [{ personId: "a", amountCents: 200 }],
    });
    expect(r[0]!.status).toBe("partial");
    expect(r[0]!.remaining).toBe(300);
  });

  it("returns paid when fully paid", () => {
    const r = computeTransactionBalances({
      splits: [{ personId: "a", owedAmountCents: 500 }],
      payments: [{ personId: "a", amountCents: 500 }],
    });
    expect(r[0]!.status).toBe("paid");
    expect(r[0]!.remaining).toBe(0);
  });

  it("returns paid when overpaid", () => {
    const r = computeTransactionBalances({
      splits: [{ personId: "a", owedAmountCents: 500 }],
      payments: [{ personId: "a", amountCents: 700 }],
    });
    expect(r[0]!.status).toBe("paid");
    expect(r[0]!.remaining).toBe(-200);
  });

  it("sums multiple partial payments", () => {
    const r = computeTransactionBalances({
      splits: [{ personId: "a", owedAmountCents: 1000 }],
      payments: [
        { personId: "a", amountCents: 300 },
        { personId: "a", amountCents: 400 },
      ],
    });
    expect(r[0]!.paid).toBe(700);
    expect(r[0]!.remaining).toBe(300);
    expect(r[0]!.status).toBe("partial");
  });
});

describe("computeProjectBalances", () => {
  it("zero when no transactions", () => {
    const r = computeProjectBalances({
      people: [
        { id: "a", name: "Alice" },
        { id: "b", name: "Bob" },
      ],
      transactions: [],
      splits: [],
    });
    expect(r.people).toHaveLength(2);
    expect(r.pairs).toHaveLength(0);
    expect(r.people.every((p) => p.netCents === 0)).toBe(true);
  });

  it("computes net when one person pays for shared expense", () => {
    // Alice paid $30 for dinner split with Bob ($15 each). No payments yet.
    // Alice's inflow = Bob's $15 share; Alice's outflow = 0 → net +$15.
    // Bob's outflow = $15; Bob's inflow = 0 → net -$15.
    const r = computeProjectBalances({
      people: [
        { id: "a", name: "Alice" },
        { id: "b", name: "Bob" },
      ],
      transactions: [{ id: "t1", paidById: "a" }],
      splits: [
        { transactionId: "t1", personId: "a", owedAmountCents: 1500 },
        { transactionId: "t1", personId: "b", owedAmountCents: 1500 },
      ],
      payments: [],
    });
    expect(r.people.find((p) => p.personId === "a")!.netCents).toBe(1500);
    expect(r.people.find((p) => p.personId === "b")!.netCents).toBe(-1500);
    expect(r.pairs).toHaveLength(1);
    expect(r.pairs[0]!.fromPersonId).toBe("b");
    expect(r.pairs[0]!.toPersonId).toBe("a");
    expect(r.pairs[0]!.cents).toBe(1500);
  });

  it("netted pair balances collapse correctly", () => {
    // Alice paid $20 ($10 each); Bob paid $10 ($5 each). No payments.
    // Net: Bob still owes Alice $5.
    const r = computeProjectBalances({
      people: [
        { id: "a", name: "Alice" },
        { id: "b", name: "Bob" },
      ],
      transactions: [
        { id: "t1", paidById: "a" },
        { id: "t2", paidById: "b" },
      ],
      splits: [
        { transactionId: "t1", personId: "a", owedAmountCents: 1000 },
        { transactionId: "t1", personId: "b", owedAmountCents: 1000 },
        { transactionId: "t2", personId: "a", owedAmountCents: 500 },
        { transactionId: "t2", personId: "b", owedAmountCents: 500 },
      ],
      payments: [],
    });
    expect(r.people.find((p) => p.personId === "a")!.netCents).toBe(500);
    expect(r.people.find((p) => p.personId === "b")!.netCents).toBe(-500);
    expect(r.pairs).toHaveLength(1);
    expect(r.pairs[0]!.fromPersonId).toBe("b");
    expect(r.pairs[0]!.cents).toBe(500);
  });

  it("payments reduce balances correctly", () => {
    // Alice paid $30 ($15 each); Bob paid Bob's $8 partial.
    // After: Bob still owes Alice $7.
    const r = computeProjectBalances({
      people: [
        { id: "a", name: "Alice" },
        { id: "b", name: "Bob" },
      ],
      transactions: [{ id: "t1", paidById: "a" }],
      splits: [
        { transactionId: "t1", personId: "a", owedAmountCents: 1500 },
        { transactionId: "t1", personId: "b", owedAmountCents: 1500 },
      ],
      payments: [{ transactionId: "t1", personId: "b", amountCents: 800 }],
    });
    expect(r.people.find((p) => p.personId === "a")!.netCents).toBe(700);
    expect(r.people.find((p) => p.personId === "b")!.netCents).toBe(-700);
    expect(r.pairs[0]!.cents).toBe(700);
  });

  it("overpayment flips a pair direction", () => {
    // Alice paid $30 ($15 each). Bob overpaid $20 (only owed $15).
    // Now Alice owes Bob $5.
    const r = computeProjectBalances({
      people: [
        { id: "a", name: "Alice" },
        { id: "b", name: "Bob" },
      ],
      transactions: [{ id: "t1", paidById: "a" }],
      splits: [
        { transactionId: "t1", personId: "a", owedAmountCents: 1500 },
        { transactionId: "t1", personId: "b", owedAmountCents: 1500 },
      ],
      payments: [{ transactionId: "t1", personId: "b", amountCents: 2000 }],
    });
    expect(r.pairs[0]!.fromPersonId).toBe("a");
    expect(r.pairs[0]!.toPersonId).toBe("b");
    expect(r.pairs[0]!.cents).toBe(500);
  });

  it("paying your own share is a no-op on balances", () => {
    // Alice paid $30 ($15 each). Alice also records a $15 self-payment.
    // Self-payments don't affect balances (the payer already "owns" their share).
    const base = computeProjectBalances({
      people: [
        { id: "a", name: "Alice" },
        { id: "b", name: "Bob" },
      ],
      transactions: [{ id: "t1", paidById: "a" }],
      splits: [
        { transactionId: "t1", personId: "a", owedAmountCents: 1500 },
        { transactionId: "t1", personId: "b", owedAmountCents: 1500 },
      ],
      payments: [],
    });
    const withSelf = computeProjectBalances({
      people: [
        { id: "a", name: "Alice" },
        { id: "b", name: "Bob" },
      ],
      transactions: [{ id: "t1", paidById: "a" }],
      splits: [
        { transactionId: "t1", personId: "a", owedAmountCents: 1500 },
        { transactionId: "t1", personId: "b", owedAmountCents: 1500 },
      ],
      payments: [{ transactionId: "t1", personId: "a", amountCents: 1500 }],
    });
    expect(withSelf.people.map((p) => p.netCents)).toEqual(
      base.people.map((p) => p.netCents),
    );
    expect(withSelf.pairs.length).toBe(base.pairs.length);
    if (withSelf.pairs[0] && base.pairs[0]) {
      expect(withSelf.pairs[0]!.cents).toBe(base.pairs[0]!.cents);
    }
  });

  it("asymmetric where payer is not part of split group", () => {
    // Alice paid for Charlie + Diana share only ($20 each); Bob not involved.
    const r = computeProjectBalances({
      people: [
        { id: "a", name: "Alice" },
        { id: "b", name: "Bob" },
        { id: "c", name: "Charlie" },
        { id: "d", name: "Diana" },
      ],
      transactions: [{ id: "t1", paidById: "a" }],
      splits: [
        { transactionId: "t1", personId: "c", owedAmountCents: 2000 },
        { transactionId: "t1", personId: "d", owedAmountCents: 2000 },
      ],
    });
    expect(r.pairs).toHaveLength(2);
    const charlieOwes = r.pairs.find((p) => p.fromPersonId === "c")!;
    expect(charlieOwes.toPersonId).toBe("a");
    expect(charlieOwes.cents).toBe(2000);
  });
});

describe("simplifySettlements", () => {
  it("returns at most N-1 transfers", () => {
    const balances = [
      { personId: "a", name: "Alice", netCents: 1000, totalInflowCents: 1000, totalOutflowCents: 0 },
      { personId: "b", name: "Bob", netCents: -500, totalInflowCents: 0, totalOutflowCents: 500 },
      { personId: "c", name: "Charlie", netCents: -500, totalInflowCents: 0, totalOutflowCents: 500 },
    ];
    const t = simplifySettlements(balances);
    expect(t).toHaveLength(2);
    expect(t.reduce((s, x) => s + x.cents, 0)).toBe(1000);
  });

  it("returns empty when balances net to zero", () => {
    const balances = [
      { personId: "a", name: "Alice", netCents: 0, totalInflowCents: 0, totalOutflowCents: 0 },
      { personId: "b", name: "Bob", netCents: 0, totalInflowCents: 0, totalOutflowCents: 0 },
    ];
    expect(simplifySettlements(balances)).toHaveLength(0);
  });
});

describe("matchesCategoryFilter (per-project category filter predicate)", () => {
  const mk = (category: string | null | undefined) => ({ category });

  it("null filter (the 'All' option) matches every transaction", () => {
    expect(matchesCategoryFilter(mk("Food"), null)).toBe(true);
    expect(matchesCategoryFilter(mk(null), null)).toBe(true);
    expect(matchesCategoryFilter(mk(""), null)).toBe(true);
  });

  it("Untagged sentinel matches empty string and null/undefined", () => {
    expect(matchesCategoryFilter(mk(""), CATEGORY_FILTER_UNTAGGED)).toBe(true);
    expect(matchesCategoryFilter(mk(null), CATEGORY_FILTER_UNTAGGED)).toBe(true);
    expect(matchesCategoryFilter(mk(undefined), CATEGORY_FILTER_UNTAGGED)).toBe(true);
    expect(matchesCategoryFilter(mk("   "), CATEGORY_FILTER_UNTAGGED)).toBe(true);
  });

  it("Untagged sentinel does NOT match a real category, even if it contains the word", () => {
    expect(matchesCategoryFilter(mk("Food"), CATEGORY_FILTER_UNTAGGED)).toBe(false);
    expect(matchesCategoryFilter(mk("Untagged"), CATEGORY_FILTER_UNTAGGED)).toBe(false);
  });

  it("exact category match is case-sensitive", () => {
    expect(matchesCategoryFilter(mk("Food"), "Food")).toBe(true);
    expect(matchesCategoryFilter(mk("food"), "Food")).toBe(false);
    expect(matchesCategoryFilter(mk("FOOD"), "Food")).toBe(false);
  });

  it("trims whitespace on both sides", () => {
    expect(matchesCategoryFilter(mk(" Food "), "Food")).toBe(true);
    expect(matchesCategoryFilter(mk("Food"), " Food ")).toBe(true);
  });

  it("does not fuzzy match", () => {
    expect(matchesCategoryFilter(mk("Food & Drink"), "Food")).toBe(false);
    expect(matchesCategoryFilter(mk("Travel/Food"), "Food")).toBe(false);
  });
});

describe("applyCategoryFilter", () => {
  const txns = [
    { id: "t1", category: "Food", amountCents: 1000 },
    { id: "t2", category: "Travel", amountCents: 2000 },
    { id: "t3", category: null, amountCents: 3000 },
    { id: "t4", category: "", amountCents: 4000 },
    { id: "t5", category: "Food", amountCents: 5000 },
  ];

  it("null filter returns the same reference (caller can cheap-compare)", () => {
    expect(applyCategoryFilter(txns, null)).toBe(txns);
  });

  it("exact filter returns a fresh array with only matches", () => {
    const r = applyCategoryFilter(txns, "Food");
    expect(r).not.toBe(txns);
    expect(r.map((t) => t.id)).toEqual(["t1", "t5"]);
  });

  it("Untagged sentinel returns only transactions without a category", () => {
    const r = applyCategoryFilter(txns, CATEGORY_FILTER_UNTAGGED);
    expect(r.map((t) => t.id)).toEqual(["t3", "t4"]);
  });

  it("never mutates the input array", () => {
    const snapshot = txns.map((t) => t.id);
    applyCategoryFilter(txns, "Food");
    applyCategoryFilter(txns, CATEGORY_FILTER_UNTAGGED);
    expect(txns.map((t) => t.id)).toEqual(snapshot);
  });

  it("zero matches returns an empty array, not null", () => {
    expect(applyCategoryFilter(txns, "DoesNotExist")).toEqual([]);
  });
});

describe("computeSpendingBuckets (per-project chart series)", () => {
  // Pin `now` to deterministic UTC moments. With TZ=UTC pinned in
  // vitest.config.ts every assertion below is identical across machines
  // + CI runners. Both `now` and `msOf` use midnight-UTC so the helper's
  // setDate math lands exactly on the same epoch-ms as our expectations.
  const WED_NOW = new Date("2026-08-05T00:00:00Z"); // Wednesday at 00:00 UTC
  const SUN_NOW = new Date("2026-08-09T00:00:00Z"); // Sunday at 00:00 UTC
  const msOf = (iso: string) => new Date(`${iso}T00:00:00Z`).getTime();

  describe("7d branch", () => {
    it("produces 7 daily buckets ending today; bucket[0] = now − 6d; not Sunday-floored", () => {
      const r = computeSpendingBuckets("7d", [], WED_NOW);
      expect(r).toHaveLength(7);
      expect(r[0]!.key).toBe("2026-07-30");
      expect(r[0]!.startMs).toBe(msOf("2026-07-30"));
      expect(r[6]!.key).toBe("2026-08-05");
      expect(r[6]!.startMs).toBe(msOf("2026-08-05"));
      const stride = 86_400_000;
      for (let i = 1; i < r.length; i++) {
        expect(r[i]!.startMs - r[i - 1]!.startMs).toBe(stride);
      }
    });
  });

  describe("30d branch", () => {
    it("produces 30 daily buckets; bucket[0] = now − 29d; not Sunday-floored", () => {
      const r = computeSpendingBuckets("30d", [], WED_NOW);
      expect(r).toHaveLength(30);
      expect(r[0]!.key).toBe("2026-07-07");
      expect(r[29]!.key).toBe("2026-08-05");
      const stride = 86_400_000;
      for (let i = 1; i < r.length; i++) {
        expect(r[i]!.startMs - r[i - 1]!.startMs).toBe(stride);
      }
    });
  });

  describe("90d branch (the only Sunday-floored branch)", () => {
    it("does not shift start when now is already a Sunday", () => {
      const r = computeSpendingBuckets("90d", [], SUN_NOW);
      expect(r).toHaveLength(13);
      // SUN_NOW − 84 days = 2026-05-17 (Sun); getDay() === 0 → no floor shift.
      expect(r[0]!.key).toBe("2026-05-17");
      expect(r[0]!.startMs).toBe(msOf("2026-05-17"));
    });

    it("floors start back to the preceding Sunday when now is mid-week", () => {
      const r = computeSpendingBuckets("90d", [], WED_NOW);
      expect(r).toHaveLength(13);
      // WED_NOW (= 2026-08-05) − 84 days = 2026-05-13 (Wed); getDay()=3 →
      // floor back 3 days → 2026-05-10 (Sun).
      expect(r[0]!.key).toBe("2026-05-10");
      expect(r[0]!.startMs).toBe(msOf("2026-05-10"));
    });

    it("uses a 7-day stride across all 13 buckets", () => {
      const r = computeSpendingBuckets("90d", [], WED_NOW);
      const stride = 7 * 86_400_000;
      for (let i = 1; i < r.length; i++) {
        expect(r[i]!.startMs - r[i - 1]!.startMs).toBe(stride);
      }
      // Last bucket lands on (or just before) WED_NOW's day.
      expect(r[12]!.startMs).toBeLessThanOrEqual(WED_NOW.getTime());
    });
  });

  describe("'all' branch (anchored at the oldest transaction; no Sunday-floor)", () => {
    it("returns a single weekly bucket anchored at now when there are 0 transactions", () => {
      const r = computeSpendingBuckets("all", [], WED_NOW);
      expect(r).toHaveLength(1);
      expect(r[0]!.key).toBe("2026-08-05");
      expect(r[0]!.startMs).toBe(WED_NOW.getTime());
    });

    it("clamps same-day single txn to totalDays=1 (weekly stride, length=1)", () => {
      const r = computeSpendingBuckets(
        "all",
        [{ occurredAt: WED_NOW }],
        WED_NOW,
      );
      expect(r).toHaveLength(1);
      // bucket[0] = firstTxnMs = WED_NOW — NO Sunday-floor, even on Friday.
      expect(r[0]!.startMs).toBe(WED_NOW.getTime());
      expect(r[0]!.key).toBe("2026-08-05");
    });

    it("uses a 7-day stride when totalDays ≤ 180 (exact 180d boundary: 180 NOT > 180)", () => {
      const firstMs = WED_NOW.getTime() - 180 * 86_400_000;
      const r = computeSpendingBuckets(
        "all",
        [{ occurredAt: firstMs }],
        WED_NOW,
      );
      expect(r).toHaveLength(26); // ceil(180/7) = 26
      const stride = 7 * 86_400_000;
      for (let i = 1; i < r.length; i++) {
        expect(r[i]!.startMs - r[i - 1]!.startMs).toBe(stride);
      }
      expect(r[0]!.startMs).toBe(firstMs);
    });

    it("switches to a 30-day stride once totalDays > 180 (exact 181d boundary)", () => {
      const firstMs = WED_NOW.getTime() - 181 * 86_400_000;
      const r = computeSpendingBuckets(
        "all",
        [{ occurredAt: firstMs }],
        WED_NOW,
      );
      expect(r).toHaveLength(7); // ceil(181/30) = 7
      const stride = 30 * 86_400_000;
      for (let i = 1; i < r.length; i++) {
        expect(r[i]!.startMs - r[i - 1]!.startMs).toBe(stride);
      }
      expect(r[0]!.startMs).toBe(firstMs);
    });

    it("clamps a future-dated first txn (negative totalDays) to 1 weekly bucket anchored at the future date", () => {
      const futureMs = WED_NOW.getTime() + 90 * 86_400_000;
      const r = computeSpendingBuckets(
        "all",
        [{ occurredAt: futureMs }],
        WED_NOW,
      );
      // totalDays = −90 → max(1, −90) = 1; stride = 7; ceil(1/7) = 1
      expect(r).toHaveLength(1);
      expect(r[0]!.startMs).toBe(futureMs);
    });

    it("rolls forward across Feb in non-leap years (existing in-page behavior pinned)", () => {
      // Non-leap 2026: now = 2026-08-05 12:00 UTC, first = 2026-02-05
      // 00:00 UTC ⇒ diff floor = 181d ⇒ monthly stride ⇒ 7 buckets.
      const first = msOf("2026-02-05");
      const r = computeSpendingBuckets(
        "all",
        [{ occurredAt: first }],
        WED_NOW,
      );
      expect(r).toHaveLength(7);
      expect(r[0]!.key).toBe("2026-02-05");
      // Feb 5 +30d → Feb has 28 days → surplus = 35 − 28 = 7 → March 7.
      expect(r[1]!.key).toBe("2026-03-07");
      // March 7 +30d → March has 31 days → surplus = 37 − 31 = 6 → April 6.
      expect(r[2]!.key).toBe("2026-04-06");
    });

    it("rolls forward across Feb 29 in leap years (2028 boundary)", () => {
      // Leap 2028: now = 2028-03-15, first = 2027-09-15 ⇒ 182d ⇒ monthly.
      const firstMs = msOf("2027-09-15");
      const r = computeSpendingBuckets(
        "all",
        [{ occurredAt: firstMs }],
        new Date(msOf("2028-03-15")),
      );
      expect(r).toHaveLength(7); // ceil(182/30) = 7
      expect(r[0]!.key).toBe("2027-09-15");
      // Sept 15 +30d → Sept has 30 days → surplus = 45 − 30 = 15 → Oct 15.
      expect(r[1]!.key).toBe("2027-10-15");
      // Oct 15 +30d → Oct has 31 days → surplus = 45 − 31 = 14 → Nov 14.
      expect(r[2]!.key).toBe("2027-11-14");
    });

    it("does NOT Sunday-floor bucket[0] even when stride is weekly (preserves existing behavior)", () => {
      // Anchor first on a Friday (after Sunday) — 90d branch would floor;
      // 'all' must keep the txn-anchored start.
      const firstMs = new Date("2026-08-07T17:00:00Z").getTime(); // Friday
      const nowMs = new Date("2026-08-05T17:00:00Z").getTime(); // Wednesday (so totalDays stays 2 → stride 7)
      const r = computeSpendingBuckets(
        "all",
        [{ occurredAt: firstMs }],
        new Date(nowMs),
      );
      expect(r[0]!.startMs).toBe(firstMs);
      expect(r[0]!.key).toBe("2026-08-07");
    });

    it("finds the oldest txn via min-reduce (order-independent)", () => {
      const txns = [
        { occurredAt: msOf("2026-08-05") },
        { occurredAt: msOf("2026-02-05") }, // oldest — DESC order
        { occurredAt: msOf("2026-06-01") },
      ];
      const rDesc = computeSpendingBuckets("all", txns, WED_NOW);
      const rAsc = computeSpendingBuckets("all", [...txns].reverse(), WED_NOW);
      expect(rDesc[0]!.key).toBe("2026-02-05");
      expect(rDesc[0]!.startMs).toBe(msOf("2026-02-05"));
      // Same result regardless of input order.
      expect(rAsc[0]!.key).toBe(rDesc[0]!.key);
      expect(rAsc[0]!.startMs).toBe(rDesc[0]!.startMs);
    });
  });

  describe("purity + input shapes", () => {
    it("does not mutate `now`", () => {
      const now = new Date(WED_NOW);
      computeSpendingBuckets("90d", [], now);
      expect(now.getTime()).toBe(WED_NOW.getTime());
    });

    it("accepts occurredAt as Date", () => {
      const r = computeSpendingBuckets(
        "all",
        [{ occurredAt: new Date(msOf("2026-02-05")) }],
        WED_NOW,
      );
      expect(r[0]!.key).toBe("2026-02-05");
    });

    it("accepts occurredAt as number (epoch ms)", () => {
      const r = computeSpendingBuckets(
        "all",
        [{ occurredAt: msOf("2026-02-05") }],
        WED_NOW,
      );
      expect(r[0]!.key).toBe("2026-02-05");
    });
  });
});

describe("deterministic rounding guarantees", () => {
  it("equal split is order-independent", () => {
    const people1 = ppl([["c", "Charlie"], ["a", "Alice"], ["b", "Bob"]]);
    const people2 = ppl([["b", "Bob"], ["c", "Charlie"], ["a", "Alice"]]);
    const r1 = splitEqual(1000, people1);
    const r2 = splitEqual(1000, people2);
    expect(new Map(r1.map((x) => [x.personId, x.owedAmountCents])))
      .toEqual(new Map(r2.map((x) => [x.personId, x.owedAmountCents])));
  });

  it("never produces fractional cents across hundreds of random splits", () => {
    for (let i = 0; i < 1000; i++) {
      const n = 2 + Math.floor(Math.random() * 9);
      const total = Math.floor(Math.random() * 100000);
      const people = Array.from({ length: n }, (_, j) => ({
        personId: `p${j}`,
        name: `Person ${String.fromCharCode(65 + j)}`,
      }));
      const r = splitEqual(total, people);
      const sum = r.reduce((s, x) => s + x.owedAmountCents, 0);
      expect(sum).toBe(total);
      expect(r.every((x) => Number.isInteger(x.owedAmountCents))).toBe(true);
    }
  });
});
