import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { buildProjectCSV, buildProjectWorkbook } from "./excel-export";
import { db } from "./db";
import { users, projects, people, transactions, splits } from "./db/schema";

describe("Excel & CSV Export", () => {
  it("generates CSV export with currency amounts divided by 100", async () => {
    const userId = "user-export-" + Date.now();
    await db.insert(users).values({
      id: userId,
      email: `export_user_${Date.now()}@example.com`,
      passwordHash: "hash",
      name: "Export Tester",
      createdAt: new Date(),
    });

    const projId = "proj-" + Date.now();
    await db.insert(projects).values({
      id: projId,
      userId,
      name: "Test Trip Export",
      currencyCode: "INR",
      currencySymbol: "₹",
      createdAt: new Date(),
    });

    const person1Id = "p1-" + Date.now();
    const person2Id = "p2-" + Date.now();
    await db.insert(people).values([
      { id: person1Id, projectId: projId, name: "Alice", colorHex: "#4F46E5", createdAt: new Date() },
      { id: person2Id, projectId: projId, name: "Bob", colorHex: "#10B981", createdAt: new Date() },
    ]);

    const txnId = "t1-" + Date.now();
    await db.insert(transactions).values({
      id: txnId,
      projectId: projId,
      title: "Hotel Booking",
      totalAmountCents: 150000, // ₹1,500.00
      currencyCode: "INR",
      currencySymbol: "₹",
      paidById: person1Id,
      occurredAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(splits).values([
      { id: "s1-" + Date.now(), transactionId: txnId, personId: person1Id, shareType: "equal", shareValue: 0, owedAmountCents: 75000 },
      { id: "s2-" + Date.now(), transactionId: txnId, personId: person2Id, shareType: "equal", shareValue: 0, owedAmountCents: 75000 },
    ]);

    const csv = await buildProjectCSV(projId);
    expect(csv).toContain("Test Trip Export");
    expect(csv).toContain("Hotel Booking");
    expect(csv).toContain("1500.00"); // 150000 / 100
    expect(csv).toContain("750.00"); // 75000 / 100
  });

  it("builds styled Excel workbook buffer without errors", async () => {
    const userId = "user-export-2-" + Date.now();
    await db.insert(users).values({
      id: userId,
      email: `export_user2_${Date.now()}@example.com`,
      passwordHash: "hash",
      name: "Export Tester 2",
      createdAt: new Date(),
    });

    const projId = "proj-2-" + Date.now();
    await db.insert(projects).values({
      id: projId,
      userId,
      name: "Beach Resort",
      currencyCode: "USD",
      currencySymbol: "$",
      createdAt: new Date(),
    });

    const buf = await buildProjectWorkbook(projId);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(100);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    expect(wb.worksheets.length).toBe(7);
    expect(wb.getWorksheet("Summary")).toBeDefined();
    expect(wb.getWorksheet("Transactions")).toBeDefined();
  });
});
