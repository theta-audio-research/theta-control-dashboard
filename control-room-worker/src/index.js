/**
 * THETA Control Room — Delta Inbox Automation Worker v3.0
 *
 * What this Worker automates:
 * - POST /api/delta receives Control Room delta JSON.
 * - Applies changed project rows to data/projects.json in GitHub.
 * - Writes delta archive files into deltas/.
 * - Writes markdown reports into reports/.
 * - Scheduled handler creates checkpoint reports at configured local times.
 *
 * Required Worker secrets:
 * - GITHUB_TOKEN: fine-grained GitHub token with Contents read/write for theta-control-dashboard.
 * - CONTROL_ROOM_TOKEN: private bearer token used by build scripts/tools to submit deltas.
 *
 * Required vars in wrangler.toml:
 * - GITHUB_OWNER
 * - GITHUB_REPO
 * - GITHUB_BRANCH
 * - TIMEZONE
 * - SCHEDULE_HOURS
 */

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({
        ok: true,
        service: "THETA Control Room Delta Inbox",
        version: "3.0",
        scheduleTimezone: env.TIMEZONE,
        scheduleHours: parseScheduleHours(env),
      });
    }

    if (request.method === "POST" && url.pathname === "/api/delta") {
      try {
        await requireAuth(request, env);
        const delta = await request.json();
        const result = await applyDeltaToGitHub(delta, env, "api");
        return json({ ok: true, result });
      } catch (error) {
        return json({ ok: false, error: String(error?.message || error) }, 400);
      }
    }

    if (request.method === "POST" && url.pathname === "/api/checkpoint") {
      try {
        await requireAuth(request, env);
        const result = await writeCheckpoint(env, "manual-api");
        return json({ ok: true, result });
      } catch (error) {
        return json({ ok: false, error: String(error?.message || error) }, 400);
      }
    }

    return json({
      ok: false,
      error: "Not found",
      available: ["GET /api/health", "POST /api/delta", "POST /api/checkpoint"],
    }, 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(event, env));
  },
};

async function handleScheduled(event, env) {
  const now = new Date();
  const local = getLocalParts(now, env.TIMEZONE || "America/Los_Angeles");
  const hours = parseScheduleHours(env);

  if (!hours.includes(local.hour)) {
    console.log(`Skipping checkpoint. Local hour ${local.hour} not in schedule.`);
    return;
  }

  const idempotencyPath = `reports/checkpoints/${local.date}-${String(local.hour).padStart(2, "0")}00.json`;
  const existing = await githubGetFile(env, idempotencyPath).catch(() => null);
  if (existing) {
    console.log(`Checkpoint already exists for ${idempotencyPath}.`);
    return;
  }

  await writeCheckpoint(env, "scheduled-cron");
}

function parseScheduleHours(env) {
  return String(env.SCHEDULE_HOURS || "6,9,12,14,16,23")
    .split(",")
    .map(x => Number(x.trim()))
    .filter(x => Number.isFinite(x));
}

function getLocalParts(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = type => parts.find(p => p.type === type)?.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
  };
}

async function requireAuth(request, env) {
  const expected = env.CONTROL_ROOM_TOKEN;
  if (!expected) throw new Error("CONTROL_ROOM_TOKEN is not configured.");

  const auth = request.headers.get("authorization") || "";
  const prefix = "Bearer ";
  if (!auth.startsWith(prefix)) throw new Error("Missing bearer token.");

  const token = auth.slice(prefix.length).trim();
  if (token !== expected) throw new Error("Invalid bearer token.");
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: JSON_HEADERS,
  });
}

function normalizeProjectId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-");
}

function readinessLabel(score) {
  const n = Number(score || 0);
  if (n >= 85) return "Shippable";
  if (n >= 65) return "Beta / close";
  if (n >= 40) return "Active build";
  if (n >= 20) return "Prototype";
  if (n > 0) return "Just begun";
  return "N/A";
}

function readinessClass(score) {
  const n = Number(score || 0);
  if (n >= 85) return "ship";
  if (n >= 65) return "beta";
  if (n >= 40) return "active";
  if (n >= 20) return "prototype";
  if (n > 0) return "early";
  return "na";
}

function makeBlankProject(projectId, name) {
  return {
    id: projectId,
    name: name || projectId.toUpperCase(),
    description: "",
    status: "decision",
    confidence: "low",
    sourceCertainty: "low",
    productConfidence: "low",
    stage: "Unclassified",
    priorityRank: null,
    today: false,
    ignoreToday: false,
    latestVersion: "Needs confirmation.",
    nextAction: "Needs Control Room intake.",
    firstAction: "Confirm project status.",
    blocker: "Needs source-of-truth confirmation.",
    decisionNeeded: "",
    recommendedChoice: "",
    formatsNow: [],
    formatsLater: [],
    lastKnownStatus: "Newly added through delta intake.",
    tomorrowFirstAction: "Confirm project status.",
    notToday: "",
    artifact: "",
    sourceConfidenceNote: "Added by delta intake.",
    shipReadiness: 0,
    readinessLabel: "N/A",
    readinessClass: "na",
    lastTouched: "",
  };
}

function applyProjectDelta(project, delta, date) {
  const fieldMap = {
    name: "name",
    description: "description",
    status: "status",
    stage: "stage",
    latestVersion: "latestVersion",
    latest_confirmed_version: "latestVersion",
    nextAction: "nextAction",
    next_action: "nextAction",
    firstAction: "firstAction",
    first_action: "firstAction",
    blocker: "blocker",
    currentBlocker: "blocker",
    current_blocker: "blocker",
    decisionNeeded: "decisionNeeded",
    decision_needed: "decisionNeeded",
    recommendedChoice: "recommendedChoice",
    recommended_choice: "recommendedChoice",
    formatsNow: "formatsNow",
    formats_in_scope: "formatsNow",
    formatsLater: "formatsLater",
    deferred_formats: "formatsLater",
    lastKnownStatus: "lastKnownStatus",
    last_known_status: "lastKnownStatus",
    tomorrowFirstAction: "tomorrowFirstAction",
    tomorrow_first_action: "tomorrowFirstAction",
    notToday: "notToday",
    not_today: "notToday",
    artifact: "artifact",
    sourceArtifact: "artifact",
    build_source_artifact: "artifact",
    sourceCertainty: "sourceCertainty",
    source_certainty: "sourceCertainty",
    sourceConfidenceNote: "sourceConfidenceNote",
    source_confidence_note: "sourceConfidenceNote",
    shipReadiness: "shipReadiness",
    ship_readiness: "shipReadiness",
    readinessLabel: "readinessLabel",
    readiness_label: "readinessLabel",
    ignoreToday: "ignoreToday",
    ignore_today: "ignoreToday",
  };

  const changed = [];
  for (const [inputKey, outputKey] of Object.entries(fieldMap)) {
    if (!(inputKey in delta)) continue;
    let value = delta[inputKey];

    if (outputKey === "shipReadiness") {
      value = Math.max(0, Math.min(100, Number(value || 0)));
      project.readinessLabel = delta.readinessLabel || delta.readiness_label || readinessLabel(value);
      project.readinessClass = readinessClass(value);
      project.productConfidence = value >= 85 ? "high" : value >= 40 ? "medium" : "low";
    }

    if (JSON.stringify(project[outputKey]) !== JSON.stringify(value)) {
      project[outputKey] = value;
      changed.push(outputKey);
    }
  }

  project.lastTouched = date;
  return changed;
}

async function applyDeltaToGitHub(delta, env, source) {
  const date = delta.date || new Date().toISOString().slice(0, 10);
  const projectsFile = await githubGetFile(env, "data/projects.json");
  const projectsData = JSON.parse(projectsFile.text);
  const projects = projectsData.projects || [];
  projectsData.projects = projects;

  const projectMap = new Map(projects.map(p => [p.id, p]));
  const changedProjects = delta.changedProjects || [];
  const applied = [];

  for (const item of changedProjects) {
    const id = normalizeProjectId(item.id || item.project || item.name);
    if (!id) throw new Error("Every changed project needs id, project, or name.");

    if (!projectMap.has(id)) {
      if (!delta.allowNewProjects) throw new Error(`Unknown project id: ${id}`);
      const blank = makeBlankProject(id, item.name || item.project || id.toUpperCase());
      projects.push(blank);
      projectMap.set(id, blank);
    }

    const project = projectMap.get(id);
    const fields = applyProjectDelta(project, item, date);
    applied.push({
      id,
      name: project.name,
      fields,
      changeType: item.changeType || item.change_type || "Delta update",
      endStatus: item.endStatus || item.end_status || project.lastKnownStatus || "",
      tomorrowFirstAction: project.tomorrowFirstAction || "",
    });
  }

  if (Array.isArray(delta.tomorrowFocus)) {
    const focusIds = delta.tomorrowFocus.map(normalizeProjectId);
    for (const p of projects) {
      const idx = focusIds.indexOf(p.id);
      p.today = idx !== -1;
      p.priorityRank = idx === -1 ? null : idx + 1;
      if (idx !== -1) p.ignoreToday = false;
    }
  }

  if (Array.isArray(delta.ignoreToday)) {
    const ignoreIds = new Set(delta.ignoreToday.map(normalizeProjectId));
    for (const p of projects) {
      if (ignoreIds.has(p.id)) {
        p.ignoreToday = true;
        p.today = false;
        p.priorityRank = null;
      }
    }
  }

  projectsData.schemaVersion = "3.0";
  projectsData.lastUpdated = date;
  projectsData.todayMessage = delta.todayMessage || projectsData.todayMessage || "Control Room delta applied.";
  const appliedAt = new Date().toISOString();
  projectsData.lastControlRoomSweep = {
    date,
    type: delta.type || "control_room_delta",
    source,
    changedProjects: applied.map(x => x.id),
    dashboardDataChanged: applied.length > 0,
    lastAppliedAt: appliedAt,
    tomorrowFirstControlRoomAction: delta.dashboardUpdateDecision?.tomorrowFirstControlRoomAction || "Review dashboard and continue active projects.",
  };
  projectsData.lastControlRoomSync = {
    type: delta.type || "control_room_delta",
    source,
    createdAt: appliedAt,
    localDate: date,
    timezone: env.TIMEZONE || "America/Los_Angeles",
    summary: `${applied.length} project delta${applied.length === 1 ? "" : "s"} applied: ${applied.map(x => x.name).join(", ") || "none"}.`,
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const deltaPath = `deltas/${date}-${timestamp}.json`;
  const reportName = delta.reportFile || `control-room-delta-${date}-${timestamp}.md`;
  const reportPath = `reports/${reportName}`;

  const message = delta.commitMessage || `Apply THETA Control Room delta ${date}`;

  // Serial writes: GitHub contents API warns against parallel create/update calls.
  await githubPutFile(env, "data/projects.json", JSON.stringify(projectsData, null, 2) + "\n", projectsFile.sha, message);
  await githubPutFile(env, deltaPath, JSON.stringify(delta, null, 2) + "\n", null, message);
  await githubPutFile(env, reportPath, buildReport(delta, applied), null, message);

  return {
    date,
    appliedCount: applied.length,
    changedProjects: applied.map(x => x.id),
    updatedFiles: ["data/projects.json", deltaPath, reportPath],
  };
}

function buildReport(delta, applied) {
  const date = delta.date || new Date().toISOString().slice(0, 10);
  const rows = applied.map(item => `| ${item.name} | ${item.changeType} | ${item.endStatus} | ${item.tomorrowFirstAction} |`).join("\n");
  const focus = Array.isArray(delta.tomorrowFocus) ? delta.tomorrowFocus.join(", ") : "Unchanged";

  return `# ${delta.title || "THETA Control Room — Delta Report"}
**Date:** ${date}  
**Mode:** ${delta.mode || "Changed projects only. Unchanged projects left alone."}

## Changed projects

| Project | Change type | End status | Tomorrow's first action |
|---|---|---|---|
${rows || "| None | None | No project deltas supplied. | Review dashboard. |"}

## Dashboard update decision

| Item | Result |
|---|---|
| Any project deltas? | ${applied.length ? "Yes" : "No"} |
| Dashboard data changed? | ${applied.length ? "Yes" : "No"} |
| Tomorrow Focus Mode priorities | ${focus} |
| Tomorrow's first Control Room action | ${delta.dashboardUpdateDecision?.tomorrowFirstControlRoomAction || "Review dashboard and continue active projects."} |

## Notes

${(delta.notes || ["Only changed projects were included."]).map(x => `- ${x}`).join("\n")}
`;
}

async function writeCheckpoint(env, source) {
  const now = new Date();
  const local = getLocalParts(now, env.TIMEZONE || "America/Los_Angeles");
  const projectsFile = await githubGetFile(env, "data/projects.json");
  const projectsData = JSON.parse(projectsFile.text);
  const projects = projectsData.projects || [];

  const today = projects
    .filter(p => p.today)
    .sort((a, b) => (a.priorityRank || 99) - (b.priorityRank || 99));

  const blocked = projects.filter(p => p.status === "blocked");
  const decisions = projects.filter(p => p.status === "decision");

  const checkpointCreatedAt = now.toISOString();
  const checkpoint = {
    date: local.date,
    localHour: local.hour,
    timezone: env.TIMEZONE,
    source,
    createdAt: checkpointCreatedAt,
    today: today.map(p => ({ id: p.id, name: p.name, nextAction: p.nextAction, firstAction: p.firstAction })),
    blockedCount: blocked.length,
    decisionCount: decisions.length,
  };

  projectsData.lastUpdated = local.date;
  projectsData.lastControlRoomSync = {
    type: "scheduled_checkpoint",
    source,
    createdAt: checkpointCreatedAt,
    localDate: local.date,
    localHour: local.hour,
    timezone: env.TIMEZONE || "America/Los_Angeles",
    summary: `Automated checkpoint at ${String(local.hour).padStart(2, "0")}:00. Today focus: ${today.map(p => p.name).join(", ") || "none"}.`,
  };

  const hour = String(local.hour).padStart(2, "0");
  const jsonPath = `reports/checkpoints/${local.date}-${hour}00.json`;
  const mdPath = `reports/checkpoints/${local.date}-${hour}00.md`;

  const md = `# THETA Control Room Checkpoint — ${local.date} ${hour}:00

**Timezone:** ${env.TIMEZONE}  
**Source:** ${source}  
**Created:** ${now.toISOString()}

## Today Focus

${today.map((p, i) => `${i + 1}. **${p.name}** — ${p.firstAction || p.nextAction}`).join("\n") || "No Today focus set."}

## Counts

| Item | Count |
|---|---:|
| Blocked projects | ${blocked.length} |
| Decision projects | ${decisions.length} |

## Reminder

This checkpoint is automated. It does not invent project changes; it records the current dashboard state at the scheduled time.
`;

  await githubPutFile(env, "data/projects.json", JSON.stringify(projectsData, null, 2) + "\n", projectsFile.sha, `Control Room checkpoint ${local.date} ${hour}:00`);
  await githubPutFile(env, jsonPath, JSON.stringify(checkpoint, null, 2) + "\n", null, `Control Room checkpoint ${local.date} ${hour}:00`);
  await githubPutFile(env, mdPath, md, null, `Control Room checkpoint ${local.date} ${hour}:00`);

  return { jsonPath, mdPath, local };
}

async function githubGetFile(env, path) {
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${encodeURIComponentPath(path)}?ref=${encodeURIComponent(env.GITHUB_BRANCH || "main")}`;
  const res = await fetch(url, {
    headers: githubHeaders(env),
  });

  if (!res.ok) {
    throw new Error(`GitHub GET ${path} failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const text = base64Decode(data.content || "");
  return { sha: data.sha, text };
}

async function githubPutFile(env, path, text, sha, message) {
  const existing = sha ? { sha } : await githubGetFile(env, path).catch(() => null);
  const body = {
    message,
    content: base64Encode(text),
    branch: env.GITHUB_BRANCH || "main",
  };
  if (existing?.sha) body.sha = existing.sha;

  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${encodeURIComponentPath(path)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: githubHeaders(env),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`GitHub PUT ${path} failed: ${res.status} ${await res.text()}`);
  }

  return await res.json();
}

function githubHeaders(env) {
  if (!env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is not configured.");
  return {
    "authorization": `Bearer ${env.GITHUB_TOKEN}`,
    "accept": "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "theta-control-room-worker",
    "content-type": "application/json",
  };
}

function base64Encode(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

function base64Decode(text) {
  const clean = String(text || "").replace(/\n/g, "");
  return decodeURIComponent(escape(atob(clean)));
}

function encodeURIComponentPath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}
