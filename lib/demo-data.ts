import type { DashboardData } from "./types";

// âââ Demo data shown when all API sources fail âââââââââââââââââââââââââââââ
// Values are realistic for a mid-stage sober living coaching business.
// This keeps the dashboard usable (for demos, onboarding) even without live API.

export const DEMO_DATA: DashboardData = {
  lastUpdated: new Date().toISOString(),
  period: "Demo Mode",

  sales: {
    totalCalls: 84,
    setsBooked: 61,
    showRate: 0.74,
    closedDeals: 19,
    closeRate: 0.226,
    cashCollected: 114000,
    avgDealSize: 6000,
    pipelineValue: 198000,
    setterToCloseConversion: 0.31,
    closers: [
      { name: "Daniel", calls: 42, closes: 11, revenue: 66000, rate: 0.262 },
      { name: "Marcus", calls: 28, closes: 6, revenue: 36000, rate: 0.214 },
      { name: "Samantha", calls: 14, closes: 2, revenue: 12000, rate: 0.143 },
    ],
    setters: [
      { name: "Jessica", setsBooked: 34, showed: 26, convRate: 0.765 },
      { name: "Tyler", setsBooked: 27, showed: 19, convRate: 0.704 },
    ],
    weeklyTrend: [
      { week: "W1", revenue: 24000, deals: 4 },
      { week: "W2", revenue: 30000, deals: 5 },
      { week: "W3", revenue: 36000, deals: 6 },
      { week: "W4", revenue: 24000, deals: 4 },
    ],
  },

  fulfillment: {
    activeClients: 47,
    newOnboardings: 8,
    avgOnboardingDays: 6,
    clientSatisfaction: 4.6,
    churnRate: 0.043,
    churnedThisMonth: 2,
    retentionRate: 0.957,
    csms: [
      { name: "Philip Blake", activeClients: 24, onboarded: 4, avgDays: 5, satisfaction: 4.7 },
      { name: "Juanyetta Beasley", activeClients: 23, onboarded: 4, avgDays: 7, satisfaction: 4.5 },
    ],
    monthlyChurn: [
      { month: "Oct", rate: 0.051 },
      { month: "Nov", rate: 0.048 },
      { month: "Dec", rate: 0.039 },
      { month: "Jan", rate: 0.044 },
      { month: "Feb", rate: 0.041 },
      { month: "Mar", rate: 0.043 },
    ],
  },

  financial: {
    mrr: 141000,
    mrrGrowth: 0.082,
    totalRevenueMTD: 114000,
    projectedMonthly: 148200,
    refunds: 6000,
    refundRate: 0.053,
    ltv: 18000,
    cac: 3600,
    ltvCacRatio: 5.0,
    monthlyRevenue: [
      { month: "Oct", revenue: 98000 },
      { month: "Nov", revenue: 109000 },
      { month: "Dec", revenue: 121000 },
      { month: "Jan", revenue: 130000 },
      { month: "Feb", revenue: 138000 },
      { month: "Mar", revenue: 114000 },
    ],
  },

  ar: {
    totalOutstanding: 42000,
    current: 28000,
    days30: 9000,
    days60: 3500,
    days90plus: 1500,
    collectionRate: 0.91,
    avgDaysToCollect: 18,
    failedPayments: 4,
    failedPaymentAmount: 9600,
    paymentPlanActive: 11,
    paymentPlanValue: 66000,
  },

  marketing: {
    totalLeads: 312,
    adLeads: 218,
    organicLeads: 94,
    adSpend: 28400,
    costPerLead: 130,
    costPerAcquisition: 1494,
    roas: 4.01,
    adCallsBooked: 44,
    organicCallsBooked: 17,
    adShowRate: 0.77,
    organicShowRate: 0.68,
    channels: [
      { name: "Facebook/Instagram", leads: 148, spend: 18200, cpl: 123, booked: 31, closed: 9 },
      { name: "YouTube", leads: 42, spend: 6400, cpl: 152, booked: 8, closed: 2 },
      { name: "Google", leads: 28, spend: 3800, cpl: 136, booked: 5, closed: 2 },
      { name: "Organic / Referral", leads: 94, spend: 0, cpl: 0, booked: 17, closed: 6 },
    ],
    weeklyAdPerformance: [
      { week: "W1", spend: 6800, leads: 74, cpl: 92 },
      { week: "W2", spend: 7200, leads: 81, cpl: 89 },
      { week: "W3", spend: 7600, leads: 88, cpl: 86 },
      { week: "W4", spend: 6800, leads: 69, cpl: 99 },
    ],
  },

  errors: [],
};
