(function () {
  const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

  if (isBrowser) {
    startClient();
  } else {
    startServer();
  }

  function startClient() {
    let state = {
      people: [],
      items: []
    };

    let filter = "all";

    const $ = selector => document.querySelector(selector);

    async function api(url, options = {}) {
      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json"
        },
        ...options
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }

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

      setTimeout(() => {
        toast.classList.remove("show");
      }, 2200);
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
        ? state.people
            .map(person => `<span class="chip">${escapeHtml(person.name)}</span>`)
            .join("")
        : `<div class="empty">No roommates yet.</div>`;

      const requestedBy = $("#requestedBy");

      requestedBy.innerHTML = state.people
        .map(person => {
          return `<option value="${person.id}">${escapeHtml(person.name)} requests</option>`;
        })
        .join("");
    }

    function renderScoreboard() {
      const scores = state.people
        .map(person => {
          const doneItems = state.items.filter(item => {
            return item.status === "done" && item.boughtBy === person.id;
          });

          const points = doneItems.reduce((sum, item) => {
            return sum + Number(item.points || 1);
          }, 0);

          return {
            ...person,
            points,
            helpedCount: doneItems.length
          };
        })
        .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

      $("#scoreboard").innerHTML = scores.length
        ? scores
            .map(person => {
              return `
                <article class="score-card">
                  <strong>${person.points}</strong>
                  <span>
                    ${escapeHtml(person.name)} · helped ${person.helpedCount}
                    time${person.helpedCount === 1 ? "" : "s"}
                  </span>
                </article>
              `;
            })
            .join("")
        : `<div class="empty">Add roommates to start the game.</div>`;
    }

    function renderItems() {
      const pendingCount = state.items.filter(item => item.status === "pending").length;
      $("#pendingCount").textContent = pendingCount;

      document.querySelectorAll(".filter").forEach(button => {
        button.classList.toggle("active", button.dataset.filter === filter);
      });

      const filteredItems = state.items.filter(item => {
        return filter === "all" || item.status === filter;
      });

      const itemsList = $("#itemsList");

      if (!filteredItems.length) {
        itemsList.innerHTML = `<div class="empty">No ${filter === "all" ? "" : filter} requests found.</div>`;
        return;
      }

      itemsList.innerHTML = filteredItems
        .map(item => {
          const helperOptions = state.people
            .filter(person => person.id !== item.requestedBy)
            .map(person => {
              return `<option value="${person.id}">${escapeHtml(person.name)} bought it</option>`;
            })
            .join("");

          const actionHtml =
            item.status === "pending"
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
        })
        .join("");
    }

    function render() {
      renderPeople();
      renderScoreboard();
      renderItems();
    }

    async function completeItem(itemId) {
      const select = document.querySelector(`[data-helper-for="${itemId}"]`);
      const boughtBy = select?.value;

      if (!boughtBy) {
        showToast("Choose who bought it first.");
        return;
      }

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
        state = await api(`/api/items/${itemId}/reopen`, {
          method: "POST"
        });

        render();
        showToast("Request reopened.");
      } catch (error) {
        showToast(error.message);
      }
    }

    async function deleteItem(itemId) {
      try {
        state = await api(`/api/items/${itemId}`, {
          method: "DELETE"
        });

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

      if (!name) {
        showToast("Enter a name first.");
        return;
      }

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

      if (!title) {
        showToast("Enter what to buy first.");
        return;
      }

      if (!requestedBy) {
        showToast("Add at least one roommate first.");
        return;
      }

      try {
        state = await api("/api/items", {
          method: "POST",
          body: JSON.stringify({
            title,
            note,
            requestedBy,
            points
          })
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

    window.completeItem = completeItem;
    window.reopenItem = reopenItem;
    window.deleteItem = deleteItem;

    loadState();
    setInterval(loadState, 5000);
  }

  function startServer() {
    const http = require("http");
    const fs = require("fs");
    const path = require("path");
    const crypto = require("crypto");

    const PORT = process.env.PORT || 3000;
    const INDEX_FILE = path.join(__dirname, "index.html");
    const APP_FILE = path.join(__dirname, "app.js");
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
        return {
          people: [],
          items: []
        };
      }
    }

    function writeData(data) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    }

    function sendJson(res, status, data) {
      res.writeHead(status, {
        "Content-Type": "application/json"
      });

      res.end(JSON.stringify(data));
    }

    function sendFile(res, filePath, contentType) {
      fs.readFile(filePath, "utf8", (error, content) => {
        if (error) {
          res.writeHead(404, {
            "Content-Type": "text/plain; charset=utf-8"
          });

          res.end("File not found");
          return;
        }

        res.writeHead(200, {
          "Content-Type": contentType
        });

        res.end(content);
      });
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

    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const method = req.method;

        if (method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
          return sendFile(res, INDEX_FILE, "text/html; charset=utf-8");
        }

        if (method === "GET" && url.pathname === "/app.js") {
          return sendFile(res, APP_FILE, "application/javascript; charset=utf-8");
        }

        if (method === "GET" && url.pathname === "/api/state") {
          return sendJson(res, 200, readData());
        }

        if (method === "POST" && url.pathname === "/api/people") {
          const body = await readBody(req);
          const name = cleanText(body.name, 60);

          if (!name) {
            return sendJson(res, 400, {
              error: "Name is required"
            });
          }

          const data = readData();

          const exists = data.people.some(person => {
            return person.name.toLowerCase() === name.toLowerCase();
          });

          if (exists) {
            return sendJson(res, 400, {
              error: "This person already exists"
            });
          }

          data.people.push({
            id: makeId("p"),
            name
          });

          writeData(data);

          return sendJson(res, 200, data);
        }

        if (method === "POST" && url.pathname === "/api/items") {
          const body = await readBody(req);

          const title = cleanText(body.title, 120);
          const note = cleanText(body.note, 500);
          const requestedBy = cleanText(body.requestedBy, 80);
          const points = Math.max(1, Number(body.points || 1));

          if (!title) {
            return sendJson(res, 400, {
              error: "Title is required"
            });
          }

          const data = readData();

          const requesterExists = data.people.some(person => {
            return person.id === requestedBy;
          });

          if (!requesterExists) {
            return sendJson(res, 400, {
              error: "Requester does not exist"
            });
          }

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

          if (!item) {
            return sendJson(res, 404, {
              error: "Item not found"
            });
          }

          if (item.status === "done") {
            return sendJson(res, 400, {
              error: "Item is already done"
            });
          }

          const helperExists = data.people.some(person => {
            return person.id === boughtBy;
          });

          if (!helperExists) {
            return sendJson(res, 400, {
              error: "Helper does not exist"
            });
          }

          if (item.requestedBy === boughtBy) {
            return sendJson(res, 400, {
              error: "Buying your own request gives no points"
            });
          }

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

          if (!item) {
            return sendJson(res, 404, {
              error: "Item not found"
            });
          }

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

          data.items = data.items.filter(item => {
            return item.id !== itemId;
          });

          writeData(data);

          return sendJson(res, 200, data);
        }

        return sendJson(res, 404, {
          error: "Not found"
        });
      } catch (error) {
        return sendJson(res, 500, {
          error: error.message || "Server error"
        });
      }
    });

    server.listen(PORT, "0.0.0.0", () => {
      ensureDataFile();

      console.log(`Goods Helper is running at http://localhost:${PORT}`);
      console.log(`Shared data file: ${DATA_FILE}`);
    });
  }
})();
