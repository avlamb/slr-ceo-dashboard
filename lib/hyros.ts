import { getCached, setCache, CACHE_TTL } from "./cache";

const HYROS_BASE = "https://api.hyros.com/v1";

async function hyrosFetch(endpoint: string, method = "GET", body?: any) {
  const apiKey = process.env.HYROS_API_KEY;
  if (!apiKey) throw new Error("Hyros API key not configured");

  const res = await fetch(`${HYROS_BASE}${endpoint}`, {
    method,
    headers: {
      "API-Key": apiKey,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Hyros API error: ${res.status} ${res.statusText} â ${text.slice(0, 200)}`);
  }
  return res.json();
}

// âââ Fetch leads (with date filter) ââââââââââââââââââââââââââââââââââââ
export async function getLeads(startDate?: string, endDate?: string) {
  const cacheKey = `hyros_leads_${startDate}_${endDate}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  const params: any = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;

  const data = await hyrosFetch("/leads", "POST", params);
  setCache(cacheKey, data, CACHE_TTL.HYROS);
  return data;
}

// âââ Fetch sales ââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export async function getSales(startDate?: string, endDate?: string) {
  const cacheKey = `hyros_sales_${startDate}_${endDate}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  const params: any = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;

  const data = await hyrosFetch("/sales", "POST", params);
  setCache(cacheKey, data, CACHE_TTL.HYROS);
  return data;
}

// âââ Fetch calls ââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export async function getCalls(startDate?: string, endDate?: string) {
  const cacheKey = `hyros_calls_${startDate}_${endDate}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  const params: any = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;

  const data = await hyrosFetch("/calls", "POST", params);
  setCache(cacheKey, data, CACHE_TTL.HYROS);
  return data;
}

// âââ Fetch ad attribution data ââââââââââââââââââââââââââââââââââââââââ
export async function getAdAttribution(startDate?: string, endDate?: string) {
  const cacheKey = `hyros_attribution_${startDate}_${endDate}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  const params: any = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;

  const data = await hyrosFetch("/attribution/ads", "POST", params);
  setCache(cacheKey, data, CACHE_TTL.HYROS);
  return data;
}

// âââ Fetch sources breakdown ââââââââââââââââââââââââââââââââââââââââââ
export async function getSources(startDate?: string, endDate?: string) {
  const cacheKey = `hyros_sources_${startDate}_${endDate}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  const params: any = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;

  const data = await hyrosFetch("/attribution/sources", "POST", params);
  setCache(cacheKey, data, CACHE_TTL.HYROS);
  return data;
}

// âââ Aggregate Hyros data for dashboard ââââââââââââââââââââââââââââââââ
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
  const [leads, sales, calls, attribution, sources] = await Promise.allSettled([
    getLeads(startOfMonth, today),
    getSales(startOfMonth, today),
    getCalls(startOfMonth, today),
    getAdAttribution(startOfMonth, today),
    getSources(startOfMonth, today),
  ]);

  if (leads.status === "rejected") errors.push(`Leads: ${leads.reason?.message}`);
  if (sales.status === "rejected") errors.push(`Sales: ${sales.reason?.message}`);
  if (calls.status === "rejected") errors.push(`Calls: ${calls.reason?.message}`);
  if (attribution.status === "rejected") errors.push(`Attribution: ${attribution.reason?.message}`);
  if (sources.status === "rejected") errors.push(`Sources: ${sources.reason?.message}`);

  const result = {
    leads: leads.status === "fulfilled" ? leads.value : { data: [] },
    sales: sales.status === "fulfilled" ? sales.value : { data: [] },
    calls: calls.status === "fulfilled" ? calls.value : { data: [] },
    attribution: attribution.status === "fulfilled" ? attribution.value : { data: [] },
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
