/**
 * lib/dialerio.ts
 * Dialer.io API scaffold — no API credentials yet
 *
 * When DIALERIO_API_KEY becomes available, implement real endpoints here.
 * All functions return empty data with source: "scaffold".
 */

export interface DialerioRepStats {
  name: string;
  callsToday: number;
  callsWeek: number;
  talkTimeMinutes: number;
  connectRate: number;
  source: "live" | "scaffold";
}

export interface DialerioCall {
  id: string;
  rep: string;
  leadName: string;
  durationSeconds: number;
  outcome: "connected" | "voicemail" | "no_answer" | "busy";
  timestamp: string;
}

export interface DialerioSummary {
  totalCallsToday: number;
  totalCallsWeek: number;
  avgTalkTimeMinutes: number;
  connectRate: number;
  repStats: DialerioRepStats[];
  recentCalls: DialerioCall[];
  source: "live" | "scaffold";
  scaffoldMessage?: string;
}

// ─── Scaffold — returns empty data ─────────────────────────────────────────────

export async function getDialerioSummary(): Promise<DialerioSummary> {
  // TODO: Implement when DIALERIO_API_KEY is configured
  // const key = process.env.DIALERIO_API_KEY;
  // if (key) { /* real API calls here */ }

  return {
    totalCallsToday: 0,
    totalCallsWeek: 0,
    avgTalkTimeMinutes: 0,
    connectRate: 0,
    repStats: [],
    recentCalls: [],
    source: "scaffold",
    scaffoldMessage: "Dialer.io integration pending API credentials",
  };
}

export async function getDialerioRepStats(repNames?: string[]): Promise<DialerioRepStats[]> {
  // Will query per-rep dialer data once API key is available
  return (repNames || []).map((name) => ({
    name,
    callsToday: 0,
    callsWeek: 0,
    talkTimeMinutes: 0,
    connectRate: 0,
    source: "scaffold" as const,
  }));
}
