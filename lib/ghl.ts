import { getCached, setCache, CACHE_TTL } from "./cache";

const GHL_BASE = "https://services.leadconnectorhq.com";

// GHL v2 API is inconsistent: most endpoints use locationId (camelCase) but
// /opportunities/search uses location_id (snake_case). We pass both to be safe.
async function ghlFetch(endpoint: string) {
  const token = process.env.GHL_API_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!token || !locationId) throw new Error("GHL credentials not configured");

  const url = `${GHL_BASE}${endpoint}`;
  const sep = url.includes("?") ? "&" : "?";
  // Pass both camelCase and snake_case â GHL silently ignores unknown params
  const fullUrl = `${url}${sep}locationId=${locationId}&location_id=${locationId}`;

  const res = await fetch(fullUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GHL API error: ${res.status} ${res.statusText} â ${body.slice(0, 200)}`);
  }
  return res.json();
}

// âââ Fetch opportunities (pipeline deals) ââââââââââââââââââââââââââââââ
export async function getOpportunities(pipelineId?: string) {
  const cacheKey = `ghl_opportunities_${pipelineId || "all"}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  // limit=100 ensures we get a meaningful page of results
  const params = pipelineId ? `?pipelineId=${pipelineId}&limit=100` : "?limit=100";
  const data = await ghlFetch(`/opportunities/search${params}`);
  setCache(cacheKey, data, CACHE_TTL.GHL);
  return data;
}

// âââ Fetch contacts with tags ââââââââââââââââââââââââââââââââââââââââââ
export async function getContacts(query?: string) {
  const cacheKey = `ghl_contacts_${query || "all"}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  const params = query ? `?query=${encodeURIComponent(query)}` : "";
  const data = await ghlFetch(`/contacts/${params}`);
  setCache(cacheKey, data, CACHE_TTL.GHL);
  return data;
}

// âââ Fetch payments/transactions âââââââââââââââââââââââââââââââââââââââ
// NOTE: Requires the "Payments" scope on the GHL Private Integration Token.
// If this returns 403, regenerate the PIT in GHL Settings > Private Integrations
// and ensure "Payments" scope is checked.
export async function getPayments(startDate?: string, endDate?: string) {
  const cacheKey = `ghl_payments_${startDate}_${endDate}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  let params = "";
  if (startDate && endDate) {
    params = `?startAt=${startDate}&endAt=${endDate}`;
  }
  const data = await ghlFetch(`/payments/transactions${params}`);
  setCache(cacheKey, data, CACHE_TTL.GHL);
  return data;
}

// âââ Fetch pipelines ââââââââââââââââââââââââââââââââââââââââââââââââââ
export async function getPipelines() {
  const cacheKey = "ghl_pipelines";
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  const data = await ghlFetch("/opportunities/pipelines");
  setCache(cacheKey, data, CACHE_TTL.GHL);
  return data;
}

// âââ Aggregate GHL data for dashboard ââââââââââââââââââââââââââââââââââ
export async function getGHLDashboardData() {
  const cacheKey = "ghl_dashboard";
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  // Fail fast if credentials are missing
  const token = process.env.GHL_API_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!token || !locationId) {
    throw new Error(
      `GHL credentials missing: ${!token ? "GHL_API_TOKEN" : ""}${!token && !locationId ? ", " : ""}${!locationId ? "GHL_LOCATION_ID" : ""}`
    );
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endOfMonth = now.toISOString();

  const errors: string[] = [];
  const [opportunities, payments, pipelines] = await Promise.allSettled([
    getOpportunities(),
    getPayments(startOfMonth, endOfMonth),
    getPipelines(),
  ]);

  if (opportunities.status === "rejected") errors.push(`Opportunities: ${opportunities.reason?.message}`);
  if (payments.status === "rejected") errors.push(`Payments: ${payments.reason?.message}`);
  if (pipelines.status === "rejected") errors.push(`Pipelines: ${pipelines.reason?.message}`);

  const result = {
    opportunities: opportunities.status === "fulfilled" ? opportunities.value : { opportunities: [] },
    payments: payments.status === "fulfilled" ? payments.value : { data: [] },
    pipelines: pipelines.status === "fulfilled" ? pipelines.value : { pipelines: [] },
    errors,
    fetchedAt: new Date().toISOString(),
  };

  // Only cache if no errors
  if (errors.length === 0) {
    setCache(cacheKey, result, CACHE_TTL.GHL);
  }
  return result;
}
