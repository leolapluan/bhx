// server.js
// Shared roommate shopping app using one JSON file as storage.
// Run: node server.js
// Open: http://localhost:3000

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data.json");

const defaultData = {
  people: [
    { id: "p_leo", name: "Leo" },
    { id: "p_roommate", name: "Roommate" }
  ],
  items: [
    {
      id: "i_sample",
      title: "Milk",
      note: "Buy 1 bottle",
      requestedBy: "p_roommate",
      status: "pending",
      boughtBy: null,
      points: 1,
      createdAt: new Date().toISOString(),
      completedAt: null
    }
  ]
};

function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
  }
}

function readData() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const data = JSON.parse(raw);
    return {
      people: Array.isArray(data.people) ? data.people : [],
      items: Array.isArray(data.items) ? data.items : []
    };
  } catch {
    return { people: [], items: [] };
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function sendHtml(res) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function cleanText(value, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Goods Helper</title>
  <style>
    :root {
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #172033;
      background: #f5f7fb;
    }

    * { box-sizing: border-box; }
    body { margin: 0; }
    button, input, textarea, select { font: inherit; }

    button {
      border: 0;
      cursor: pointer;
      background: #172033;
      color: white;
      border-radius: 14px;
      padding: 12px 16px;
      font-weight: 700;
    }

    button:hover { opacity: 0.92; }
    button.secondary { background: #eef1f7; color: #172033; }
    button.danger { background: #ffe8e8; color: #b42318; }

    .app {
      width: min(1120px, calc(100% - 32px));
      margin: 32px auto;
    }

    .hero {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 18px;
      align-items: center;
      margin-bottom: 20px;
      padding: 28px;
      border-radius: 28px;
      color: white;
      background: linear-gradient(135deg, #172033, #42526e);
    }

    .eyebrow {
      margin: 0 0 8px;
      text-transform: uppercase;
      letter-spacing: .12em;
      font-size: 12px;
      opacity: .75;
    }

    h1, h2, p { margin-top: 0; }
    h1 { margin-bottom: 8px; font-size: clamp(32px, 6vw, 56px); line-height: 1; }
    h2 { font-size: 20px; margin-bottom: 16px; }
    .subtext { margin-bottom: 0; color: #dce3f3; }

    .hero-card {
      min-width: 150px;
      padding: 20px;
      background: rgba(255,255,255,.12);
      border: 1px solid rgba(255,255,255,.2);
      border-radius: 24px;
      text-align: center;
    }

    .hero-card span { display: block; font-size: 44px; font-weight: 900; }
    .hero-card small { color: #dce3f3; }

    .grid {
      display: grid;
      grid-template-columns: 1fr 1.3fr;
      gap: 20px;
      margin-bottom: 20px;
    }

    .panel {
      background: white;
      border: 1px solid #e5e9f2;
      border-radius: 24px;
      padding: 22px;
      box-shadow: 0 12px 30px rgba(23, 32, 51, .06);
      margin-bottom: 20px;
    }

    .form { display: flex; gap: 10px; }
    .form.stacked { flex-direction: column; }
    .row { display: grid; grid-template-columns: 1fr 120px; gap: 10px; }

    input, textarea, select {
      width: 100%;
      border: 1px solid #d8deea;
      border-radius: 14px;
      padding: 12px 14px;
      outline: none;
      background: white;
      color: #172033;
    }

    textarea { min-height: 88px; resize: vertical; }
    input:focus, textarea:focus, select:focus {
      border-color: #596780;
      box-shadow: 0 0 0 3px rgba(89, 103, 128, .12);
    }

    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
    .chip { background: #eef1f7; border-radius: 999px; padding: 8px 12px; font-weight: 700; }

    .section-title {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
    }

    .section-title p { margin: 0; color: #69758a; }
    .scoreboard { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }

    .score-card {
      border: 1px solid #e5e9f2;
      border-radius: 20px;
      padding: 16px;
      background: #fbfcff;
    }

    .score-card strong { display: block; font-size: 28px; margin-bottom: 4px; }
    .score-card span { color: #69758a; }
    .filters { display: flex; flex-wrap: wrap; gap: 8px; }
    .filter { background: #eef1f7; color: #172033; padding: 9px 12px; }
    .filter.active { background: #172033; color: white; }
    .items { display: grid; gap: 12px; }

    .item {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 14px;
      border: 1px solid #e5e9f2;
      border-radius: 20px;
      padding: 16px;
      background: #fbfcff;
    }

    .item.done { opacity: .76; }
    .item h3 { margin: 0 0 8px; }
    .item p { margin: 0 0 8px; color: #596780; }

    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      color: #69758a;
      font-size: 14px;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 5px 9px;
      background: #eef1f7;
      font-weight: 700;
    }

    .actions { display: flex; gap: 8px; align-items: flex-start; }
    .helper-select { min-width: 150px; }

    .empty {
      padding: 28px;
      text-align: center;
      color: #69758a;
      border: 1px dashed #cfd6e5;
      border-radius: 18px;
    }

    .small-note { color: #69758a; font-size: 14px; line-height: 1.5; margin-bottom: 14px; }

    .toast {
      position: fixed;
      left: 50%;
      bottom: 22px;
      transform: translateX(-50%);
      background: #172033;
      color: white;
      padding: 12px 16px;
      border-radius: 999px;
      box-shadow: 0 12px 24px rgba(23, 32, 51, .22);
      opacity: 0;
      pointer-events: none;
      transition: opacity .2s ease, bottom .2s ease;
    }

    .toast.show { opacity: 1; bottom: 32px; }

    @media (max-width: 760px) {
      .hero, .grid, .item { grid-template-columns: 1fr; }
      .section-title { align-items: flex-start; flex-direction: column; }
      .form, .actions { flex-direction: column; }
      .helper-select { min-width: 100%; }
    }
  </style>
</head>
<body>
  <main class="app">
    <section class="hero">
      <div>
        <p class="eyebrow">Roommate shopping helper</p>
        <h1>Goods Helper</h1>
        <p class="subtext">Request goods, let someone buy them, and give responsibility points to the helper.</p>
      </div>
      <div class="hero-card">
        <span id="pendingCount">0</span>
        <small>pending requests</small>
      </div>
    </section>

    <section class="grid">
      <div class="panel">
        <h2>Add roommate</h2>
        <form id="personForm" class="form">
          <input id="personName" placeholder="Name, e.g. Minh" autocomplete="off" />
          <button type="submit">Add</button>
        </form>
        <div id="peopleList" class="chips"></div>
      </div>

      <div class="panel">
        <h2>Add buying request</h2>
        <form id="itemForm" class="form stacked">
          <input id="itemTitle" placeholder="What to buy? e.g. eggs, noodles" autocomplete="off" />
          <textarea id="itemNote" placeholder="Note, quantity, brand, budget..."></textarea>
          <div class="row">
            <select id="requestedBy"></select>
            <input id="points" type="number" min="1" value="1" title="Responsible points" />
          </div>
          <button type="submit">Create request</button>
        </form>
      </div>
    </section>

    <section class="panel">
      <div class="section-title">
        <h2>Scoreboard</h2>
        <p>Only helping others gives points.</p>
      </div>
      <div id="scoreboard" class="scoreboard"></div>
    </section>

    <section class="panel">
      <div class="section-title">
        <h2>Buying list</h2>
        <div class="filters">
          <button class="filter active" data-filter="all">All</button>
          <button class="filter" data-filter="pending">Pending</button>
          <button class="filter" data-filter="done">Done</button>
        </div>
      </div>
      <div id="itemsList" class="items"></div>
    </section>
  </main>

  <div id="toast" class="toast"></div>

  <script>
    let state = { people: [], items: [] };
    let filter = "all";
    const $ = selector => document.querySelector(selector);

    async function api(url, options = {}) {
      const response = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...options
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Request failed");
      return data;
    }

    function escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function personName(id) {
      return state.people.find(person => person.id === id)?.name || "Unknown";
    }

    function showToast(message) {
      const toast = $("#toast");
      toast.textContent = message;
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 2200);
    }

    async function loadState() {
      try {
        state = await api("/api/state");
        render();
      } catch (error) {
        showToast(error.message);
      }
    }

    function renderPeople() {
      const peopleList = $("#peopleList");
      peopleList.innerHTML = state.people.length
        ? state.people.map(person => `<span class="chip">${escapeHtml(person.name)}</span>`).join("")
        : `<div class="empty">No roommates yet.</div>`;

      const requestedBy = $("#requestedBy");
      requestedBy.innerHTML = state.people.map(person => (
        `<option value="${person.id}">${escapeHtml(person.name)} requests</option>`
      )).join("");
    }

    function renderScoreboard() {
      const scores = state.people.map(person => {
        const doneItems = state.items.filter(item => item.status === "done" && item.boughtBy === person.id);
        const points = doneItems.reduce((sum, item) => sum + Number(item.points || 1), 0);
        return { ...person, points, helpedCount: doneItems.length };
      }).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

      $("#scoreboard").innerHTML = scores.length
        ? scores.map(person => `
          <article class="score-card">
            <strong>${person.points}</strong>
            <span>${escapeHtml(person.name)} · helped ${person.helpedCount} time${person.helpedCount === 1 ? "" : "s"}</span>
          </article>
        `).join("")
        : `<div class="empty">Add roommates to start the game.</div>`;
    }

    function renderItems() {
      const pendingCount = state.items.filter(item => item.status === "pending").length;
      $("#pendingCount").textContent = pendingCount;

      document.querySelectorAll(".filter").forEach(button => {
        button.classList.toggle("active", button.dataset.filter === filter);
      });

      const filteredItems = state.items.filter(item => filter === "all" || item.status === filter);
      const itemsList = $("#itemsList");

      if (!filteredItems.length) {
        itemsList.innerHTML = `<div class="empty">No ${filter === "all" ? "" : filter} requests found.</div>`;
        return;
      }

      itemsList.innerHTML = filteredItems.map(item => {
        const helperOptions = state.people
          .filter(person => person.id !== item.requestedBy)
          .map(person => `<option value="${person.id}">${escapeHtml(person.name)} bought it</option>`)
          .join("");

        const actionHtml = item.status === "pending"
          ? `
            <select class="helper-select" data-helper-for="${item.id}">
              ${helperOptions || `<option value="">No helper available</option>`}
            </select>
            <button onclick="completeItem('${item.id}')">Done</button>
          `
          : `<button class="secondary" onclick="reopenItem('${item.id}')">Reopen</button>`;

        return `
          <article class="item ${item.status}">
            <div>
              <h3>${escapeHtml(item.title)}</h3>
              ${item.note ? `<p>${escapeHtml(item.note)}</p>` : ""}
              <div class="meta">
                <span class="badge">${item.status === "done" ? "Done" : "Pending"}</span>
                <span>Requested by ${escapeHtml(personName(item.requestedBy))}</span>
                <span>${Number(item.points || 1)} point${Number(item.points || 1) === 1 ? "" : "s"}</span>
                ${item.boughtBy ? `<span>Bought by ${escapeHtml(personName(item.boughtBy))}</span>` : ""}
              </div>
            </div>
            <div class="actions">
              ${actionHtml}
              <button class="danger" onclick="deleteItem('${item.id}')">Delete</button>
            </div>
          </article>
        `;
      }).join("");
    }

    function render() {
      renderPeople();
      renderScoreboard();
      renderItems();
    }

    async function completeItem(itemId) {
      const select = document.querySelector(`[data-helper-for="${itemId}"]`);
      const boughtBy = select?.value;
      if (!boughtBy) return showToast("Choose who bought it first.");

      try {
        state = await api(`/api/items/${itemId}/complete`, {
          method: "POST",
          body: JSON.stringify({ boughtBy })
        });
        render();
        showToast("Point added.");
      } catch (error) {
        showToast(error.message);
      }
    }

    async function reopenItem(itemId) {
      try {
        state = await api(`/api/items/${itemId}/reopen`, { method: "POST" });
        render();
        showToast("Request reopened.");
      } catch (error) {
        showToast(error.message);
      }
    }

    async function deleteItem(itemId) {
      try {
        state = await api(`/api/items/${itemId}`, { method: "DELETE" });
        render();
        showToast("Request deleted.");
      } catch (error) {
        showToast(error.message);
      }
    }

    $("#personForm").addEventListener("submit", async event => {
      event.preventDefault();
      const input = $("#personName");
      const name = input.value.trim();
      if (!name) return showToast("Enter a name first.");

      try {
        state = await api("/api/people", {
          method: "POST",
          body: JSON.stringify({ name })
        });
        input.value = "";
        render();
      } catch (error) {
        showToast(error.message);
      }
    });

    $("#itemForm").addEventListener("submit", async event => {
      event.preventDefault();
      const title = $("#itemTitle").value.trim();
      const note = $("#itemNote").value.trim();
      const requestedBy = $("#requestedBy").value;
      const points = Math.max(1, Number($("#points").value || 1));

      if (!title) return showToast("Enter what to buy first.");
      if (!requestedBy) return showToast("Add at least one roommate first.");

      try {
        state = await api("/api/items", {
          method: "POST",
          body: JSON.stringify({ title, note, requestedBy, points })
        });
        $("#itemTitle").value = "";
        $("#itemNote").value = "";
        $("#points").value = 1;
        render();
        showToast("Request created.");
      } catch (error) {
        showToast(error.message);
      }
    });

    document.querySelectorAll(".filter").forEach(button => {
      button.addEventListener("click", () => {
        filter = button.dataset.filter;
        render();
      });
    });

    loadState();
    setInterval(loadState, 5000);
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const method = req.method;

    if (method === "GET" && url.pathname === "/") {
      return sendHtml(res);
    }

    if (method === "GET" && url.pathname === "/api/state") {
      return sendJson(res, 200, readData());
    }

    if (method === "POST" && url.pathname === "/api/people") {
      const body = await readBody(req);
      const name = cleanText(body.name, 60);
      if (!name) return sendJson(res, 400, { error: "Name is required" });

      const data = readData();
      const exists = data.people.some(person => person.name.toLowerCase() === name.toLowerCase());
      if (exists) return sendJson(res, 400, { error: "This person already exists" });

      data.people.push({ id: makeId("p"), name });
      writeData(data);
      return sendJson(res, 200, data);
    }

    if (method === "POST" && url.pathname === "/api/items") {
      const body = await readBody(req);
      const title = cleanText(body.title, 120);
      const note = cleanText(body.note, 500);
      const requestedBy = cleanText(body.requestedBy, 80);
      const points = Math.max(1, Number(body.points || 1));

      if (!title) return sendJson(res, 400, { error: "Title is required" });

      const data = readData();
      const requesterExists = data.people.some(person => person.id === requestedBy);
      if (!requesterExists) return sendJson(res, 400, { error: "Requester does not exist" });

      data.items.unshift({
        id: makeId("i"),
        title,
        note,
        requestedBy,
        status: "pending",
        boughtBy: null,
        points,
        createdAt: new Date().toISOString(),
        completedAt: null
      });

      writeData(data);
      return sendJson(res, 200, data);
    }

    const completeMatch = url.pathname.match(/^\/api\/items\/([^/]+)\/complete$/);
    if (method === "POST" && completeMatch) {
      const itemId = completeMatch[1];
      const body = await readBody(req);
      const boughtBy = cleanText(body.boughtBy, 80);
      const data = readData();

      const item = data.items.find(item => item.id === itemId);
      if (!item) return sendJson(res, 404, { error: "Item not found" });
      if (item.status === "done") return sendJson(res, 400, { error: "Item is already done" });

      const helperExists = data.people.some(person => person.id === boughtBy);
      if (!helperExists) return sendJson(res, 400, { error: "Helper does not exist" });
      if (item.requestedBy === boughtBy) return sendJson(res, 400, { error: "Buying your own request gives no points" });

      item.status = "done";
      item.boughtBy = boughtBy;
      item.completedAt = new Date().toISOString();

      writeData(data);
      return sendJson(res, 200, data);
    }

    const reopenMatch = url.pathname.match(/^\/api\/items\/([^/]+)\/reopen$/);
    if (method === "POST" && reopenMatch) {
      const itemId = reopenMatch[1];
      const data = readData();
      const item = data.items.find(item => item.id === itemId);
      if (!item) return sendJson(res, 404, { error: "Item not found" });

      item.status = "pending";
      item.boughtBy = null;
      item.completedAt = null;

      writeData(data);
      return sendJson(res, 200, data);
    }

    const deleteMatch = url.pathname.match(/^\/api\/items\/([^/]+)$/);
    if (method === "DELETE" && deleteMatch) {
      const itemId = deleteMatch[1];
      const data = readData();
      data.items = data.items.filter(item => item.id !== itemId);
      writeData(data);
      return sendJson(res, 200, data);
    }

    return sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Server error" });
  }
});

server.listen(PORT, () => {
  ensureDataFile();
  console.log(`Goods Helper is running at http://localhost:${PORT}`);
  console.log(`Shared data file: ${DATA_FILE}`);
});
