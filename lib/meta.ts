import { getCached, setCache, CACHE_TTL } from "./cache";

const META_GRAPH_URL = "https://graph.facebook.com/v19.0";

async function metaFetch(endpoint: string) {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("Meta access token not configured");

  const sep = endpoint.includes("?") ? "&" : "?";
  const url = `${META_GRAPH_URL}${endpoint}${sep}access_token=${token}`;

  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Meta API error: ${res.status} - ${err?.error?.message || res.statusText}`
    );
  }
  return res.json();
}

// âââ Fetch campaign insights for current month ââââââââââââââââââââââââ
// Throws on failure â caller (getMetaDashboardData) handles via Promise.allSettled
export async function getCampaignInsights(
  startDate?: string,
  endDate?: string
) {
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  if (!adAccountId) throw new Error("Meta Ad Account ID not configured");

  const cacheKey = `meta_insights_${startDate}_${endDate}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  const now = new Date();
  const start =
    startDate ||
    new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
  const end = endDate || now.toISOString().split("T")[0];

  const fields = [
    "campaign_id",
    "campaign_name",
    "spend",
    "impressions",
    "clicks",
    "actions",
    "cost_per_action_type",
    "cpc",
    "cpm",
    "reach",
  ].join(",");

  const data = await metaFetch(
    `/${adAccountId}/insights?fields=${fields}&time_range={"since":"${start}","until":"${end}"}&level=campaign&limit=100`
  );

  setCache(cacheKey, data, CACHE_TTL.META);
  return data;
}

// âââ Fetch ad-level insights ââââââââââââââââââââââââââââââââââââââââââ
// Throws on failure â caller handles via Promise.allSettled
export async function getAdInsights(startDate?: string, endDate?: string) {
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  if (!adAccountId) throw new Error("Meta Ad Account ID not configured");

  const cacheKey = `meta_ad_insights_${startDate}_${endDate}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  const now = new Date();
  const start =
    startDate ||
    new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
  const end = endDate || now.toISOString().split("T")[0];

  const fields = ["ad_id", "ad_name", "spend", "impressions", "clicks", "actions"].join(",");

  const data = await metaFetch(
    `/${adAccountId}/insights?fields=${fields}&time_range={"since":"${start}","until":"${end}"}&level=ad&limit=100`
  );

  setCache(cacheKey, data, CACHE_TTL.META);
  return data;
}

// âââ Get total spend for period âââââââââââââââââââââââââââââââââââââââ
// Throws on failure â caller handles via Promise.allSettled
export async function getAccountSpend(startDate?: string, endDate?: string) {
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  if (!adAccountId) throw new Error("Meta Ad Account ID not configured");

  const cacheKey = `meta_spend_${startDate}_${endDate}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  const now = new Date();
  const start =
    startDate ||
    new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
  const end = endDate || now.toISOString().split("T")[0];

  const data = await metaFetch(
    `/${adAccountId}/insights?fields=spend,impressions,clicks,actions&time_range={"since":"${start}","until":"${end}"}`
  );

  setCache(cacheKey, data, CACHE_TTL.META);
  return data;
}

// âââ Aggregate Meta data for dashboard âââââââââââââââââââââââââââââââââ
export async function getMetaDashboardData() {
  const cacheKey = "meta_dashboard";
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  const token = process.env.META_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  if (!token || !adAccountId) {
    throw new Error(
      `Meta credentials missing: ${!token ? "META_ACCESS_TOKEN" : ""}${!token && !adAccountId ? ", " : ""}${!adAccountId ? "META_AD_ACCOUNT_ID" : ""}`
    );
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const today = now.toISOString().split("T")[0];

  const errors: string[] = [];
  const [campaignInsights, accountSpend] = await Promise.allSettled([
    getCampaignInsights(startOfMonth, today),
    getAccountSpend(startOfMonth, today),
  ]);

  if (campaignInsights.status === "rejected") errors.push(`Campaigns: ${campaignInsights.reason?.message}`);
  if (accountSpend.status === "rejected") errors.push(`AccountSpend: ${accountSpend.reason?.message}`);

  const result = {
    campaigns:
      campaignInsights.status === "fulfilled"
        ? campaignInsights.value
        : { data: [] },
    accountSpend:
      accountSpend.status === "fulfilled" ? accountSpend.value : { data: [] },
    errors,
    fetchedAt: new Date().toISOString(),
  };

  // Only cache if no errors
  if (errors.length === 0) {
    setCache(cacheKey, result, CACHE_TTL.META);
  }
  return result;
}
