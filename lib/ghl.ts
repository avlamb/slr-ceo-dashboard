import { getCached, setCache, CACHE_TTL } from "./cache";

const GHL_BASE = "https://services.leadconnectorhq.com";

async function ghlFetch(endpoint: string) {
  const token = process.env.GHL_API_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!token || !locationId) throw new Error("GHL credentials not configured");

  const url = `${GHL_BASE}${endpoint}`;
  const sep = url.includes("?") ? "&" : "?";
  const fullUrl = `${url}${sep}locationId=${locationId}`;

  const res = await fetch(fullUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    },
  });

  if (!res.ok) {
    throw new Error(`GHL API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// âââ Fetch opportunities (pipeline deals) ââââââââââââââââââââââââââââââ
export async function getOpportunities(pipelineId?: string) {
  const cacheKey = `ghl_opportunities_${pipelineId || "all"}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  try {
    const params = pipelineId ? `?pipelineId=${pipelineId}` : "";
    const data = await ghlFetch(`/opportunities/search${params}`);
    setCache(cacheKey, data, CACHE_TTL.GHL);
    return data;
  } catch (err) {
    console.error("GHL opportunities fetch error:", err);
    return { opportunities: [] };
  }
}

// âââ Fetch contacts with tags ââââââââââââââââââââââââââââââââââââââââââ
export async function getContacts(query?: string) {
  const cacheKey = `ghl_contacts_${query || "all"}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  try {
    const params = query ? `?query=${encodeURIComponent(query)}` : "";
    const data = await ghlFetch(`/contacts/${params}`);
    setCache(cacheKey, data, CACHE_TTL.GHL);
    return data;
  } catch (err) {
    console.error("GHL contacts fetch error:", err);
    return { contacts: [] };
  }
}

// âââ Fetch payments/transactions âââââââââââââââââââââââââââââââââââââââ
export async function getPayments(startDate?: string, endDate?: string) {
  const cacheKey = `ghl_payments_${startDate}_${endDate}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  try {
    let params = "";
    if (startDate && endDate) {
      params = `?startAt=${startDate}&endAt=${endDate}`;
    }
    const data = await ghlFetch(`/payments/transactions${params}`);
    setCache(cacheKey, data, CACHE_TTL.GHL);
    return data;
  } catch (err) {
    console.error("GHL payments fetch error:", err);
    return { data: [] };
  }
}

// âââ Fetch pipelines ââââââââââââââââââââââââââââââââââââââââââââââââââ
export async function getPipelines() {
  const cacheKey = "ghl_pipelines";
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  try {
    const data = await ghlFetch("/opportunities/pipelines");
    setCache(cacheKey, data, CACHE_TTL.GHL);
    return data;
  } catch (err) {
    console.error("GHL pipelines fetch error:", err);
    return { pipelines: [] };
  }
}

// âââ Aggregate GHL data for dashboard ââââââââââââââââââââââââââââââââââ
export async function getGHLDashboardData() {
  const cacheKey = "ghl_dashboard";
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endOfMonth = now.toISOString();

  const [opportunities, payments, pipelines] = await Promise.allSettled([
    getOpportunities(),
    getPayments(startOfMonth, endOfMonth),
    getPipelines(),
  ]);

  const result = {
    opportunities: opportunities.status === "fulfilled" ? opportunities.value : { opportunities: [] },
    payments: payments.status === "fulfilled" ? payments.value : { data: [] },
    pipelines: pipelines.status === "fulfilled" ? pipelines.value : { pipelines: [] },
    fetchedAt: new Date().toISOString(),
  };

  setCache(cacheKey, result, CACHE_TTL.GHL);
  return result;
}
