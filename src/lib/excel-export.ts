/**
 * Excel export: multi-sheet styled workbook with summary, people,
 * transactions, splits, payments, balances, and simplified settlements.
 *
 * Money formatting: convert cents to currency values (/100) with
 * Excel numFmt '"' + symbol + '"#,##0.00;[Red]-"' + symbol + '"#,##0.00'.
 * Headers: styled with brand indigo background, white bold text, frozen top row.
 * Views: explicit gridlines enabled on all worksheets.
 */
import ExcelJS from "exceljs";
import { eq, asc, inArray, desc } from "drizzle-orm";
import { db } from "./db";
import {
  projects,
  people,
  transactions,
  splits,
  payments,
} from "./db/schema";
import {
  computeProjectBalances,
  simplifySettlements,
} from "./calculations";
import {
  formatCents,
  formatDate,
} from "./utils";

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

const BRAND_INDIGO = "FF4F46E5";
const LIGHT_BORDER = "FFE5E7EB";

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BRAND_INDIGO },
    };
    cell.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = {
      top: { style: "thin", color: { argb: "FF3730A3" } },
      left: { style: "thin", color: { argb: "FF3730A3" } },
      right: { style: "thin", color: { argb: "FF3730A3" } },
      bottom: { style: "thin", color: { argb: "FF3730A3" } },
    };
  });
  row.height = 26;
}

function applySheetFormatting(sheet: ExcelJS.Worksheet, currencySymbol: string) {
  sheet.views = [{ showGridLines: true, state: "frozen", ySplit: 1 }];

  // Apply row fonts, vertical alignment, and cell borders
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // Header already styled
    row.height = 22;
    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.font = cell.font || { name: "Segoe UI", size: 10 };
      cell.alignment = cell.alignment || { vertical: "middle", horizontal: "left" };
      cell.border = {
        top: { style: "thin", color: { argb: LIGHT_BORDER } },
        left: { style: "thin", color: { argb: LIGHT_BORDER } },
        right: { style: "thin", color: { argb: LIGHT_BORDER } },
        bottom: { style: "thin", color: { argb: LIGHT_BORDER } },
      };
    });
  });

  // Dynamic column width calculation
  sheet.columns.forEach((col) => {
    let maxLen = 12;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const valStr = cell.value != null ? String(cell.value) : "";
      if (valStr.length > maxLen) maxLen = valStr.length;
    });
    col.width = Math.min(Math.max(maxLen + 4, 14), 50);
  });
}

function getCurrencyNumFmt(symbol: string): string {
  return `"${symbol}"#,##0.00;[Red]-"${symbol}"#,##0.00;"${symbol}"0.00`;
}

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

  const numFmt = getCurrencyNumFmt(proj.currencySymbol);

  /* Sheet 1: Summary */
  const sum = wb.addWorksheet("Summary");
  sum.columns = [
    { header: "Project Metric", key: "field", width: 28 },
    { header: "Details / Value", key: "value", width: 45 },
  ];
  styleHeader(sum.getRow(1));

  sum.addRow({ field: "Project Name", value: proj.name });
  sum.addRow({ field: "Description", value: proj.description ?? "N/A" });
  sum.addRow({ field: "Currency", value: `${proj.currencyCode} (${proj.currencySymbol})` });
  sum.addRow({ field: "Created Date", value: formatDate(proj.createdAt) });
  sum.addRow({ field: "Total Participants", value: ppl.length });
  sum.addRow({ field: "Total Transactions", value: txns.length });
  
  const totalSpentRow = sum.addRow({
    field: "Total Spent",
    value: txns.reduce((s, t) => s + t.totalAmountCents, 0) / 100,
  });
  totalSpentRow.getCell("value").numFmt = numFmt;

  const totalOwedRow = sum.addRow({
    field: "Total Still Owed",
    value: Math.max(0, balances.pairs.reduce((s, p) => s + p.cents, 0)) / 100,
  });
  totalOwedRow.getCell("value").numFmt = numFmt;

  sum.addRow({ field: "Settled Payments Count", value: allPayments.length });
  applySheetFormatting(sum, proj.currencySymbol);

  /* Sheet 2: People */
  const pl = wb.addWorksheet("People");
  pl.columns = [
    { header: "Name", key: "name", width: 24 },
    { header: "Color", key: "color", width: 12 },
    { header: "Is Me", key: "isMe", width: 10 },
    { header: "Total Inflow (Paid Out)", key: "in", width: 22 },
    { header: "Total Outflow (Share Owed)", key: "out", width: 24 },
    { header: "Net Balance", key: "net", width: 20 },
  ];
  styleHeader(pl.getRow(1));

  for (const p of balances.people) {
    const row = pl.addRow({
      name: p.name,
      color: personMap.get(p.personId)?.colorHex ?? "",
      isMe: personMap.get(p.personId)?.isMe ? "Yes" : "No",
      in: p.totalInflowCents / 100,
      out: p.totalOutflowCents / 100,
      net: p.netCents / 100,
    });
    row.getCell("in").numFmt = numFmt;
    row.getCell("out").numFmt = numFmt;
    row.getCell("net").numFmt = numFmt;
  }
  applySheetFormatting(pl, proj.currencySymbol);

  /* Sheet 3: Transactions */
  const tx = wb.addWorksheet("Transactions");
  tx.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Title", key: "title", width: 30 },
    { header: "Category", key: "category", width: 16 },
    { header: "Description", key: "desc", width: 36 },
    { header: "Paid By", key: "paidBy", width: 20 },
    { header: "Total Amount", key: "total", width: 18 },
  ];
  styleHeader(tx.getRow(1));

  for (const t of txns) {
    const row = tx.addRow({
      date: formatDate(t.occurredAt instanceof Date ? t.occurredAt.getTime() : Number(t.occurredAt)),
      title: t.title,
      category: t.category ?? "-",
      desc: t.description ?? "-",
      paidBy: personMap.get(t.paidById)?.name ?? "?",
      total: t.totalAmountCents / 100,
    });
    row.getCell("total").numFmt = numFmt;
  }
  applySheetFormatting(tx, proj.currencySymbol);

  /* Sheet 4: Splits */
  const sp = wb.addWorksheet("Splits");
  sp.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Transaction", key: "title", width: 30 },
    { header: "Person", key: "person", width: 20 },
    { header: "Share Type", key: "shareType", width: 14 },
    { header: "Share Value", key: "shareValue", width: 16 },
    { header: "Owed Amount", key: "owed", width: 18 },
  ];
  styleHeader(sp.getRow(1));

  for (const s of allSplits) {
    const txn = txnMap.get(s.transactionId);
    let displayShareValue: string | number = "-";
    if (s.shareType === "percentage") {
      displayShareValue = `${(s.shareValue / 100).toFixed(2)}%`;
    } else if (s.shareType === "exact") {
      displayShareValue = s.shareValue / 100;
    }

    const row = sp.addRow({
      date: txn ? formatDate(txn.occurredAt) : "-",
      title: txn?.title ?? "-",
      person: personMap.get(s.personId)?.name ?? "?",
      shareType: s.shareType,
      shareValue: displayShareValue,
      owed: s.owedAmountCents / 100,
    });
    row.getCell("owed").numFmt = numFmt;
    if (typeof displayShareValue === "number") {
      row.getCell("shareValue").numFmt = numFmt;
    }
  }
  applySheetFormatting(sp, proj.currencySymbol);

  /* Sheet 5: Payments */
  const pm = wb.addWorksheet("Payments");
  pm.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Transaction", key: "title", width: 30 },
    { header: "Person", key: "person", width: 20 },
    { header: "Amount Paid", key: "amount", width: 18 },
    { header: "Note", key: "note", width: 32 },
  ];
  styleHeader(pm.getRow(1));

  for (const p of allPayments) {
    const txn = txnMap.get(p.transactionId);
    const row = pm.addRow({
      date: formatDate(p.paidAt instanceof Date ? p.paidAt.getTime() : Number(p.paidAt)),
      title: txn?.title ?? "-",
      person: personMap.get(p.personId)?.name ?? "?",
      amount: p.amountCents / 100,
      note: p.note ?? "-",
    });
    row.getCell("amount").numFmt = numFmt;
  }
  applySheetFormatting(pm, proj.currencySymbol);

  /* Sheet 6: Balances (Pairwise) */
  const ba = wb.addWorksheet("Balances");
  ba.columns = [
    { header: "From (Debtor)", key: "from", width: 24 },
    { header: "Status", key: "owes", width: 12 },
    { header: "To (Creditor)", key: "to", width: 24 },
    { header: "Amount Owed", key: "amount", width: 18 },
  ];
  styleHeader(ba.getRow(1));

  for (const p of balances.pairs) {
    const row = ba.addRow({ from: p.fromName, owes: "→ owes", to: p.toName, amount: p.cents / 100 });
    row.getCell("amount").numFmt = numFmt;
  }
  applySheetFormatting(ba, proj.currencySymbol);

  /* Sheet 7: Settlements (Minimum Payment Transfers) */
  const ss = wb.addWorksheet("Settlements");
  ss.columns = [
    { header: "From (Debtor)", key: "from", width: 24 },
    { header: "Action", key: "owes", width: 12 },
    { header: "To (Creditor)", key: "to", width: 24 },
    { header: "Suggested Transfer", key: "amount", width: 20 },
  ];
  styleHeader(ss.getRow(1));

  if (settlements.length === 0) {
    ss.addRow({ from: "—", owes: "", to: "Everyone is fully settled up", amount: 0 });
  } else {
    for (const s of settlements) {
      const row = ss.addRow({ from: s.fromName, owes: "→ pays", to: s.toName, amount: s.cents / 100 });
      row.getCell("amount").numFmt = numFmt;
    }
  }
  applySheetFormatting(ss, proj.currencySymbol);

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export function buildProjectCSV(projectId: string): Promise<string> {
  return (async () => {
    const { proj, ppl, txns, allSplits, allPayments } = await loadProjectData(projectId);
    const personMap = new Map(ppl.map((p) => [p.id, p]));
    const lines: string[][] = [
      ["Project Name", proj.name],
      ["Currency", `${proj.currencyCode} (${proj.currencySymbol})`],
      ["Export Date", formatDate(new Date())],
      [],
      [
        "Date",
        "Transaction Title",
        "Category",
        "Paid By",
        "Total Amount",
        "Participant",
        "Share Type",
        "Share Value",
        "Owed Amount",
        "Payment Amount",
        "Payment Date",
        "Payment Note",
      ],
    ];

    for (const t of txns) {
      const txnSplits = allSplits.filter((s) => s.transactionId === t.id);
      const txnPayments = allPayments.filter((p) => p.transactionId === t.id);
      const totalDisplay = (t.totalAmountCents / 100).toFixed(2);

      if (txnSplits.length === 0) {
        lines.push([
          formatDate(t.occurredAt instanceof Date ? t.occurredAt.getTime() : Number(t.occurredAt)),
          t.title,
          t.category ?? "",
          personMap.get(t.paidById)?.name ?? "",
          totalDisplay,
          "", "", "", "", "", "", "",
        ]);
        continue;
      }

      for (const s of txnSplits) {
        const matchingPayments = txnPayments.filter((p) => p.personId === s.personId);
        const shareValDisplay =
          s.shareType === "percentage"
            ? `${(s.shareValue / 100).toFixed(2)}%`
            : (s.shareValue / 100).toFixed(2);
        const owedDisplay = (s.owedAmountCents / 100).toFixed(2);

        if (matchingPayments.length === 0) {
          lines.push([
            formatDate(t.occurredAt instanceof Date ? t.occurredAt.getTime() : Number(t.occurredAt)),
            t.title,
            t.category ?? "",
            personMap.get(t.paidById)?.name ?? "",
            totalDisplay,
            personMap.get(s.personId)?.name ?? "?",
            s.shareType,
            shareValDisplay,
            owedDisplay,
            "0.00",
            "",
            "",
          ]);
        } else {
          for (const p of matchingPayments) {
            lines.push([
              formatDate(t.occurredAt instanceof Date ? t.occurredAt.getTime() : Number(t.occurredAt)),
              t.title,
              t.category ?? "",
              personMap.get(t.paidById)?.name ?? "",
              totalDisplay,
              personMap.get(s.personId)?.name ?? "?",
              s.shareType,
              shareValDisplay,
              owedDisplay,
              (p.amountCents / 100).toFixed(2),
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

  const index = wb.addWorksheet("Projects Index");
  index.columns = [
    { header: "Project Name", key: "name", width: 32 },
    { header: "Currency", key: "cur", width: 12 },
    { header: "Created Date", key: "created", width: 16 },
    { header: "Description", key: "desc", width: 45 },
  ];
  styleHeader(index.getRow(1));

  for (const p of userProjects) {
    index.addRow({
      name: p.name,
      cur: p.currencyCode,
      created: formatDate(p.createdAt),
      desc: p.description ?? "-",
    });
  }
  applySheetFormatting(index, "₹");

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
      applySheetFormatting(copy, p.currencySymbol);
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

