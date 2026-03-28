/**
 * app/api/data/route.ts
 * Primary data endpoint — reads from Google Sheets, returns DashboardData
 *
 * Cache: 5-minute in-memory TTL (server-side)
 * Auth:  GOOGLE_SERVICE_ACCOUNT_KEY env var required
 *
 * Sources:
 *   - SLR 2026 Closer Tracker Sheet     → sales KPIs, monthly history
 *   - SLR 2026 Setter Tracker           → setter KPIs
 *   - SLR Deals Master List             → per-rep breakdown, AR
 *   - SLR Projection Dashboard 2026     → cash vs projection vs pace
 *   - GoHighLevel Calendar API          → real appointment counts (totalCalls + per-closer)
 */

import { NextResponse } from "next/server";
import {
  fetchAllSheetData,
  money,
  pct,
  num,
  MONTH_NAMES_SHORT,
} from "@/lib/sheets";
import { getCalendarAppointmentsCurrentMonth } from "@/lib/ghl";
import { getCached, setCache, CACHE_TTL } from "@/lib/cache";
import type {
  DashboardData,
  CloserMetrics,
  SetterMetrics,
  DataSourceError,
} from "@/lib/types";

export const dynamic = "force-dynamic";

type CalendarEntry = { name: string; count: number };

// ─── Fuzzy-match a closer name to a GHL calendar entry ────────────────────────
// Strategy: split closer name into tokens (≥3 chars), require ALL tokens to
// appear in the calendar name. Falls back to any-single-token match if needed.
const NICKNAMES: Record<string, string[]> = {
  gabriel: ["gabe"],
  gabe: ["gabriel"],
  dan: ["daniel"],
  daniel: ["dan"],
  nate: ["nathan", "nathaniel"],
  nathan: ["nate"],
};

function expandName(tokens: string[]): string[] {
  const expanded = new Set(tokens);
  for (const t of tokens) {
    const alts = NICKNAMES[t];
    if (alts) alts.forEach((a) => expanded.add(a));
  }
  return Array.from(expanded);
}

// ─── Fuzzy-match a closer name to a GHL calendar entry ────────────────────────
// 3-tier: exact → all-token (nickname-expanded) → scored first-name fallback.
function matchCalendar(
  closerName: string,
  calendars: CalendarEntry[]
): number {
  const lower = closerName.toLowerCase().trim();
  const tokens = lower.split(/\s+/).filter((t) => t.length >= 3);
  if (tokens.length === 0) return 0;
  const expanded = expandName(tokens);

  // 1. Exact substring match
  for (const cal of calendars) {
    if (cal.name.toLowerCase().includes(lower)) return cal.count;
  }

  // 2. All-token match (nickname-expanded)
  if (expanded.length > 1) {
    for (const cal of calendars) {
      const cn = cal.name.toLowerCase();
      if (expanded.every((t) => cn.includes(t))) return cal.count;
    }
  }

  // 3. Scored first-name fallback — picks best match when multiple cals share first name
  const firstAlts = expandName([tokens[0]]);
  let best: { count: number; score: number } | null = null;
  for (const cal of calendars) {
    const cn = cal.name.toLowerCase();
    if (!firstAlts.some((fn) => cn.includes(fn))) continue;
    let score = 1;
    for (const t of tokens.slice(1)) {
      if (cn.includes(t)) score += 2;
      else if (new RegExp("[ -]" + t[0] + "(?:[ -]|$)").test(cn)) score += 1;
    }
    if (!best || score > best.score) best = { count: cal.count, score };
  }
  return best?.count ?? 0;
}

// ─── Transform sheets data → DashboardData ─────────────────────────────────────
function transformSheetData(
  closer: Awaited<ReturnType<typeof fetchAllSheetData>>["closer"],
  setter: Awaited<ReturnType<typeof fetchAllSheetData>>["setter"],
  deals: Awaited<ReturnType<typeof fetchAllSheetData>>["deals"],
  projection: Awaited<ReturnType<typeof fetchAllSheetData>>["projection"],
  errors: DataSourceError[],
  ghlCalendarTotal?: number,
  ghlPerCalendar?: CalendarEntry[]
): DashboardData {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const period = `${MONTH_NAMES_SHORT[currentMonth]} ${currentYear}`;

  // ── Per-rep metrics from Deals Master List (current month only) ──
  const closerDealsMap = new Map<string, { closes: number; revenue: number }>();
  const setterDealsMap = new Map<string, { closes: number; revenue: number }>();

  if (deals?.deals) {
    deals.deals
      .filter((d) => {
        if (!d.dateWon) return false;
        return (
          d.dateWon.getFullYear() === currentYear &&
          d.dateWon.getMonth() === currentMonth
        );
      })
      .forEach((d) => {
        if (d.closer) {
          const c = closerDealsMap.get(d.closer) || { closes: 0, revenue: 0 };
          c.closes++;
          c.revenue += d.dealValue;
          closerDealsMap.set(d.closer, c);
        }
        if (d.setter) {
          const s = setterDealsMap.get(d.setter) || { closes: 0, revenue: 0 };
          s.closes++;
          s.revenue += d.dealValue;
          setterDealsMap.set(d.setter, s);
        }
      });
  }

  // ── Supplement closer call counts from Leaderboard tab ──
  const closerCallMap = new Map<string, number>();
  if (closer?.leaderboard && closer.leaderboard.length > 1) {
    const headers = (closer.leaderboard[0] || []).map((h) =>
      (h || "").toLowerCase()
    );
    const nameCol = headers.findIndex(
      (h) => h.includes("name") || h.includes("rep") || h.includes("closer")
    );
    const callCol = headers.findIndex(
      (h) => h.includes("sched") || h.includes("live") || h.includes("call")
    );
    if (nameCol >= 0 && callCol >= 0) {
      closer.leaderboard.slice(1).forEach((row) => {
        const name = row[nameCol];
        const calls = num(row[callCol]);
        if (name && calls > 0) closerCallMap.set(name, calls);
      });
    }
  }

  // ── Override per-closer call counts with GHL calendar data (real-time) ──
  const cals = ghlPerCalendar ?? [];
  if (cals.length > 0) {
    // Override existing sheet-sourced call counts
    closerCallMap.forEach((_v, name) => {
      const ghlCount = matchCalendar(name, cals);
      if (ghlCount > 0) closerCallMap.set(name, ghlCount);
    });
    // Add closers from Deals that have no leaderboard entry
    closerDealsMap.forEach((_v, name) => {
      if (!closerCallMap.has(name)) {
        const ghlCount = matchCalendar(name, cals);
        if (ghlCount > 0) closerCallMap.set(name, ghlCount);
      }
    });

  }

  // ── Build closers array ──
  const closers: CloserMetrics[] = Array.from(
    new Set([...Array.from(closerDealsMap.keys()), ...Array.from(closerCallMap.keys())])
  )
    .map((name) => {
      const d = closerDealsMap.get(name) || { closes: 0, revenue: 0 };
      const calls = closerCallMap.get(name) || 0;
      return {
        name,
        calls,
        closes: d.closes,
        revenue: d.revenue,
        rate: calls > 0 ? d.closes / calls : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  // ── Build setters array from Setter Leaderboard tab ──
  const setters: SetterMetrics[] = [];
  if (setter?.leaderboard && setter.leaderboard.length > 1) {
    const headers = (setter.leaderboard[0] || []).map((h) =>
      (h || "").toLowerCase()
    );
    const nameCol = headers.findIndex(
      (h) => h.includes("name") || h.includes("rep") || h.includes("setter")
    );
    const setsCol = headers.findIndex(
      (h) => h.includes("set") && !h.includes("close") && !h.includes("off")
    );
    const showedCol = headers.findIndex(
      (h) => h.includes("live") || h.includes("show")
    );
    const convCol = headers.findIndex(
      (h) => h.includes("conv") || (h.includes("rate") && !h.includes("show"))
    );

    if (nameCol >= 0) {
      setter.leaderboard.slice(1).forEach((row) => {
        const name = row[nameCol];
        if (!name) return;
        setters.push({
          name,
          setsBooked: setsCol >= 0 ? num(row[setsCol]) : 0,
          showed: showedCol >= 0 ? num(row[showedCol]) : 0,
          convRate: convCol >= 0 ? pct(row[convCol]) : 0,
        });
      });
    }
  }

  // ── Monthly revenue chart from closer history ──
  const monthlyRevenue = (closer?.history || []).map((h) => ({
    month: h.month,
    revenue: h.cashCollected,
  }));

  const weeklyTrend = (closer?.history || []).map((h) => ({
    week: h.month,
    revenue: h.cashCollected,
    deals: h.closes,
  }));

  // ── AR: deals with payment plans in current month ──
  let arOutstanding = 0;
  let paymentPlansActive = 0;
  let paymentPlanValue = 0;

  if (deals?.deals) {
    deals.deals
      .filter((d) => {
        if (!d.dateWon) return false;
        if (
          d.dateWon.getFullYear() !== currentYear ||
          d.dateWon.getMonth() !== currentMonth
        )
          return false;
        const plan = (d.paymentPlan || "").toLowerCase();
        return plan && plan !== "paid in full" && plan !== "pif";
      })
      .forEach((d) => {
        paymentPlansActive++;
        paymentPlanValue += d.dealValue;
        const depositMatch = d.paymentPlan.match(/\$?([\d,]+)\s*(down|deposit)/i);
        const deposit = depositMatch ? money(depositMatch[1]) : 0;
        arOutstanding += Math.max(d.dealValue - deposit, 0);
      });
  }

  // ── MRR growth ──
  const hist = closer?.history || [];
  let mrrGrowth = 0;
  if (hist.length >= 2) {
    const prev = hist[hist.length - 2].cashCollected;
    const curr = hist[hist.length - 1].cashCollected;
    mrrGrowth = prev > 0 ? (curr - prev) / prev : 0;
  }

  const cashCollected =
    projection?.cashActual || closer?.current?.cashCollected || 0;
  const closes = closer?.current?.closes || 0;

  return {
    lastUpdated: now.toISOString(),
    period,

    sales: {
      totalCalls: ghlCalendarTotal ?? closer?.current?.scheduledCalls ?? 0,
      setsBooked:
        setter?.current?.setsOnCalendar ?? setter?.current?.sets ?? 0,
      showRate: closer?.current?.showRate ?? 0,
      closedDeals: closes,
      closeRate: closer?.current?.callCloseRate ?? 0,
      cashCollected,
      avgDealSize: closes > 0 ? cashCollected / closes : 0,
      pipelineValue: 0,
      setterToCloseConversion: setter?.current?.setToClose ?? 0,
      closers,
      setters,
      weeklyTrend,
    },

    fulfillment: {
      activeClients: 0,
      newOnboardings: closes,
      avgOnboardingDays: 0,
      clientSatisfaction: 0,
      churnRate: 0,
      churnedThisMonth: 0,
      retentionRate: 0,
      csms: [
        {
          name: "Philip Blake",
          activeClients: 0,
          onboarded: 0,
          avgDays: 0,
          satisfaction: 0,
        },
        {
          name: "Juanyetta Beasley",
          activeClients: 0,
          onboarded: 0,
          avgDays: 0,
          satisfaction: 0,
        },
      ],
      monthlyChurn: [],
    },

    financial: {
      mrr: cashCollected,
      mrrGrowth,
      totalRevenueMTD: cashCollected,
      projectedMonthly: projection?.cashProjection ?? 0,
      refunds: 0,
      refundRate: 0,
      ltv: 0,
      cac: 0,
      ltvCacRatio: 0,
      monthlyRevenue,
    },

    ar: {
      totalOutstanding: arOutstanding,
      current: arOutstanding,
      days30: 0,
      days60: 0,
      days90plus: 0,
      collectionRate: closer?.current?.collectionRate ?? 0,
      avgDaysToCollect: 0,
      failedPayments: 0,
      failedPaymentAmount: 0,
      paymentPlanActive: paymentPlansActive,
      paymentPlanValue,
    },

    marketing: {
      totalLeads: setter?.current?.leadsAssigned ?? 0,
      adLeads: 0,
      organicLeads: 0,
      adSpend: 0,
      costPerLead: 0,
      costPerAcquisition: 0,
      roas: 0,
      adCallsBooked: 0,
      organicCallsBooked: 0,
      adShowRate: 0,
      organicShowRate: 0,
      channels: [],
      weeklyAdPerformance: [],
    },

    errors,
  };
}

// ─── Route Handler ─────────────────────────────────────────────────────────────
export async function GET() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return NextResponse.json(
      {
        error: "GOOGLE_SERVICE_ACCOUNT_KEY not configured",
        setup: "Add service account JSON to .env.local — see .env.local.example",
      },
      { status: 503 }
    );
  }

  // Cache check — stored with _ghlCalendars so both paths return it
  const cached = getCached<DashboardData & { _ghlCalendars: CalendarEntry[] }>(
    "dashboard_sheets"
  );
  if (cached) return NextResponse.json(cached);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [sheetsResult, calendarResult] = await Promise.allSettled([
    fetchAllSheetData(),
    process.env.GHL_API_TOKEN && process.env.GHL_LOCATION_ID
      ? getCalendarAppointmentsCurrentMonth(startOfMonth)
      : Promise.resolve(null),
  ]);

  const { closer, setter, deals, projection, errors } =
    sheetsResult.status === "fulfilled"
      ? sheetsResult.value
      : { closer: null, setter: null, deals: null, projection: null, errors: [] };

  const ghlPerCalendar: CalendarEntry[] =
    calendarResult.status === "fulfilled" && calendarResult.value
      ? calendarResult.value.perCalendar
      : [];

  // Identify paid (self-book, has *) and organic calendars for separate tracking
  const paidCal = ghlPerCalendar.find((c) => c.name.includes("*"));
  const organicCal = ghlPerCalendar.find((c) => /^organic/i.test(c.name.trim()));
  const callsPaid = paidCal?.count ?? 0;
  const callsOrganic = organicCal?.count ?? 0;
  // totalCalls = paid + organic (avoids double-counting setter/aggregate calendars)
  const ghlCalendarTotal =
    callsPaid + callsOrganic > 0 ? callsPaid + callsOrganic : undefined;

  const dashboard = transformSheetData(
    closer,
    setter,
    deals,
    projection,
    errors as DataSourceError[],
    ghlCalendarTotal,
    ghlPerCalendar
  );

  // Store with _ghlCalendars so cached responses also include it
  const fullResponse = { ...dashboard, _ghlCalendars: ghlPerCalendar, callsPaid, callsOrganic };
  setCache("dashboard_sheets", fullResponse, CACHE_TTL.SHEETS);

  return NextResponse.json(fullResponse);
}
