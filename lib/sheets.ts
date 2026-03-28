/**
 * lib/sheets.ts
 * Google Sheets API client — SLR CEO Dashboard
 *
 * Reads from 4 source sheets:
 *   1. SLR 2026 Closer Tracker Sheet       → sales/closer metrics
 *   2. SLR - 2026 Setter Tracker v.0124    → setter metrics
 *   3. SLR Deals Master List               → per-deal data, AR
 *   4. SLR Projection Dashboard 2026       → cash vs projection vs pace
 *
 * Auth: GOOGLE_SERVICE_ACCOUNT_KEY env var (full service account JSON, stringified)
 * All 4 sheets must be shared with the service account email (editor or viewer).
 */

import { google, sheets_v4 } from "googleapis";

// ─── Sheet IDs ─────────────────────────────────────────────────────────────────
export const SHEET_IDS = {
  closer: "1DNcejgM5S_eesdoXa-IWNfrjI8xahKjp5HbwPRb26vc",
  setter: "17NzlkmHDY8Rjt-5oPWae4bvmRLLu-3pB8SzSqJbiWn0",
  deals: "1uRtm1wO7VDKhCvAoQ1VPgJABNfySG3u7mRW9hWxwgqQ",
  projection: "1de1P9VBX5ilxKQFOXfbYVWDTj-7LkXkLkD5Zr7LFYy4",
};

export const MONTH_NAMES_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export const MONTH_NAMES_FULL  = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ─── Auth ──────────────────────────────────────────────────────────────────────
function getSheetsClient(): sheets_v4.Sheets {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY env var not set");

  let credentials: object;
  try {
    credentials = JSON.parse(keyJson);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON");
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return google.sheets({ version: "v4", auth });
}

// ─── Parse Helpers ─────────────────────────────────────────────────────────────
export function money(v?: string | null): number {
  if (!v) return 0;
  return parseFloat(String(v).replace(/[$,\s]/g, "")) || 0;
}

export function pct(v?: string | null): number {
  if (!v) return 0;
  const n = parseFloat(String(v).replace(/[%\s]/g, ""));
  return isNaN(n) ? 0 : n / 100;
}

export function num(v?: string | null): number {
  if (!v) return 0;
  return parseFloat(String(v).replace(/[,\s]/g, "")) || 0;
}

// Parse date string like "3/28/2025" or "2025-03-28"
export function parseDate(v?: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// ─── Batch Fetch Utility ───────────────────────────────────────────────────────
async function batchGet(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  ranges: string[]
): Promise<string[][][]> {
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
  });
  return (res.data.valueRanges || []).map((vr) => (vr.values || []) as string[][]);
}

// ─── Closer Tracker ────────────────────────────────────────────────────────────
//
// Tab: "Team Summary"
//   Row 17 = headers:
//     A=Label   B=Schedule Calls   C=Live Calls   D=Show(%)
//     E=Offers  F=Offer(%)         G=Deposits     H=Closes
//     I=Offer Commitment(%)        J=Offer Close(%)
//     K=Call Commitment(%)         L=Call Close(%)
//     M=Total Collected($)         N=Total Revenue($)   O=Total Coll(%)
//   Row 18 = January, Row 19 = February, Row 20 = March, …
//
// Tab: "Leaderboard"
//   Row 1 = headers, Rows 2+ = per-rep data
//
export interface CloserCurrentMetrics {
  scheduledCalls: number;
  liveCalls: number;
  showRate: number;
  offers: number;
  offerRate: number;
  closes: number;
  offerCloseRate: number;
  callCloseRate: number;
  cashCollected: number;
  revenue: number;
  collectionRate: number;
}

export interface MonthlySnapshot {
  month: string;
  scheduledCalls: number;
  liveCalls: number;
  showRate: number;
  closes: number;
  cashCollected: number;
  revenue: number;
}

export interface CloserTrackerResult {
  current: CloserCurrentMetrics;
  history: MonthlySnapshot[];       // Jan → current month
  leaderboard: string[][];           // Raw rows — first row is headers
}

export async function fetchCloserData(): Promise<CloserTrackerResult> {
  const sheets = getSheetsClient();
  const monthIdx = new Date().getMonth(); // 0 = Jan

  const [summaryRows, leaderboardRows] = await batchGet(sheets, SHEET_IDS.closer, [
    "Team Summary!A17:O24",  // header row + Jan–Aug
    "Leaderboard!A1:P80",    // per-rep ranked data
  ]);

  // Row 0 in summaryRows = header row (row 17 in sheet)
  // Row 1 = January, Row 2 = February, Row (monthIdx+1) = current month
  const curr = summaryRows[monthIdx + 1] || [];

  const history: MonthlySnapshot[] = [];
  for (let i = 0; i <= monthIdx; i++) {
    const r = summaryRows[i + 1];
    if (!r) break;
    history.push({
      month: MONTH_NAMES_SHORT[i],
      scheduledCalls: num(r[1]),
      liveCalls: num(r[2]),
      showRate: pct(r[3]),
      closes: num(r[7]),
      cashCollected: money(r[12]),
      revenue: money(r[13]),
    });
  }

  return {
    current: {
      scheduledCalls: num(curr[1]),
      liveCalls: num(curr[2]),
      showRate: pct(curr[3]),
      offers: num(curr[4]),
      offerRate: pct(curr[5]),
      closes: num(curr[7]),
      offerCloseRate: pct(curr[9]),
      callCloseRate: pct(curr[11]),
      cashCollected: money(curr[12]),
      revenue: money(curr[13]),
      collectionRate: pct(curr[14]),
    },
    history,
    leaderboard: leaderboardRows,
  };
}

// ─── Setter Tracker ────────────────────────────────────────────────────────────
//
// Tab: "Team Summary"
//   Row 17 = headers:
//     A=Month              B=Leads Assigned     C=Total Dials
//     D=Meaningful Convos  E=Meaningful Convos(%)  F=Sets
//     G=Convo-to-Set(%)    H=Sets On Calendar   I=Live Calls
//     J=Sets Offered       K=Sets Closed        L=Show Rate(%)
//     M=Offer Rate(%)      N=Set-to-close(%)
//
//   Note: The "Meaningful Convos" count (col D) is often blank/formula-driven;
//   col E (index 4) contains the % value. The effective data mapping is:
//     idx 1=Leads, 2=Dials, 3=Convos(count,often blank), 4=Convos%
//     idx 5=Sets, 6=Convo-Set%, 7=Sets-on-Cal, 8=Live Calls
//     idx 9=Sets Offered, 10=Sets Closed, 11=Show Rate%, 12=Offer Rate%, 13=Set-to-close%
//
export interface SetterCurrentMetrics {
  leadsAssigned: number;
  totalDials: number;
  sets: number;
  setsOnCalendar: number;
  liveCalls: number;
  setsOffered: number;
  setsClosed: number;
  showRate: number;
  offerRate: number;
  setToClose: number;
}

export interface SetterTrackerResult {
  current: SetterCurrentMetrics;
  leaderboard: string[][];
}

export async function fetchSetterData(): Promise<SetterTrackerResult> {
  const sheets = getSheetsClient();
  const monthIdx = new Date().getMonth();

  const [summaryRows, leaderboardRows] = await batchGet(sheets, SHEET_IDS.setter, [
    "Team Summary!A17:N24",
    "Leaderboard!A1:N80",
  ]);

  const curr = summaryRows[monthIdx + 1] || [];

  return {
    current: {
      leadsAssigned: num(curr[1]),
      totalDials: num(curr[2]),
      // curr[3] = Meaningful Convos count (often blank)
      // curr[4] = Meaningful Convos %
      sets: num(curr[5]),
      setsOnCalendar: num(curr[7]),
      liveCalls: num(curr[8]),
      setsOffered: num(curr[9]),
      setsClosed: num(curr[10]),
      showRate: pct(curr[11]),
      offerRate: pct(curr[12]),
      setToClose: pct(curr[13]),
    },
    leaderboard: leaderboardRows,
  };
}

// ─── Deals Master List ─────────────────────────────────────────────────────────
//
// Tab: "DEALS WON"
//   Row 1 = headers:
//     A=Name  B=Email  C=Date Won  D=Deal Value($)  E=Offer/Product
//     F=Payment Plan   G=Setter    H=Closer         (more cols may follow)
//
// Tab: "PAYMENTS"
//   Raw payment tracking data (structure TBD — fetched for AR section)
//
export interface Deal {
  name: string;
  email: string;
  dateWon: Date | null;
  dealValue: number;
  product: string;
  paymentPlan: string;
  setter: string;
  closer: string;
  raw: string[];
}

export interface DealsResult {
  deals: Deal[];
  paymentRows: string[][];  // Raw PAYMENTS tab
}

export async function fetchDealsData(): Promise<DealsResult> {
  const sheets = getSheetsClient();

  const [dealsWonRows, paymentRows] = await batchGet(sheets, SHEET_IDS.deals, [
    "DEALS WON!A1:L2000",
    "PAYMENTS!A1:J2000",
  ]);

  // Row 0 = headers, skip it
  const deals: Deal[] = dealsWonRows.slice(1)
    .filter((r) => r.length > 0 && r[0])
    .map((r) => ({
      name: r[0] || "",
      email: r[1] || "",
      dateWon: parseDate(r[2]),
      dealValue: money(r[3]),
      product: r[4] || "",
      paymentPlan: r[5] || "",
      setter: r[6] || "",
      closer: r[7] || "",
      raw: r,
    }));

  return { deals, paymentRows };
}

// ─── Projection Dashboard ──────────────────────────────────────────────────────
//
// Tab per month: "January 2026", "February 2026", "March 2026", …
//   Structure (col letters):
//     Col A = row label (left sidebar context)
//     Col D = metric label (e.g., "Total Units", "Cash Collected")
//     Col E = Projection
//     Col F = Actual
//     Col G = Pace
//
// We search for known labels in col D to extract values robustly.
//
export interface ProjectionMetrics {
  totalUnitsProjection: number;
  totalUnitsActual: number;
  totalUnitsPace: number;
  cashProjection: number;
  cashActual: number;
  cashPace: number;
  daysInMonth: number;
  currentDay: number;
  daysLeft: number;
}

export async function fetchProjectionData(): Promise<ProjectionMetrics | null> {
  const sheets = getSheetsClient();
  const now = new Date();
  const tabName = `${MONTH_NAMES_FULL[now.getMonth()]} ${now.getFullYear()}`;

  let rows: string[][];
  try {
    const [fetched] = await batchGet(sheets, SHEET_IDS.projection, [
      `${tabName}!A1:G60`,
    ]);
    rows = fetched;
  } catch {
    return null;
  }

  if (!rows.length) return null;

  // Helper: find a row by searching col D (index 3) for a label substring
  function findRow(label: string): string[] | undefined {
    return rows.find((r) =>
      (r[3] || "").toLowerCase().includes(label.toLowerCase())
    );
  }

  // Col B (index 1) in the first few rows typically holds day counts
  const daysRow = rows.find((r) =>
    (r[0] || "").toLowerCase().includes("days in month")
  );
  const currentDayRow = rows.find((r) =>
    (r[0] || "").toLowerCase().includes("current days")
  );
  const daysLeftRow = rows.find((r) =>
    (r[0] || "").toLowerCase().includes("days left in month")
  );

  const unitsRow = findRow("total units");
  const cashRow = findRow("cash collected");

  return {
    daysInMonth: num(daysRow?.[1]),
    currentDay: num(currentDayRow?.[1]),
    daysLeft: num(daysLeftRow?.[1]),
    totalUnitsProjection: num(unitsRow?.[4]),
    totalUnitsActual: num(unitsRow?.[5]),
    totalUnitsPace: num(unitsRow?.[6]),
    cashProjection: money(cashRow?.[4]),
    cashActual: money(cashRow?.[5]),
    cashPace: money(cashRow?.[6]),
  };
}

// ─── Aggregate: fetch all 4 sources in parallel ────────────────────────────────
export async function fetchAllSheetData() {
  const [closerResult, setterResult, dealsResult, projectionResult] =
    await Promise.allSettled([
      fetchCloserData(),
      fetchSetterData(),
      fetchDealsData(),
      fetchProjectionData(),
    ]);

  return {
    closer:
      closerResult.status === "fulfilled"
        ? closerResult.value
        : null,
    setter:
      setterResult.status === "fulfilled"
        ? setterResult.value
        : null,
    deals:
      dealsResult.status === "fulfilled"
        ? dealsResult.value
        : null,
    projection:
      projectionResult.status === "fulfilled"
        ? projectionResult.value
        : null,
    errors: [
      closerResult.status === "rejected"
        ? { source: "sheets" as const, message: `Closer tracker: ${closerResult.reason?.message}`, timestamp: new Date().toISOString() }
        : null,
      setterResult.status === "rejected"
        ? { source: "sheets" as const, message: `Setter tracker: ${setterResult.reason?.message}`, timestamp: new Date().toISOString() }
        : null,
      dealsResult.status === "rejected"
        ? { source: "sheets" as const, message: `Deals master list: ${dealsResult.reason?.message}`, timestamp: new Date().toISOString() }
        : null,
      projectionResult.status === "rejected"
        ? { source: "sheets" as const, message: `Projection dashboard: ${projectionResult.reason?.message}`, timestamp: new Date().toISOString() }
        : null,
    ].filter(Boolean),
  };
}
