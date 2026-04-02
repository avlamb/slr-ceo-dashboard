/**
 * lib/airtable.ts
 * Airtable REST API client for Fulfillment data
 *
 * Base: appoWeyMZiY2Nwtro
 * Tables:
 *   CRM      → tbln7k2BqALRk3YKM  (active clients)
 *   CSM EoW  → tblD7tXPQQVTTT9sV  (CSM end-of-week summaries)
 *
 * Auth: AIRTABLE_PAT env var
 * Cache: 5 minutes (CACHE_TTL.GHL)
 */

import { getCached, setCache, CACHE_TTL } from "./cache";

const AIRTABLE_BASE_URL = "https://api.airtable.com/v0";
const BASE_ID = process.env.AIRTABLE_BASE_ID || "appoWeyMZiY2Nwtro";
const CRM_TABLE_ID = "tbln7k2BqALRk3YKM";
const CSM_TABLE_ID = "tblD7tXPQQVTTT9sV";

// ─── Paginated fetch (follows offset token) ────────────────────────────────────
async function airtableFetchAll(tableId: string, params?: Record<string, string>): Promise<any[]> {
  const pat = process.env.AIRTABLE_PAT;
  if (!pat) throw new Error("AIRTABLE_PAT not configured");

  const allRecords: any[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(`${AIRTABLE_BASE_URL}/${BASE_ID}/${tableId}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${pat}` },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Airtable API error: ${res.status} — ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    allRecords.push(...(data.records || []));
    offset = data.offset;
  } while (offset);

  return allRecords;
}

// ─── Field name resolution helpers ─────────────────────────────────────────────
// Airtable field names vary by setup — try multiple common patterns
function pick(fields: Record<string, any>, ...keys: string[]): any {
  for (const k of keys) {
    if (fields[k] !== undefined && fields[k] !== null && fields[k] !== "") {
      return fields[k];
    }
    // Case-insensitive match
    const lk = k.toLowerCase();
    for (const fk of Object.keys(fields)) {
      if (fk.toLowerCase() === lk && fields[fk] !== undefined && fields[fk] !== null && fields[fk] !== "") {
        return fields[fk];
      }
    }
  }
  return undefined;
}

function pickStr(fields: Record<string, any>, ...keys: string[]): string {
  const v = pick(fields, ...keys);
  return v != null ? String(v) : "";
}

function pickNum(fields: Record<string, any>, ...keys: string[]): number {
  const v = pick(fields, ...keys);
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/[,$]/g, ""));
  return isNaN(n) ? 0 : n;
}

// ─── Public types ──────────────────────────────────────────────────────────────

export interface AirtableClientRecord {
  id: string;
  name: string;
  status: string;
  csm: string;
  startDate: string;
  program: string;
  paymentStatus: string;
  nextPaymentDate: string;
  totalPaid: number;
  balance: number;
}

export interface AirtableCSMWeekly {
  id: string;
  csm: string;
  weekEnding: string;
  checkIns: number;
  goalsSet: number;
  goalsHit: number;
  clients: number;
  notes: string;
}

// ─── CRM Table — Active Clients ────────────────────────────────────────────────
export async function getAirtableClients(): Promise<AirtableClientRecord[]> {
  const cacheKey = "airtable_crm_clients";
  const cached = getCached<AirtableClientRecord[]>(cacheKey);
  if (cached) return cached;

  try {
    const records = await airtableFetchAll(CRM_TABLE_ID, {
      maxRecords: "500",
    });

    const clients: AirtableClientRecord[] = records.map((r: any) => {
      const f = r.fields || {};
      return {
        id: r.id,
        name: pickStr(f, "Name", "Client Name", "Full Name", "Client", "First Name"),
        status: pickStr(f, "Status", "Program Status", "Stage", "Client Status"),
        csm: pickStr(f, "CSM", "Account Manager", "Assigned CSM", "Coach", "Assigned To"),
        startDate: pickStr(f, "Start Date", "Onboard Date", "Enrollment Date", "Date Started", "Created"),
        program: pickStr(f, "Program", "Package", "Program Type", "Service"),
        paymentStatus: pickStr(f, "Payment Status", "Pay Status", "Billing Status"),
        nextPaymentDate: pickStr(f, "Next Payment Date", "Next Payment", "Next Billing"),
        totalPaid: pickNum(f, "Total Paid", "Amount Paid", "Revenue", "Total Revenue"),
        balance: pickNum(f, "Balance", "Outstanding Balance", "Amount Owed", "Remaining Balance"),
      };
    });

    setCache(cacheKey, clients, CACHE_TTL.GHL);
    return clients;
  } catch (err: any) {
    console.error("Airtable CRM fetch error:", err?.message || err);
    return [];
  }
}

// ─── CSM End-of-Week Table ─────────────────────────────────────────────────────
export async function getAirtableCSMWeekly(): Promise<AirtableCSMWeekly[]> {
  const cacheKey = "airtable_csm_weekly";
  const cached = getCached<AirtableCSMWeekly[]>(cacheKey);
  if (cached) return cached;

  try {
    const records = await airtableFetchAll(CSM_TABLE_ID, {
      maxRecords: "200",
      sort: JSON.stringify([{ field: "Week Ending", direction: "desc" }]),
    });

    const weekly: AirtableCSMWeekly[] = records.map((r: any) => {
      const f = r.fields || {};
      return {
        id: r.id,
        csm: pickStr(f, "CSM", "Name", "CSM Name", "Team Member"),
        weekEnding: pickStr(f, "Week Ending", "Week", "Date", "Period"),
        checkIns: pickNum(f, "Check-ins", "Check Ins", "Checkins", "Total Check-ins"),
        goalsSet: pickNum(f, "Goals Set", "Goals Created", "New Goals"),
        goalsHit: pickNum(f, "Goals Hit", "Goals Completed", "Goals Achieved", "Goals Met"),
        clients: pickNum(f, "Clients", "Active Clients", "Client Count", "Total Clients"),
        notes: pickStr(f, "Notes", "Comments", "Summary"),
      };
    });

    setCache(cacheKey, weekly, CACHE_TTL.GHL);
    return weekly;
  } catch (err: any) {
    console.error("Airtable CSM weekly fetch error:", err?.message || err);
    return [];
  }
}

// ─── Aggregate summary (used by API route) ─────────────────────────────────────
export interface AirtableSummary {
  totalClients: number;
  activeClients: number;
  clientsByCSM: Record<string, number>;
  recentClients: AirtableClientRecord[];
  latestCSMWeekly: AirtableCSMWeekly[];
  totalARBalance: number;
  source: "live" | "error";
  error?: string;
}

export async function getAirtableSummary(): Promise<AirtableSummary> {
  const cacheKey = "airtable_summary";
  const cached = getCached<AirtableSummary>(cacheKey);
  if (cached) return cached;

  try {
    const [clients, weekly] = await Promise.all([
      getAirtableClients(),
      getAirtableCSMWeekly(),
    ]);

    const activeClients = clients.filter((c) => {
      const s = c.status.toLowerCase();
      return !s.includes("inactive") && !s.includes("churned") && !s.includes("cancelled") && !s.includes("canceled");
    });

    const clientsByCSM: Record<string, number> = {};
    activeClients.forEach((c) => {
      if (!c.csm) return;
      clientsByCSM[c.csm] = (clientsByCSM[c.csm] || 0) + 1;
    });

    const totalARBalance = activeClients.reduce((sum, c) => sum + c.balance, 0);

    // Most recent 20 clients sorted by startDate desc
    const recentClients = [...activeClients]
      .sort((a, b) => (b.startDate > a.startDate ? 1 : -1))
      .slice(0, 20);

    // Latest CSM weekly entries (most recent week per CSM)
    const latestByCSM: Record<string, AirtableCSMWeekly> = {};
    weekly.forEach((w) => {
      if (!w.csm) return;
      if (!latestByCSM[w.csm] || w.weekEnding > latestByCSM[w.csm].weekEnding) {
        latestByCSM[w.csm] = w;
      }
    });
    const latestCSMWeekly = Object.values(latestByCSM);

    const summary: AirtableSummary = {
      totalClients: clients.length,
      activeClients: activeClients.length,
      clientsByCSM,
      recentClients,
      latestCSMWeekly,
      totalARBalance,
      source: "live",
    };

    setCache(cacheKey, summary, CACHE_TTL.GHL);
    return summary;
  } catch (err: any) {
    console.error("Airtable summary error:", err?.message || err);
    return {
      totalClients: 0,
      activeClients: 0,
      clientsByCSM: {},
      recentClients: [],
      latestCSMWeekly: [],
      totalARBalance: 0,
      source: "error",
      error: err?.message || String(err),
    };
  }
}
