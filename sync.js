/* ===== GitHub Gist Sync =====
 * Globals used (defined in index.html inline script):
 *   SK, G, _pt, _busy, _skip  – sync state
 *   $, S, save, norm, apply, bi, t, esc, ask, fmt  – app helpers
 */

function saveG() {
  try { localStorage.setItem(SK, JSON.stringify(G)) } catch (e) {}
}

function ago(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return bi("เมื่อสักครู่", "just now");
  if (s < 3600) return Math.floor(s / 60) + bi(" นาที", " min ago");
  if (s < 86400) return Math.floor(s / 3600) + bi(" ชม.", " hr ago");
  return Math.floor(s / 86400) + bi(" วัน", " d ago");
}

function syncUI() {
  const on = !!(G.pat && G.gid);
  if (on) {
    const a = G.ls ? ago(G.ls) : "";
    $("sst").innerHTML =
      `<span class="sd${_busy ? " busy" : " on"}"></span> ` +
      (_busy ? bi("กำลัง sync...", "Syncing...") : bi("เชื่อมต่อแล้ว", "Connected")) +
      (a ? " · " + a : "");
    $("sbtn").textContent = "⚙️";
  } else {
    $("sst").innerHTML = `<span class="sd"></span> ` + bi("ยังไม่ sync", "Not synced");
    $("sbtn").textContent = bi("เชื่อมต่อ", "Connect");
  }
}

/* ---- push (debounced, auto-triggered by save()) ---- */

async function push() {
  if (!G.pat || !G.gid || _busy) return;
  _busy = true; syncUI();
  try {
    const r = await fetch("https://api.github.com/gists/" + G.gid, {
      method: "PATCH",
      headers: {
        "Authorization": "Bearer " + G.pat,
        "Accept": "application/vnd.github.v3+json"
      },
      body: JSON.stringify({
        files: { "monney-data.json": { content: JSON.stringify(S, null, 1) } }
      })
    });
    if (r.ok) { G.ls = Date.now(); saveG() }
    else if (r.status === 401 || r.status === 404) { G = {}; saveG() }
  } catch (e) { console.warn("sync push:", e) }
  _busy = false; syncUI();
}

function dpush() {
  if (_skip || !G.pat || !G.gid) return;
  clearTimeout(_pt);
  _pt = setTimeout(push, 1500);
}

/* ---- pull (called on page load) ---- */

async function pull() {
  if (!G.pat || !G.gid) return;
  _busy = true; syncUI();
  try {
    const r = await fetch("https://api.github.com/gists/" + G.gid, {
      headers: {
        "Authorization": "Bearer " + G.pat,
        "Accept": "application/vnd.github.v3+json"
      }
    });
    if (!r.ok) {
      if (r.status === 401 || r.status === 404) { G = {}; saveG() }
      _busy = false; syncUI(); return;
    }
    const g = await r.json(), f = g.files["monney-data.json"];
    if (!f) { _busy = false; syncUI(); return }
    const d = JSON.parse(f.content), rt = d._ts || 0, lt = S._ts || 0;
    if (rt > lt) {
      S = d; norm();
      _skip = true; save(); _skip = false;
      apply();
    }
    G.ls = Date.now(); saveG();
  } catch (e) { console.warn("sync pull:", e) }
  _busy = false; syncUI();
}

/* ---- setup dialog ---- */

function resetBtn() {
  $("sdy").disabled = false;
  $("sdy").textContent = bi("เชื่อมต่อ", "Connect");
}

function openSync() {
  const d = $("syncDlg"), on = !!(G.pat && G.gid);

  let h = `<h2>🔄 ${bi("ตั้งค่า Sync", "Sync Setup")}</h2>`;
  h += `<label>Personal Access Token`;
  h += `<input id="sp" type="password" value="${G.pat ? "••••••••" : ""}" placeholder="ghp_..."></label>`;
  h += `<p class="note"><a href="https://github.com/settings/tokens/new?scopes=gist&description=Monney+Sync" `;
  h += `target="_blank" rel="noopener">→ ${bi("สร้าง Token ที่นี่", "Create a token here")} (gist scope)</a></p>`;
  h += `<label>Gist ID <small>(${bi("เว้นว่างเพื่อสร้างใหม่", "leave empty to create new")})</small>`;
  h += `<input id="sg" value="${esc(G.gid || "")}" placeholder="abc123..."></label>`;
  if (G.gid) h += `<p class="note" style="word-break:break-all;font-size:12px">ID: ${esc(G.gid)}</p>`;
  h += `<div class="act"><button id="sdn">${t("cancel")}</button>`;
  h += `<button class="pri" id="sdy">${bi("เชื่อมต่อ", "Connect")}</button></div>`;
  if (on) h += `<div style="margin-top:10px;text-align:center"><button class="lnk" id="sdd" data-d>${bi("ยกเลิกการเชื่อมต่อ", "Disconnect")}</button></div>`;

  d.innerHTML = h;
  $("sdn").onclick = () => d.close();
  if (on) $("sdd").onclick = () => { G = {}; saveG(); d.close(); syncUI() };

  $("sdy").onclick = async () => {
    /* --- resolve PAT --- */
    let pat = $("sp").value.trim();
    if (pat === "••••••••") pat = G.pat;
    if (!pat) { ask(bi("กรอก Token", "Enter your token"), false); return }

    $("sdy").disabled = true;
    $("sdy").textContent = bi("กำลังเชื่อมต่อ...", "Connecting...");

    /* --- verify token --- */
    try {
      const v = await fetch("https://api.github.com/user", {
        headers: { "Authorization": "Bearer " + pat }
      });
      if (!v.ok) {
        ask(bi("Token ไม่ถูกต้อง หรือหมดอายุ", "Invalid or expired token"), false);
        resetBtn(); return;
      }
    } catch (e) {
      ask(bi("เชื่อมต่อไม่ได้", "Connection failed"), false);
      resetBtn(); return;
    }

    /* --- resolve or create Gist --- */
    let gid = $("sg").value.trim();
    if (!gid) {
      try {
        S._ts = Date.now();
        const r = await fetch("https://api.github.com/gists", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + pat,
            "Accept": "application/vnd.github.v3+json"
          },
          body: JSON.stringify({
            description: "Monney - Finance Tracker Data",
            public: false,
            files: { "monney-data.json": { content: JSON.stringify(S, null, 1) } }
          })
        });
        if (!r.ok) {
          ask(bi("สร้าง Gist ไม่สำเร็จ", "Failed to create Gist"), false);
          resetBtn(); return;
        }
        const j = await r.json();
        gid = j.id;
      } catch (e) {
        ask(bi("เชื่อมต่อไม่ได้", "Connection failed"), false);
        resetBtn(); return;
      }
    }

    /* --- save config & sync --- */
    G = { pat, gid, ls: Date.now() };
    saveG();
    $("sdy").disabled = false;
    d.close();
    syncUI();
    pull();
  };

  d.showModal();
}
