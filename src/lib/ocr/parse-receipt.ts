/**
 * Parse extracted OCR text from a receipt image to identify transaction details.
 * Returns structured data that can pre-fill the transaction form.
 *
 * India-focused support:
 * - UPI payment screenshots (Paytm, GPay, PhonePe, BHIM, Amazon Pay, Mobikwik)
 * - Bank statements (SBI, HDFC, ICICI, Axis, etc.)
 * - Handwritten notes
 * - Standard receipts
 */

export type ExtractedReceipt = {
  title: string | null;
  amount: number | null; // in paise (cents)
  date: string | null; // ISO date string (YYYY-MM-DD)
  category: string | null;
  recipient: string | null; // UPI recipient name or VPA
  rawText: string;
};

// ============================================================
// SHARED INDIAN UPI PATTERNS (used across all apps)
// ============================================================

/** Amount patterns - common across all UPI apps */
const INDIAN_UPI_AMOUNT_PATTERNS: RegExp[] = [
  /(?:paid|sent|received|transferred|debited|credited|successfully)\s*(?:₹|rs\.?|inr)?\s*([\d,]+\.?\d{0,2})/i,
  /(?:₹|rs\.?|inr)\s*([\d,]+\.?\d{0,2})/i,
  /amount\s*[:\s]*(?:₹|rs\.?|inr)?\s*([\d,]+\.?\d{0,2})/i,
  /(?:total|sum|amount|payment)\s*(?:of\s*)?(?:₹|rs\.?|inr)?\s*([\d,]+\.?\d{0,2})/i,
  /you\s+(?:paid|sent|transferred)\s*(?:₹|rs\.?|inr)?\s*([\d,]+\.?\d{0,2})/i,
];

/** Date patterns - DD/MM/YYYY prioritized for Indian context */
const INDIAN_UPI_DATE_PATTERNS: RegExp[] = [
  /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
  /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+\d{1,2}:\d{2}\s*(?:am|pm)/i,
  /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})\b/,
  /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{2,4})/i,
  /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{1,2}),?\s+(\d{2,4})/i,
  /(today|yesterday)/i,
];

/** Title patterns - common across all UPI apps */
const INDIAN_UPI_TITLE_PATTERNS: RegExp[] = [
  /(?:paid|sent|transferred|payment\s+to)\s+(.+?)(?:\n|$)/i,
  /(?:to|paid\s*to|sent\s*to|transferred\s*to)\s+(.+?)(?:\n|$)/i,
  /(?:from|received\s*from)\s+(.+?)(?:\n|$)/i,
  /(?:vpa|upi\s*id)\s*[:\s]*(.+?)(?:\n|$)/i,
  /(?:payment|money)\s+(?:to|for)\s+(.+?)(?:\n|$)/i,
];

/** Recipient patterns - for extracting UPI recipient name or VPA */
const INDIAN_UPI_RECIPIENT_PATTERNS: RegExp[] = [
  /(?:to|paid\s*to|sent\s*to|transferred\s*to)\s+(.+?)(?:\n|$)/i,
  /(?:vpa|upi\s*id)\s*[:\s]*(.+?)(?:\n|$)/i,
  /@\w+\.?(?:bank|upi|paytm|okaxis|oksbi|okhdfc|okicici|ybl|google|amazon|phonepe|bhim|icici|axis|hdfc|sbi|kotak|pnb|bob|canara|union|indian|yes|federal|indusind)/i,
];

// ============================================================
// NOISE PATTERNS (for title extraction)
// ============================================================

const NOISE_PATTERNS: RegExp[] = [
  /^\d+$/,
  /^(receipt|invoice|bill|order|transaction|date|time|cashier|register|store|#)/i,
  /^(tel|fax|phone|address|city|state|zip|country)/i,
  /^[\-=*]+$/,
  /^\s*$/,
  /^(thank you|welcome|visit|feedback|survey)/i,
  /^(visa|mastercard|amex|cash|credit|debit|change|total|subtotal|tax|tip)/i,
  /^(account|routing|swift|iban|bic)/i,
  /^(statement|period|from|opening|closing|balance)/i,
  /^(payment|minimum|due|late|fee|interest|charge)/i,
  /^(debited|credited|settled|pending|failed|reversed)/i,
  /^(upi|vpa|neft|imps|rtgs)/i,
  /^(ref|reference|transaction\s*id)/i,
  /^(transaction\s*id|reference\s*number|utr\s*number)/i,
  /^(bank\s*reference|check\s*balance|view\s*details)/i,
  /^(upi\s*id|bank\s*account|account\s*number)/i,
  /^(paid\s*on|sent\s*on|received\s*on)/i,
];

// ============================================================
// INDIAN CATEGORY KEYWORDS
// ============================================================

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Food: [
    "restaurant", "cafe", "coffee", "food", "meal", "dinner", "lunch", "breakfast",
    "pizza", "sushi", "burger", "starbucks", "mcdonald", "subway", "kfc", "domino",
    "zomato", "swiggy", "uber eats", "dunkin", "bakery", "bistro", "grill", "kitchen",
    "diner", "eatery", "cuisine", "takeout", "delivery", "snack", "drink", "tea",
    "juice", "chaat", "dhaba", "mess", "canteen", "tiffin", "paratha", "biryani",
    "chai", "samosa", "pani puri", "vada pav", "dosa", "idli", "chole bhature",
  ],
  Travel: [
    "uber", "ola", "rapido", "taxi", "cab", "flight", "airline", "airport", "train",
    "bus", "metro", "transit", "parking", "toll", "fuel", "petrol", "diesel",
    "irctc", "redbus", "makemytrip", "goibibo", "yatra", "rental", "auto",
    "rickshaw", "bike", "drive", "trip", "journey", "railway",
  ],
  Lodging: [
    "hotel", "motel", "airbnb", "booking", "inn", "resort", "hostel", "lodge",
    "olerooms", "oyo", "fabhotels", "treebo", "makemytrip", "goibibo", "yatra",
    "stay", "night", "room", "suite", "apartment", "vacation",
  ],
  Shopping: [
    "amazon", "flipkart", "myntra", "ajio", "meesho", "snapdeal", "paytm mall",
    "jio mart", "bigbasket", "blinkit", "zepto", "instamart", "dmart",
    "mall", "store", "shop", "market", "grocery", "retail", "outlet",
    "electronics", "clothing", "furniture", "home", "bazaar",
  ],
  Entertainment: [
    "movie", "cinema", "netflix", "hotstar", "prime video", "jio cinema",
    "spotify", "concert", "theater", "game", "ticket", "show", "event",
    "bookmyshow", "paytm insider", "insider", "streaming", "music",
  ],
  Health: [
    "pharmacy", "apollo", "medplus", "netmeds", "pharmeasy", "1mg",
    "doctor", "hospital", "clinic", "medical", "dental", "vision",
    "gym", "fitness", "health", "wellness", "therapy", "prescription",
    "medicine", "drug", "supplement", "vitamin",
  ],
  Utilities: [
    "electric", "water", "gas bill", "internet", "phone", "broadband",
    "jio", "airtel", "vi", "bsnl", "tata play", "dish tv", "videocon",
    "utility", "cable", "mobile", "recharge", "data", "plan",
  ],
  Education: [
    "school", "college", "university", "course", "class", "tuition",
    "book", "textbook", "training", "workshop", "seminar", "learning",
    "education", "byju", "unacademy", "vedantu", "physics wallah",
  ],
  Finance: [
    "bank", "transfer", "payment", "fee", "charge", "interest", "loan",
    "insurance", "premium", "deductible", "tax", "audit", "accounting",
    "mutual fund", "sip", "investment", "stock", "trading", "demat",
  ],
};

// ============================================================
// INDIAN BANK STATEMENT DETECTION
// ============================================================

const INDIAN_BANK_NAMES = [
  "sbi", "state bank", "hdfc", "icici", "axis", "kotak", "pnb",
  "bank of baroda", "bob", "canara", "union bank", "indian bank",
  "idbi", "yes bank", "federal bank", "south indian bank",
  "karur vysya", "city union", "dhanlaxmi", "indusind",
  "bandhan", "rbl", "idfc first", "au small finance",
  "equitas", "ujjivan", "janalakshmi",
];

const BANK_STATEMENT_PATTERNS = [
  /bank\s*statement/i,
  /account\s*(?:statement|summary)/i,
  /transaction\s*(?:history|details|log)/i,
  /debit\s*(?:card|transaction)/i,
  /credit\s*(?:card|transaction)/i,
  /statement\s*period/i,
  /opening\s*balance/i,
  /closing\s*balance/i,
  /minimum\s*payment/i,
  /payment\s*due\s*date/i,
  /utr\s*[:\s]*\d+/i,
  /neft|imps|rtgs/i,
  /ifsc\s*[:\s]*[A-Z]{4}0[A-Z0-9]{6}/i,
];

function isBankStatement(text: string): boolean {
  const lower = text.toLowerCase();
  return INDIAN_BANK_NAMES.some((bank) => lower.includes(bank)) ||
    BANK_STATEMENT_PATTERNS.some((p) => p.test(lower));
}

// ============================================================
// HANDWRITTEN NOTE DETECTION
// ============================================================

const HANDWRITTEN_INDICATORS = [
  /note|memo|reminder|todo|list/i,
  /bought|spent|paid|owe|owed/i,
  /for|from|to|with/i,
  /lunch|dinner|coffee|groceries|rent|utilities/i,
];

function isHandwrittenNote(text: string): boolean {
  const lower = text.toLowerCase();
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  return lines.length <= 5 && lines.some((l) => HANDWRITTEN_INDICATORS.some((p) => p.test(l)));
}

// ============================================================
// EXTRACTION HELPERS
// ============================================================

function parseAmount(str: string): number | null {
  const cleaned = str.replace(/,/g, "");
  const num = parseFloat(cleaned);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num * 100); // Convert to paise/cents
}

function parseDateMatch(match: RegExpMatchArray): string | null {
  const monthNames: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };

  if (match[1] && /^(today|yesterday)$/i.test(match[1])) {
    const d = new Date();
    if (/yesterday/i.test(match[1])) d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  if (match[1] && match[2] && match[3] && match[3].length === 4) {
    const d = parseInt(match[1]);
    const m = parseInt(match[2]);
    const y = parseInt(match[3]);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 2000 && y <= 2099) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  if (match[1] && match[2] && match[3] && match[3].length === 2) {
    const d = parseInt(match[1]);
    const m = parseInt(match[2]);
    const y = 2000 + parseInt(match[3]);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 2000 && y <= 2099) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  if (match[1] && match[1].length === 4 && match[2] && match[3]) {
    const y = parseInt(match[1]);
    const m = parseInt(match[2]);
    const d = parseInt(match[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2099) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  if (match[1] && match[2] && match[3]) {
    let monthStr = match[1].toLowerCase().slice(0, 3);
    let day: number;
    let year: number;

    if (monthNames[monthStr]) {
      day = parseInt(match[2]);
      year = parseInt(match[3]);
    } else {
      monthStr = match[2].toLowerCase().slice(0, 3);
      if (monthNames[monthStr]) {
        day = parseInt(match[1]);
        year = parseInt(match[3]);
      } else {
        return null;
      }
    }

    const m = monthNames[monthStr];
    if (m && day >= 1 && day <= 31 && year >= 2000 && year <= 2099) {
      return `${year}-${m}-${String(day).padStart(2, "0")}`;
    }
  }

  return null;
}

function extractAmount(text: string): number | null {
  if (isBankStatement(text)) {
    const bankAmountPatterns = [
      /(?:debit|charge|payment|withdrawal)\s*[:\s]*[\$₹€£¥]?\s*([\d,]+\.?\d{0,2})/i,
      /(?:credit|deposit|refund)\s*[:\s]*[\$₹€£¥]?\s*([\d,]+\.?\d{0,2})/i,
      /(?:amount|sum|total)\s*[:\s]*[\$₹€£¥]?\s*([\d,]+\.?\d{0,2})/i,
    ];
    for (const pattern of bankAmountPatterns) {
      const match = text.match(pattern);
      if (match) {
        const amount = parseAmount(match[1]);
        if (amount !== null && amount > 0) return amount;
      }
    }
  }

  if (isHandwrittenNote(text)) {
    const handwrittenAmountPatterns = [
      /(?:spent|paid|owe|owed|cost|total|amount)\s*[:\s]*[\$₹€£¥]?\s*([\d,]+\.?\d{0,2})/i,
      /[\$₹€£¥]\s*([\d,]+\.?\d{0,2})/i,
      /\b(\d{1,6}\.\d{2})\b/,
    ];
    for (const pattern of handwrittenAmountPatterns) {
      const match = text.match(pattern);
      if (match) {
        const amount = parseAmount(match[1]);
        if (amount !== null && amount > 0) return amount;
      }
    }
  }

  const totalPatterns = [
    /(?:grand\s*)?total\s*[:\s]*[\$₹€£¥]?\s*([\d,]+\.?\d{0,2})/i,
    /(?:amount\s*(?:due|paid|owing|sent|received)?)\s*[:\s]*[\$₹€£¥]?\s*([\d,]+\.?\d{0,2})/i,
    /(?:balance\s*(?:due|owing)?)\s*[:\s]*[\$₹€£¥]?\s*([\d,]+\.?\d{0,2})/i,
    /(?:net|final)\s*(?:amount|total)?\s*[:\s]*[\$₹€£¥]?\s*([\d,]+\.?\d{0,2})/i,
    /(?:sent|paid|received|transferred|debited|credited)\s*[\$₹€£¥]?\s*([\d,]+\.?\d{0,2})/i,
  ];

  for (const pattern of totalPatterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseAmount(match[1]);
      if (amount !== null && amount > 0) return amount;
    }
  }

  const currencyAmounts = [...text.matchAll(/[₹]\s*([\d,]+\.?\d{0,2})/g)];
  if (currencyAmounts.length > 0) {
    const lastMatch = currencyAmounts[currencyAmounts.length - 1];
    const amount = parseAmount(lastMatch[1]);
    if (amount !== null && amount > 0) return amount;
  }

  const anyCurrencyAmounts = [...text.matchAll(/[\$₹€£¥]\s*([\d,]+\.?\d{0,2})/g)];
  if (anyCurrencyAmounts.length > 0) {
    const lastMatch = anyCurrencyAmounts[anyCurrencyAmounts.length - 1];
    const amount = parseAmount(lastMatch[1]);
    if (amount !== null && amount > 0) return amount;
  }

  const standaloneAmounts = [...text.matchAll(/\b(\d{1,6}\.\d{2})\b/g)];
  if (standaloneAmounts.length > 0) {
    let maxAmount = 0;
    let bestAmount = 0;
    for (const match of standaloneAmounts) {
      const amount = parseAmount(match[1]);
      if (amount !== null && amount > maxAmount) {
        maxAmount = amount;
        bestAmount = amount;
      }
    }
    if (bestAmount > 0) return bestAmount;
  }

  return null;
}

function extractDate(text: string): string | null {
  for (const pattern of INDIAN_UPI_DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const date = parseDateMatch(match);
      if (date) return date;
    }
  }
  return null;
}

function extractTitle(lines: string[], text: string): string | null {
  if (isBankStatement(text)) {
    const descPatterns = [
      /(?:description|desc|memo|narrative)\s*[:\s]*(.+?)(?:\n|$)/i,
      /(?:transaction|txn)\s*(?:detail|description)\s*[:\s]*(.+?)(?:\n|$)/i,
      /(?:particulars|remarks)\s*[:\s]*(.+?)(?:\n|$)/i,
    ];
    for (const pattern of descPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const title = match[1].trim();
        if (title.length >= 2 && title.length <= 60) {
          return title;
        }
      }
    }
  }

  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const line = lines[i].trim();
    if (line.length < 2 || line.length > 60) continue;
    if (NOISE_PATTERNS.some((p) => p.test(line))) continue;
    return line;
  }
  return null;
}

function extractRecipient(text: string): string | null {
  for (const pattern of INDIAN_UPI_RECIPIENT_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const recipient = match[1].trim();
      if (recipient.length >= 2 && recipient.length <= 60) {
        return recipient;
      }
    }
  }
  return null;
}

function extractCategory(text: string): string | null {
  const lower = text.toLowerCase();
  let bestCategory = null;
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return bestScore >= 1 ? bestCategory : null;
}

// ============================================================
// MAIN FUNCTION
// ============================================================

export function parseReceiptText(rawText: string): ExtractedReceipt {
  const lines = rawText.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  const text = lines.join("\n");

  // Extract title: try UPI patterns first, then fallback to generic
  let title: string | null = null;
  for (const pattern of INDIAN_UPI_TITLE_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const extracted = match[1].trim();
      if (extracted.length >= 2 && extracted.length <= 60) {
        title = extracted;
        break;
      }
    }
  }
  if (!title) {
    title = extractTitle(lines, text);
  }

  // Extract amount: try UPI patterns first, then fallback to generic
  let amount: number | null = null;
  for (const pattern of INDIAN_UPI_AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const parsed = parseAmount(match[1]);
      if (parsed !== null && parsed > 0) {
        amount = parsed;
        break;
      }
    }
  }
  if (amount === null) {
    amount = extractAmount(text);
  }

  return {
    title,
    amount,
    date: extractDate(text),
    category: extractCategory(text),
    recipient: extractRecipient(text),
    rawText,
  };
}
