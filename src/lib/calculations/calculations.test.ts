import { describe, it, expect } from "vitest";
import {
  splitEqual,
  splitExact,
  splitPercentage,
  computeSplits,
  computeTransactionBalances,
  computeProjectBalances,
  simplifySettlements,
} from "./index";

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
