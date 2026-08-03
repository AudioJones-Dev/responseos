// scripts/sync-dashboard.mjs
// Auto-syncs dashboard/dashboard-data.json with live GitHub issue/PR state.
// Runs in GitHub Actions on Node 20+ (uses global fetch). No external deps.
//
// For every task that has a "ref" (issue or PR number):
//   - issue closed, or PR merged          -> task.status = "Done", progress = 100
//   - PR closed WITHOUT merging           -> never auto-complete; a stale "Done"
//                                            is demoted to "To Do"/0, other
//                                            statuses are left as authored
//   - ref open (or reopened) but "Done"   -> revert to "In Progress"
// It also refreshes data.liveIssues (open issues only) and stamps generatedAt
// when substantive dashboard data changes.

import { readFileSync, writeFileSync } from "node:fs";

const DATA_PATH = "dashboard/dashboard-data.json";
const repo = process.env.GITHUB_REPOSITORY; // "owner/name"
const token = process.env.GITHUB_TOKEN;

if (!repo) {
  console.error("GITHUB_REPOSITORY is not set; aborting.");
  process.exit(1);
}
const [owner, name] = repo.split("/");
const API = "https://api.github.com";
const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

async function gh(path) {
  const res = await fetch(API + path, { headers });
  if (!res.ok) throw new Error(`GitHub ${path} -> ${res.status} ${res.statusText}`);
  return res.json();
}

// PRs are returned by the issues endpoint too, so this works for both.
// For PRs the payload carries a `pull_request` object whose `merged_at` is
// non-null only when the PR was actually merged (vs closed-unmerged).
async function getRef(num) {
  try {
    return await gh(`/repos/${owner}/${name}/issues/${num}`);
  } catch (e) {
    console.warn(`  ref #${num}: ${e.message}`);
    return null;
  }
}

async function getOpenIssues() {
  const out = [];
  for (let page = 1; page <= 5; page++) {
    const batch = await gh(`/repos/${owner}/${name}/issues?state=open&per_page=100&page=${page}`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const i of batch) {
      if (i.pull_request) continue; // exclude PRs from the open-issues panel
      out.push({
        number: i.number,
        title: i.title,
        url: i.html_url,
        state: i.state,
        labels: (i.labels || []).map((l) => (typeof l === "string" ? l : l.name)),
      });
    }
    if (batch.length < 100) break;
  }
  return out;
}

const originalData = JSON.parse(readFileSync(DATA_PATH, "utf8"));
const data = structuredClone(originalData);

// 1) Sync tasks linked to an issue/PR.
for (const t of data.tasks || []) {
  if (!t.ref) continue;
  const ref = await getRef(t.ref);
  if (!ref) continue;

  const isPR = Boolean(ref.pull_request);
  const merged = isPR && Boolean(ref.pull_request.merged_at);
  const closed = ref.state === "closed";

  let newStatus = t.status;
  let newProgress = t.progress;

  if (isPR && closed && !merged) {
    // PR closed without merging: the work did NOT land. Never auto-complete.
    // Demote a stale "Done" back to To Do; leave any deliberate status alone.
    if (t.status === "Done") {
      newStatus = "To Do";
      newProgress = 0;
    }
  } else if (closed) {
    // Issue closed, or PR merged -> complete.
    newStatus = "Done";
    newProgress = 100;
  } else if (t.status === "Done") {
    // Reopened / still open but marked Done -> walk back.
    newStatus = "In Progress";
  }

  if (t.status !== newStatus) console.log(`  #${t.ref} ${t.title}: ${t.status} -> ${newStatus}`);
  t.status = newStatus;
  t.progress = newProgress;
  t.refState = merged ? "merged" : ref.state;
  t.refUrl = ref.html_url;
}

// 2) Refresh the open-issues panel.
try {
  data.liveIssues = await getOpenIssues();
} catch (e) {
  console.warn("Could not fetch open issues:", e.message);
}

const originalSubstantiveData = structuredClone(originalData);
const currentSubstantiveData = structuredClone(data);
delete originalSubstantiveData.generatedAt;
delete currentSubstantiveData.generatedAt;

if (JSON.stringify(originalSubstantiveData) === JSON.stringify(currentSubstantiveData)) {
  console.log("No substantive dashboard changes.");
} else {
  data.generatedAt = new Date().toISOString();
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + "\n");
  console.log(
    `Synced: refs=${(data.tasks || []).filter((t) => t.ref).length} openIssues=${(data.liveIssues || []).length}`
  );
}
