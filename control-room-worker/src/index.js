/**
 * THETA Control Room — Delta Inbox Automation Worker v3.3
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
        version: "3.8",
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

    if (request.method === "POST" && url.pathname === "/api/ticket") {
      try {
        await requireAuth(request, env);
        const payload = await request.json();
        const result = await updateTicketInGitHub(payload, env, false);
        return json({ ok: true, result });
      } catch (error) {
        return json({ ok: false, error: String(error?.message || error) }, 400);
      }
    }

    if (request.method === "POST" && url.pathname === "/api/ticket/complete") {
      try {
        await requireAuth(request, env);
        const payload = await request.json();
        const result = await updateTicketInGitHub(payload, env, true);
        return json({ ok: true, result });
      } catch (error) {
        return json({ ok: false, error: String(error?.message || error) }, 400);
      }
    }

    if (request.method === "POST" && url.pathname === "/api/return-packet") {
      try {
        await requireAuth(request, env);
        const payload = await request.json();
        const result = await generateReturnPacketInGitHub(payload, env);
        return json({ ok: true, ...result });
      } catch (error) {
        return json({ ok: false, error: String(error?.message || error) }, 400);
      }
    }

    return json({
      ok: false,
      error: "Not found",
      available: ["GET /api/health", "POST /api/delta", "POST /api/checkpoint", "POST /api/ticket", "POST /api/ticket/complete", "POST /api/return-packet"],
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

function semverScore(value) {
  return String(value || "")
    .replace(/^v/i, "")
    .split(".")
    .map(part => Number(part) || 0);
}

function compareSemver(a, b) {
  const aa = semverScore(a);
  const bb = semverScore(b);
  const max = Math.max(aa.length, bb.length);
  for (let i = 0; i < max; i++) {
    const av = aa[i] || 0;
    const bv = bb[i] || 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

function inferVersionFromDelta(...sources) {
  const blob = sources
    .filter(Boolean)
    .map(source => {
      if (typeof source === "string") return source;
      return [
        source.version,
        source.latestVersion,
        source.latest_confirmed_version,
        source.currentVersion,
        source.lastBuild,
        source.source_artifact,
        source.sourceArtifact,
        source.build_artifact,
        source.buildArtifact,
        source.artifact,
        source.summary,
        source.status,
        source.next_action,
        source.nextAction,
      ].filter(Boolean).join(" ");
    })
    .join(" ");

  const versions = [];
  const regex = /(?:^|[^A-Za-z0-9])v?(\d+\.\d+(?:\.\d+)*)/g;
  let match;
  while ((match = regex.exec(blob)) !== null) {
    versions.push(`v${match[1]}`);
  }

  if (!versions.length) return "";
  versions.sort(compareSemver);
  return versions[versions.length - 1];
}

function isLifecycleStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return new Set([
    "active",
    "paused",
    "blocked",
    "decision",
    "prototype",
    "research",
    "archive",
    "archived",
    "shipping",
    "shipped",
    "complete",
    "completed"
  ]).has(normalized);
}

function setProjectField(project, key, value, changed) {
  if (value === undefined || value === null || value === "") return;
  if (JSON.stringify(project[key]) !== JSON.stringify(value)) {
    project[key] = value;
    if (!changed.includes(key)) changed.push(key);
  }
}

function getChangedProjectsFromDelta(delta) {
  const direct = Array.isArray(delta.changedProjects) ? delta.changedProjects.slice() : [];
  if (direct.length) {
    return direct.map(item => {
      const inferred = inferVersionFromDelta(item, delta);
      return {
        ...item,
        version: item.version || item.latestVersion || item.latest_confirmed_version || inferred,
        latestVersion: item.latestVersion || item.latest_confirmed_version || item.version || inferred,
        currentVersion: item.currentVersion || item.version || item.latestVersion || inferred,
        lastBuild: item.lastBuild || item.version || item.latestVersion || inferred,
      };
    });
  }

  const projectName = delta.project || delta.projectId || delta.id || delta.name;
  if (!projectName) return [];

  const inferred = inferVersionFromDelta(delta);

  return [{
    id: delta.id || delta.projectId || normalizeProjectId(projectName),
    name: delta.name || String(projectName).trim(),
    version: delta.version || inferred,
    latestVersion: delta.latestVersion || delta.latest_confirmed_version || delta.version || inferred,
    currentVersion: delta.currentVersion || delta.version || inferred,
    lastBuild: delta.lastBuild || delta.version || inferred,
    next_action: delta.next_action || delta.nextAction || "",
    first_action: delta.first_action || delta.firstAction || "",
    blocker: delta.blocker || delta.currentBlocker || delta.current_blocker || "",
    summary: delta.summary || delta.status || "",
    status: delta.status || "",
    lastDeltaStatus: delta.status || "",
    sourceArtifact: delta.sourceArtifact || delta.source_artifact || "",
    source_artifact: delta.source_artifact || delta.sourceArtifact || "",
    buildArtifact: delta.buildArtifact || delta.build_artifact || "",
    build_artifact: delta.build_artifact || delta.buildArtifact || "",
    artifact: delta.artifact || delta.build_artifact || delta.source_artifact || "",
    formats_in_scope: delta.formats_in_scope || delta.formats || delta.formatsNow || "",
    ship_readiness: delta.ship_readiness || delta.shipReadiness || "",
    changeType: delta.event || delta.changeType || delta.change_type || "Build/install delta",
    endStatus: delta.status || delta.summary || "",
    tomorrow_first_action: delta.tomorrow_first_action || delta.tomorrowFirstAction || "",
  }];
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
    stage: "stage",
    latestVersion: "latestVersion",
    latest_confirmed_version: "latestVersion",
    version: "latestVersion",
    currentVersion: "currentVersion",
    current_version: "currentVersion",
    lastBuild: "lastBuild",
    last_build: "lastBuild",
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
    summary: "summary",
    lastDeltaStatus: "lastDeltaStatus",
    last_delta_status: "lastDeltaStatus",
    tomorrowFirstAction: "tomorrowFirstAction",
    tomorrow_first_action: "tomorrowFirstAction",
    notToday: "notToday",
    not_today: "notToday",
    artifact: "artifact",
    sourceArtifact: "sourceArtifact",
    source_artifact: "sourceArtifact",
    buildArtifact: "buildArtifact",
    build_artifact: "buildArtifact",
    build_source_artifact: "sourceArtifact",
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

  const inferredVersion = inferVersionFromDelta(delta);
  if (inferredVersion) {
    setProjectField(project, "latestVersion", inferredVersion, changed);
    setProjectField(project, "currentVersion", inferredVersion, changed);
    setProjectField(project, "lastBuild", inferredVersion, changed);
  }

  const incomingStatus = delta.status || delta.endStatus || delta.end_status || "";
  if (incomingStatus) {
    if (isLifecycleStatus(incomingStatus)) {
      setProjectField(project, "status", String(incomingStatus).trim().toLowerCase(), changed);
    } else {
      setProjectField(project, "lastDeltaStatus", incomingStatus, changed);
      if (!delta.summary) setProjectField(project, "summary", incomingStatus, changed);
    }
  }

  setProjectField(project, "summary", delta.summary || project.summary || "", changed);
  setProjectField(project, "sourceArtifact", delta.sourceArtifact || delta.source_artifact || "", changed);
  setProjectField(project, "buildArtifact", delta.buildArtifact || delta.build_artifact || "", changed);

  project.lastTouched = date;
  return changed;
}

// ---- v3.8: Delta Ticket Packet Auto-Merge ------------------------------------
function mergeTicketPacketIntoProject(project, ticketPacket, nowIso) {
  const norm = v => String(v ?? "").trim().toLowerCase();
  const normText = v => norm(v).replace(/\s+/g, " ");
  project.testTickets = Array.isArray(project.testTickets) ? project.testTickets : [];

  const incoming = Array.isArray(ticketPacket && ticketPacket.tickets) ? ticketPacket.tickets : [];
  const packetVersion = (ticketPacket && ticketPacket.version) || "";
  const packetSource = (ticketPacket && ticketPacket.source) || "";

  // Static definition fields a packet MAY update. Live test state
  // (status, tester, version, versionTested, notes, result, completed,
  //  completedAt, updatedAt, createdAt, archive metadata) is never copied here.
  const STATIC_FIELDS = ["question", "title", "slug", "category", "section", "module",
    "qaCategory", "qaLayer", "layer", "priority", "description", "steps", "expected",
    "acceptance", "testMaterial", "notesTarget"];

  const byId = new Map(), bySlug = new Map(), byTitle = new Map(), byQ = new Map();
  const index = t => {
    if (t.id) byId.set(norm(t.id), t);
    if (t.slug) bySlug.set(norm(t.slug), t);
    if (t.title) byTitle.set(normText(t.title), t);
    if (t.question) byQ.set(normText(t.question), t);
  };
  project.testTickets.forEach(index);

  const findExisting = inc => {
    if (inc.id && byId.has(norm(inc.id))) return byId.get(norm(inc.id));
    if (inc.slug && bySlug.has(norm(inc.slug))) return bySlug.get(norm(inc.slug));
    if (inc.title && byTitle.has(normText(inc.title))) return byTitle.get(normText(inc.title));
    if (inc.question && byQ.has(normText(inc.question))) return byQ.get(normText(inc.question));
    return null;
  };

  let added = 0, updated = 0, preserved = 0, seq = 0;

  for (const inc of incoming) {
    if (!inc || typeof inc !== "object") continue;
    const existing = findExisting(inc);

    if (!existing) {
      const fresh = {
        id: inc.id || inc.slug || (project.id + "-ticket-" + Date.now() + "-" + (seq++)),
        question: inc.question || inc.title || "New test question",
        status: "open",
        priority: inc.priority || "normal",
        tester: "",
        notes: "",
        version: inc.version || packetVersion || project.latestVersion || "",
        versionTested: "",
        result: "",
        createdAt: nowIso,
        updatedAt: "",
        completedAt: "",
      };
      for (const f of STATIC_FIELDS) {
        if (inc[f] !== undefined && inc[f] !== null && inc[f] !== "") fresh[f] = inc[f];
      }
      if (packetSource) fresh.ticketSource = packetSource;
      if (packetVersion) fresh.ticketPacketVersion = packetVersion;
      project.testTickets.push(fresh);
      index(fresh);
      added++;
    } else {
      let changed = false;
      for (const f of STATIC_FIELDS) {
        if (inc[f] === undefined || inc[f] === null) continue;
        if (inc[f] === "" && existing[f]) continue;
        if (existing[f] !== inc[f]) { existing[f] = inc[f]; changed = true; }
      }
      changed ? updated++ : preserved++;
    }
  }

  return { added, updated, preserved, total: project.testTickets.length };
}

async function applyDeltaToGitHub(delta, env, source) {
  const now = new Date();
  const local = getLocalParts(now, env.TIMEZONE || "America/Los_Angeles");
  const date = delta.date || local.date;
  const appliedAt = now.toISOString();
  const projectsFile = await githubGetFile(env, "data/projects.json");
  const projectsData = JSON.parse(projectsFile.text);
  const projects = projectsData.projects || [];
  projectsData.projects = projects;

  const projectMap = new Map(projects.map(p => [p.id, p]));
  const changedProjects = getChangedProjectsFromDelta(delta);
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
    project.lastUpdated = appliedAt;
    project.lastControlRoomSync = {
      type: delta.type || "control_room_delta",
      source,
      createdAt: appliedAt,
      localDate: local.date,
      localHour: local.hour,
      timezone: env.TIMEZONE || "America/Los_Angeles",
      summary: `${project.name || id} updated from Control Room delta${project.latestVersion ? `: ${project.latestVersion}` : ""}.`,
    };
    if (!fields.includes("lastUpdated")) fields.push("lastUpdated");
    if (!fields.includes("lastControlRoomSync")) fields.push("lastControlRoomSync");

    applied.push({
      id,
      name: project.name,
      fields,
      changeType: item.changeType || item.change_type || "Delta update",
      endStatus: item.endStatus || item.end_status || project.lastKnownStatus || "",
      tomorrowFirstAction: project.tomorrowFirstAction || "",
    });
  }

  // v3.8: merge optional ticketPacket.tickets into the named project's testTickets
  let ticketMergeStats = null;
  if (delta.ticketPacket && Array.isArray(delta.ticketPacket.tickets) && delta.ticketPacket.tickets.length) {
    const ticketTargetId = normalizeProjectId(
      delta.ticketPacket.project || delta.project ||
      (changedProjects[0] && (changedProjects[0].id || changedProjects[0].project || changedProjects[0].name))
    );
    const ticketTarget = ticketTargetId ? projectMap.get(ticketTargetId) : null;
    if (ticketTarget) {
      ticketMergeStats = mergeTicketPacketIntoProject(ticketTarget, delta.ticketPacket, appliedAt);
    }
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
    localDate: local.date,
    localHour: local.hour,
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
    ticketMerge: ticketMergeStats,
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


function findProjectOrThrow(projectsData, projectId) {
  const pid = normalizeProjectId(projectId);
  const project = (projectsData.projects || []).find(p => p.id === pid);
  if (!project) throw new Error(`Unknown project: ${pid}`);
  return project;
}

function findTicketOrCreate(project, ticketId, payload) {
  project.testTickets = project.testTickets || [];
  let ticket = project.testTickets.find(t => t.id === ticketId);
  if (!ticket) {
    ticket = {
      id: ticketId || `${project.id}-ticket-${Date.now()}`,
      question: payload.question || "New test question",
      status: "open",
      priority: payload.priority || "normal",
      tester: "",
      notes: "",
      version: payload.version || project.latestVersion || "",
      createdAt: new Date().toISOString(),
      updatedAt: "",
      completedAt: "",
      result: "",
    };
    project.testTickets.push(ticket);
  }
  return ticket;
}

async function updateTicketInGitHub(payload, env, complete) {
  const projectId = normalizeProjectId(payload.projectId || payload.project || payload.id);
  const ticketId = payload.ticketId || payload.ticket_id;
  if (!projectId) throw new Error("projectId is required.");
  if (!ticketId) throw new Error("ticketId is required.");

  const projectsFile = await githubGetFile(env, "data/projects.json");
  const projectsData = JSON.parse(projectsFile.text);
  const project = findProjectOrThrow(projectsData, projectId);
  const ticket = findTicketOrCreate(project, ticketId, payload);
  const now = new Date().toISOString();

  ticket.status = complete ? "passed" : (payload.status || ticket.status || "open");
  ticket.tester = payload.tester ?? ticket.tester ?? "";
  ticket.notes = payload.notes ?? ticket.notes ?? "";
  ticket.version = payload.version ?? ticket.version ?? project.latestVersion ?? "";
  ticket.result = payload.result ?? ticket.result ?? "";
  ticket.updatedAt = now;
  if (complete || ticket.status === "passed") {
    ticket.completedAt = ticket.completedAt || now;
    ticket.result = ticket.result || "passed";
  } else if (ticket.status === "open") {
    ticket.completedAt = "";
  }

  projectsData.lastUpdated = now.slice(0, 10);
  projectsData.lastControlRoomSync = {
    type: "ticket_update",
    source: "dashboard-ticket-ui",
    createdAt: now,
    localDate: now.slice(0, 10),
    timezone: env.TIMEZONE || "America/Los_Angeles",
    summary: `${project.name} ticket updated: ${ticket.question}`,
  };

  const message = `Update ${project.name} test ticket`;
  await githubPutFile(env, "data/projects.json", JSON.stringify(projectsData, null, 2) + "\\n", projectsFile.sha, message);

  if (ticket.status === "passed") {
    const archivePath = `tickets/archive/${project.id}/${now.slice(0,10)}-${ticket.id}.json`;
    await githubPutFile(env, archivePath, JSON.stringify({ project: project.name, ticket }, null, 2) + "\\n", null, message);
  }

  return { projectId: project.id, ticketId: ticket.id, status: ticket.status };
}

function buildReturnPacket(project) {
  const tickets = project.testTickets || [];
  const open = tickets.filter(t => (t.status || "open") !== "passed");
  const passed = tickets.filter(t => (t.status || "open") === "passed");
  const failed = tickets.filter(t => t.status === "failed");
  const blocked = tickets.filter(t => t.status === "blocked");
  const linesFor = (items) => items.length
    ? items.map(t => `- [${t.status === "passed" ? "x" : " "}] ${t.question}${t.notes ? `\\n  Notes: ${t.notes}` : ""}`).join("\\n")
    : "- None";

  return `# ${project.name} — Test Return Packet

## Project state

- Latest version/state: ${project.latestVersion || "Needs confirmation"}
- Status: ${project.status || "unknown"}
- Stage: ${project.stage || "unknown"}
- Ship readiness: ${project.shipReadiness ?? "N/A"}%
- Current blocker: ${project.blocker || "None listed"}
- Next action: ${project.nextAction || "None listed"}

## Open test questions

${linesFor(open)}

## Passed tests

${linesFor(passed)}

## Failed tests

${linesFor(failed)}

## Blocked tests

${linesFor(blocked)}

## Recommended project-chat instruction

Use this return packet as the latest tester/control-room feedback. Update the next build plan around failed/blocked tests first, preserve passed behavior, and update the project Control Room hook after the next build.
`;
}

async function generateReturnPacketInGitHub(payload, env) {
  const projectId = normalizeProjectId(payload.projectId || payload.project || payload.id);
  if (!projectId) throw new Error("projectId is required.");
  const projectsFile = await githubGetFile(env, "data/projects.json");
  const projectsData = JSON.parse(projectsFile.text);
  const project = findProjectOrThrow(projectsData, projectId);
  const packet = buildReturnPacket(project);
  const now = new Date().toISOString();
  const path = `reports/return-packets/${project.id}-${now.slice(0,10)}-${now.replace(/[:.]/g, "-")}.md`;

  projectsData.lastUpdated = now.slice(0, 10);
  projectsData.lastControlRoomSync = {
    type: "return_packet",
    source: "dashboard-ticket-ui",
    createdAt: now,
    localDate: now.slice(0, 10),
    timezone: env.TIMEZONE || "America/Los_Angeles",
    summary: `${project.name} return packet generated.`,
  };

  const message = `Generate ${project.name} return packet`;
  await githubPutFile(env, "data/projects.json", JSON.stringify(projectsData, null, 2) + "\\n", projectsFile.sha, message);
  await githubPutFile(env, path, packet, null, message);
  return { projectId: project.id, path, packet };
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
