import { getCached, setCache, CACHE_TTL } from "./cache";

// Base: https://api.hyros.com/v1 — endpoints at /api/v1.0/*, date params: fromDate/toDate
const HYROS_BASE = "https://api.hyros.com/v1";

async function hyrosFetch(endpoint: string) {
  const apiKey = process.env.HYROS_API_KEY;
  if (!apiKey) throw new Error("Hyros API key not configured");

  const res = await fetch(`${HYROS_BASE}${endpoint}`, {
    method: "GET",
    headers: {
      "API-Key": apiKey,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Hyros API error: ${res.status} ${res.statusText} — ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ─── Fetch leads (with date filter) ────────────────────────────────────
export async function getLeads(startDate?: string, endDate?: string) {
  const cacheKey = `hyros_leads_${startDate}_${endDate}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  const qs = startDate && endDate ? `?fromDate=${startDate}&toDate=${endDate}` : "";
  const data = await hyrosFetch(`/api/v1.0/leads${qs}`);
  setCache(cacheKey, data, CACHE_TTL.HYROS);
  return data;
}

// ─── Fetch sales ──────────────────────────────────────────────────────
export async function getSales(startDate?: string, endDate?: string) {
  const cacheKey = `hyros_sales_${startDate}_${endDate}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  const qs = startDate && endDate ? `?fromDate=${startDate}&toDate=${endDate}` : "";
  const data = await hyrosFetch(`/api/v1.0/sales${qs}`);
  setCache(cacheKey, data, CACHE_TTL.HYROS);
  return data;
}

// ─── Fetch calls ──────────────────────────────────────────────────────
export async function getCalls(startDate?: string, endDate?: string) {
  const cacheKey = `hyros_calls_${startDate}_${endDate}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  const qs = startDate && endDate ? `?fromDate=${startDate}&toDate=${endDate}` : "";
  const data = await hyrosFetch(`/api/v1.0/calls${qs}`);
  setCache(cacheKey, data, CACHE_TTL.HYROS);
  return data;
}

// ─── Fetch sources breakdown ──────────────────────────────────────────
export async function getSources(startDate?: string, endDate?: string) {
  const cacheKey = `hyros_sources_${startDate}_${endDate}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  const qs = startDate && endDate ? `?fromDate=${startDate}&toDate=${endDate}` : "";
  const data = await hyrosFetch(`/api/v1.0/sources${qs}`);
  setCache(cacheKey, data, CACHE_TTL.HYROS);
  return data;
}

// ─── Aggregate Hyros data for dashboard ────────────────────────────────
export async function getHyrosDashboardData() {
  const cacheKey = "hyros_dashboard";
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  // Fail fast if credentials are missing
  const apiKey = process.env.HYROS_API_KEY;
  if (!apiKey) {
    throw new Error("Hyros credentials missing: HYROS_API_KEY not set");
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const today = now.toISOString().split("T")[0];

  const errors: string[] = [];
  const [leads, sales, calls, sources] = await Promise.allSettled([
    getLeads(startOfMonth, today),
    getSales(startOfMonth, today),
    getCalls(startOfMonth, today),
    getSources(startOfMonth, today),
  ]);

  if (leads.status === "rejected") errors.push(`Leads: ${leads.reason?.message}`);
  if (sales.status === "rejected") errors.push(`Sales: ${sales.reason?.message}`);
  if (calls.status === "rejected") errors.push(`Calls: ${calls.reason?.message}`);
  if (sources.status === "rejected") errors.push(`Sources: ${sources.reason?.message}`);

  const result = {
    leads: leads.status === "fulfilled" ? leads.value : { data: [] },
    sales: sales.status === "fulfilled" ? sales.value : { data: [] },
    calls: calls.status === "fulfilled" ? calls.value : { data: [] },
    sources: sources.status === "fulfilled" ? sources.value : { data: [] },
    errors,
    fetchedAt: new Date().toISOString(),
  };

  // Only cache if no errors
  if (errors.length === 0) {
    setCache(cacheKey, result, CACHE_TTL.HYROS);
  }
  return result;
}
