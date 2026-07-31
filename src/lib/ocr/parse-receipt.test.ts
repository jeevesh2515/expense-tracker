import { describe, it, expect } from "vitest";
import { parseReceiptText } from "./parse-receipt";

describe("parseReceiptText", () => {
  it("parses Google Pay / UPI payment screenshot text", () => {
    const rawText = `
      Paid ₹1,500.00
      To Grand Seafood Restaurant
      UPI Ref ID: 320491823912
      Date: 28/07/2026 14:32
      Split between 3 people
    `;

    const result = parseReceiptText(rawText);
    expect(result.title).toBe("Grand Seafood Restaurant");
    expect(result.amount).toBe(150000); // 1500 * 100
    expect(result.date).toBe("2026-07-28");
    expect(result.category).toBe("Food");
    expect(result.peopleCount).toBe(3);
  });

  it("parses PhonePe / Paytm payment with 4-way split", () => {
    const rawText = `
      You sent ₹4,500 to Villa Booking Host
      Transaction Successful
      25/07/2026
      Category: Hotel Stay
      4-way split
    `;

    const result = parseReceiptText(rawText);
    expect(result.title).toBe("Villa Booking Host");
    expect(result.amount).toBe(450000);
    expect(result.date).toBe("2026-07-25");
    expect(result.category).toBe("Lodging");
    expect(result.peopleCount).toBe(4);
  });

  it("extracts participant count from word numbers (e.g. split among three friends)", () => {
    const rawText = `
      Uber Trip to Airport
      Total: ₹850.00
      Date: 15/06/2026
      Split among three friends
    `;

    const result = parseReceiptText(rawText);
    expect(result.title).toBe("Uber Trip to Airport");
    expect(result.amount).toBe(85000);
    expect(result.date).toBe("2026-06-15");
    expect(result.category).toBe("Travel");
    expect(result.peopleCount).toBe(3);
  });

  it("handles standard receipt without explicit split count gracefully", () => {
    const rawText = `
      Starbucks Coffee
      Total ₹420.00
      Paid via UPI
    `;

    const result = parseReceiptText(rawText);
    expect(result.title).toBe("Starbucks Coffee");
    expect(result.amount).toBe(42000);
    expect(result.category).toBe("Food");
    expect(result.peopleCount).toBeNull();
  });
});
