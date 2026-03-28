// ─── Zoom Server-to-Server OAuth integration ─────────────────────────────────
// GHL user UUID → Zoom email → PMI ID → participant reports → show/noshow status

const ZOOM_BASE = "https://api.zoom.us/v2";

let _zoomToken: string | null = null;
let _zoomTokenExpiry = 0;

async function getZoomToken(): Promise<string> {
  if (_zoomToken && Date.now() < _zoomTokenExpiry) return _zoomToken;
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  if (!accountId || !clientId || !clientSecret) {
    throw new Error("Zoom credentials not configured");
  }
  const basic = Buffer.from(clientId + ":" + clientSecret).toString("base64");
  const res = await fetch(
    "https://zoom.us/oauth/token?grant_type=account_credentials&account_id=" + accountId,
    { method: "POST", headers: { Authorization: "Basic " + basic } }
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error("Zoom token error: " + res.status + " " + t);
  }
  const data = await res.json() as { access_token: string; expires_in: number };
  _zoomToken = data.access_token;
  _zoomTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return _zoomToken;
}

async function zoomFetch(endpoint: string): Promise<unknown> {
  const token = await getZoomToken();
  const res = await fetch(ZOOM_BASE + endpoint, {
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error("Zoom API error " + res.status + ": " + t.slice(0, 200));
  }
  return res.json();
}

export interface ZoomUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  pmi: number;
}

export interface ZoomParticipant {
  id: string;
  user_id: string;
  name: string;
  user_email: string;
  join_time: string;
  leave_time: string;
  duration: number;
}

export async function getZoomUsers(): Promise<ZoomUser[]> {
  let users: ZoomUser[] = [];
  let nextPageToken = "";
  do {
    const qs = nextPageToken
      ? "?page_size=100&next_page_token=" + nextPageToken
      : "?page_size=100&status=active";
    const data = await zoomFetch("/users" + qs) as { users?: ZoomUser[]; next_page_token?: string };
    users = users.concat(data.users || []);
    nextPageToken = data.next_page_token || "";
  } while (nextPageToken);
  return users;
}

export async function getMeetingParticipants(meetingId: string | number): Promise<ZoomParticipant[]> {
  try {
    const data = await zoomFetch("/report/meetings/" + meetingId + "/participants?page_size=300") as { participants?: ZoomParticipant[] };
    return data.participants || [];
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("404") || msg.includes("400")) return [];
    throw err;
  }
}

export function determineShowStatus(
  participants: ZoomParticipant[],
  hostEmail: string
): "showed" | "noshow" | "unknown" {
  if (participants.length === 0) return "unknown";
  const nonHost = participants.filter(
    (p) => p.user_email?.toLowerCase() !== hostEmail.toLowerCase() && p.duration > 30
  );
  return nonHost.length > 0 ? "showed" : "noshow";
}

export function getGhlToZoomEmailMap(): Record<string, string> {
  try { return JSON.parse(process.env.ZOOM_USER_EMAIL_MAP || "{}") as Record<string, string>; }
  catch { return {}; }
}

export async function buildZoomPmiMap(): Promise<Record<string, number>> {
  const emailMap = getGhlToZoomEmailMap();
  const zoomUsers = await getZoomUsers();
  const emailToPmi: Record<string, number> = {};
  for (const u of zoomUsers) emailToPmi[u.email.toLowerCase()] = u.pmi;
  const pmiMap: Record<string, number> = {};
  for (const [ghlUuid, email] of Object.entries(emailMap)) {
    const pmi = emailToPmi[email.toLowerCase()];
    if (pmi) pmiMap[ghlUuid] = pmi;
  }
  return pmiMap;
}

export function getPmiForUser(ghlUserId: string): number | null {
  try {
    const map = JSON.parse(process.env.ZOOM_PMI_MAP || "{}") as Record<string, number>;
    return map[ghlUserId] ?? null;
  } catch { return null; }
}
