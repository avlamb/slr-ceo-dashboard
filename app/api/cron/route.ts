import { NextResponse } from "next/server";
import type { DashboardData } from "@/lib/types";

export const dynamic = "force-dynamic";

// âââ Format KPI summary for email/webhook âââââââââââââââââââââââââââââââââââ

function formatSummary(d: DashboardData): string {
  const lines = [
    `SLR Daily KPI Summary â ${d.period}`,
    `Generated: ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}`,
    "",
    "âââ FINANCIAL âââ",
    `  MRR:              ${fmtUSD(d.financial.mrr)}`,
    `  Revenue MTD:      ${fmtUSD(d.financial.totalRevenueMTD)}`,
    `  Projected Monthly: ${fmtUSD(d.financial.projectedMonthly)}`,
    `  Refunds:          ${fmtUSD(d.financial.refunds)} (${fmtPct(d.financial.refundRate)})`,
    `  LTV:CAC:          ${d.financial.ltvCacRatio.toFixed(1)}x`,
    "",
    "âââ SALES âââ",
    `  Cash Collected:   ${fmtUSD(d.sales.cashCollected)}`,
    `  Closed Deals:     ${d.sales.closedDeals}`,
    `  Close Rate:       ${fmtPct(d.sales.closeRate)}`,
    `  Pipeline Value:   ${fmtUSD(d.sales.pipelineValue)}`,
    `  Avg Deal Size:    ${fmtUSD(d.sales.avgDealSize)}`,
    "",
    "âââ MARKETING âââ",
    `  Total Leads:      ${d.marketing.totalLeads}`,
    `  Ad Spend:         ${fmtUSD(d.marketing.adSpend)}`,
    `  CPL (Paid):       ${fmtUSD(d.marketing.costPerLead)}`,
    `  ROAS:             ${d.marketing.roas.toFixed(1)}x`,
    "",
    "âââ FULFILLMENT âââ",
    `  Active Clients:   ${d.fulfillment.activeClients}`,
    `  Churn Rate:       ${fmtPct(d.fulfillment.churnRate)}`,
    `  Retention:        ${fmtPct(d.fulfillment.retentionRate)}`,
    "",
    "âââ AR âââ",
    `  Outstanding:      ${fmtUSD(d.ar.totalOutstanding)}`,
    `  Collection Rate:  ${fmtPct(d.ar.collectionRate)}`,
    `  Failed Payments:  ${d.ar.failedPayments} (${fmtUSD(d.ar.failedPaymentAmount)})`,
    "",
    "â",
    "View full dashboard: " + (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://your-dashboard.vercel.app"),
  ];
  return lines.join("\n");
}

function fmtUSD(n: number): string {
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
function fmtPct(n: number): string {
  return (n * 100).toFixed(1) + "%";
}

// âââ Cron Route Handler ââââââââââââââââââââââââââââââââââââââââââââââââââââ

export async function GET(request: Request) {
  // Verify cron secret (Vercel sets this header for cron jobs)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch dashboard data from our own API
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
    const password = process.env.DASHBOARD_PASSWORD || "";

    const res = await fetch(`${baseUrl}/api/data?auth=${encodeURIComponent(password)}`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      throw new Error(`Data API returned ${res.status}`);
    }

    const data: DashboardData = await res.json();
    const summary = formatSummary(data);

    // ââ Send via Resend (if configured) ââ
    const resendKey = process.env.RESEND_API_KEY;
    const emailTo = process.env.SUMMARY_EMAIL_TO || "avlamb@gmail.com";

    if (resendKey) {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "SLR Dashboard <dashboard@resend.dev>",
          to: [emailTo],
          subject: `SLR Daily KPIs â ${data.period}`,
          text: summary,
        }),
      });

      if (!emailRes.ok) {
        const errBody = await emailRes.text();
        console.error("Resend error:", errBody);
        return NextResponse.json({
          ok: false,
          error: "Email send failed",
          summary,
        });
      }

      return NextResponse.json({ ok: true, method: "resend", sentTo: emailTo });
    }

    // ââ Fallback: webhook (if configured) ââ
    const webhookUrl = process.env.SUMMARY_WEBHOOK_URL;
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: summary,
          subject: `SLR Daily KPIs â ${data.period}`,
        }),
      });
      return NextResponse.json({ ok: true, method: "webhook" });
    }

    // ââ No delivery method configured â return summary in response ââ
    return NextResponse.json({
      ok: true,
      method: "none",
      message: "No RESEND_API_KEY or SUMMARY_WEBHOOK_URL configured. Summary generated but not sent.",
      summary,
    });
  } catch (err: any) {
    console.error("Cron error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
