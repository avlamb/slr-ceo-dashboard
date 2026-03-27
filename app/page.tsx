"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  DashboardData,
  CloserMetrics,
  SetterMetrics,
  CSMMetrics,
  ChannelMetrics,
  WeeklyRevenue,
  WeeklyAdPerformance,
  MonthlyRevenuePoint,
  MonthlyChurn,
} from "@/lib/types";

// âââ Design Tokens ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const T = {
  bg: "#0f1117",
  card: "#181b23",
  border: "#2a2d38",
  text: "#e8e9ed",
  muted: "#7a7f8e",
  accent: "#6366f1",
  green: "#22c55e",
  red: "#ef4444",
  amber: "#f59e0b",
  cardRadius: 12,
  cardPad: 20,
};

// âââ Demo Data ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const DEMO_DATA: DashboardData = {
  lastUpdated: new Date().toISOString(),
  period: "Mar 2026",
  sales: {
    totalCalls: 187,
    setsBooked: 112,
    showRate: 0.72,
    closedDeals: 34,
    closeRate: 0.182,
    cashCollected: 289_400,
    avgDealSize: 8_512,
    pipelineValue: 478_200,
    setterToCloseConversion: 0.304,
    closers: [
      { name: "Drew", calls: 42, closes: 9, revenue: 76_500, rate: 0.214 },
      { name: "Marcus", calls: 38, closes: 7, revenue: 59_500, rate: 0.184 },
      { name: "Trey", calls: 31, closes: 6, revenue: 51_000, rate: 0.194 },
      { name: "Jordan", calls: 28, closes: 5, revenue: 42_500, rate: 0.179 },
      { name: "Chris", calls: 24, closes: 4, revenue: 34_000, rate: 0.167 },
      { name: "Brandon", calls: 24, closes: 3, revenue: 25_900, rate: 0.125 },
    ],
    setters: [
      { name: "Kia", setsBooked: 18, showed: 14, convRate: 0.778 },
      { name: "Deja", setsBooked: 16, showed: 12, convRate: 0.75 },
      { name: "Malik", setsBooked: 15, showed: 10, convRate: 0.667 },
      { name: "Tasha", setsBooked: 14, showed: 11, convRate: 0.786 },
      { name: "Rico", setsBooked: 13, showed: 9, convRate: 0.692 },
      { name: "Nia", setsBooked: 12, showed: 8, convRate: 0.667 },
      { name: "Jamal", setsBooked: 12, showed: 9, convRate: 0.75 },
      { name: "Keisha", setsBooked: 12, showed: 8, convRate: 0.667 },
    ],
    weeklyTrend: [
      { week: "W1", revenue: 62_300, deals: 8 },
      { week: "W2", revenue: 78_100, deals: 10 },
      { week: "W3", revenue: 84_500, deals: 9 },
      { week: "W4", revenue: 64_500, deals: 7 },
    ],
  },
  fulfillment: {
    activeClients: 142,
    newOnboardings: 34,
    avgOnboardingDays: 3.2,
    clientSatisfaction: 8.7,
    churnRate: 0.052,
    churnedThisMonth: 7,
    retentionRate: 0.948,
    csms: [
      { name: "Philip Blake", activeClients: 74, onboarded: 18, avgDays: 2.9, satisfaction: 8.9 },
      { name: "Juanyetta Beasley", activeClients: 68, onboarded: 16, avgDays: 3.5, satisfaction: 8.5 },
    ],
    monthlyChurn: [
      { month: "Oct", rate: 0.068 },
      { month: "Nov", rate: 0.061 },
      { month: "Dec", rate: 0.057 },
      { month: "Jan", rate: 0.054 },
      { month: "Feb", rate: 0.049 },
      { month: "Mar", rate: 0.052 },
    ],
  },
  financial: {
    mrr: 289_400,
    mrrGrowth: 0.12,
    totalRevenueMTD: 289_400,
    projectedMonthly: 342_000,
    refunds: 8_500,
    refundRate: 0.029,
    ltv: 24_800,
    cac: 3_200,
    ltvCacRatio: 7.75,
    monthlyRevenue: [
      { month: "Oct", revenue: 218_000 },
      { month: "Nov", revenue: 234_000 },
      { month: "Dec", revenue: 245_000 },
      { month: "Jan", revenue: 261_000 },
      { month: "Feb", revenue: 278_000 },
      { month: "Mar", revenue: 289_400 },
    ],
  },
  ar: {
    totalOutstanding: 67_400,
    current: 28_200,
    days30: 18_600,
    days60: 12_400,
    days90plus: 8_200,
    collectionRate: 0.92,
    avgDaysToCollect: 22,
    failedPayments: 14,
    failedPaymentAmount: 11_800,
    paymentPlanActive: 23,
    paymentPlanValue: 41_200,
  },
  marketing: {
    totalLeads: 312,
    adLeads: 198,
    organicLeads: 114,
    adSpend: 24_800,
    costPerLead: 125.25,
    costPerAcquisition: 729.41,
    roas: 11.67,
    adCallsBooked: 84,
    organicCallsBooked: 28,
    adShowRate: 0.68,
    organicShowRate: 0.75,
    channels: [
      { name: "Facebook Ads", leads: 142, spend: 18_200, cpl: 128.17, booked: 58, closed: 18 },
      { name: "Instagram Ads", leads: 56, spend: 6_600, cpl: 117.86, booked: 26, closed: 8 },
      { name: "YouTube (Organic)", leads: 48, spend: 0, cpl: 0, booked: 12, closed: 4 },
      { name: "TikTok (Organic)", leads: 34, spend: 0, cpl: 0, booked: 8, closed: 2 },
      { name: "Referrals", leads: 32, spend: 0, cpl: 0, booked: 8, closed: 2 },
    ],
    weeklyAdPerformance: [
      { week: "W1", spend: 5_800, leads: 44, cpl: 131.82 },
      { week: "W2", spend: 6_200, leads: 52, cpl: 119.23 },
      { week: "W3", spend: 6_900, leads: 58, cpl: 118.97 },
      { week: "W4", spend: 5_900, leads: 44, cpl: 134.09 },
    ],
  },
  errors: [],
};

// âââ Helpers ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const fmt = {
  usd: (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 }),
  pct: (n: number) => (n * 100).toFixed(1) + "%",
  num: (n: number) => n.toLocaleString("en-US"),
  dec: (n: number, d = 1) => n.toFixed(d),
};

type Tab = "overview" | "sales" | "fulfillment" | "marketing" | "financial" | "ar";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "sales", label: "Sales" },
  { key: "fulfillment", label: "Fulfillment" },
  { key: "marketing", label: "Marketing" },
  { key: "financial", label: "Financial" },
  { key: "ar", label: "AR" },
];

// âââ Reusable Components ââââââââââââââââââââââââââââââââââââââââââââââââââââ

function MetricCard({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: string;
  color?: string;
  sub?: string;
}) {
  return (
    <div
      style={{
        backgroundColor: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: T.cardRadius,
        padding: "16px 18px",
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: color || T.text,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}</div>
      {sub && (
        <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

function BarChart({
  data,
  labelKey,
  valueKey,
  height = 180,
  color = T.accent,
  formatValue,
}: {
  data: Record<string, any>[];
  labelKey: string;
  valueKey: string;
  height?: number;
  color?: string;
  formatValue?: (n: number) => string;
}) {
  if (!data.length) return <div style={{ color: T.muted, padding: 20 }}>No data</div>;
  const maxVal = Math.max(...data.map((d) => d[valueKey] || 0), 1);
  const fmtVal = formatValue || fmt.usd;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height, padding: "0 4px" }}>
      {data.map((d, i) => {
        const val = d[valueKey] || 0;
        const pct = (val / maxVal) * 100;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ fontSize: 10, color: T.muted, fontVariantNumeric: "tabular-nums" }}>
              {fmtVal(val)}
            </div>
            <div
              style={{
                width: "100%",
                maxWidth: 48,
                height: `${Math.max(pct, 2)}%`,
                backgroundColor: color,
                borderRadius: "4px 4px 0 0",
                minHeight: 4,
                transition: "height 0.3s ease",
              }}
            />
            <div style={{ fontSize: 11, color: T.muted }}>{d[labelKey]}</div>
          </div>
        );
      })}
    </div>
  );
}

function HorizontalStackedBar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  return (
    <div>
      <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", height: 28 }}>
        {segments.map((seg, i) => (
          <div
            key={i}
            style={{
              width: `${(seg.value / total) * 100}%`,
              backgroundColor: seg.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 600,
              color: "#fff",
              minWidth: seg.value > 0 ? 30 : 0,
            }}
          >
            {seg.value / total > 0.08 ? fmt.pct(seg.value / total) : ""}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: seg.color }} />
            <span style={{ color: T.muted }}>{seg.label}</span>
            <span style={{ color: T.text, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              {fmt.usd(seg.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DataTable({
  columns,
  rows,
}: {
  columns: { key: string; label: string; align?: "left" | "right"; format?: (v: any) => string; colorFn?: (v: any) => string | undefined }[];
  rows: Record<string, any>[];
}) {
  if (!rows.length)
    return <div style={{ color: T.muted, padding: 16, textAlign: "center" }}>No data available</div>;
  const cellStyle = (align?: string): React.CSSProperties => ({
    padding: "10px 12px",
    textAlign: (align || "left") as any,
    fontVariantNumeric: "tabular-nums",
    borderBottom: `1px solid ${T.border}`,
    fontSize: 13,
  });
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  ...cellStyle(col.align),
                  color: T.muted,
                  fontWeight: 600,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
              {columns.map((col) => {
                const val = row[col.key];
                const display = col.format ? col.format(val) : String(val ?? "â");
                const clr = col.colorFn ? col.colorFn(val) : undefined;
                return (
                  <td key={col.key} style={{ ...cellStyle(col.align), color: clr || T.text }}>
                    {display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: T.cardRadius,
        padding: T.cardPad,
        marginBottom: 16,
      }}
    >
      {title && (
        <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 16 }}>{title}</div>
      )}
      {children}
    </div>
  );
}

// âââ Tab Content Components ââââââââââââââââââââââââââââââââââââââââââââââââ

function OverviewTab({ d }: { d: DashboardData }) {
  const adPct = d.marketing.totalLeads > 0 ? d.marketing.adLeads / d.marketing.totalLeads : 0;
  const orgPct = 1 - adPct;
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
        <MetricCard label="MRR" value={fmt.usd(d.financial.mrr)} color={T.green} sub={`${d.financial.mrrGrowth > 0 ? "+" : ""}${fmt.pct(d.financial.mrrGrowth)} growth`} />
        <MetricCard label="Cash Collected" value={fmt.usd(d.sales.cashCollected)} />
        <MetricCard label="Close Rate" value={fmt.pct(d.sales.closeRate)} color={d.sales.closeRate >= 0.15 ? T.green : T.red} />
        <MetricCard label="Active Clients" value={fmt.num(d.fulfillment.activeClients)} />
        <MetricCard label="Ad ROAS" value={d.marketing.roas.toFixed(1) + "x"} color={d.marketing.roas >= 3 ? T.green : d.marketing.roas >= 1 ? T.amber : T.red} />
        <MetricCard label="AR Outstanding" value={fmt.usd(d.ar.totalOutstanding)} color={d.ar.totalOutstanding > 50000 ? T.amber : T.text} />
        <MetricCard label="LTV:CAC" value={d.financial.ltvCacRatio.toFixed(1) + "x"} color={d.financial.ltvCacRatio >= 3 ? T.green : T.red} />
        <MetricCard label="Churn" value={fmt.pct(d.fulfillment.churnRate)} color={d.fulfillment.churnRate <= 0.05 ? T.green : d.fulfillment.churnRate <= 0.08 ? T.amber : T.red} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <SectionCard title="6-Month Revenue Trend">
          <BarChart data={d.financial.monthlyRevenue} labelKey="month" valueKey="revenue" />
        </SectionCard>
        <SectionCard title="Lead Source Split">
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", height: 32 }}>
              <div style={{ width: `${adPct * 100}%`, backgroundColor: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "#fff" }}>
                Ads {fmt.pct(adPct)}
              </div>
              <div style={{ width: `${orgPct * 100}%`, backgroundColor: T.green, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "#fff" }}>
                Organic {fmt.pct(orgPct)}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, color: T.muted }}>
              <span>{d.marketing.adLeads} ad leads</span>
              <span>{d.marketing.organicLeads} organic leads</span>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="AR Aging Distribution">
        <HorizontalStackedBar
          segments={[
            { label: "Current", value: d.ar.current, color: T.green },
            { label: "30-Day", value: d.ar.days30, color: T.amber },
            { label: "60-Day", value: d.ar.days60, color: "#f97316" },
            { label: "90+ Day", value: d.ar.days90plus, color: T.red },
          ]}
        />
      </SectionCard>
    </>
  );
}

function SalesTab({ d }: { d: DashboardData }) {
  const s = d.sales;
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12, marginBottom: 20 }}>
        <MetricCard label="Total Calls" value={fmt.num(s.totalCalls)} />
        <MetricCard label="Sets Booked" value={fmt.num(s.setsBooked)} />
        <MetricCard label="Show Rate" value={fmt.pct(s.showRate)} color={s.showRate >= 0.7 ? T.green : T.amber} />
        <MetricCard label="Closed Deals" value={fmt.num(s.closedDeals)} />
        <MetricCard label="Close Rate" value={fmt.pct(s.closeRate)} color={s.closeRate >= 0.15 ? T.green : T.red} />
        <MetricCard label="Avg Deal Size" value={fmt.usd(s.avgDealSize)} />
        <MetricCard label="Pipeline Value" value={fmt.usd(s.pipelineValue)} />
        <MetricCard label="SetterâClose" value={fmt.pct(s.setterToCloseConversion)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <SectionCard title="Weekly Revenue">
          <BarChart data={s.weeklyTrend} labelKey="week" valueKey="revenue" height={150} />
        </SectionCard>
        <div />
      </div>

      <SectionCard title="Closer Performance">
        <DataTable
          columns={[
            { key: "name", label: "Name" },
            { key: "calls", label: "Calls", align: "right", format: (v: number) => fmt.num(v) },
            { key: "closes", label: "Closes", align: "right", format: (v: number) => fmt.num(v) },
            { key: "revenue", label: "Revenue", align: "right", format: (v: number) => fmt.usd(v) },
            {
              key: "rate",
              label: "Close %",
              align: "right",
              format: (v: number) => fmt.pct(v),
              colorFn: (v: number) => (v >= 0.18 ? T.green : v >= 0.12 ? T.amber : T.red),
            },
          ]}
          rows={s.closers}
        />
      </SectionCard>

      <SectionCard title="Setter Performance">
        <DataTable
          columns={[
            { key: "name", label: "Name" },
            { key: "setsBooked", label: "Sets Booked", align: "right", format: (v: number) => fmt.num(v) },
            { key: "showed", label: "Showed", align: "right", format: (v: number) => fmt.num(v) },
            {
              key: "convRate",
              label: "Show %",
              align: "right",
              format: (v: number) => fmt.pct(v),
              colorFn: (v: number) => (v >= 0.75 ? T.green : v >= 0.6 ? T.amber : T.red),
            },
          ]}
          rows={s.setters}
        />
      </SectionCard>
    </>
  );
}

function FulfillmentTab({ d }: { d: DashboardData }) {
  const f = d.fulfillment;
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12, marginBottom: 20 }}>
        <MetricCard label="Active Clients" value={fmt.num(f.activeClients)} />
        <MetricCard label="New Onboardings" value={fmt.num(f.newOnboardings)} />
        <MetricCard label="Avg Onboard Time" value={fmt.dec(f.avgOnboardingDays) + " days"} color={f.avgOnboardingDays <= 3 ? T.green : T.amber} />
        <MetricCard label="Client Satisfaction" value={fmt.dec(f.clientSatisfaction) + "/10"} color={f.clientSatisfaction >= 8.5 ? T.green : T.amber} />
        <MetricCard label="Churn Rate" value={fmt.pct(f.churnRate)} color={f.churnRate <= 0.05 ? T.green : f.churnRate <= 0.08 ? T.amber : T.red} />
        <MetricCard label="Retention Rate" value={fmt.pct(f.retentionRate)} color={f.retentionRate >= 0.93 ? T.green : T.amber} />
      </div>

      <SectionCard title="CSM Performance">
        <DataTable
          columns={[
            { key: "name", label: "CSM" },
            { key: "activeClients", label: "Active Clients", align: "right", format: (v: number) => fmt.num(v) },
            { key: "onboarded", label: "Onboarded", align: "right", format: (v: number) => fmt.num(v) },
            { key: "avgDays", label: "Avg Days", align: "right", format: (v: number) => fmt.dec(v) },
            {
              key: "satisfaction",
              label: "Satisfaction",
              align: "right",
              format: (v: number) => fmt.dec(v) + "/10",
              colorFn: (v: number) => (v >= 8.5 ? T.green : v >= 7 ? T.amber : T.red),
            },
          ]}
          rows={f.csms}
        />
      </SectionCard>

      <SectionCard title="6-Month Churn Trend">
        <BarChart
          data={f.monthlyChurn}
          labelKey="month"
          valueKey="rate"
          height={150}
          color={T.red}
          formatValue={(n) => fmt.pct(n)}
        />
      </SectionCard>
    </>
  );
}

function MarketingTab({ d }: { d: DashboardData }) {
  const m = d.marketing;
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12, marginBottom: 20 }}>
        <MetricCard label="Total Leads" value={fmt.num(m.totalLeads)} />
        <MetricCard label="Ad Leads" value={fmt.num(m.adLeads)} />
        <MetricCard label="Organic Leads" value={fmt.num(m.organicLeads)} />
        <MetricCard label="Ad Spend" value={fmt.usd(m.adSpend)} />
        <MetricCard label="CPL (Paid)" value={fmt.usd(m.costPerLead)} color={m.costPerLead <= 130 ? T.green : T.amber} />
        <MetricCard label="CPA" value={fmt.usd(m.costPerAcquisition)} />
        <MetricCard label="ROAS" value={m.roas.toFixed(1) + "x"} color={m.roas >= 3 ? T.green : T.red} />
        <MetricCard label="Ad Show Rate" value={fmt.pct(m.adShowRate)} color={m.adShowRate >= 0.65 ? T.green : T.amber} />
      </div>

      <SectionCard title="Channel Breakdown">
        <DataTable
          columns={[
            { key: "name", label: "Channel" },
            { key: "leads", label: "Leads", align: "right", format: (v: number) => fmt.num(v) },
            { key: "spend", label: "Spend", align: "right", format: (v: number) => fmt.usd(v) },
            { key: "cpl", label: "CPL", align: "right", format: (v: number) => (v > 0 ? fmt.usd(v) : "â") },
            { key: "booked", label: "Calls Booked", align: "right", format: (v: number) => fmt.num(v) },
            { key: "closed", label: "Closed", align: "right", format: (v: number) => fmt.num(v) },
          ]}
          rows={m.channels}
        />
      </SectionCard>

      <SectionCard title="Weekly Ad Performance">
        <BarChart data={m.weeklyAdPerformance} labelKey="week" valueKey="spend" height={150} color={T.accent} />
      </SectionCard>
    </>
  );
}

function FinancialTab({ d }: { d: DashboardData }) {
  const f = d.financial;
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12, marginBottom: 20 }}>
        <MetricCard label="MRR" value={fmt.usd(f.mrr)} color={T.green} sub={`${f.mrrGrowth > 0 ? "+" : ""}${fmt.pct(f.mrrGrowth)} MoM`} />
        <MetricCard label="Revenue MTD" value={fmt.usd(f.totalRevenueMTD)} />
        <MetricCard label="Projected Monthly" value={fmt.usd(f.projectedMonthly)} />
        <MetricCard label="Refunds" value={fmt.usd(f.refunds)} color={f.refundRate > 0.05 ? T.red : T.text} sub={fmt.pct(f.refundRate) + " rate"} />
        <MetricCard label="LTV" value={fmt.usd(f.ltv)} />
        <MetricCard label="CAC" value={fmt.usd(f.cac)} />
        <MetricCard label="LTV:CAC" value={f.ltvCacRatio.toFixed(1) + "x"} color={f.ltvCacRatio >= 3 ? T.green : T.red} />
      </div>

      <SectionCard title="6-Month Revenue Trend">
        <BarChart data={f.monthlyRevenue} labelKey="month" valueKey="revenue" height={200} color={T.green} />
      </SectionCard>
    </>
  );
}

function ARTab({ d }: { d: DashboardData }) {
  const a = d.ar;
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12, marginBottom: 20 }}>
        <MetricCard label="Total Outstanding" value={fmt.usd(a.totalOutstanding)} color={a.totalOutstanding > 50000 ? T.amber : T.text} />
        <MetricCard label="Collection Rate" value={fmt.pct(a.collectionRate)} color={a.collectionRate >= 0.9 ? T.green : T.red} />
        <MetricCard label="Avg Days to Collect" value={a.avgDaysToCollect.toString()} color={a.avgDaysToCollect <= 25 ? T.green : T.amber} />
        <MetricCard label="Failed Payments" value={fmt.num(a.failedPayments)} color={a.failedPayments > 10 ? T.red : T.text} sub={fmt.usd(a.failedPaymentAmount)} />
        <MetricCard label="Active Pay Plans" value={fmt.num(a.paymentPlanActive)} sub={fmt.usd(a.paymentPlanValue) + " value"} />
        <MetricCard label="90+ Day AR" value={fmt.usd(a.days90plus)} color={a.days90plus > 5000 ? T.red : T.amber} />
      </div>

      <SectionCard title="AR Aging Distribution">
        <HorizontalStackedBar
          segments={[
            { label: "Current", value: a.current, color: T.green },
            { label: "30-Day", value: a.days30, color: T.amber },
            { label: "60-Day", value: a.days60, color: "#f97316" },
            { label: "90+ Day", value: a.days90plus, color: T.red },
          ]}
        />
      </SectionCard>
    </>
  );
}

// âââ Main Dashboard Component âââââââââââââââââââââââââââââââââââââââââââââââ

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [isDemo, setIsDemo] = useState(false);
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState(false);

  const fetchData = useCallback(
    async (pw?: string) => {
      try {
        setLoading(true);
        setError(null);
        const authStr = pw || password;
        const res = await fetch(`/api/data${authStr ? `?auth=${encodeURIComponent(authStr)}` : ""}`);

        if (res.status === 401) {
          setAuthed(false);
          setAuthError(true);
          setLoading(false);
          return;
        }

        if (!res.ok) throw new Error(`API returned ${res.status}`);

        const json: DashboardData = await res.json();

        // Check if data is essentially empty (all zeros) â use demo
        const isEmpty =
          json.sales.totalCalls === 0 &&
          json.sales.cashCollected === 0 &&
          json.marketing.totalLeads === 0 &&
          json.financial.mrr === 0;

        if (isEmpty) {
          setData(DEMO_DATA);
          setIsDemo(true);
        } else {
          setData(json);
          setIsDemo(false);
        }
        setAuthed(true);
        setAuthError(false);
      } catch (err: any) {
        console.error("Fetch error:", err);
        setData(DEMO_DATA);
        setIsDemo(true);
        setError(err.message);
        setAuthed(true);
      } finally {
        setLoading(false);
      }
    },
    [password]
  );

  // Initial fetch
  useEffect(() => {
    // Try without password first
    fetchData("");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh
  useEffect(() => {
    if (!authed) return;
    const interval = parseInt(process.env.NEXT_PUBLIC_REFRESH_INTERVAL || "300000", 10);
    const timer = setInterval(() => fetchData(), interval);
    return () => clearInterval(timer);
  }, [authed, fetchData]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData(password);
  };

  // ââ Login Screen ââ
  if (!authed && authError) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: T.bg,
        }}
      >
        <form
          onSubmit={handleLogin}
          style={{
            backgroundColor: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: T.cardRadius,
            padding: 40,
            width: 360,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>SLR CEO Dashboard</div>
          <div style={{ fontSize: 13, color: T.muted, marginBottom: 28 }}>Enter dashboard password</div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            style={{
              width: "100%",
              padding: "12px 14px",
              backgroundColor: T.bg,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              color: T.text,
              fontSize: 14,
              fontFamily: "'DM Sans', sans-serif",
              marginBottom: 16,
              outline: "none",
              boxSizing: "border-box",
            }}
            autoFocus
          />
          {authError && <div style={{ fontSize: 12, color: T.red, marginBottom: 12 }}>Invalid password. Try again.</div>}
          <button
            type="submit"
            style={{
              width: "100%",
              padding: "12px 0",
              backgroundColor: T.accent,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif",
              cursor: "pointer",
            }}
          >
            Sign In
          </button>
        </form>
      </div>
    );
  }

  // ââ Loading Screen ââ
  if (loading && !data) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: T.bg,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 40,
              height: 40,
              border: `3px solid ${T.border}`,
              borderTopColor: T.accent,
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ fontSize: 15, color: T.muted }}>Loading dashboard...</div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // ââ Dashboard ââ
  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 24px 60px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>SLR CEO Dashboard</div>
          <div style={{ fontSize: 13, color: T.muted }}>
            {data.period} &middot; Updated {new Date(data.lastUpdated).toLocaleTimeString()}
            {loading && <span style={{ marginLeft: 8, color: T.accent }}>refreshing...</span>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {isDemo && (
            <div
              style={{
                backgroundColor: "rgba(245, 158, 11, 0.15)",
                color: T.amber,
                padding: "6px 14px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              DEMO DATA
            </div>
          )}
        </div>
      </div>

      {/* Error Banners */}
      {data.errors.length > 0 &&
        data.errors.map((err, i) => (
          <div
            key={i}
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: `1px solid ${T.red}`,
              borderRadius: 8,
              padding: "10px 16px",
              marginBottom: 10,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
            }}
          >
            <span style={{ color: T.red, fontWeight: 600 }}>{err.source.toUpperCase()}</span>
            <span style={{ color: T.text }}>{err.message}</span>
          </div>
        ))}

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          backgroundColor: T.card,
          borderRadius: 10,
          padding: 4,
          marginBottom: 24,
          border: `1px solid ${T.border}`,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1,
              padding: "10px 0",
              border: "none",
              borderRadius: 8,
              backgroundColor: tab === t.key ? T.accent : "transparent",
              color: tab === t.key ? "#fff" : T.muted,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "overview" && <OverviewTab d={data} />}
      {tab === "sales" && <SalesTab d={data} />}
      {tab === "fulfillment" && <FulfillmentTab d={data} />}
      {tab === "marketing" && <MarketingTab d={data} />}
      {tab === "financial" && <FinancialTab d={data} />}
      {tab === "ar" && <ARTab d={data} />}

      {/* Data Source Legend */}
      <div
        style={{
          marginTop: 32,
          padding: "14px 18px",
          backgroundColor: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: T.cardRadius,
          display: "flex",
          alignItems: "center",
          gap: 20,
          fontSize: 12,
          color: T.muted,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 600, color: T.text }}>Data Sources:</span>
        {[
          { name: "GoHighLevel", color: "#3b82f6" },
          { name: "Hyros", color: "#a855f7" },
          { name: "Meta Ads", color: "#06b6d4" },
        ].map((src) => (
          <span key={src.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: src.color, display: "inline-block" }} />
            {src.name}
          </span>
        ))}
        <span style={{ marginLeft: "auto" }}>Auto-refresh: 5 min</span>
      </div>
    </div>
  );
}
