import { describe, it, expect } from "vitest";
import {
  computeSplits,
  balancePercentages,
} from "./index";

describe("percentage share calculation & auto-balancing", () => {
  it("balances typical 3-way split (33.33% x 3) so sum is 10000 bp", () => {
    const participants = [
      { personId: "p1", name: "Alice", value: 3333 },
      { personId: "p2", name: "Bob", value: 3333 },
      { personId: "p3", name: "Charlie", value: 3333 },
    ];
    const balanced = balancePercentages(participants);
    expect(balanced.reduce((acc, curr) => acc + curr.value, 0)).toBe(10000);
    expect(balanced[2].value).toBe(3334);

    const splits = computeSplits(3000, "percentage", balanced);
    expect(splits.reduce((acc, curr) => acc + curr.owedAmountCents, 0)).toBe(3000);
  });

  it("handles exact 50% / 50% split seamlessly", () => {
    const participants = [
      { personId: "p1", name: "Alice", value: 5000 },
      { personId: "p2", name: "Bob", value: 5000 },
    ];
    const balanced = balancePercentages(participants);
    const splits = computeSplits(5000, "percentage", balanced);
    expect(splits[0].owedAmountCents).toBe(2500);
    expect(splits[1].owedAmountCents).toBe(2500);
  });

  it("handles uneven percentage split (60% / 40%)", () => {
    const participants = [
      { personId: "p1", name: "Alice", value: 6000 },
      { personId: "p2", name: "Bob", value: 4000 },
    ];
    const splits = computeSplits(10000, "percentage", participants);
    expect(splits.find((s) => s.personId === "p1")?.owedAmountCents).toBe(6000);
    expect(splits.find((s) => s.personId === "p2")?.owedAmountCents).toBe(4000);
  });
});
