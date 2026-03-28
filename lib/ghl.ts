import { getCached, setCache, CACHE_TTL } from "./cache";

const GHL_BASE = "https://services.leadconnectorhq.com";

// CSM name patterns — calendars matching these are excluded from call counts
const CSM_NAME_PATTERNS = ["philip", "blake", "juanyetta", "beasley"];

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

// ─── Raw authenticated fetch (no auto-locationId injection) ────────────
async function ghlRawFetch(url: string) {
  const token = process.env.GHL_API_TOKEN;
  if (!token) throw new Error("GHL credentials not configured");
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    },
  });
  if (!res.ok) throw new Error(`GHL API error: ${res.status} ${res.statusText}`);
  return res.json();
}

// ─── Fetch opportunities (first 100, for quick pipeline overview) ──────
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

// ─── Fetch ALL won opportunities for current month (cursor-paginated) ──
// Uses order=updated_desc with early exit for efficiency.
// Filters by lastStatusChangeAt (when deal was marked won), falling back to updatedAt/createdAt.
export async function getWonOpportunitiesCurrentMonth(startDate: string): Promise<any[]> {
  const cacheKey = `ghl_won_opps_${startDate}`;
  const cached = getCached<any[]>(cacheKey);
  if (cached) return cached;

  const token = process.env.GHL_API_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!token || !locationId) throw new Error("GHL credentials not configured");

  const startMs = new Date(startDate).getTime();
  let allWon: any[] = [];
  let startAfterId: string | null = null;
  const MAX_PAGES = 30;

  for (let page = 0; page < MAX_PAGES; page++) {
    let url = `${GHL_BASE}/opportunities/search?locationId=${locationId}&status=won&order=updated_desc&limit=100`;
    if (startAfterId) url += `&startAfterId=${encodeURIComponent(startAfterId)}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Version: "2021-07-28",
      },
    });
    if (!res.ok) break;

    const data = await res.json();
    const opps: any[] = data?.opportunities ?? [];
    if (opps.length === 0) break;

    for (const opp of opps) {
      // Use lastStatusChangeAt (when marked won) → updatedAt → createdAt
      const ts = opp.lastStatusChangeAt || opp.updatedAt || opp.createdAt || "";
      const ms = ts ? new Date(ts).getTime() : 0;
      if (ms >= startMs) allWon.push(opp);
    }

    // Early exit: oldest item on this page predates start of month
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

// ─── Fetch contacts with tags ──────────────────────────────────────────
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

// ─── Fetch payments/transactions ───────────────────────────────────────
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

// ─── Fetch pipelines ──────────────────────────────────────────────────
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

// ─── Fetch GHL users (for assignedTo ID → name resolution) ───────────
export async function getUsers() {
  const cacheKey = "ghl_users";
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  try {
    const data = await ghlFetch(`/users/?locationId=${process.env.GHL_LOCATION_ID ?? ""}`);
    setCache(cacheKey, data, CACHE_TTL.GHL);
    return data;
  } catch (err) {
    console.error("GHL users fetch error:", err);
    return { users: [] };
  }
}

// ─── Fetch all calendars ───────────────────────────────────────────────
export async function getCalendars() {
  const cacheKey = "ghl_calendars";
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  try {
    const data = await ghlFetch("/calendars/");
    setCache(cacheKey, data, CACHE_TTL.GHL);
    return data;
  } catch (err) {
    console.error("GHL calendars fetch error:", err);
    return { calendars: [] };
  }
}

// ─── Count calendar appointments for current month (excl CSMs) ─────────
// Fetches all non-Personal, non-CSM booking calendars and sums event counts.
// Batched in groups of 10 to avoid overwhelming the API.
export async function getCalendarAppointmentsCurrentMonth(
  startDate: string
): Promise<{
  total: number;
  perCalendar: Array<{ name: string; count: number }>;
  perUser: Array<{ name: string; count: number }>;
}> {
  const cacheKey = `ghl_cal_appts_${startDate}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  const token = process.env.GHL_API_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!token || !locationId) throw new Error("GHL credentials not configured");

  const startMs = new Date(startDate).getTime();
  // End = last ms of the current month
  const startDt = new Date(startDate);
  const endMs = new Date(startDt.getFullYear(), startDt.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

  // Get all calendars, filter out Personal Calendars and CSM calendars
  const calendarsData = await getCalendars();
  const allCalendars: any[] = calendarsData?.calendars || [];

  const bookingCalendars = allCalendars.filter(
    // Only fetch events from paid (*) + organic calendars — reduces ~15 GHL calls to 2
    (cal: any) => cal.name.includes("*") || /^organic/i.test(cal.name.trim())
  );

  // Build userId -> name map for per-closer attribution
  const usersData = await getUsers();
  const userIdToName = new Map<string, string>();
  for (const u of usersData?.users || []) {
    const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
    if (name) userIdToName.set(u.id, name);
  }

  // Fetch event counts in batches of 10 (parallel within each batch)
  // Also collect events for per-user attribution
  const BATCH_SIZE = 10;
  const perCalendar: Array<{ name: string; count: number }> = [];
  const userCountMap = new Map<string, number>(); // userName -> count

  for (let i = 0; i < bookingCalendars.length; i += BATCH_SIZE) {
    const batch = bookingCalendars.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (cal: any) => {
        const url = `${GHL_BASE}/calendars/events?locationId=${locationId}&calendarId=${cal.id}&startTime=${startMs}&endTime=${endMs}`;
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Version: "2021-07-28",
          },
        });
        if (!res.ok) return { name: cal.name, count: 0, events: [] as any[] };
        const data = await res.json();
        const events: any[] = data?.events || [];
        return { name: cal.name, count: events.length, events };
      })
    );
    results.forEach((r) => {
      if (r.status !== "fulfilled") return;
      const { name, count, events } = r.value;
      perCalendar.push({ name, count });
      // Attribute each appointment to its assigned user
      for (const evt of events) {
        const userId: string | undefined =
          evt.assignedUserId || evt.userId || evt.users?.[0]?.id;
        if (!userId) continue;
        const userName = userIdToName.get(userId);
        if (!userName) continue;
        // Skip CSMs
        if (CSM_NAME_PATTERNS.some((p) => userName.toLowerCase().includes(p))) continue;
        userCountMap.set(userName, (userCountMap.get(userName) || 0) + 1);
      }
    });
  }

  const total = perCalendar.reduce((sum, c) => sum + c.count, 0);
  const perUser = Array.from(userCountMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const result = { total, perCalendar, perUser };
  setCache(cacheKey, result, CACHE_TTL.GHL);
  return result;
}

// ─── Aggregate GHL data for dashboard ──────────────────────────────────
export async function getGHLDashboardData() {
  const cacheKey = "ghl_dashboard";
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endOfMonth = now.toISOString();

  const [opportunities, payments, pipelines, wonOpportunities, calendarAppointments, users] =
    await Promise.allSettled([
      getOpportunities(),
      getPayments(startOfMonth, endOfMonth),
      getPipelines(),
      getWonOpportunitiesCurrentMonth(startOfMonth),
      getCalendarAppointmentsCurrentMonth(startOfMonth),
      getUsers(),
    ]);

  const result = {
    opportunities:
      opportunities.status === "fulfilled" ? opportunities.value : { opportunities: [] },
    payments: payments.status === "fulfilled" ? payments.value : { data: [] },
    pipelines: pipelines.status === "fulfilled" ? pipelines.value : { pipelines: [] },
    wonOpportunities:
      wonOpportunities.status === "fulfilled" ? wonOpportunities.value : [],
    calendarAppointments:
      calendarAppointments.status === "fulfilled"
        ? calendarAppointments.value
        : { total: 0, perCalendar: [] },
    users: users.status === "fulfilled" ? users.value : { users: [] },
    fetchedAt: new Date().toISOString(),
  };

  setCache(cacheKey, result, CACHE_TTL.GHL);
  return result;
}
