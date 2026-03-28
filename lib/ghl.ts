import { getCached, setCache, CACHE_TTL } from "./cache";

const GHL_BASE = "https://services.leadconnectorhq.com";

// GHL v2 API has strict schema validation per endpoint:
// - /opportunities/search → location_id (snake_case only)
// - /opportunities/pipelines → locationId (camelCase only)
// - /contacts/ → locationId (camelCase only)
// - /payments/transactions → no location param (inferred from token)
// Passing both causes 422. Use locationParam to control which is appended.
async function ghlFetch(endpoint: string, locationParam: "camel" | "snake" | "none" = "camel") {
  const token = process.env.GHL_API_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!token || !locationId) throw new Error("GHL credentials not configured");

  const url = `${GHL_BASE}${endpoint}`;
  const sep = url.includes("?") ? "&" : "?";
  const locSuffix =
    locationParam === "camel"
      ? `${sep}locationId=${locationId}`
      : locationParam === "snake"
      ? `${sep}location_id=${locationId}`
      : "";
  const fullUrl = `${url}${locSuffix}`;

  const res = await fetch(fullUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GHL API error: ${res.status} ${res.statusText} → ${body.slice(0, 200)}`);
  }
  return res.json();
}

// ─── Fetch opportunities (first 100 snapshot for pipeline/totals) ──────────
export async function getOpportunities(pipelineId?: string) {
  const cacheKey = `ghl_opportunities_${pipelineId || "all"}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  // /opportunities/search requires location_id (snake_case) — rejects locationId
  const params = pipelineId ? `?pipelineId=${pipelineId}&limit=100` : "?limit=100";
  const data = await ghlFetch(`/opportunities/search${params}`, "snake");
  setCache(cacheKey, data, CACHE_TTL.GHL);
  return data;
}

// ─── Fetch ALL won opportunities for current month (cursor-paginated) ──────
// Sorts by updated_desc so most-recently-won deals appear first.
// Stops early once the oldest deal on a page pre-dates startDate.
export async function getWonOpportunitiesCurrentMonth(startDate: string): Promise<any[]> {
  const cacheKey = `ghl_won_opps_${startDate}`;
  const cached = getCached<any[]>(cacheKey);
  if (cached) return cached;

  const startMs = new Date(startDate).getTime();
  let allWon: any[] = [];
  let startAfterId: string | null = null;
  const MAX_PAGES = 30; // 30 × 100 = 3,000 max won deals

  for (let page = 0; page < MAX_PAGES; page++) {
    let endpoint = "/opportunities/search?status=won&order=updated_desc&limit=100";
    if (startAfterId) endpoint += `&startAfterId=${encodeURIComponent(startAfterId)}`;

    const data = await ghlFetch(endpoint, "snake");
    const opps: any[] = data?.opportunities ?? [];
    if (opps.length === 0) break;

    for (const opp of opps) {
      // dateUpdated reflects when the status last changed (e.g. marked won)
      const ts = opp.lastStatusChangeAt || opp.createdAt || ""; // Filter by status change date, not general updatedAt
      const ms = ts ? new Date(ts).getTime() : 0;
      if (ms >= startMs) allWon.push(opp);
    }

    // Early exit: with updated_desc sort, once the oldest opp in this page
    // pre-dates startDate, all subsequent pages are also pre-startDate.
    const oldest = opps[opps.length - 1];
    const oldestTs = oldest?.updatedAt || oldest?.lastStatusChangeAt || oldest?.createdAt || "";
    const oldestMs = oldestTs ? new Date(oldestTs).getTime() : 0;
    if (oldestMs > 0 && oldestMs < startMs) break;

    startAfterId = data?.meta?.startAfterId ?? null;
    if (!startAfterId) break;
  }

  setCache(cacheKey, allWon, CACHE_TTL.GHL);
  return allWon;
}

// ─── Fetch contacts with tags ──────────────────────────────────────
export async function getContacts(query?: string) {
  const cacheKey = `ghl_contacts_${query || "all"}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  const params = query ? `?query=${encodeURIComponent(query)}` : "";
  const data = await ghlFetch(`/contacts/${params}`, "camel");
  setCache(cacheKey, data, CACHE_TTL.GHL);
  return data;
}

// ─── Fetch payments/transactions ─────────────────────────────────────
// NOTE: Returns 403 if no payment processor (Stripe) connected to the GHL location.
export async function getPayments(startDate?: string, endDate?: string) {
  const cacheKey = `ghl_payments_${startDate}_${endDate}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  let params = "";
  if (startDate && endDate) {
    params = `?startAt=${startDate}&endAt=${endDate}`;
  }
  const data = await ghlFetch(`/payments/transactions${params}`, "none");
  setCache(cacheKey, data, CACHE_TTL.GHL);
  return data;
}

// ─── Fetch pipelines ────────────────────────────────────────────
export async function getPipelines() {
  const cacheKey = "ghl_pipelines";
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  // /opportunities/pipelines requires locationId (camelCase) — rejects location_id
  const data = await ghlFetch("/opportunities/pipelines", "camel");
  setCache(cacheKey, data, CACHE_TTL.GHL);
  return data;
}

// ─── Aggregate GHL data for dashboard ──────────────────────────────
export async function getGHLDashboardData() {
  const cacheKey = "ghl_dashboard";
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  const token = process.env.GHL_API_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!token || !locationId) {
    throw new Error(
      `GHL credentials missing: ${!token ? "GHL_API_TOKEN" : ""}${!token && !locationId ? ", " : ""}${!locationId ? "GHL_LOCATION_ID" : ""}`
    );
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const errors: string[] = [];

  const [opportunities, pipelines, wonOpportunities] = await Promise.allSettled([
    getOpportunities(),
    getPipelines(),
    getWonOpportunitiesCurrentMonth(startOfMonth),
  ]);

  if (opportunities.status === "rejected")
    errors.push(`Opportunities: ${opportunities.reason?.message}`);
  if (pipelines.status === "rejected")
    errors.push(`Pipelines: ${pipelines.reason?.message}`);
  if (wonOpportunities.status === "rejected")
    errors.push(`WonOpportunities: ${wonOpportunities.reason?.message}`);

  const result = {
    opportunities:
      opportunities.status === "fulfilled"
        ? opportunities.value
        : { opportunities: [] },
    pipelines:
      pipelines.status === "fulfilled" ? pipelines.value : { pipelines: [] },
    wonOpportunities:
      wonOpportunities.status === "fulfilled" ? wonOpportunities.value : [],
    errors,
    fetchedAt: new Date().toISOString(),
  };

  if (errors.length === 0) {
    setCache(cacheKey, result, CACHE_TTL.GHL);
  }
  return result;
}
