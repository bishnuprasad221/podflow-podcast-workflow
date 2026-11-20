/* PodFlow – Podcast Production Workflow
   Plain JavaScript. Data is saved in the browser with localStorage. */

// ---------- 1. Constants ----------
const STORAGE_KEY = "podflow-data-v1";

// Workflow steps in order. "done" is the value that marks a step complete.
const STEPS = [
  { key: "script",  label: "Script",    options: ["Not started", "Drafting", "Approved"],          done: "Approved" },
  { key: "record",  label: "Recording", options: ["Not scheduled", "Scheduled", "Recorded"],       done: "Recorded" },
  { key: "edit",    label: "Editing",   options: ["Not started", "Rough cut", "Mixing", "Final"],  done: "Final" },
  { key: "art",     label: "Artwork",   options: ["Pending", "In design", "Done"],                 done: "Done" },
  { key: "publish", label: "Publishing",options: ["Draft", "Scheduled", "Published"],              done: "Published" },
];

// ---------- 2. State ----------
let state = load();
let editingEpisodeId = null;
let editingGuestId = null;

function demoData() {
  return {
    guests: [
      { id: "g1", name: "Aarav Sharma", role: "Startup founder", email: "aarav@example.com", bio: "Built two EdTech startups; talks about early-stage hustle." },
      { id: "g2", name: "Meera Kapoor", role: "Sound engineer", email: "meera@example.com", bio: "10 years mixing podcasts and live shows." },
    ],
    episodes: [
      { id: "e1", title: "From Campus to Startup", idea: "How students can launch real products.", guestId: "g1", recordDate: "2026-11-02", publishDate: "2026-11-15", script: "Approved", record: "Scheduled", edit: "Not started", art: "In design", publish: "Draft", scriptText: "Intro, 3 questions, outro." },
      { id: "e2", title: "Sound That Sells", idea: "Audio quality tips for beginners.", guestId: "g2", recordDate: "2026-10-20", publishDate: "2026-11-05", script: "Approved", record: "Recorded", edit: "Mixing", art: "Done", publish: "Scheduled", scriptText: "" },
    ],
  };
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.episodes && saved.guests) return saved;
  } catch (e) { /* ignore corrupted data */ }
  return demoData();
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

// ---------- 3. Helpers ----------
const $ = (sel) => document.querySelector(sel);
const uid = () => Math.random().toString(36).slice(2, 9);
// Escape user text before putting it in HTML (prevents HTML injection)
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const guestName = (id) => (state.guests.find((g) => g.id === id) || {}).name || "No guest";
const fmtDate = (d) => (d ? new Date(d + "T00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

function progress(ep) {
  const doneCount = STEPS.filter((s) => ep[s.key] === s.done).length;
  return Math.round((doneCount / STEPS.length) * 100);
}
// Current stage = first step that is not finished yet
function currentStage(ep) {
  const next = STEPS.find((s) => ep[s.key] !== s.done);
  return next ? next.label : "Complete";
}

// ---------- 4. Rendering ----------
function renderDashboard() {
  const eps = state.episodes;
  const published = eps.filter((e) => e.publish === "Published").length;
  const stats = [
    ["Total episodes", eps.length],
    ["In production", eps.length - published],
    ["Published", published],
    ["Guests", state.guests.length],
  ];
  $("#stats").innerHTML = stats.map(([l, n]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join("");

  // Pipeline: how many episodes completed each step
  $("#pipeline").innerHTML = STEPS.map((s) => {
    const n = eps.filter((e) => e[s.key] === s.done).length;
    const pct = eps.length ? (n / eps.length) * 100 : 0;
    return `<div class="pipe-row"><span>${s.label}</span><div class="progress"><div style="width:${pct}%"></div></div><b>${n}/${eps.length}</b></div>`;
  }).join("");

  const upcoming = eps.filter((e) => e.record !== "Recorded" && e.recordDate)
    .sort((a, b) => a.recordDate.localeCompare(b.recordDate)).slice(0, 5);
  $("#upcoming").innerHTML = upcoming.length
    ? upcoming.map((e) => `<li><span><b>${esc(e.title)}</b><br><small>with ${esc(guestName(e.guestId))}</small></span><span>${fmtDate(e.recordDate)}</span></li>`).join("")
    : "<li>No upcoming recordings.</li>";
}

function renderEpisodes() {
  const q = $("#search").value.trim().toLowerCase();
  const stage = $("#stageFilter").value;
  const list = state.episodes.filter((e) =>
    (!q || (e.title + " " + e.idea + " " + guestName(e.guestId)).toLowerCase().includes(q)) &&
    (stage === "all" || currentStage(e) === stage));

  $("#episodeList").innerHTML = list.length ? list.map((e) => {
    const pct = progress(e);
    const badges = STEPS.map((s) => {
      const cls = e[s.key] === s.done ? "done" : e[s.key] === s.options[0] ? "" : "mid";
      return `<span class="badge ${cls}">${s.label}: ${esc(e[s.key])}</span>`;
    }).join("");
    return `<article class="card">
      <h3>${esc(e.title)}</h3>
      <p>${esc(e.idea) || "No description"}</p>
      <p>👤 ${esc(guestName(e.guestId))} · 🎙️ ${fmtDate(e.recordDate)} · 🚀 ${fmtDate(e.publishDate)}</p>
      <div class="badges">${badges}</div>
      <div class="progress"><div style="width:${pct}%"></div></div>
      <p>Next up: <b>${currentStage(e)}</b> · ${pct}% complete</p>
      <div class="card-actions">
        <button class="btn ghost" data-act="edit-ep" data-id="${e.id}">Edit</button>
        <button class="btn danger" data-act="del-ep" data-id="${e.id}">Delete</button>
      </div></article>`;
  }).join("") : '<div class="empty">No episodes found. Click "+ New episode" to start.</div>';
}

function renderGuests() {
  $("#guestList").innerHTML = state.guests.length ? state.guests.map((g) => {
    const count = state.episodes.filter((e) => e.guestId === g.id).length;
    return `<article class="card">
      <h3>${esc(g.name)}</h3>
      <div class="badges"><span class="badge">${esc(g.role) || "Guest"}</span><span class="badge">${count} episode(s)</span></div>
      <p>${esc(g.bio) || "No bio yet."}</p>
      <p>✉️ ${esc(g.email) || "—"}</p>
      <div class="card-actions">
        <button class="btn ghost" data-act="edit-g" data-id="${g.id}">Edit</button>
        <button class="btn danger" data-act="del-g" data-id="${g.id}">Delete</button>
      </div></article>`;
  }).join("") : '<div class="empty">No guests yet. Add your first guest.</div>';
}

function renderAll() { renderDashboard(); renderEpisodes(); renderGuests(); }

// ---------- 5. Episode form ----------
function buildStatusFields() {
  $("#statusFields").innerHTML = STEPS.map((s) =>
    `<label>${s.label} status<select id="e-${s.key}">${s.options.map((o) => `<option>${o}</option>`).join("")}</select></label>`).join("");
  $("#stageFilter").innerHTML = '<option value="all">All stages</option>' +
    [...STEPS.map((s) => s.label), "Complete"].map((l) => `<option>${l}</option>`).join("");
}

function openEpisode(id) {
  editingEpisodeId = id || null;
  const ep = state.episodes.find((e) => e.id === id) ||
    { title: "", idea: "", guestId: "", recordDate: "", publishDate: "", scriptText: "", ...Object.fromEntries(STEPS.map((s) => [s.key, s.options[0]])) };
  $("#episodeDialogTitle").textContent = id ? "Edit episode" : "New episode";
  $("#e-title").value = ep.title;
  $("#e-idea").value = ep.idea;
  $("#e-guest").innerHTML = '<option value="">No guest</option>' +
    state.guests.map((g) => `<option value="${g.id}" ${g.id === ep.guestId ? "selected" : ""}>${esc(g.name)}</option>`).join("");
  $("#e-recordDate").value = ep.recordDate;
  $("#e-publishDate").value = ep.publishDate;
  $("#e-scriptText").value = ep.scriptText;
  STEPS.forEach((s) => ($("#e-" + s.key).value = ep[s.key]));
  $("#episodeDialog").showModal();
}

$("#episodeForm").addEventListener("submit", () => {
  const data = {
    title: $("#e-title").value.trim(), idea: $("#e-idea").value.trim(), guestId: $("#e-guest").value,
    recordDate: $("#e-recordDate").value, publishDate: $("#e-publishDate").value, scriptText: $("#e-scriptText").value,
  };
  STEPS.forEach((s) => (data[s.key] = $("#e-" + s.key).value));
  if (editingEpisodeId) {
    Object.assign(state.episodes.find((e) => e.id === editingEpisodeId), data);
  } else {
    state.episodes.push({ id: uid(), ...data });
  }
  save(); renderAll();
});

// ---------- 6. Guest form ----------
function openGuest(id) {
  editingGuestId = id || null;
  const g = state.guests.find((x) => x.id === id) || { name: "", role: "", email: "", bio: "" };
  $("#guestDialogTitle").textContent = id ? "Edit guest" : "New guest";
  $("#g-name").value = g.name; $("#g-role").value = g.role; $("#g-email").value = g.email; $("#g-bio").value = g.bio;
  $("#guestDialog").showModal();
}

$("#guestForm").addEventListener("submit", () => {
  const data = { name: $("#g-name").value.trim(), role: $("#g-role").value.trim(), email: $("#g-email").value.trim(), bio: $("#g-bio").value.trim() };
  if (editingGuestId) Object.assign(state.guests.find((g) => g.id === editingGuestId), data);
  else state.guests.push({ id: uid(), ...data });
  save(); renderAll();
});

// ---------- 7. Events ----------
// Switch between views
document.querySelectorAll(".nav-btn").forEach((btn) =>
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn, .view").forEach((el) => el.classList.remove("active"));
    btn.classList.add("active");
    $("#view-" + btn.dataset.view).classList.add("active");
  }));

// One listener handles all Edit/Delete buttons (event delegation)
document.addEventListener("click", (ev) => {
  const t = ev.target.closest("[data-act], [data-close]");
  if (!t) return;
  if (t.dataset.close !== undefined) return t.closest("dialog").close();
  const { act, id } = t.dataset;
  if (act === "edit-ep") openEpisode(id);
  if (act === "edit-g") openGuest(id);
  if (act === "del-ep" && confirm("Delete this episode?")) {
    state.episodes = state.episodes.filter((e) => e.id !== id); save(); renderAll();
  }
  if (act === "del-g" && confirm("Delete this guest? Their episodes will be kept without a guest.")) {
    state.guests = state.guests.filter((g) => g.id !== id);
    state.episodes.forEach((e) => { if (e.guestId === id) e.guestId = ""; });
    save(); renderAll();
  }
});

$("#addEpisode").addEventListener("click", () => openEpisode());
$("#addGuest").addEventListener("click", () => openGuest());
$("#search").addEventListener("input", renderEpisodes);
$("#stageFilter").addEventListener("change", renderEpisodes);

$("#resetBtn").addEventListener("click", () => {
  if (confirm("Replace all data with demo data?")) { state = demoData(); save(); renderAll(); }
});
$("#exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "podflow-data.json"; a.click();
  URL.revokeObjectURL(a.href);
});

// ---------- 8. Start ----------
buildStatusFields();
renderAll();
