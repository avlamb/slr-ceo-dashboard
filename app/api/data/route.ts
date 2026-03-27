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

  const closedOpps = opps.filter((o: any) => o.status === "won");
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
  const organicLeads = hyrosLeads.length - adLeads;ËÈ8¥ 8¥ Ø[Ý[]HYÜ[ÛH\ÜÈ]X][Û]H8¥ 8¥ ÛÛÝÝ[YÜ[H\ÜÐ]X][ÛYXÙJ
Ý[N[X\][JHOÝ[H
È
]ÛÜÝ
K
NÂËÈZ[Ú[[XZÙÝÛÛH\ÜÈ]X][ÛÛÛÝÚ[[X\H]ÈX\Ý[ËÈXYÎ[X\ÈÜ[[X\ÈÛÚÙY[X\ÈÛÜÙY[X\O
NÂ\ÜÐ]X][ÛÜXXÚ

][JHOÂÛÛÝÛÝ\ÙHH]ÛÝ\ÙH]Ø[\ZYÛÛ[YH[ÛÝÛÂÛÛÝ^\Ý[ÈHÚ[[X\Ù]
ÛÝ\ÙJHÈXYÎÜ[ÛÚÙYÛÜÙYNÂ^\Ý[ËXYÈ
ÏH]XYÈÂ^\Ý[ËÜ[
ÏH]ÛÜÝÂ^\Ý[ËÛÜÙY
ÏH]Ø[\ÈÂÚ[[X\Ù]
ÛÝ\ÙK^\Ý[ÊNÂJNÂÛÛÝÚ[[ÈH\^KÛJÚ[[X\[Y\Ê
JBX\

Û[YK]WJHO
Â[YKXYÎ]KXYËÜ[]KÜ[Ü]KXYÈÈ]KÜ[È]KXYÈÛÚÙY]KÛÚÙYÛÜÙY]KÛÜÙYJJBÛÜ

KHOXYÈHKXYÊBÛXÙJ
NÂËÈ8¥ 8¥ Ø[Ý[]H[[ÚX[Y]XÜÈ8¥ 8¥ ÛÛÝÝ[][YHH\ÜÔØ[\ËYXÙJ
Ý[N[X\Î[JHOÝ[H
È
Ë[[Ý[
K
HØ\ÚÛÛXÝYÂÛÛÝY[ÈH^[Y[Ë[\
[JHOÝ]\ÈOOHY[YNÂÛÛÝY[[[Ý[HY[ËYXÙJ
Ý[N[X\[JHOÝ[H
È
[[Ý[
K
NÂËÈ8¥ 8¥ Z[\ÚØ\]H8¥ 8¥ ÛÛÝ\ÚØ\\ÚØ\]HHÂ\Ý\]YÝËÒTÓÔÝ[Ê
K\[Ù	Û[Û[Y\ÖÛÝËÙ][Û

W_H	ÛÝËÙ][YX\
_XØ[\ÎÂÝ[Ø[ÎÝ[ÜËÙ]ÐÛÚÙYX]Ý[
Ý[ÜÈ
KËÈ\Ý[X]HYÝXÚØXH\XÝBÚÝÔ]NÌËÈÚ[HY[YÚ]ÒØ[[\]BÛÜÙYX[ÎÛÜÙYÜË[ÝÛÜÙT]NÝ[ÜÈÈÛÜÙYÜË[ÝÈÝ[ÜÈØ\ÚÛÛXÝYØ\ÚÛÛXÝYÝ[][YK]ÑX[Ú^NÛÜÙYÜË[ÝÈ
Ø\ÚÛÛXÝYÝ[][YJHÈÛÜÙYÜË[Ý\[[U[YNÜÂ[\
Î[JHOËÝ]\ÈOOHÜ[BYXÙJ
Ý[N[X\Î[JHOÝ[H
È
Ë[Û]\U[YH
K
KÙ]\ÐÛÜÙPÛÛ\Ú[ÛËÈYYÈÙ]\XÚÚ[ÂÛÜÙ\ËÙ]\Î×KËÈYYÈÒ\Ù\X\[ÂÙYZÛU[×KËÈYYÈÙYZÛHYÙÜYØ][ÛK[[Y[ÂXÝ]PÛY[ÎËÈYYÈÒÛÛXÝYÈ[\[Â]ÓÛØ\[ÜÎ]ÓÛØ\[Ñ^\ÎÛY[Ø]\ÙXÝ[ÛÚ\]NÚ\Y\Ó[Û][[Û]NÜÛ\ÎÂÈ[YN[\ZÙHXÝ]PÛY[ÎÛØ\Y]Ñ^\ÎØ]\ÙXÝ[ÛKÈ[YNX[Y]HX\Û^HXÝ]PÛY[ÎÛØ\Y]Ñ^\ÎØ]\ÙXÝ[ÛKK[ÛPÚ\×KK[[ÚX[Â\Ý[][YK\ÜÝÝÝ[][YSUÝ[][YKÚXÝY[ÛNÝ[][YH

ÌÈÝËÙ]]J
JKY[ÎY[[[Ý[Y[]NÝ[][YHÈY[[[Ý[ÈÝ[][YHËÈYYÈ\ÝÜXØ[Ø[Ý[][ÛØXÎ\ÜÓXYË[ÝÈÝ[YÜ[ÈÛÜÙYÜË[ÝØXÔ][Î[ÛT][YN×KK\ÂÝ[Ý]Ý[[ÎËÈYYÈ^[Y[Ý]\È[[\Ú\ÂÝ\[^\ÌÌ^\Í^\ÎL\ÎÛÛXÝ[Û]N]Ñ^\ÕÐÛÛXÝZ[Y^[Y[ÎZ[Y^[Y[[[Ý[^[Y[[XÝ]N^[Y[[[YNKX\Ù][ÎÂÝ[XYÎ\ÜÓXYË[ÝYXYËÜØ[XÓXYËYÜ[Ý[YÜ[ÛÜÝ\XYYXYÈÈÝ[YÜ[ÈYXYÈÛÜÝVXÜisition: closedOpps.length > 0 ? totalAdSpend / closedOpps.length : 0,
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

// âââ API Route Handler ââââââââââââââââââââââââââââââââââââââââââââââââââ

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

  // Fetch all sources in parallel (GHL + Hyros only â Hyros provides ad spend via attribution)
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
  }
  if (hyrosResult.status === "rejected") {
    errors.push({
      source: "hyros",
      message: hyrosResult.reason?.message || "Hyros fetch failed",
      timestamp: new Date().toISOString(),
    });
  }

  const dashboard = transformData(ghl, hyros, errors);
  setCache("dashboard_aggregated", dashboard, CACHE_TTL.AGGREGATED);

  return NextResponse.json(dashboard);
}
