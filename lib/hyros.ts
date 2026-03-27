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
    throw new Error(`Hyros API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// âââ Fetch leads (with date filter) ââââââââââââââââââââââââââââââââââââ
export async function getLeads(startDate?: string, endDate?: string) {
  const cacheKey = `hyros_leads_${startDate}_${endDate}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  try {
    const params: any = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const data = await hyrosFetch("/leads", "POST", params);
    setCache(cacheKey, data, CACHE_TTL.HYROS);
    return data;
  } catch (err) {
    console.error("Hyros leads fetch error:", err);
    return { data: [] };
  }
}

// âââ Fetch sales ââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export async function getSales(startDate?: string, endDate?: string) {
  const cacheKey = `hyros_sales_${startDate}_${endDate}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  try {
    const params: any = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const data = await hyrosFetch("/sales", "POST", params);
    setCache(cacheKey, data, CACHE_TTL.HYROS);
    return data;
  } catch (err) {
    console.error("Hyros sales fetch error:", err);
    return { data: [] };
  }
}

// âââ Fetch calls ââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export async function getCalls(startDate?: string, endDate?: string) {
  const cacheKey = `hyros_calls_${startDate}_${endDate}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  try {
    const params: any = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const data = await hyrosFetch("/calls", "POST", params);
    setCache(cacheKey, data, CACHE_TTL.HYROS);
    return data;
  } catch (err) {
    console.error("Hyros calls fetch error:", err);
    return { data: [] };
  }
}

// âââ Fetch ad attribution data ââââââââââââââââââââââââââââââââââââââââ
export async function getAdAttribution(startDate?: string, endDate?: string) {
  const cacheKey = `hyros_attribution_${startDate}_${endDate}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  try {
    const params: any = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const data = await hyrosFetch("/attribution/ads", "POST", params);
    setCache(cacheKey, data, CACHE_TTL.HYROS);
    return data;
  } catch (err) {
    console.error("Hyros attribution fetch error:", err);
    return { data: [] };
  }
}

// âââ Fetch sources breakdown ââââââââââââââââââââââââââââââââââââââââââ
export async function getSources(startDate?: string, endDate?: string) {
  const cacheKey = `hyros_sources_${startDate}_${endDate}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  try {
    const params: any = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const data = await hyrosFetch("/attribution/sources", "POST", params);
    setCache(cacheKey, data, CACHE_TTL.HYROS);
    return data;
  } catch (err) {
    console.error("Hyros sources fetch error:", err);
    return { data: [] };
  }
}

// âââ Aggregate Hyros data for dashboard ââââââââââââââââââââââââââââââââ
export async function getHyrosDashboardData() {
  const cacheKey = "hyros_dashboard";
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const today = now.toISOString().split("T")[0];

  const [leads, sales, calls, attribution, sources] = await Promise.allSettled([
    getLeads(startOfMonth, today),
    getSales(startOfMonth, today),
    getCalls(startOfMonth, today),
    getAdAttribution(startOfMonth, today),
    getSources(startOfMonth, today),
  ]);

  const result = {
    leads: leads.status === "fulfilled" ? leads.value : { data: [] },
    sales: sales.status === "fulfilled" ? sales.value : { data: [] },
    calls: calls.status === "fulfilled" ? calls.value : { data: [] },
    attribution: attribution.status === "fulfilled" ? attribution.value : { data: [] },
    sources: sources.status === "fulfilled" ? sources.value : { data: [] },
    fetchedAt: new Date().toISOString(),
  };

  setCache(cacheKey, result, CACHE_TTL.HYROS);
  return result;
}
