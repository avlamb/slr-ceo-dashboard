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
import { DEMO_DATA } from "@/lib/demo-data";

type ApiData = DashboardData & { callsPaid?: number; callsOrganic?: number };

// ─── Design Tokens ──────────────────────────────────────────────────────────
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

// ─── Helpers ────────────────────────────────────────────────────────────────
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

// ─── Reusable Components ────────────────────────────────────────────────────

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
  defaultSort,
  defaultDir = "desc",
}: {
  columns: { key: string; label: string; align?: "left" | "right"; format?: (v: any) => string; colorFn?: (v: any) => string | undefined }[];
  rows: Record<string, any>[];
  defaultSort?: string;
  defaultDir?: "asc" | "desc";
}) {
  const [sortKey, setSortKey] = useState<string | null>(defaultSort ?? null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(defaultDir);

  const sorted = sortKey
    ? [...rows].sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        if (typeof av === "number" && typeof bv === "number")
          return sortDir === "desc" ? bv - av : av - bv;
        return sortDir === "desc"
          ? String(bv ?? "").localeCompare(String(av ?? ""))
          : String(av ?? "").localeCompare(String(bv ?? ""));
      })
    : rows;

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

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
            {columns.map((col) => {
              const isSorted = sortKey === col.key;
              return (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  style={{
                    ...cellStyle(col.align),
                    color: isSorted ? T.text : T.muted,
                    fontWeight: 600,
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    cursor: "pointer",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {col.label}{" "}
                  <span style={{ opacity: isSorted ? 1 : 0.25, fontSize: 10 }}>
                    {isSorted ? (sortDir === "desc" ? "↓" : "↑") : "↕"}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
              {columns.map((col) => {
                const val = row[col.key];
                const display = col.format ? col.format(val) : String(val ?? "–");
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

// ─── Tab Content Components ────────────────────────────────────────────────

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

function SalesTab({ d }: { d: ApiData }) {
  const s = d.sales;
  const callsPaid = d.callsPaid ?? 0;
  const callsOrganic = d.callsOrganic ?? 0;
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12, marginBottom: 20 }}>
        <MetricCard label="Total Calls" value={fmt.num(s.totalCalls)} sub={(callsPaid || callsOrganic) ? `${fmt.num(callsPaid)} paid · ${fmt.num(callsOrganic)} organic` : undefined} />
        <MetricCard label="Sets Booked" value={fmt.num(s.setsBooked)} />
        <MetricCard label="Show Rate" value={fmt.pct(s.showRate)} color={s.showRate >= 0.7 ? T.green : T.amber} />
        <MetricCard label="Closed Deals" value={fmt.num(s.closedDeals)} />
        <MetricCard label="Close Rate" value={fmt.pct(s.closeRate)} color={s.closeRate >= 0.15 ? T.green : T.red} />
        <MetricCard label="Avg Deal Size" value={fmt.usd(s.avgDealSize)} />
        <MetricCard label="Pipeline Value" value={fmt.usd(s.pipelineValue)} />
        <MetricCard label="Setter→Close" value={fmt.pct(s.setterToCloseConversion)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <SectionCard title="Weekly Revenue">
          <BarChart data={s.weeklyTrend} labelKey="week" valueKey="revenue" height={150} />
        </SectionCard>
        <div />
      </div>

      <SectionCard title="Closer Performance">
        <DataTable
          defaultSort="closes"
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
            { key: "cpl", label: "CPL", align: "right", format: (v: number) => (v > 0 ? fmt.usd(v) : "—") },
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

// ─── Main Dashboard Component ───────────────────────────────────────────────

export default function Dashboard() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
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

        const json: ApiData = await res.json();
        setData(json);
        setIsDemoMode(false);
        setAuthed(true);
        setAuthError(false);
      } catch (err: any) {
        console.error("Fetch error:", err);
        setError(err.message);
        // Fall back to demo data so dashboard is never blank
        setData(DEMO_DATA);
        setIsDemoMode(true);
        setAuthed(true);
      } finally {
        setLoading(false);
      }
    },
    [password]
  );

  // Initial fetch
  useEffect(() => {
    //Try without password first
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

  // ── Login Screen ──
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

  // ── Loading Screen ──
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

  // If data is still null after loading (shouldn't happen with demo fallback, but guard it)
  if (!data) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: T.bg,
          color: T.text,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 15, color: T.muted }}>Loading dashboard...</div>
        </div>
      </div>
    );
  }

  // ── Dashboard ──
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
          {isDemoMode ? (
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
              DEMO MODE
            </div>
          ) : data.errors.length > 0 ? (
            <div
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                color: T.red,
                padding: "6px 14px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              API ERRORS ({data.errors.length})
            </div>
          ) : (
            <div
              style={{
                backgroundColor: "rgba(34, 197, 94, 0.15)",
                color: T.green,
                padding: "6px 14px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              LIVE
            </div>
          )}
        </div>
      </div>

      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div
          style={{
            backgroundColor: "rgba(245, 158, 11, 0.1)",
            border: `1px solid ${T.amber}`,
            borderRadius: 8,
            padding: "10px 16px",
            marginBottom: 10,
            fontSize: 13,
            color: T.amber,
          }}
        >
          <span style={{ fontWeight: 600 }}>DEMO MODE</span>
          {" — "}API credentials not reachable. Showing sample data. Set GHL_API_TOKEN, GHL_LOCATION_ID, HYROS_API_KEY, META_ACCESS_TOKEN in Vercel environment variables.
        </div>
      )}

      {/* Error Banners */}
      {!isDemoMode && data.errors.length > 0 &&
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
