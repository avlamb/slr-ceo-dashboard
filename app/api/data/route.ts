import { NextResponse } from "next/server";
import { getGHLDashboardData } from "@/lib/ghl";
import { getHyrosDashboardData } from "@/lib/hyros";
import { getCached, setCache, CACHE_TTL } from "@/lib/cache";
import type { DashboardData, DataSourceError } from "@/lib/types";

export const dynamic = "force-dynamic";

// âââ Transform raw API data into dashboard format ââââââââââââââââââââââ

function transformData(
  ghl: any,
  hyros: any,
  errors: DataSourceError[]
): DashboardData {
  const now = new Date();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // ââ Parse GHL opportunities into sales metrics ââ
  const opps = ghl?.opportunities?.opportunities || [];
  const payments = ghl?.payments?.data || [];

  // wonOpportunities: paginated all won deals for current month
  const wonOpps: any[] = (ghl?.wonOpportunities as any[]) || [];
  const closedOpps = wonOpps.length > 0 ? wonOpps : opps.filter((o: any) => o.status === "won");
  const totalOpps = opps.length;
  const cashCollected = closedOpps.reduce((sum: number, o: any) => sum + (o.monetaryValue || 0), 0);

  // Group by assignedTo for closer metrics
  const closerMap = new Map<string, { calls: number; closes: number; revenue: number }>();
  opps.forEach((o: any) => {
    const assigned = o.assignedTo || "Unassigned";
    const existing = closerMap.get(assigned) || { calls: 0, closes: 0, revenue: 0 };
    existing.calls++;
    if (o.status === "won") {
      existing.closes++;
      existing.revenue += o.monetaryValue || 0;
    }
    closerMap.set(assigned, existing);
  });

  const closers = Array.from(closerMap.entries()).map(([name, data]) => ({
    name,
    calls: data.calls,
    closes: data.closes,
    revenue: data.revenue,
    rate: data.calls > 0 ? data.closes / data.calls : 0,
  }));

  // ââ Parse Hyros data for marketing metrics ââ
  const hyrosLeads = hyros?.leads?.data || [];
  const hyrosSales = hyros?.sales?.data || [];
  const hyrosSources = hyros?.sources?.data || [];
  const hyrosAttribution = hyros?.attribution?.data || [];

  const adLeads = hyrosLeads.filter((l: any) =>
    (l.sources || []).some((s: string) =>
      s.toLowerCase().includes("facebook") ||
      s.toLowerCase().includes("meta") ||
      s.toLowerCase().includes("google") ||
      s.toLowerCase().includes("youtube")
    )
  ).length;
  const organicLeads = hyrosLeads.length - adLeads;

  // ââ Ad spend: Meta campaigns as primary source, Hyros attribution as fallback ââ
  const hyrosAdSpend = hyrosAttribution.reduce(
    (sum: number, attr: any) => sum + (attr.cost || 0),
    0
  );
  const totalAdSpend = hyrosAdSpend;

  // Build channel breakdown from Hyros attribution
  const channelMap = new Map<string, { leads: number; spend: number; booked: number; closed: number }>();

  hyrosAttribution.forEach((attr: any) => {
    const source = attr.source || attr.campaign_name || "Unknown";
    const existing = channelMap.get(source) || { leads: 0, spend: 0, booked: 0, closed: 0 };
    existing.leads += attr.leads || 0;
    existing.spend += attr.cost || 0;
    existing.closed += attr.sales || 0;
    channelMap.set(source, existing);
  });

  const channels = Array.from(channelMap.entries())
    .map(([name, data]) => ({
      name,
      leads: data.leads,
      spend: data.spend,
      cpl: data.leads > 0 ? data.spend / data.leads : 0,
      booked: data.booked,
      closed: data.closed,
    }))
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 8);

  // ââ Calculate financial metrics ââ
  const totalRevenue = hyrosSales.reduce((sum: number, s: any) => sum + (s.amount || 0), 0) || cashCollected;
  const refunds = payments.filter((p: any) => p.status === "refunded");
  const refundAmount = refunds.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

  // ââ Build dashboard data ââ
  const dashboard: DashboardData = {
    lastUpdated: now.toISOString(),
    period: `${monthNames[now.getMonth()]} ${now.getFullYear()}`,

    sales: {
      totalCalls: totalOpps,
      setsBooked: Math.round(totalOpps * 0.6), // Estimate if not trackable directly
      showRate: 0.72, // Will be refined with GHL calendar data
      closedDeals: closedOpps.length,
      closeRate: totalOpps > 0 ? closedOpps.length / totalOpps : 0,
      cashCollected: cashCollected || totalRevenue,
      avgDealSize: closedOpps.length > 0 ? (cashCollected || totalRevenue) / closedOpps.length : 0,
      pipelineValue: opps
        .filter((o: any) => o.status === "open")
        .reduce((sum: number, o: any) => sum + (o.monetaryValue || 0), 0),
      setterToCloseConversion: 0, // Needs setter tracking
      closers,
      setters: [], // Needs GHL user mapping
      weeklyTrend: [], // Needs weekly aggregation
    },

    fulfillment: {
      activeClients: 0, // Needs GHL contact tag filtering
      newOnboardings: 0,
      avgOnboardingDays: 0,
      clientSatisfaction: 0,
      churnRate: 0,
      churnedThisMonth: 0,
      retentionRate: 0,
      csms: [
        { name: "Philip Blake", activeClients: 0, onboarded: 0, avgDays: 0, satisfaction: 0 },
        { name: "Juanyetta Beasley", activeClients: 0, onboarded: 0, avgDays: 0, satisfaction: 0 },
      ],
      monthlyChurn: [],
    },

    financial: {
      mrr: totalRevenue,
      mrrGrowth: 0,
      totalRevenueMTD: totalRevenue,
      projectedMonthly: totalRevenue * (30 / now.getDate()),
      refunds: refundAmount,
      refundRate: totalRevenue > 0 ? refundAmount / totalRevenue : 0,
      ltv: 0, // Needs historical calculation
      cac: closedOpps.length > 0 ? totalAdSpend / closedOpps.length : 0,
      ltvCacRatio: 0,
      monthlyRevenue: [],
    },

    ar: {
      totalOutstanding: 0, // Needs payment status analysis
      current: 0,
      days30: 0,
      days60: 0,
      days90plus: 0,
      collectionRate: 0,
      avgDaysToCollect: 0,
      failedPayments: 0,
      failedPaymentAmount: 0,
      paymentPlanActive: 0,
      paymentPlanValue: 0,
    },

    marketing: {
      totalLeads: hyrosLeads.length,
      adLeads,
      organicLeads,
      adSpend: totalAdSpend,
      costPerLead: adLeads > 0 ? totalAdSpend / adLeads : 0,
      costPerAcquisition: closedOpps.length > 0 ? totalAdSpend / closedOpps.length : 0,
      roas: totalAdSpend > 0 ? totalRevenue / totalAdSpend : 0,
      adCallsBooked: 0,
      organicCallsBooked: 0,
      adShowRate: 0,
      organicShowRate: 0,
      channels,
      weeklyAdPerformance: [],
    },

    errors,
  };

  return dashboard;
}

// âââ API Route Handler âââââââââââââââââââââââââââââââââââââââââââââââââ

export async function GET(request: Request) {
  // Simple password auth via query param or header
  const url = new URL(request.url);
  const authHeader = request.headers.get("x-dashboard-auth");
  const authParam = url.searchParams.get("auth");
  const password = process.env.DASHBOARD_PASSWORD;

  if (password && authHeader !== password && authParam !== password) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check aggregated cache first
  const cached = getCached<DashboardData>("dashboard_aggregated");
  if (cached) {
    return NextResponse.json(cached);
  }

  const errors: DataSourceError[] = [];

  // Fetch all three sources in parallel
  const [ghlResult, hyrosResult] = await Promise.allSettled([
    getGHLDashboardData(),
    getHyrosDashboardData(),
  ]);

  const ghl = ghlResult.status === "fulfilled" ? ghlResult.value : null;
  const hyros = hyrosResult.status === "fulfilled" ? hyrosResult.value : null;

  if (ghlResult.status === "rejected") {
    errors.push({
      source: "ghl",
      message: ghlResult.reason?.message || "GHL fetch failed",
      timestamp: new Date().toISOString(),
    });
  } else if (ghl?.errors?.length) {
    // Partial GHL errors (some endpoints failed)
    for (const e of ghl.errors) {
      errors.push({ source: "ghl", message: e, timestamp: new Date().toISOString() });
    }
  }

  if (hyrosResult.status === "rejected") {
    errors.push({
      source: "hyros",
      message: hyrosResult.reason?.message || "Hyros fetch failed",
      timestamp: new Date().toISOString(),
    });
  } else if (hyros?.errors?.length) {
    // Partial Hyros errors (some endpoints failed)
    for (const e of hyros.errors) {
      errors.push({ source: "hyros", message: e, timestamp: new Date().toISOString() });
    }
  }

  const dashboard = transformData(ghl, hyros, errors);

  // Only cache if no errors
  if (errors.length === 0) {
    setCache("dashboard_aggregated", dashboard, CACHE_TTL.AGGREGATED);
  }

  return NextResponse.json(dashboard);
}
