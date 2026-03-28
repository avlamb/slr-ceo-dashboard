// POST /api/zoom-sync
// Syncs Zoom participant data to GHL appointment status for a given date.
// Called nightly by cron or on-demand.
// Query params: auth=<AUTH_SECRET>, date=YYYY-MM-DD, dry_run=true

import { NextRequest, NextResponse } from "next/server";
import { getMeetingParticipants, determineShowStatus, getPmiForUser, buildZoomPmiMap, getZoomUsers } from "@/lib/zoom";

const GHL_BASE = "https://services.leadconnectorhq.com";

function checkAuth(req) {
  const secret = process.env.AUTH_SECRET || "soberliving10";
  return req.nextUrl.searchParams.get("auth") === secret;
}

async function getGhlAppointments(startTs, endTs) {
  const token = process.env.GHL_API_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;
  const calendarId = process.env.GHL_CALENDAR_ID;
  const url = GHL_BASE + "/calendars/events?locationId=" + locationId + "&calendarId=" + calendarId + "&startTime=" + startTs + "&endTime=" + endTs;
  const res = await fetch(url, { headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", Version: "2021-07-28" } });
  if (!res.ok) throw new Error("GHL appointments error: " + res.status);
  const data = await res.json();
  return data.events || [];
}

async function patchGhlAppointmentStatus(eventId, status) {
  const token = process.env.GHL_API_TOKEN;
  const res = await fetch(GHL_BASE + "/calendars/events/appointments/" + eventId, {
    method: "PUT",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", Version: "2021-07-28" },
    body: JSON.stringify({ appointmentStatus: status }),
  });
  return res.ok;
}

export async function POST(req) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const dryRun = params.get("dry_run") === "true";
  const dateStr = params.get("date") || (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();

  const dayStart = new Date(dateStr + "T00:00:00Z").getTime();
  const dayEnd = new Date(dateStr + "T23:59:59Z").getTime();
  const results = [];
  let updated = 0, skipped = 0, errors = 0;

  try {
    const appointments = await getGhlAppointments(dayStart, dayEnd);
    const unresolved = appointments.filter((a) => ["new", "confirmed"].includes(a.appointmentStatus || "new"));

    for (const appt of unresolved) {
      const userId = appt.assignedUserId;
      if (!userId) { skipped++; continue; }

      const pmi = getPmiForUser(userId);
      if (!pmi) { results.push({ id: appt.id, status: "skip", reason: "no PMI for " + userId }); skipped++; continue; }

      const apptEnd = appt.endTime || appt.end_time || 0;
      if (Date.now() < apptEnd + 30 * 60 * 1000) { results.push({ id: appt.id, status: "skip", reason: "meeting may not have ended" }); skipped++; continue; }

      const participants = await getMeetingParticipants(pmi);
      const emailMap = (() => { try { return JSON.parse(process.env.ZOOM_USER_EMAIL_MAP || "{}"); } catch { return {}; } })();
      const hostEmail = emailMap[userId] || "";
      const showStatus = determineShowStatus(participants, hostEmail);

      if (showStatus === "unknown") { results.push({ id: appt.id, pmi, status: "skip", reason: "Zoom report not ready" }); skipped++; continue; }

      let patched = false;
      if (!dryRun) { patched = await patchGhlAppointmentStatus(appt.id, showStatus); if (patched) updated++; else errors++; }
      results.push({ id: appt.id, userId, pmi, participants: participants.length, showStatus, ghlPatched: dryRun ? "dry_run" : patched });
    }

    return NextResponse.json({ date: dateStr, dryRun, totalAppointments: appointments.length, unresolved: unresolved.length, updated, skipped, errors, results });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const action = req.nextUrl.searchParams.get("action");

  if (action === "build_pmi_map") {
    const pmiMap = await buildZoomPmiMap();
    return NextResponse.json({ pmiMap, envVarValue: JSON.stringify(pmiMap) });
  }
  if (action === "list_users") {
    const users = await getZoomUsers();
    return NextResponse.json({ users: users.map((u) => ({ email: u.email, name: u.first_name + " " + u.last_name, pmi: u.pmi })) });
  }
  return NextResponse.json({ usage: { "GET ?action=list_users": "List Zoom users with PMIs", "GET ?action=build_pmi_map": "Build UUID→PMI map", "POST ?date=YYYY-MM-DD": "Run sync", "POST ?dry_run=true": "Preview" } });
}
