"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  DashboardData,
  AirtableClientSummary,
  AirtableCSMWeeklySummary,
} from "@/lib/types";

// ─── Design Tokens ─────────────────────────────────────────────────────────────
const T = {
  bg: "#0b0f1a",
  surface: "#111827",
  card: "#141929",
  cardAlt: "#1a2035",
  border: "#232b45",
  borderSubtle: "#1c2540",
  text: "#f0f2f5",
  sub: "#c0c5d4",
  muted: "#7b85a3",
  accent: "#6366f1",
  accentGlow: "rgba(99,102,241,0.12)",
  // Semantic value colors (applied to VALUES, not card borders)
  green: "#6ee7b7",
  greenDim: "rgba(110,231,183,0.12)",
  yellow: "#fbbf24",
  yellowDim: "rgba(251,191,36,0.12)",
  red: "#f472b6",
  redDim: "rgba(244,114,182,0.12)",
  blue: "#60a5fa",
  blueDim: "rgba(96,165,250,0.12)",
  // Legacy colors
  amber: "#f59e0b",
  gold: "#fbbf24",
  silver: "#94a3b8",
  bronze: "#d97706",
  cardRadius: 14,
  cardPad: 20,
  mono: "'DM Mono', 'Courier New', monospace",
  sans: "'DM Sans', system-ui, sans-serif",
};

// ─── Responsive hook ───────────────────────────────────────────────────────────
function useWindowWidth() {
  const [width, setWidth] = useState(1440);
  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return width;
}

function useCols(w: number): 1 | 2 | 3 {
  if (w < 640) return 1;
  if (w < 1100) return 2;
  return 3;
}

// ─── Formatters ────────────────────────────────────────────────────────────────
const fmt = {
  usd: (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 }),
  usdK: (n: number) => n >= 1_000_000 ? "$" + (n / 1_000_000).toFixed(1) + "M" : n >= 1_000 ? "$" + (n / 1_000).toFixed(0) + "K" : fmt.usd(n),
  pct: (n: number) => (n * 100).toFixed(1) + "%",
  num: (n: number) => n.toLocaleString("en-US"),
  dec: (n: number, d = 1) => n.toFixed(d),
  mult: (n: number) => n.toFixed(1) + "x",
};

// ─── Tab types ─────────────────────────────────────────────────────────────────
type Tab = "goals" | "closers" | "setters" | "marketing" | "fulfillment" | "financial";
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "goals", label: "Goals", icon: "◎" },
  { key: "closers", label: "Closers", icon: "⚡" },
  { key: "setters", label: "Setters", icon: "📞" },
  { key: "marketing", label: "Marketing", icon: "📈" },
  { key: "fulfillment", label: "Fulfillment", icon: "✓" },
  { key: "financial", label: "Financial", icon: "$" },
];

// ─── Demo Data ─────────────────────────────────────────────────────────────────
const DEMO: DashboardData = {
  lastUpdated: new Date().toISOString(),
  period: "Apr 2026",
  sales: {
    totalCalls: 187, setsBooked: 112, showRate: 0.72, closedDeals: 34,
    closeRate: 0.182, cashCollected: 289_400, avgDealSize: 8_512,
    pipelineValue: 478_200, setterToCloseConversion: 0.304,
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
      { week: "Oct", revenue: 218_000, deals: 28 },
      { week: "Nov", revenue: 234_000, deals: 31 },
      { week: "Dec", revenue: 245_000, deals: 32 },
      { week: "Jan", revenue: 261_000, deals: 35 },
      { week: "Feb", revenue: 278_000, deals: 37 },
      { week: "Apr", revenue: 289_400, deals: 34 },
    ],
  },
  fulfillment: {
    activeClients: 142, newOnboardings: 34, avgOnboardingDays: 3.2,
    clientSatisfaction: 8.7, churnRate: 0.052, churnedThisMonth: 7,
    retentionRate: 0.948,
    csms: [
      { name: "Philip Blake", activeClients: 74, onboarded: 18, avgDays: 2.9, satisfaction: 8.9 },
      { name: "Juanyetta Beasley", activeClients: 68, onboarded: 16, avgDays: 3.5, satisfaction: 8.5 },
    ],
    monthlyChurn: [
      { month: "Oct", rate: 0.068 }, { month: "Nov", rate: 0.061 },
      { month: "Dec", rate: 0.057 }, { month: "Jan", rate: 0.054 },
      { month: "Feb", rate: 0.049 }, { month: "Apr", rate: 0.052 },
    ],
    airtableClients: [],
    airtableCSMWeekly: [],
    airtableSource: "unconfigured",
  },
  financial: {
    mrr: 289_400, mrrGrowth: 0.12, totalRevenueMTD: 289_400,
    projectedMonthly: 342_000, refunds: 8_500, refundRate: 0.029,
    ltv: 24_800, cac: 3_200, ltvCacRatio: 7.75,
    monthlyRevenue: [
      { month: "Oct", revenue: 218_000 }, { month: "Nov", revenue: 234_000 },
      { month: "Dec", revenue: 245_000 }, { month: "Jan", revenue: 261_000 },
      { month: "Feb", revenue: 278_000 }, { month: "Apr", revenue: 289_400 },
    ],
  },
  ar: {
    totalOutstanding: 67_400, current: 28_200, days30: 18_600,
    days60: 12_400, days90plus: 8_200, collectionRate: 0.92,
    avgDaysToCollect: 22, failedPayments: 14, failedPaymentAmount: 11_800,
    paymentPlanActive: 23, paymentPlanValue: 41_200,
  },
  marketing: {
    totalLeads: 312, adLeads: 198, organicLeads: 114, adSpend: 24_800,
    costPerLead: 125.25, costPerAcquisition: 729.41, roas: 11.67,
    adCallsBooked: 84, organicCallsBooked: 28, adShowRate: 0.68,
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

// ─── Semantic color helper ─────────────────────────────────────────────────────
type Sentiment = "good" | "warn" | "bad" | "neutral";
function sentimentColor(s: Sentiment): string {
  return s === "good" ? T.green : s === "warn" ? T.yellow : s === "bad" ? T.red : T.blue;
}

// ─── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
  id, label, value, sentiment = "neutral", sub, span = 1, annotations, onAnnotate,
}: {
  id: string; label: string; value: string; sentiment?: Sentiment;
  sub?: string; span?: 1 | 2 | 3;
  annotations: Record<string, string>;
  onAnnotate: (id: string, text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(annotations[id] || "");
  const color = sentimentColor(sentiment);
  const hasNote = !!annotations[id];

  return (
    <div
      style={{
        backgroundColor: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: T.cardRadius,
        padding: T.cardPad,
        gridColumn: `span ${span}`,
        minWidth: 0,
        position: "relative",
      }}
    >
      {/* Note icon */}
      <button
        onClick={() => { setDraft(annotations[id] || ""); setEditing(true); }}
        title="Add note"
        style={{
          position: "absolute", top: 10, right: 10,
          background: "none", border: "none", cursor: "pointer",
          fontSize: 14, color: hasNote ? T.yellow : T.muted,
          opacity: 0.7, padding: 2, lineHeight: 1,
        }}
      >
        {hasNote ? "📝" : "○"}
      </button>

      <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color, fontFamily: T.mono, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>{sub}</div>}
      {hasNote && !editing && (
        <div
          onClick={() => { setDraft(annotations[id]); setEditing(true); }}
          style={{ fontSize: 11, color: T.yellow, marginTop: 8, cursor: "pointer", borderTop: `1px solid ${T.border}`, paddingTop: 8, fontStyle: "italic" }}
        >
          {annotations[id]}
        </div>
      )}
      {editing && (
        <div style={{ marginTop: 10, borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add annotation..."
            rows={2}
            style={{
              width: "100%", backgroundColor: T.bg, border: `1px solid ${T.border}`,
              borderRadius: 6, color: T.text, fontSize: 12, padding: "6px 8px",
              fontFamily: T.sans, resize: "vertical", boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button
              onClick={() => { onAnnotate(id, draft); setEditing(false); }}
              style={{ fontSize: 11, padding: "4px 10px", backgroundColor: T.accent, color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontFamily: T.sans }}
            >Save</button>
            <button
              onClick={() => setEditing(false)}
              style={{ fontSize: 11, padding: "4px 10px", backgroundColor: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 5, cursor: "pointer", fontFamily: T.sans }}
            >Cancel</button>
            {hasNote && (
              <button
                onClick={() => { onAnnotate(id, ""); setEditing(false); }}
                style={{ fontSize: 11, padding: "4px 10px", backgroundColor: "transparent", color: T.red, border: `1px solid ${T.border}`, borderRadius: 5, cursor: "pointer", fontFamily: T.sans }}
              >Clear</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Bento Grid wrapper ────────────────────────────────────────────────────────
function BentoGrid({ cols, children }: { cols: 1 | 2 | 3; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 14, marginBottom: 14 }}>
      {children}
    </div>
  );
}

// ─── Section Card ──────────────────────────────────────────────────────────────
function Card({ title, span = 1, children }: { title?: string; span?: 1 | 2 | 3; children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: T.cardRadius,
        padding: T.cardPad,
        gridColumn: `span ${span}`,
        minWidth: 0,
      }}
    >
      {title && (
        <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────
function BarChart({
  data, labelKey, valueKey, height = 160, color = T.accent, formatValue,
}: {
  data: Record<string, any>[]; labelKey: string; valueKey: string;
  height?: number; color?: string; formatValue?: (n: number) => string;
}) {
  if (!data.length) return <div style={{ color: T.muted, padding: 20, textAlign: "center", fontSize: 13 }}>No data</div>;
  const maxVal = Math.max(...data.map((d) => d[valueKey] || 0), 1);
  const fmtVal = formatValue || fmt.usd;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height, padding: "0 4px" }}>
      {data.map((d, i) => {
        const val = d[valueKey] || 0;
        const pctH = (val / maxVal) * 100;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ fontSize: 10, color: T.sub, fontFamily: T.mono, fontWeight: 500, textAlign: "center" }}>
              {fmtVal(val)}
            </div>
            <div
              style={{
                width: "100%",
                height: `${Math.max(pctH, 2)}%`,
                background: color,
                borderRadius: "3px 3px 0 0",
                minHeight: 3,
                opacity: 0.9,
              }}
            />
            <div style={{ fontSize: 10, color: T.muted }}>{d[labelKey]}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Horizontal Stacked Bar ────────────────────────────────────────────────────
function StackedBar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  return (
    <div>
      <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", height: 24, marginBottom: 10 }}>
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
              fontWeight: 700,
              color: "#000",
              minWidth: seg.value > 0 ? 28 : 0,
              opacity: 0.9,
            }}
          >
            {seg.value / total > 0.1 ? (seg.value / total * 100).toFixed(0) + "%" : ""}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: seg.color }} />
            <span style={{ color: T.muted }}>{seg.label}</span>
            <span style={{ color: T.sub, fontFamily: T.mono, fontWeight: 600 }}>{fmt.usd(seg.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Leaderboard Table ─────────────────────────────────────────────────────────
type ColDef = {
  key: string; label: string; align?: "left" | "right";
  format?: (v: any) => string; sentiment?: (v: any) => Sentiment;
  bar?: boolean; barMax?: number;
};
function Leaderboard({ columns, rows, ranked = false }: { columns: ColDef[]; rows: Record<string, any>[]; ranked?: boolean }) {
  if (!rows.length)
    return <div style={{ color: T.muted, padding: 20, textAlign: "center", fontSize: 13 }}>No data available</div>;

  const rankColors = [T.gold, T.silver, T.bronze];

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr>
            {ranked && (
              <th style={{ padding: "10px 12px", textAlign: "center", fontSize: 11, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: `2px solid ${T.border}`, width: 36 }}>
                #
              </th>
            )}
            {columns.map((col) => (
              <th key={col.key} style={{ padding: "10px 12px", textAlign: col.align || "left", fontSize: 11, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: `2px solid ${T.border}` }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
              {ranked && (
                <td style={{ padding: "12px", textAlign: "center", fontSize: 16, fontWeight: 700, color: rankColors[i] || T.muted, borderBottom: `1px solid ${T.borderSubtle}` }}>
                  {i + 1}
                </td>
              )}
              {columns.map((col) => {
                const val = row[col.key];
                const display = col.format ? col.format(val) : String(val ?? "—");
                const sentiment = col.sentiment ? col.sentiment(val) : undefined;
                const color = sentiment ? sentimentColor(sentiment) : undefined;
                const isName = col.key === "name";

                if (col.bar && typeof val === "number") {
                  const pctW = Math.min((val / (col.barMax || 1)) * 100, 100);
                  const barColor = color || T.green;
                  return (
                    <td key={col.key} style={{ padding: "10px 12px", borderBottom: `1px solid ${T.borderSubtle}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: col.align === "right" ? "flex-end" : "flex-start" }}>
                        <div style={{ width: 80, height: 6, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 3, overflow: "hidden", flexShrink: 0 }}>
                          <div style={{ width: `${pctW}%`, height: "100%", backgroundColor: barColor, borderRadius: 3 }} />
                        </div>
                        <span style={{ color: barColor, fontFamily: T.mono, fontWeight: 700, minWidth: 46, textAlign: "right" }}>{display}</span>
                      </div>
                    </td>
                  );
                }
                return (
                  <td key={col.key} style={{
                    padding: "12px", textAlign: col.align || "left",
                    borderBottom: `1px solid ${T.borderSubtle}`,
                    color: isName ? T.text : (color || T.sub),
                    fontWeight: isName ? 600 : 400,
                    fontFamily: isName ? T.sans : T.mono,
                  }}>
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

// ─── AI Insights Panel ─────────────────────────────────────────────────────────
function AIInsights({ insights }: { insights: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        backgroundColor: T.accentGlow,
        border: `1px solid ${T.accent}`,
        borderRadius: T.cardRadius,
        overflow: "hidden",
        marginBottom: 14,
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", padding: "12px 18px",
          background: "none", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 10,
          textAlign: "left", fontFamily: T.sans,
        }}
      >
        <span style={{ fontSize: 16 }}>✦</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.accent }}>AI Insights</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: T.muted, fontWeight: 500 }}>Powered by Claude</span>
        <span style={{ fontSize: 12, color: T.muted, marginLeft: 8 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ padding: "4px 18px 16px", borderTop: `1px solid rgba(99,102,241,0.2)` }}>
          {insights.map((insight, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "flex-start" }}>
              <span style={{ color: T.accent, fontSize: 16, lineHeight: 1.4, flexShrink: 0 }}>›</span>
              <span style={{ fontSize: 13, color: T.sub, lineHeight: 1.5 }}>{insight}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── AI Insights generators ────────────────────────────────────────────────────
function goalsInsights(d: DashboardData): string[] {
  const cashPct = d.financial.projectedMonthly > 0
    ? (d.financial.totalRevenueMTD / d.financial.projectedMonthly * 100).toFixed(0)
    : "—";
  const closeStatus = d.sales.closeRate >= 0.18 ? "above target" : d.sales.closeRate >= 0.14 ? "near target" : "below target";
  const insights = [
    `Revenue is ${cashPct}% of ${fmt.usd(d.financial.projectedMonthly)} projection. Pace ${d.sales.closedDeals > 30 ? "on track" : "needs acceleration"} with ${d.sales.closedDeals} closes this period.`,
    `Close rate at ${fmt.pct(d.sales.closeRate)} — ${closeStatus}. Show rate ${fmt.pct(d.sales.showRate)} suggests ${d.sales.showRate >= 0.7 ? "strong" : "weak"} setter execution.`,
    `AR outstanding: ${fmt.usd(d.ar.totalOutstanding)}. ${d.ar.days90plus > 5000 ? `${fmt.usd(d.ar.days90plus)} in 90+ day bucket requires immediate collection action.` : "Aging distribution is healthy."}`,
    `LTV:CAC ratio of ${fmt.mult(d.financial.ltvCacRatio)} ${d.financial.ltvCacRatio >= 5 ? "is strong — consider scaling ad spend." : d.financial.ltvCacRatio >= 3 ? "is healthy." : "is below 3x threshold — review acquisition costs."}`,
  ];
  return insights;
}

function closersInsights(d: DashboardData): string[] {
  const top = d.sales.closers[0];
  const bottom = d.sales.closers[d.sales.closers.length - 1];
  return [
    top ? `Top closer: ${top.name} with ${top.closes} closes at ${fmt.pct(top.rate)} rate — ${fmt.usd(top.revenue)} revenue.` : "No closer data yet.",
    bottom && d.sales.closers.length > 1 ? `${bottom.name} has lowest rate at ${fmt.pct(bottom.rate)} — assess call quality or pipeline assignment.` : "",
    `Team avg deal size: ${fmt.usd(d.sales.avgDealSize)}. ${d.sales.avgDealSize > 8000 ? "Premium deal mix is healthy." : "Consider upsell positioning to increase ADS."}`,
    `${d.sales.closedDeals} total closes this period. Projection pace: ${d.financial.projectedMonthly > 0 ? Math.ceil((d.financial.projectedMonthly - d.financial.totalRevenueMTD) / Math.max(d.sales.avgDealSize, 1)) + " more closes to hit monthly target." : "Set a monthly projection target."}`,
  ].filter(Boolean);
}

function settersInsights(d: DashboardData): string[] {
  const topSetter = [...d.sales.setters].sort((a, b) => b.convRate - a.convRate)[0];
  return [
    `Show rate at ${fmt.pct(d.sales.showRate)}. ${d.sales.showRate >= 0.75 ? "Excellent — setters qualifying leads well." : d.sales.showRate >= 0.6 ? "Acceptable — review pre-call confirmation protocols." : "Low show rate — audit lead quality and SMS confirmation sequences."}`,
    topSetter ? `Highest conversion: ${topSetter.name} at ${fmt.pct(topSetter.convRate)} show rate — use their call framework as team template.` : "",
    `${d.sales.setsBooked} sets booked. Setter→Close pipeline: ${fmt.pct(d.sales.setterToCloseConversion)} conversion — ${d.sales.setterToCloseConversion >= 0.25 ? "strong end-to-end performance." : "gap between sets and closes needs attention."}`,
    "Dialer.io integration pending — call volume and connect rate data will populate here once configured.",
  ].filter(Boolean);
}

function marketingInsights(d: DashboardData): string[] {
  const m = d.marketing;
  return [
    `ROAS of ${fmt.mult(m.roas)} with ${fmt.usd(m.adSpend)} ad spend. ${m.roas >= 10 ? "Exceptional — scale spend aggressively." : m.roas >= 5 ? "Healthy — test increasing budget 20-30%." : m.roas >= 3 ? "Breakeven zone — optimize creative before scaling." : "Below 3x — pause underperformers and rebuild."}`,
    `CPL at ${fmt.usd(m.costPerLead)}. ${m.costPerLead <= 100 ? "Well below $130 target." : m.costPerLead <= 130 ? "At target range." : "Above $130 — audit targeting and ad creative."}`,
    m.channels.length > 0 ? `Top channel: ${m.channels[0].name} with ${m.channels[0].leads} leads at ${m.channels[0].cpl > 0 ? fmt.usd(m.channels[0].cpl) + " CPL" : "organic"}.` : "",
    `${fmt.pct(m.organicLeads / Math.max(m.totalLeads, 1))} of leads are organic. ${m.organicLeads > m.adLeads ? "Strong organic presence — document and replicate content strategy." : "Paid-heavy mix — invest in content to reduce CAC long-term."}`,
  ].filter(Boolean);
}

function fulfillmentInsights(d: DashboardData): string[] {
  const f = d.fulfillment;
  const src = f.airtableSource ?? "unconfigured";
  const clients = f.airtableClients ?? [];
  const airtableNote = src === "live"
    ? `Airtable CRM shows ${clients.length} recent active clients.`
    : src === "unconfigured"
    ? "Connect Airtable (AIRTABLE_PAT env var) to unlock live client roster."
    : "Airtable sync error — check AIRTABLE_PAT configuration.";
  return [
    `${f.activeClients > 0 ? `${f.activeClients} active clients` : "Active client count pending Airtable sync"}. Churn at ${fmt.pct(f.churnRate)} — ${f.churnRate <= 0.05 ? "healthy, below 5% target." : "above 5% target, review client success protocols."}`,
    `Philip Blake: ${f.csms[0]?.activeClients || 0} clients. Juanyetta Beasley: ${f.csms[1]?.activeClients || 0} clients. ${Math.abs((f.csms[0]?.activeClients || 0) - (f.csms[1]?.activeClients || 0)) > 20 ? "Significant workload imbalance — rebalance assignments." : "Workload balanced."}`,
    airtableNote,
    f.newOnboardings > 0 ? `${f.newOnboardings} new onboardings this period — verify 30-day check-in completion rate.` : "No new onboardings data yet.",
  ].filter(Boolean);
}

function financialInsights(d: DashboardData): string[] {
  const f = d.financial;
  const a = d.ar;
  return [
    `MRR: ${fmt.usd(f.mrr)} — ${f.mrrGrowth > 0 ? "+" + fmt.pct(f.mrrGrowth) + " MoM growth." : fmt.pct(Math.abs(f.mrrGrowth)) + " MoM decline — investigate."}`,
    `AR collection rate: ${fmt.pct(a.collectionRate)}. ${a.failedPayments > 10 ? `${a.failedPayments} failed payments (${fmt.usd(a.failedPaymentAmount)}) — trigger dunning sequence immediately.` : "Failed payment volume is manageable."}`,
    `${a.paymentPlanActive} active payment plans worth ${fmt.usd(a.paymentPlanValue)}. Monitor for next payment failure triggers.`,
    `Refund rate: ${fmt.pct(f.refundRate)}. ${f.refundRate > 0.05 ? "Above 5% — review refund reasons for systematic issues." : "Within acceptable range."}`,
  ];
}

// ─── Goals Tab ─────────────────────────────────────────────────────────────────
function GoalsTab({ d, cols, ann, onAnn }: TabProps) {
  const adPct = d.marketing.totalLeads > 0 ? d.marketing.adLeads / d.marketing.totalLeads : 0;
  return (
    <>
      <AIInsights insights={goalsInsights(d)} />
      <BentoGrid cols={cols}>
        <KpiCard id="g-cash" label="Cash MTD" value={fmt.usd(d.financial.totalRevenueMTD)} sentiment="good" sub={`of ${fmt.usd(d.financial.projectedMonthly)} projected`} annotations={ann} onAnnotate={onAnn} />
        <KpiCard id="g-closes" label="Closed Deals" value={fmt.num(d.sales.closedDeals)} sentiment={d.sales.closedDeals >= 30 ? "good" : "warn"} sub={`${fmt.usd(d.sales.avgDealSize)} avg`} annotations={ann} onAnnotate={onAnn} />
        <KpiCard id="g-close-rate" label="Close Rate" value={fmt.pct(d.sales.closeRate)} sentiment={d.sales.closeRate >= 0.18 ? "good" : d.sales.closeRate >= 0.14 ? "warn" : "bad"} annotations={ann} onAnnotate={onAnn} />
        <KpiCard id="g-clients" label="Active Clients" value={fmt.num(d.fulfillment.activeClients || 0)} sentiment="neutral" sub="from Airtable CRM" annotations={ann} onAnnotate={onAnn} />
        <KpiCard id="g-roas" label="Ad ROAS" value={fmt.mult(d.marketing.roas)} sentiment={d.marketing.roas >= 5 ? "good" : d.marketing.roas >= 3 ? "warn" : "bad"} annotations={ann} onAnnotate={onAnn} />
        <KpiCard id="g-ar" label="AR Outstanding" value={fmt.usd(d.ar.totalOutstanding)} sentiment={d.ar.totalOutstanding > 80000 ? "bad" : d.ar.totalOutstanding > 40000 ? "warn" : "good"} annotations={ann} onAnnotate={onAnn} />
        <KpiCard id="g-ltvcac" label="LTV:CAC" value={fmt.mult(d.financial.ltvCacRatio)} sentiment={d.financial.ltvCacRatio >= 5 ? "good" : d.financial.ltvCacRatio >= 3 ? "warn" : "bad"} annotations={ann} onAnnotate={onAnn} />
        <KpiCard id="g-churn" label="Churn Rate" value={fmt.pct(d.fulfillment.churnRate)} sentiment={d.fulfillment.churnRate <= 0.05 ? "good" : d.fulfillment.churnRate <= 0.08 ? "warn" : "bad"} annotations={ann} onAnnotate={onAnn} />
      </BentoGrid>
      <BentoGrid cols={cols}>
        <Card title="6-Month Revenue Trend" span={cols >= 3 ? 2 : (cols as 1 | 2)}>
          <BarChart data={d.financial.monthlyRevenue} labelKey="month" valueKey="revenue" color={T.green} height={170} />
        </Card>
        <Card title="Lead Source Split" span={1}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", height: 28 }}>
              <div style={{ width: `${adPct * 100}%`, backgroundColor: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>
                {adPct > 0.12 ? "Paid " + (adPct * 100).toFixed(0) + "%" : ""}
              </div>
              <div style={{ width: `${(1 - adPct) * 100}%`, backgroundColor: T.green, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#000" }}>
                {(1 - adPct) > 0.12 ? "Organic " + ((1 - adPct) * 100).toFixed(0) + "%" : ""}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, color: T.muted }}>
              <span>{d.marketing.adLeads} paid</span>
              <span>{d.marketing.organicLeads} organic</span>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Set→Show→Close</div>
            {[
              { label: "Sets Booked", val: d.sales.setsBooked, color: T.blue },
              { label: "Showed", val: Math.round(d.sales.setsBooked * d.sales.showRate), color: T.yellow },
              { label: "Closed", val: d.sales.closedDeals, color: T.green },
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: s.color }} />
                <span style={{ fontSize: 12, color: T.muted, flex: 1 }}>{s.label}</span>
                <span style={{ fontSize: 14, fontWeight: 700, fontFamily: T.mono, color: s.color }}>{s.val}</span>
              </div>
            ))}
          </div>
        </Card>
      </BentoGrid>
      <BentoGrid cols={cols}>
        <Card title="AR Aging Distribution" span={cols as 1 | 2 | 3}>
          <StackedBar segments={[
            { label: "Current", value: d.ar.current, color: T.green },
            { label: "30-Day", value: d.ar.days30, color: T.yellow },
            { label: "60-Day", value: d.ar.days60, color: T.amber },
            { label: "90+ Day", value: d.ar.days90plus, color: T.red },
          ]} />
        </Card>
      </BentoGrid>
    </>
  );
}

// ─── Closers Tab ───────────────────────────────────────────────────────────────
function ClosersTab({ d, cols, ann, onAnn }: TabProps) {
  const s = d.sales;
  return (
    <>
      <AIInsights insights={closersInsights(d)} />
      <BentoGrid cols={cols}>
        <KpiCard id="cl-calls" label="Total Calls" value={fmt.num(s.totalCalls)} sentiment="neutral" annotations={ann} onAnnotate={onAnn} />
        <KpiCard id="cl-closes" label="Closed Deals" value={fmt.num(s.closedDeals)} sentiment={s.closedDeals >= 30 ? "good" : "warn"} annotations={ann} onAnnotate={onAnn} />
        <KpiCard id="cl-rate" label="Close Rate" value={fmt.pct(s.closeRate)} sentiment={s.closeRate >= 0.18 ? "good" : s.closeRate >= 0.14 ? "warn" : "bad"} annotations={ann} onAnnotate={onAnn} />
        <KpiCard id="cl-cash" label="Cash Collected" value={fmt.usd(s.cashCollected)} sentiment="good" annotations={ann} onAnnotate={onAnn} />
        <KpiCard id="cl-avg" label="Avg Deal Size" value={fmt.usd(s.avgDealSize)} sentiment={s.avgDealSize >= 8000 ? "good" : "warn"} annotations={ann} onAnnotate={onAnn} />
        <KpiCard id="cl-pipe" label="Pipeline Value" value={fmt.usd(s.pipelineValue)} sentiment="neutral" annotations={ann} onAnnotate={onAnn} />
      </BentoGrid>
      <BentoGrid cols={cols}>
        <Card title="Closer Leaderboard" span={cols as 1 | 2 | 3}>
          <Leaderboard
            ranked
            columns={[
              { key: "name", label: "Name" },
              { key: "calls", label: "Calls", align: "right", format: fmt.num },
              { key: "closes", label: "Closes", align: "right", format: fmt.num },
              { key: "revenue", label: "Revenue", align: "right", format: fmt.usd },
              {
                key: "rate", label: "Close %", align: "right",
                format: fmt.pct,
                sentiment: (v: number) => v >= 0.18 ? "good" : v >= 0.12 ? "warn" : "bad",
                bar: true, barMax: 0.35,
              },
            ]}
            rows={s.closers}
          />
        </Card>
      </BentoGrid>
      <BentoGrid cols={cols}>
        <Card title="Revenue by Closer" span={cols >= 3 ? 2 : (cols as 1 | 2)}>
          <BarChart data={s.closers} labelKey="name" valueKey="revenue" color={T.accent} height={140} />
        </Card>
        <Card title="Show Rate" span={1}>
          <div style={{ textAlign: "center", paddingTop: 20 }}>
            <div style={{ fontSize: 48, fontWeight: 800, fontFamily: T.mono, color: s.showRate >= 0.7 ? T.green : T.yellow, lineHeight: 1 }}>
              {fmt.pct(s.showRate)}
            </div>
            <div style={{ fontSize: 13, color: T.muted, marginTop: 8 }}>show rate</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 16 }}>
              {Math.round(s.setsBooked * s.showRate)} of {s.setsBooked} sets showed
            </div>
          </div>
        </Card>
      </BentoGrid>
    </>
  );
}

// ─── Setters Tab ───────────────────────────────────────────────────────────────
function SettersTab({ d, cols, ann, onAnn }: TabProps) {
  const s = d.sales;
  return (
    <>
      <AIInsights insights={settersInsights(d)} />
      <BentoGrid cols={cols}>
        <KpiCard id="se-leads" label="Leads Assigned" value={fmt.num(d.marketing.totalLeads)} sentiment="neutral" annotations={ann} onAnnotate={onAnn} />
        <KpiCard id="se-sets" label="Sets Booked" value={fmt.num(s.setsBooked)} sentiment={s.setsBooked >= 100 ? "good" : "warn"} annotations={ann} onAnnotate={onAnn} />
        <KpiCard id="se-show" label="Show Rate" value={fmt.pct(s.showRate)} sentiment={s.showRate >= 0.7 ? "good" : s.showRate >= 0.6 ? "warn" : "bad"} annotations={ann} onAnnotate={onAnn} />
        <KpiCard id="se-conv" label="Setter→Close" value={fmt.pct(s.setterToCloseConversion)} sentiment={s.setterToCloseConversion >= 0.25 ? "good" : "warn"} annotations={ann} onAnnotate={onAnn} />
        <KpiCard id="se-pipeline" label="Sets in Pipeline" value={fmt.num(s.setsBooked - s.closedDeals)} sentiment="neutral" sub="not yet closed" annotations={ann} onAnnotate={onAnn} />
      </BentoGrid>
      <BentoGrid cols={cols}>
        <Card title="Setter Leaderboard" span={cols as 1 | 2 | 3}>
          <Leaderboard
            ranked
            columns={[
              { key: "name", label: "Name" },
              { key: "setsBooked", label: "Sets", align: "right", format: fmt.num },
              { key: "showed", label: "Showed", align: "right", format: fmt.num },
              {
                key: "convRate", label: "Show %", align: "right",
                format: fmt.pct,
                sentiment: (v: number) => v >= 0.75 ? "good" : v >= 0.6 ? "warn" : "bad",
                bar: true, barMax: 1,
              },
            ]}
            rows={s.setters}
          />
        </Card>
      </BentoGrid>
      <BentoGrid cols={cols}>
        <Card title="Sets Distribution" span={cols >= 3 ? 2 : (cols as 1 | 2)}>
          <BarChart data={s.setters} labelKey="name" valueKey="setsBooked" color={T.blue} height={130} formatValue={fmt.num} />
        </Card>
        <Card title="Dialer.io" span={1}>
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📞</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.muted, marginBottom: 8 }}>Dialer.io Integration</div>
            <div
              style={{
                fontSize: 11, color: T.yellow, backgroundColor: T.yellowDim,
                border: `1px solid ${T.yellow}`, borderRadius: 6,
                padding: "6px 10px", display: "inline-block",
              }}
            >
              Pending API Credentials
            </div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 12, lineHeight: 1.5 }}>
              Call volume, connect rates, and talk time will appear here once DIALERIO_API_KEY is configured.
            </div>
          </div>
        </Card>
      </BentoGrid>
    </>
  );
}

// ─── Marketing Tab ─────────────────────────────────────────────────────────────
function MarketingTab({ d, cols, ann, onAnn }: TabProps) {
  const m = d.marketing;
  return (
    <>
      <AIInsights insights={marketingInsights(d)} />
      <BentoGrid cols={cols}>
        <KpiCard id="mk-leads" label="Total Leads" value={fmt.num(m.totalLeads)} sentiment="neutral" sub={`${m.adLeads} paid / ${m.organicLeads} organic`} annotations={ann} onAnnotate={onAnn} />
        <KpiCard id="mk-spend" label="Ad Spend" value={fmt.usd(m.adSpend)} sentiment="neutral" annotations={ann} onAnnotate={onAnn} />
        <KpiCard id="mk-cpl" label="CPL (Paid)" value={fmt.usd(m.costPerLead)} sentiment={m.costPerLead <= 100 ? "good" : m.costPerLead <= 130 ? "warn" : "bad"} sub="target: $130" annotations={ann} onAnnotate={onAnn} />
        <KpiCard id="mk-cpa" label="CPA" value={fmt.usd(m.costPerAcquisition)} sentiment="neutral" annotations={ann} onAnnotate={onAnn} />
        <KpiCard id="mk-roas" label="ROAS" value={fmt.mult(m.roas)} sentiment={m.roas >= 5 ? "good" : m.roas >= 3 ? "warn" : "bad"} annotations={ann} onAnnotate={onAnn} />
        <KpiCard id="mk-bookings" label="Calls Booked" value={fmt.num(m.adCallsBooked + m.organicCallsBooked)} sentiment="neutral" sub={`${m.adCallsBooked} paid / ${m.organicCallsBooked} organic`} annotations={ann} onAnnotate={onAnn} />
      </BentoGrid>
      <BentoGrid cols={cols}>
        <Card title="Channel Breakdown" span={cols as 1 | 2 | 3}>
          <Leaderboard
            columns={[
              { key: "name", label: "Channel" },
              { key: "leads", label: "Leads", align: "right", format: fmt.num },
              { key: "spend", label: "Spend", align: "right", format: (v: number) => v > 0 ? fmt.usd(v) : "—" },
              { key: "cpl", label: "CPL", align: "right", format: (v: number) => v > 0 ? fmt.usd(v) : "Organic" },
              { key: "booked", label: "Booked", align: "right", format: fmt.num },
              { key: "closed", label: "Closed", align: "right", format: fmt.num },
            ]}
            rows={m.channels}
          />
        </Card>
      </BentoGrid>
      <BentoGrid cols={cols}>
        <Card title="Weekly Ad Spend" span={cols >= 2 ? 2 : 1}>
          <BarChart data={m.weeklyAdPerformance} labelKey="week" valueKey="spend" color={T.accent} height={130} />
        </Card>
        <Card title="Ad Funnel" span={1}>
          {[
            { label: "Leads", value: m.totalLeads, color: T.blue },
            { label: "Calls Booked", value: m.adCallsBooked + m.organicCallsBooked, color: T.yellow },
            { label: "Showed", value: Math.round((m.adCallsBooked + m.organicCallsBooked) * ((m.adShowRate + m.organicShowRate) / 2)), color: T.green },
            { label: "Closed", value: d.sales.closedDeals, color: T.accent },
          ].map((step, i, arr) => {
            const pct = i === 0 ? 100 : arr[i - 1].value > 0 ? Math.round((step.value / arr[i - 1].value) * 100) : 0;
            return (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: T.muted }}>{step.label}</span>
                  <span style={{ fontSize: 13, fontFamily: T.mono, fontWeight: 700, color: step.color }}>{step.value}</span>
                </div>
                <div style={{ height: 4, backgroundColor: T.border, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", backgroundColor: step.color, opacity: 0.8 }} />
                </div>
                {i > 0 && <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{pct}% of prev</div>}
              </div>
            );
          })}
        </Card>
      </BentoGrid>
    </>
  );
}

// ─── Fulfillment Tab ───────────────────────────────────────────────────────────
function FulfillmentTab({ d, cols, ann, onAnn }: TabProps) {
  const f = d.fulfillment;
  const airtableSource = f.airtableSource ?? "unconfigured";
  const airtableClients = f.airtableClients ?? [];
  const airtableCSMWeekly = f.airtableCSMWeekly ?? [];
  const hasAirtable = airtableSource === "live";

  return (
    <>
      <AIInsights insights={fulfillmentInsights(d)} />
      {/* Airtable status badge */}
      <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: T.muted }}>Airtable CRM</span>
        <span style={{
          fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 600,
          backgroundColor: hasAirtable ? T.greenDim : airtableSource === "error" ? T.redDim : T.yellowDim,
          color: hasAirtable ? T.green : airtableSource === "error" ? T.red : T.yellow,
          border: `1px solid ${hasAirtable ? T.green : airtableSource === "error" ? T.red : T.yellow}`,
        }}>
          {hasAirtable ? "● LIVE" : airtableSource === "error" ? "● ERROR" : "○ NOT CONFIGURED"}
        </span>
      </div>
      <BentoGrid cols={cols}>
        <KpiCard id="fu-active" label="Active Clients" value={fmt.num(f.activeClients)} sentiment="neutral" sub={hasAirtable ? "from Airtable" : "data pending"} annotations={ann} onAnnotate={onAnn} />
        <KpiCard id="fu-onboard" label="New Onboardings" value={fmt.num(f.newOnboardings)} sentiment="good" sub="this period" annotations={ann} onAnnotate={onAnn} />
        <KpiCard id="fu-churn" label="Churn Rate" value={fmt.pct(f.churnRate)} sentiment={f.churnRate <= 0.05 ? "good" : f.churnRate <= 0.08 ? "warn" : "bad"} annotations={ann} onAnnotate={onAnn} />
        <KpiCard id="fu-retention" label="Retention" value={fmt.pct(f.retentionRate)} sentiment={f.retentionRate >= 0.93 ? "good" : "warn"} annotations={ann} onAnnotate={onAnn} />
      </BentoGrid>

      {/* CSM Workload Cards */}
      <BentoGrid cols={cols}>
        {f.csms.map((csm, i) => {
          const weeklyData = airtableCSMWeekly.find((w) => w.csm?.toLowerCase().includes(csm.name.split(" ")[0].toLowerCase()));
          return (
            <Card key={i} title={csm.name} span={1}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: T.muted }}>Active Clients</span>
                  <span style={{ fontSize: 22, fontWeight: 700, fontFamily: T.mono, color: T.blue }}>{csm.activeClients}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: T.muted }}>Onboarded MTD</span>
                  <span style={{ fontSize: 16, fontWeight: 600, fontFamily: T.mono, color: T.green }}>{csm.onboarded}</span>
                </div>
                {weeklyData && (
                  <>
                    <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
                      <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Week of {weeklyData.weekEnding || "Latest"}
                      </div>
                      <div style={{ display: "flex", gap: 12 }}>
                        {[
                          { label: "Check-ins", val: weeklyData.checkIns },
                          { label: "Goals Set", val: weeklyData.goalsSet },
                          { label: "Goals Hit", val: weeklyData.goalsHit },
                        ].map((item, j) => (
                          <div key={j} style={{ flex: 1, textAlign: "center" }}>
                            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: T.mono, color: T.blue }}>{item.val}</div>
                            <div style={{ fontSize: 10, color: T.muted }}>{item.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </Card>
          );
        })}
        <Card title="Churn Trend" span={cols >= 3 ? 1 : 1}>
          <BarChart data={f.monthlyChurn} labelKey="month" valueKey="rate" height={120} color={T.red} formatValue={(n) => (n * 100).toFixed(1) + "%"} />
        </Card>
      </BentoGrid>

      {/* Client Table */}
      {hasAirtable && airtableClients.length > 0 ? (
        <BentoGrid cols={cols}>
          <Card title={`Recent Clients (${airtableClients.length})`} span={cols as 1 | 2 | 3}>
            <Leaderboard
              columns={[
                { key: "name", label: "Client" },
                { key: "csm", label: "CSM", format: (v: string) => v || "—" },
                { key: "status", label: "Status", format: (v: string) => v || "—" },
                { key: "program", label: "Program", format: (v: string) => v || "—" },
                { key: "paymentStatus", label: "Payment", format: (v: string) => v || "—" },
                { key: "balance", label: "Balance", align: "right", format: (v: number) => v > 0 ? fmt.usd(v) : "—", sentiment: (v: number) => v > 0 ? "warn" : "good" },
              ]}
              rows={airtableClients}
            />
          </Card>
        </BentoGrid>
      ) : (
        <div style={{
          backgroundColor: T.card, border: `1px solid ${T.border}`,
          borderRadius: T.cardRadius, padding: T.cardPad, textAlign: "center",
          color: T.muted, fontSize: 13,
        }}>
          {f.airtableSource === "unconfigured"
            ? "Add AIRTABLE_PAT to environment variables to enable client roster view."
            : airtableSource === "error"
            ? "Airtable connection error — verify AIRTABLE_PAT and Base ID configuration."
            : "No client data available."}
        </div>
      )}
    </>
  );
}

// ─── Financial Tab ─────────────────────────────────────────────────────────────
function FinancialTab({ d, cols, ann, onAnn }: TabProps) {
  const f = d.financial;
  const a = d.ar;
  return (
    <>
      <AIInsights insights={financialInsights(d)} />
      <BentoGrid cols={cols}>
        <KpiCard id="fi-mrr" label="MRR" value={fmt.usd(f.mrr)} sentiment="good" sub={`${f.mrrGrowth >= 0 ? "+" : ""}${fmt.pct(f.mrrGrowth)} MoM`} annotations={ann} onAnnotate={onAnn} />
        <KpiCard id="fi-rev" label="Revenue MTD" value={fmt.usd(f.totalRevenueMTD)} sentiment="neutral" annotations={ann} onAnnotate={onAnn} />
        <KpiCard id="fi-proj" label="Projected" value={fmt.usd(f.projectedMonthly)} sentiment="neutral" annotations={ann} onAnnotate={onAnn} />
        <KpiCard id="fi-refund" label="Refunds" value={fmt.usd(f.refunds)} sentiment={f.refundRate > 0.05 ? "bad" : "warn"} sub={fmt.pct(f.refundRate) + " rate"} annotations={ann} onAnnotate={onAnn} />
        <KpiCard id="fi-ltv" label="LTV" value={fmt.usd(f.ltv)} sentiment="good" annotations={ann} onAnnotate={onAnn} />
        <KpiCard id="fi-cac" label="CAC" value={fmt.usd(f.cac)} sentiment="neutral" annotations={ann} onAnnotate={onAnn} />
        <KpiCard id="fi-ratio" label="LTV:CAC" value={fmt.mult(f.ltvCacRatio)} sentiment={f.ltvCacRatio >= 5 ? "good" : f.ltvCacRatio >= 3 ? "warn" : "bad"} annotations={ann} onAnnotate={onAnn} />
      </BentoGrid>
      <BentoGrid cols={cols}>
        <Card title="AR Overview" span={1}>
          {[
            { label: "Total Outstanding", value: fmt.usd(a.totalOutstanding), color: T.yellow },
            { label: "Collection Rate", value: fmt.pct(a.collectionRate), color: a.collectionRate >= 0.9 ? T.green : T.red },
            { label: "Avg Days to Collect", value: a.avgDaysToCollect.toString() + "d", color: a.avgDaysToCollect <= 25 ? T.green : T.yellow },
            { label: "Failed Payments", value: `${a.failedPayments} · ${fmt.usd(a.failedPaymentAmount)}`, color: a.failedPayments > 10 ? T.red : T.muted },
            { label: "Active Pay Plans", value: `${a.paymentPlanActive} · ${fmt.usd(a.paymentPlanValue)}`, color: T.blue },
          ].map((row, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < 4 ? `1px solid ${T.borderSubtle}` : "none" }}>
              <span style={{ fontSize: 12, color: T.muted }}>{row.label}</span>
              <span style={{ fontSize: 14, fontWeight: 700, fontFamily: T.mono, color: row.color }}>{row.value}</span>
            </div>
          ))}
        </Card>
        <Card title="AR Aging" span={cols >= 3 ? 2 : 1}>
          <StackedBar segments={[
            { label: "Current", value: a.current, color: T.green },
            { label: "30-Day", value: a.days30, color: T.yellow },
            { label: "60-Day", value: a.days60, color: T.amber },
            { label: "90+ Day", value: a.days90plus, color: T.red },
          ]} />
          <div style={{ marginTop: 20 }}>
            <BarChart
              data={[
                { label: "Current", value: a.current },
                { label: "30d", value: a.days30 },
                { label: "60d", value: a.days60 },
                { label: "90+", value: a.days90plus },
              ]}
              labelKey="label" valueKey="value" height={100} color={T.accent}
            />
          </div>
        </Card>
      </BentoGrid>
      <BentoGrid cols={cols}>
        <Card title="6-Month Revenue" span={cols as 1 | 2 | 3}>
          <BarChart data={f.monthlyRevenue} labelKey="month" valueKey="revenue" color={T.green} height={160} />
        </Card>
      </BentoGrid>
    </>
  );
}

// ─── Tab Props ─────────────────────────────────────────────────────────────────
type TabProps = {
  d: DashboardData;
  cols: 1 | 2 | 3;
  ann: Record<string, string>;
  onAnn: (id: string, text: string) => void;
};

// ─── AI Chat Panel ─────────────────────────────────────────────────────────────
const CHAT_REPLIES: Record<string, string> = {
  default: "I can help analyze your SLR dashboard data. Ask me about specific KPIs, trends, or recommendations.",
  close: "Your current close rate should be benchmarked against your 6-month trend. Look for the highest-performing closer and replicate their call framework across the team.",
  roas: "ROAS above 5x is typically a signal to increase budget. Check channel breakdown for the top performer and allocate more there before testing new channels.",
  churn: "Churn above 5% compresses LTV and increases CAC payback period. Implement a 30-day check-in protocol and proactive re-engagement for at-risk clients.",
  ar: "Accounts receivable above 30 days should trigger automated follow-up sequences. Prioritize 60+ day buckets for personal outreach before escalating.",
  lead: "Lead quality is often more important than volume. Review show rate by source — low show rate from high-CPL channels indicates targeting misalignment.",
};

function getReply(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("close") || m.includes("closer")) return CHAT_REPLIES.close;
  if (m.includes("roas") || m.includes("ad") || m.includes("marketing")) return CHAT_REPLIES.roas;
  if (m.includes("churn") || m.includes("retention")) return CHAT_REPLIES.churn;
  if (m.includes("ar") || m.includes("receivable") || m.includes("collection")) return CHAT_REPLIES.ar;
  if (m.includes("lead") || m.includes("setter") || m.includes("set")) return CHAT_REPLIES.lead;
  return CHAT_REPLIES.default;
}

function AIChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([
    { role: "ai", text: "SLR Assistant ready. Ask me about any KPI, trend, or strategic question." },
  ]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setMessages((m) => [...m, { role: "user", text }, { role: "ai", text: getReply(text) }]);
    setInput("");
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed", bottom: 80, right: 20, width: 340, maxHeight: "60vh",
        backgroundColor: T.card, border: `1px solid ${T.border}`,
        borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        display: "flex", flexDirection: "column", zIndex: 1000,
        animation: "slideUp 0.2s ease",
      }}
    >
      <style>{`@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>✦</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>SLR Assistant</span>
          <span style={{ fontSize: 10, color: T.muted, backgroundColor: T.accentGlow, padding: "2px 6px", borderRadius: 4 }}>Claude</span>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div
              style={{
                maxWidth: "85%", padding: "8px 12px", borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                backgroundColor: msg.role === "user" ? T.accent : T.cardAlt,
                color: T.text, fontSize: 13, lineHeight: 1.5,
              }}
            >
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: "10px 14px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask about any KPI..."
          style={{
            flex: 1, backgroundColor: T.bg, border: `1px solid ${T.border}`,
            borderRadius: 8, color: T.text, fontSize: 13, padding: "8px 12px",
            fontFamily: T.sans, outline: "none",
          }}
        />
        <button
          onClick={send}
          style={{
            padding: "8px 14px", backgroundColor: T.accent, color: "#fff",
            border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13,
            fontFamily: T.sans, fontWeight: 600,
          }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("goals");
  const [isDemo, setIsDemo] = useState(false);
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [annotations, setAnnotations] = useState<Record<string, string>>({});
  const [chatOpen, setChatOpen] = useState(false);
  const width = useWindowWidth();
  const cols = useCols(width);

  const handleAnnotate = useCallback((id: string, text: string) => {
    setAnnotations((prev) => {
      const next = { ...prev };
      if (text) next[id] = text; else delete next[id];
      return next;
    });
  }, []);

  const fetchData = useCallback(async (pw?: string) => {
    try {
      setLoading(true);
      const authStr = pw !== undefined ? pw : password;
      const res = await fetch(`/api/data${authStr ? `?auth=${encodeURIComponent(authStr)}` : ""}`);

      if (res.status === 401) {
        setAuthed(false);
        setAuthError(true);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(`API ${res.status}`);

      const json: DashboardData = await res.json();
      const isEmpty = json.sales.totalCalls === 0 && json.sales.cashCollected === 0 && json.marketing.totalLeads === 0;

      setData(isEmpty ? DEMO : json);
      setIsDemo(isEmpty);
      setAuthed(true);
      setAuthError(false);
    } catch {
      setData(DEMO);
      setIsDemo(true);
      setAuthed(true);
    } finally {
      setLoading(false);
    }
  }, [password]);

  // Initial fetch
  useEffect(() => { fetchData(""); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh every 15 min
  useEffect(() => {
    if (!authed) return;
    const interval = parseInt(process.env.NEXT_PUBLIC_REFRESH_INTERVAL || "900000", 10);
    const timer = setInterval(() => fetchData(), interval);
    return () => clearInterval(timer);
  }, [authed, fetchData]);

  // Pull-to-refresh (mobile)
  useEffect(() => {
    if (!authed) return;
    const THRESHOLD = 80;
    let touchStartY = 0;
    let pulling = false;
    let indicator: HTMLDivElement | null = null;

    function getIndicator() {
      if (!indicator) {
        indicator = document.createElement("div");
        indicator.style.cssText = "position:fixed;top:0;left:0;right:0;height:3px;background:#6366f1;transform:scaleX(0);transform-origin:left;transition:transform .15s;z-index:9999;pointer-events:none";
        document.body.appendChild(indicator);
      }
      return indicator;
    }

    function onTouchStart(e: TouchEvent) {
      if (window.scrollY === 0) { touchStartY = e.touches[0].clientY; pulling = true; }
    }
    function onTouchMove(e: TouchEvent) {
      if (!pulling) return;
      const dy = e.touches[0].clientY - touchStartY;
      if (dy > 0) getIndicator().style.transform = `scaleX(${Math.min(dy / THRESHOLD, 1)})`;
    }
    function onTouchEnd(e: TouchEvent) {
      if (!pulling) return;
      pulling = false;
      const dy = e.changedTouches[0].clientY - touchStartY;
      const ind = getIndicator();
      if (dy >= THRESHOLD) {
        ind.style.background = "#6ee7b7"; ind.style.transform = "scaleX(1)";
        fetchData();
        setTimeout(() => { ind.style.transition = "transform .4s"; ind.style.transform = "scaleX(0)"; ind.style.background = "#6366f1"; }, 800);
      } else {
        ind.style.transform = "scaleX(0)";
      }
      touchStartY = 0;
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      if (indicator && document.body.contains(indicator)) { document.body.removeChild(indicator); indicator = null; }
    };
  }, [authed, fetchData]);

  // ── Loading ──
  if (loading && !data) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: T.bg }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 36, height: 36, border: `3px solid ${T.border}`, borderTopColor: T.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 14px" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ fontSize: 14, color: T.muted }}>Loading dashboard...</div>
        </div>
      </div>
    );
  }

  // ── Login screen ──
  if (!authed && authError) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: T.bg }}>
        <form
          onSubmit={(e) => { e.preventDefault(); fetchData(password); }}
          style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, borderRadius: T.cardRadius, padding: 40, width: 360, textAlign: "center" }}
        >
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>SLR CEO Dashboard</div>
          <div style={{ fontSize: 13, color: T.muted, marginBottom: 28 }}>Enter dashboard password</div>
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            style={{ width: "100%", padding: "12px 14px", backgroundColor: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 14, fontFamily: T.sans, marginBottom: 12, outline: "none", boxSizing: "border-box" }}
            autoFocus
          />
          {authError && <div style={{ fontSize: 12, color: T.red, marginBottom: 12 }}>Invalid password.</div>}
          <button type="submit" style={{ width: "100%", padding: "12px 0", backgroundColor: T.accent, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, fontFamily: T.sans, cursor: "pointer" }}>
            Sign In
          </button>
        </form>
      </div>
    );
  }

  if (!data) return null;

  const tabProps: TabProps = { d: data, cols, ann: annotations, onAnn: handleAnnotate };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: T.bg, paddingBottom: 80 }}>
      <div style={{ maxWidth: 1440, margin: "0 auto", padding: `20px ${cols === 1 ? "12px" : "24px"}` }}>
        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: T.text }}>
              SLR CEO Dashboard
            </div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 3, fontFamily: T.mono }}>
              {data.period} &middot; {new Date(data.lastUpdated).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}
              {loading && <span style={{ color: T.accent, marginLeft: 8 }}>↻</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {isDemo && (
              <div style={{ backgroundColor: T.yellowDim, color: T.yellow, padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700, border: `1px solid ${T.yellow}` }}>
                DEMO DATA
              </div>
            )}
            <button
              onClick={() => fetchData()}
              style={{ padding: "6px 14px", backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, borderRadius: 8, color: T.sub, fontSize: 12, fontFamily: T.sans, cursor: "pointer", fontWeight: 600 }}
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* ── Error Banners ── */}
        {data.errors.map((err, i) => (
          <div key={i} style={{ backgroundColor: "rgba(244,114,182,0.08)", border: `1px solid ${T.red}`, borderRadius: 8, padding: "8px 14px", marginBottom: 10, display: "flex", gap: 8, fontSize: 12 }}>
            <span style={{ color: T.red, fontWeight: 700 }}>{err.source.toUpperCase()}</span>
            <span style={{ color: T.sub }}>{err.message}</span>
          </div>
        ))}

        {/* ── Tab Bar ── */}
        <div
          style={{
            display: "flex", gap: 2, backgroundColor: T.card, borderRadius: 12, padding: 4,
            marginBottom: 20, border: `1px solid ${T.border}`, overflowX: "auto",
          }}
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, minWidth: cols === 1 ? 70 : "auto",
                padding: cols === 1 ? "8px 4px" : "10px 0",
                border: "none", borderRadius: 9,
                backgroundColor: tab === t.key ? T.accent : "transparent",
                color: tab === t.key ? "#fff" : T.muted,
                fontSize: cols === 1 ? 11 : 13, fontWeight: 700,
                fontFamily: T.sans, cursor: "pointer",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
              }}
            >
              {cols === 1 ? t.icon + " " + t.label : t.label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        {tab === "goals" && <GoalsTab {...tabProps} />}
        {tab === "closers" && <ClosersTab {...tabProps} />}
        {tab === "setters" && <SettersTab {...tabProps} />}
        {tab === "marketing" && <MarketingTab {...tabProps} />}
        {tab === "fulfillment" && <FulfillmentTab {...tabProps} />}
        {tab === "financial" && <FinancialTab {...tabProps} />}
      </div>

      {/* ── AI Chat Panel ── */}
      <AIChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />

      {/* ── Chat FAB ── */}
      <button
        onClick={() => setChatOpen((o) => !o)}
        title="AI Assistant"
        style={{
          position: "fixed", bottom: 24, right: 24,
          width: 52, height: 52, borderRadius: "50%",
          backgroundColor: chatOpen ? T.cardAlt : T.accent,
          border: `2px solid ${chatOpen ? T.border : T.accent}`,
          color: "#fff", fontSize: 20, cursor: "pointer",
          boxShadow: "0 4px 20px rgba(99,102,241,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s ease", zIndex: 1001,
          fontFamily: T.sans,
        }}
      >
        {chatOpen ? "×" : "✦"}
      </button>
    </div>
  );
}
