/**
 * Excel export: multi-sheet styled workbook with summary, people,
 * transactions, splits, payments, balances, and simplified settlements.
 *
 * Money formatting: show as "$1,234.56" using each project's currency.
 * Headers: styled with brand background, white bold text, frozen top row.
 */
import ExcelJS from "exceljs";
import { eq, asc, and, inArray, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  projects,
  people,
  transactions,
  splits,
  payments,
} from "@/lib/db/schema";
import {
  computeProjectBalances,
  simplifySettlements,
} from "@/lib/calculations";
import {
  formatCents,
  formatCentsCompact,
  formatDate,
} from "@/lib/utils";

type Person = { id: string; name: string; colorHex: string; isMe: boolean };
type Txn = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  totalAmountCents: number;
  currencyCode: string;
  currencySymbol: string;
  occurredAt: number;
  paidById: string;
};

async function loadProjectData(projectId: string) {
  const proj = await db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!proj) throw new Error("Project not found");
  const ppl = await db.select().from(people).where(eq(people.projectId, projectId)).all();
  const txns = await db
    .select()
    .from(transactions)
    .where(eq(transactions.projectId, projectId))
    .orderBy(asc(transactions.occurredAt))
    .all();
  const txnIds = txns.map((t) => t.id);
  const allSplits =
    txnIds.length === 0
      ? []
      : await db.select().from(splits).where(inArray(splits.transactionId, txnIds)).all();
  const allPayments =
    txnIds.length === 0
      ? []
      : await db.select().from(payments).where(inArray(payments.transactionId, txnIds)).all();
  return { proj, ppl, txns, allSplits, allPayments };
}

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4F46E5" },
    };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCCCCCC" } },
      left: { style: "thin", color: { argb: "FFCCCCCC" } },
      right: { style: "thin", color: { argb: "FFCCCCCC" } },
      bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
    };
  });
  row.height = 22;
}

function setCurrencyFormat(cell: ExcelJS.Cell, currencySymbol: string) {
  cell.numFmt = `"${currencySymbol}"#,##0.00;[Red]-"${currencySymbol}"#,##0.00`;
}

const HEADER_BG = "FF4F46E5";

export async function buildProjectWorkbook(projectId: string): Promise<Buffer> {
  const { proj, ppl, txns, allSplits, allPayments } = await loadProjectData(projectId);

  const personMap = new Map(ppl.map((p) => [p.id, p]));
  const txnMap = new Map<string, Txn>(
    txns.map((t) => [
      t.id,
      {
        id: t.id,
        title: t.title,
        description: t.description,
        category: t.category,
        totalAmountCents: t.totalAmountCents,
        currencyCode: t.currencyCode,
        currencySymbol: t.currencySymbol,
        occurredAt: t.occurredAt instanceof Date ? t.occurredAt.getTime() : Number(t.occurredAt),
        paidById: t.paidById,
      },
    ]),
  );

  // Pre-compute project balances + settlements with this project's data.
  const balances = computeProjectBalances({
    people: ppl.map((p) => ({ id: p.id, name: p.name })),
    transactions: txns.map((t) => ({ id: t.id, paidById: t.paidById })),
    splits: allSplits.map((s) => ({
      transactionId: s.transactionId,
      personId: s.personId,
      owedAmountCents: s.owedAmountCents,
    })),
    payments: allPayments.map((p) => ({
      transactionId: p.transactionId,
      personId: p.personId,
      amountCents: p.amountCents,
    })),
  });
  const settlements = simplifySettlements(balances.people);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Splittrack";
  wb.created = new Date();

  /* Sheet 1: Summary */
  const sum = wb.addWorksheet("Summary");
  sum.columns = [
    { header: "Field", key: "field", width: 28 },
    { header: "Value", key: "value", width: 60 },
  ];
  styleHeader(sum.getRow(1));
  sum.addRow({ field: "Project name", value: proj.name });
  sum.addRow({ field: "Description", value: proj.description ?? "" });
  sum.addRow({ field: "Currency", value: `${proj.currencyCode} (${proj.currencySymbol})` });
  sum.addRow({ field: "Created", value: formatDate(proj.createdAt) });
  sum.addRow({ field: "Number of people", value: ppl.length });
  sum.addRow({ field: "Number of transactions", value: txns.length });
  sum.addRow({
    field: "Total spent",
    value: formatCents(txns.reduce((s, t) => s + t.totalAmountCents, 0), {
      code: proj.currencyCode,
      symbol: proj.currencySymbol,
    }),
  });
  sum.addRow({
    field: "Total still owed",
    value: formatCents(
      Math.max(0, balances.pairs.reduce((s, p) => s + p.cents, 0)),
      { code: proj.currencyCode, symbol: proj.currencySymbol },
    ),
  });
  sum.addRow({ field: "Settled entries", value: allPayments.length });
  // Style currency cells
  ["B7", "B8"].forEach((addr) => {
    setCurrencyFormat(sum.getCell(addr), proj.currencySymbol);
  });

  /* Sheet 2: People */
  const pl = wb.addWorksheet("People");
  pl.columns = [
    { header: "Name", key: "name", width: 28 },
    { header: "Color", key: "color", width: 12 },
    { header: "Is me", key: "isMe", width: 10 },
    { header: "Total inflow", key: "in", width: 18 },
    { header: "Total outflow", key: "out", width: 18 },
    { header: "Net", key: "net", width: 18 },
  ];
  styleHeader(pl.getRow(1));
  for (const p of balances.people) {
    pl.addRow({
      name: p.name,
      color: personMap.get(p.personId)?.colorHex ?? "",
      isMe: personMap.get(p.personId)?.isMe ? "yes" : "",
      in: p.totalInflowCents,
      out: p.totalOutflowCents,
      net: p.netCents,
    });
  }
  // Format currency columns
  pl.getColumn("in").numFmt = `"${proj.currencySymbol}"#,##0.00`;
  pl.getColumn("out").numFmt = `"${proj.currencySymbol}"#,##0.00`;
  pl.getColumn("net").numFmt = `"${proj.currencySymbol}"#,##0.00;[Red]-"${proj.currencySymbol}"#,##0.00`;

  /* Sheet 3: Transactions */
  const tx = wb.addWorksheet("Transactions");
  tx.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Title", key: "title", width: 32 },
    { header: "Category", key: "category", width: 16 },
    { header: "Description", key: "desc", width: 40 },
    { header: "Paid by", key: "paidBy", width: 20 },
    { header: "Total", key: "total", width: 16 },
  ];
  styleHeader(tx.getRow(1));
  for (const t of txns) {
    tx.addRow({
      date: formatDate(t.occurredAt instanceof Date ? t.occurredAt.getTime() : Number(t.occurredAt)),
      title: t.title,
      category: t.category ?? "",
      desc: t.description ?? "",
      paidBy: personMap.get(t.paidById)?.name ?? "?",
      total: t.totalAmountCents,
    });
  }
  tx.getColumn("total").numFmt = `"${proj.currencySymbol}"#,##0.00`;
  // Freeze header row
  tx.views = [{ state: "frozen", ySplit: 1 }];

  /* Sheet 4: Splits */
  const sp = wb.addWorksheet("Splits");
  sp.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Transaction", key: "title", width: 32 },
    { header: "Person", key: "person", width: 20 },
    { header: "Share type", key: "shareType", width: 14 },
    { header: "Share value", key: "shareValue", width: 14 },
    { header: "Owed amount", key: "owed", width: 14 },
  ];
  styleHeader(sp.getRow(1));
  for (const s of allSplits) {
    const txn = txnMap.get(s.transactionId);
    sp.addRow({
      date: txn ? formatDate(txn.occurredAt) : "",
      title: txn?.title ?? "",
      person: personMap.get(s.personId)?.name ?? "?",
      shareType: s.shareType,
      shareValue: s.shareType === "equal" ? "-" : s.shareType === "percentage" ? (s.shareValue / 100).toFixed(2) + "%" : formatCentsCompact(s.shareValue, proj.currencySymbol),
      owed: s.owedAmountCents,
    });
  }
  sp.getColumn("owed").numFmt = `"${proj.currencySymbol}"#,##0.00`;

  /* Sheet 5: Payments */
  const pm = wb.addWorksheet("Payments");
  pm.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Transaction", key: "title", width: 32 },
    { header: "Person", key: "person", width: 20 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Note", key: "note", width: 32 },
  ];
  styleHeader(pm.getRow(1));
  for (const p of allPayments) {
    const txn = txnMap.get(p.transactionId);
    pm.addRow({
      date: formatDate(p.paidAt instanceof Date ? p.paidAt.getTime() : Number(p.paidAt)),
      title: txn?.title ?? "",
      person: personMap.get(p.personId)?.name ?? "?",
      amount: p.amountCents,
      note: p.note ?? "",
    });
  }
  pm.getColumn("amount").numFmt = `"${proj.currencySymbol}"#,##0.00`;

  /* Sheet 6: Balances (pairwise) */
  const ba = wb.addWorksheet("Balances");
  ba.columns = [
    { header: "From", key: "from", width: 24 },
    { header: "Owes", key: "owes", width: 16 },
    { header: "To", key: "to", width: 24 },
    { header: "Amount", key: "amount", width: 16 },
  ];
  styleHeader(ba.getRow(1));
  for (const p of balances.pairs) {
    ba.addRow({ from: p.fromName, owes: "→", to: p.toName, amount: p.cents });
  }
  ba.getColumn("amount").numFmt = `"${proj.currencySymbol}"#,##0.00`;

  /* Sheet 7: Settlements (greedy simplification) */
  const ss = wb.addWorksheet("Settlements");
  ss.columns = [
    { header: "From", key: "from", width: 24 },
    { header: "Pays", key: "owes", width: 16 },
    { header: "To", key: "to", width: 24 },
    { header: "Amount", key: "amount", width: 16 },
  ];
  styleHeader(ss.getRow(1));
  if (settlements.length === 0) {
    ss.addRow({ from: "—", owes: "", to: "Everyone is settled up", amount: 0 });
  } else {
    for (const s of settlements) {
      ss.addRow({ from: s.fromName, owes: "→", to: s.toName, amount: s.cents });
    }
  }
  ss.getColumn("amount").numFmt = `"${proj.currencySymbol}"#,##0.00`;

  // Auto-size-ish: minor padding
  for (const sheet of wb.worksheets) {
    sheet.eachRow({ includeEmpty: false }, (row) => {
      row.alignment = { vertical: "middle" };
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export function buildProjectCSV(projectId: string): Promise<string> {
  return (async () => {
    const { proj, ppl, txns, allSplits, allPayments } = await loadProjectData(projectId);
    const personMap = new Map(ppl.map((p) => [p.id, p]));
    const txnMap = new Map(txns.map((t) => [t.id, t]));
    const lines: string[][] = [
      ["Project", proj.name],
      ["Currency", proj.currencyCode],
      [],
      ["Date", "Title", "Category", "Paid by", "Total", "Person", "Share type", "Share value", "Owed (cents)", "Payments (cents)", "Payment date", "Payment note"],
    ];
    for (const t of txns) {
      const txnSplits = allSplits.filter((s) => s.transactionId === t.id);
      const txnPayments = allPayments.filter((p) => p.transactionId === t.id);
      if (txnSplits.length === 0) {
        lines.push([
          formatDate(t.occurredAt instanceof Date ? t.occurredAt.getTime() : Number(t.occurredAt)),
          t.title,
          t.category ?? "",
          personMap.get(t.paidById)?.name ?? "",
          String(t.totalAmountCents / 100),
          "", "", "", "", "", "", "",
        ]);
        continue;
      }
      for (const s of txnSplits) {
        const matchingPayments = txnPayments.filter((p) => p.personId === s.personId);
        if (matchingPayments.length === 0) {
          lines.push([
            formatDate(t.occurredAt instanceof Date ? t.occurredAt.getTime() : Number(t.occurredAt)),
            t.title,
            t.category ?? "",
            personMap.get(t.paidById)?.name ?? "",
            String(t.totalAmountCents / 100),
            personMap.get(s.personId)?.name ?? "?",
            s.shareType,
            s.shareType === "percentage" ? String(s.shareValue / 100) + "%" : String(s.shareValue / 100),
            String(s.owedAmountCents / 100),
            "", "", "",
          ]);
        } else {
          for (const p of matchingPayments) {
            lines.push([
              formatDate(t.occurredAt instanceof Date ? t.occurredAt.getTime() : Number(t.occurredAt)),
              t.title,
              t.category ?? "",
              personMap.get(t.paidById)?.name ?? "",
              String(t.totalAmountCents / 100),
              personMap.get(s.personId)?.name ?? "?",
              s.shareType,
              s.shareType === "percentage" ? String(s.shareValue / 100) + "%" : String(s.shareValue / 100),
              String(s.owedAmountCents / 100),
              String(p.amountCents / 100),
              formatDate(p.paidAt instanceof Date ? p.paidAt.getTime() : Number(p.paidAt)),
              p.note ?? "",
            ]);
          }
        }
      }
    }
    return lines
      .map((row) =>
        row
          .map((cell) => {
            const s = String(cell);
            if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
            return s;
          })
          .join(","),
      )
      .join("\n");
  })();
}

export async function buildAllProjectsWorkbook(userId: string): Promise<Buffer> {
  const userProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.createdAt))
    .all();

  const wb = new ExcelJS.Workbook();
  wb.creator = "Splittrack";
  wb.created = new Date();
  wb.created = new Date();

  const index = wb.addWorksheet("Projects");
  index.columns = [
    { header: "Project", key: "name", width: 30 },
    { header: "Currency", key: "cur", width: 10 },
    { header: "Created", key: "created", width: 14 },
    { header: "Description", key: "desc", width: 40 },
  ];
  styleHeader(index.getRow(1));
  for (const p of userProjects) {
    index.addRow({
      name: p.name,
      cur: p.currencyCode,
      created: formatDate(p.createdAt),
      desc: p.description ?? "",
    });
  }

  for (const p of userProjects) {
    const inner = await buildProjectWorkbook(p.id);
    const innerWb = new ExcelJS.Workbook();
    await innerWb.xlsx.load(inner as unknown as ArrayBuffer);
    for (const ws of innerWb.worksheets) {
      const copy = wb.addWorksheet(`${p.name} — ${ws.name}`.slice(0, 31));
      ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        const newRow = copy.getRow(rowNumber);
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          newRow.getCell(colNumber).value = cell.value;
          if (cell.font) newRow.getCell(colNumber).font = cell.font;
          if (cell.fill) newRow.getCell(colNumber).fill = cell.fill;
          if (cell.numFmt) newRow.getCell(colNumber).numFmt = cell.numFmt;
        });
      });
      copy.columns = ws.columns;
      copy.views = [{ state: "frozen", ySplit: 1 }];
    }
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
