# ResponseOS — Build Progress Dashboard

A self-contained, auto-updating progress board: roadmap phases, progress bars,
a kanban, owner workload, and an open-issues panel. Open `index.html` in any
browser — no server or build step required.

## How it works

```
dashboard-data.json   <-- single source of truth (edit this)
        │
        ├── index.html            reads the JSON and renders everything
        └── ../scripts/sync-dashboard.mjs   refreshes it from live GitHub data
```

- **`dashboard-data.json`** holds the project, the three owners
  (Audio, Claude Code, Codex), the roadmap phases, and the task list.
- **`index.html`** fetches that JSON (local copy first, then the `master` raw
  URL, then an embedded fallback) and draws the dashboard. Every KPI, phase bar,
  kanban card, chart, and table row is derived from the task list.
- **`scripts/sync-dashboard.mjs`** runs in CI and keeps the data honest:
  any task with a `"ref"` to an issue/PR is flipped to **Done** when that
  issue/PR closes, and the open-issues panel + sync timestamp are refreshed.

## The one rule for agents (Claude Code / Codex)

> When you finish or change a unit of work, update **`dashboard/dashboard-data.json`** —
> add/edit the task, set its `status`, `progress`, and `owner`. If the work maps
> to a GitHub issue or PR, set `"ref": <number>` and `"refType": "issue"|"pull"`
> and the sync job will close it out automatically when the issue/PR closes.

### Task shape

```json
{
  "id": "V-02",
  "phase": "v0.3 · Demo Scope",
  "title": "Decide demo surface / feature cut",
  "owner": "Audio",
  "status": "In Progress",       // Backlog | To Do | In Progress | Review | Done
  "progress": 30,                 // 0-100
  "priority": "High",            // High | Med | Low
  "start": "2026-06-02",
  "due": "2026-06-16",
  "ref": 27,                      // optional: linked issue/PR number
  "refType": "issue",            // optional: "issue" | "pull"
  "blocked": true,                // optional
  "blockedReason": "..."         // optional
}
```

## Viewing it

- **Locally:** open `dashboard/index.html` in a browser.
- **Shared URL (optional):** enable GitHub Pages — see the header comment in
  `.github/workflows/dashboard.yml`. Once on, the board publishes to
  `https://audiojones-dev.github.io/responseos/`.
