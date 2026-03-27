// âââ Dashboard Data Types ââââââââââââââââââââââââââââââââââââââââââââââ

export interface DashboardData {
  lastUpdated: string;
  period: string;
  sales: SalesData;
  fulfillment: FulfillmentData;
  financial: FinancialData;
  ar: ARData;
  marketing: MarketingData;
  errors: DataSourceError[];
}

export interface DataSourceError {
  source: "ghl" | "hyros" | "meta" | "sheets";
  message: string;
  timestamp: string;
}

// âââ Sales âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

export interface SalesData {
  totalCalls: number;
  setsBooked: number;
  showRate: number;
  closedDeals: number;
  closeRate: number;
  cashCollected: number;
  avgDealSize: number;
  pipelineValue: number;
  setterToCloseConversion: number;
  closers: CloserMetrics[];
  setters: SetterMetrics[];
  weeklyTrend: WeeklyRevenue[];
}

export interface CloserMetrics {
  name: string;
  calls: number;
  closes: number;
  revenue: number;
  rate: number;
}

export interface SetterMetrics {
  name: string;
  setsBooked: number;
  showed: number;
  convRate: number;
}

export interface WeeklyRevenue {
  week: string;
  revenue: number;
  deals: number;
}

// âââ Fulfillment âââââââââââââââââââââââââââââââââââââââââââââââââââââââ

export interface FulfillmentData {
  activeClients: number;
  newOnboardings: number;
  avgOnboardingDays: number;
  clientSatisfaction: number;
  churnRate: number;
  churnedThisMonth: number;
  retentionRate: number;
  csms: CSMMetrics[];
  monthlyChurn: MonthlyChurn[];
}

export interface CSMMetrics {
  name: string;
  activeClients: number;
  onboarded: number;
  avgDays: number;
  satisfaction: number;
}

export interface MonthlyChurn {
  month: string;
  rate: number;
}

// âââ Financial âââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

export interface FinancialData {
  mrr: number;
  mrrGrowth: number;
  totalRevenueMTD: number;
  projectedMonthly: number;
  refunds: number;
  refundRate: number;
  ltv: number;
  cac: number;
  ltvCacRatio: number;
  monthlyRevenue: MonthlyRevenuePoint[];
}

export interface MonthlyRevenuePoint {
  month: string;
  revenue: number;
}

// âââ Accounts Receivable âââââââââââââââââââââââââââââââââââââââââââââââ

export interface ARData {
  totalOutstanding: number;
  current: number;
  days30: number;
  days60: number;
  days90plus: number;
  collectionRate: number;
  avgDaysToCollect: number;
  failedPayments: number;
  failedPaymentAmount: number;
  paymentPlanActive: number;
  paymentPlanValue: number;
}

// âââ Marketing âââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

export interface MarketingData {
  totalLeads: number;
  adLeads: number;
  organicLeads: number;
  adSpend: number;
  costPerLead: number;
  costPerAcquisition: number;
  roas: number;
  adCallsBooked: number;
  organicCallsBooked: number;
  adShowRate: number;
  organicShowRate: number;
  channels: ChannelMetrics[];
  weeklyAdPerformance: WeeklyAdPerformance[];
}

export interface ChannelMetrics {
  name: string;
  leads: number;
  spend: number;
  cpl: number;
  booked: number;
  closed: number;
}

export interface WeeklyAdPerformance {
  week: string;
  spend: number;
  leads: number;
  cpl: number;
}

// âââ GHL API Response Types ââââââââââââââââââââââââââââââââââââââââââââ

export interface GHLContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  tags: string[];
  dateAdded: string;
  assignedTo: string;
  customFields: Record<string, string>;
}

export interface GHLOpportunity {
  id: string;
  name: string;
  monetaryValue: number;
  pipelineId: string;
  pipelineStageId: string;
  status: string;
  assignedTo: string;
  contact: { id: string; name: string };
  dateAdded: string;
  lastStatusChangeAt: string;
}

export interface GHLPayment {
  id: string;
  amount: number;
  status: string;
  currency: string;
  contactId: string;
  createdAt: string;
}

// âââ Hyros API Response Types ââââââââââââââââââââââââââââââââââââââââââ

export interface HyrosLead {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  tags: string[];
  sources: string[];
  created_at: string;
}

export interface HyrosSale {
  id: string;
  email: string;
  amount: number;
  source: string;
  ad_id: string;
  campaign_id: string;
  created_at: string;
}

export interface HyrosAdAttribution {
  ad_id: string;
  ad_name: string;
  campaign_name: string;
  source: string;
  leads: number;
  sales: number;
  revenue: number;
  cost: number;
  roas: number;
}

// âââ Meta Ads API Response Types âââââââââââââââââââââââââââââââââââââââ

export interface MetaCampaignInsight {
  campaign_id: string;
  campaign_name: string;
  spend: string;
  impressions: string;
  clicks: string;
  actions?: { action_type: string; value: string }[];
  cost_per_action_type?: { action_type: string; value: string }[];
  date_start: string;
  date_stop: string;
}
