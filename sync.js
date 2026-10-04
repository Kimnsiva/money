/* ===== GitHub Gist Sync =====
 * Globals used (defined in index.html inline script):
 *   SK, G, _pt, _busy, _skip  – sync state
 *   $, S, save, norm, apply, bi, t, esc, ask, fmt  – app helpers
 */

const GIST_FILE = "monney-data.json";
let _again = false, _lastPull = 0;

function saveG() {
  try { localStorage.setItem(SK, JSON.stringify(G)) } catch (e) {}
}

function hdr(pat) {
  return { "Authorization": "Bearer " + (pat || G.pat), "Accept": "application/vnd.github+json" };
}

/* GitHub API responses are cacheable for ~60s; always bypass the HTTP cache */
function gh(path, opt = {}, pat) {
  return fetch("https://api.github.com" + path, Object.assign({ cache: "no-store", headers: hdr(pat) }, opt));
}

function errMsg(status) {
  if (status === 401) return bi("Token ไม่ถูกต้องหรือหมดอายุ", "Token invalid or expired");
  if (status === 403) return bi("Token ไม่มีสิทธิ์ Gist", "Token lacks Gist permission");
  if (status === 404) return bi("ไม่พบ Gist หรือ Token ไม่มีสิทธิ์ Gist", "Gist not found or token lacks Gist permission");
  if (status === 0) return bi("ออฟไลน์ / เชื่อมต่อไม่ได้", "Offline / connection failed");
  return "HTTP " + status;
}

function setErr(status) {
  G.err = status == null ? null : errMsg(status);
  saveG();
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
    let cls = _busy ? " busy" : G.err ? " err" : " on";
    let txt = _busy ? bi("กำลัง sync...", "Syncing...")
      : G.err ? bi("Sync ผิดพลาด: ", "Sync error: ") + esc(G.err)
      : bi("เชื่อมต่อแล้ว", "Connected") + (a ? " · " + a : "");
    $("sst").innerHTML = `<span class="sd${cls}"></span> ` + txt;
    $("sbtn").textContent = "⚙️";
  } else {
    $("sst").innerHTML = `<span class="sd"></span> ` + bi("ยังไม่ sync", "Not synced");
    $("sbtn").textContent = bi("เชื่อมต่อ", "Connect");
  }
}

/* ---- push (debounced, auto-triggered by save()) ---- */

async function push() {
  if (!G.pat || !G.gid) return;
  /* a save happened during another request: retry once it finishes instead of dropping it */
  if (_busy) { _again = true; return }
  _busy = true; syncUI();
  try {
    const r = await gh("/gists/" + G.gid, {
      method: "PATCH",
      body: JSON.stringify({ files: { [GIST_FILE]: { content: JSON.stringify(S, null, 1) } } })
    });
    if (r.ok) { G.ls = Date.now(); setErr(null) } else setErr(r.status);
  } catch (e) { console.warn("sync push:", e); setErr(0) }
  _busy = false; syncUI();
  if (_again) { _again = false; dpush() }
}

function dpush() {
  if (_skip || !G.pat || !G.gid) return;
  clearTimeout(_pt);
  _pt = setTimeout(push, 1500);
}

/* ---- pull (on load, when the tab becomes visible, and after connecting) ---- */

async function readRemote(gid, pat) {
  const r = await gh("/gists/" + gid, {}, pat);
  if (!r.ok) return { status: r.status };
  const g = await r.json(), f = g.files && g.files[GIST_FILE];
  if (!f) return { status: 200, data: null };
  let txt = f.content;
  if (f.truncated && f.raw_url) txt = await (await fetch(f.raw_url, { cache: "no-store" })).text();
  return { status: 200, data: JSON.parse(txt) };
}

async function pull() {
  if (!G.pat || !G.gid || _busy) return;
  _busy = true; _lastPull = Date.now(); syncUI();
  let needPush = false;
  try {
    const res = await readRemote(G.gid);
    if (res.status !== 200) setErr(res.status);
    else {
      const d = res.data, rt = (d && d._ts) || 0, lt = S._ts || 0;
      if (d && Array.isArray(d.items) && rt > lt) {
        S = d; norm();
        _skip = true; save(); _skip = false;
        apply();
      } else if (lt > rt) needPush = true; /* local is newer (e.g. edited offline) */
      G.ls = Date.now(); setErr(null);
    }
  } catch (e) { console.warn("sync pull:", e); setErr(0) }
  _busy = false; syncUI();
  if (needPush || _again) { _again = false; dpush() }
}

/* refresh from the cloud when coming back to the tab (throttled to once per 20s) */
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && Date.now() - _lastPull > 20000) pull();
});
addEventListener("online", () => pull());

/* ---- find an existing Monney gist so a second device joins the same one ---- */

async function findGist(pat) {
  const hits = [];
  for (let page = 1; page <= 5; page++) {
    const r = await gh("/gists?per_page=100&page=" + page, {}, pat);
    if (!r.ok) return { status: r.status };
    const list = await r.json();
    list.forEach(g => { if (g.files && g.files[GIST_FILE]) hits.push(g.id) });
    if (list.length < 100) break;
  }
  if (hits.length <= 1) return { status: 200, id: hits[0] || null };
  /* several gists (older versions created one per device): prefer the one with real data, then the newest */
  let best = null, bestScore = -1, bestTs = -1;
  for (const id of hits.slice(0, 10)) {
    try {
      const { status, data } = await readRemote(id, pat);
      if (status !== 200 || !data) continue;
      const score = (data.items || []).length + (data.funds || []).length + Object.keys(data.tax || {}).length;
      const has = score > 0 ? 1 : 0, ts = data._ts || 0;
      if (has > bestScore || (has === bestScore && ts > bestTs)) { best = id; bestScore = has; bestTs = ts }
    } catch (e) {}
  }
  return { status: 200, id: best || hits[0] };
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
  h += `<label>Gist ID <small>(${bi("เว้นว่าง = ค้นหา Gist เดิมอัตโนมัติ ถ้าไม่มีจะสร้างใหม่", "leave empty to auto-find your existing gist, or create one")})</small>`;
  h += `<input id="sg" value="${esc(G.gid || "")}" placeholder="abc123..."></label>`;
  if (G.gid) h += `<p class="note" style="word-break:break-all;font-size:12px">ID: ${esc(G.gid)}</p>`;
  if (G.err) h += `<p class="note" style="color:var(--out)">${esc(G.err)}</p>`;
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

    try {
      /* --- verify token --- */
      const v = await gh("/user", {}, pat);
      if (!v.ok) { ask(errMsg(v.status), false); resetBtn(); return }

      /* --- resolve gist: typed ID > existing Monney gist > create new --- */
      let gid = $("sg").value.trim();
      if (!gid) {
        const f = await findGist(pat);
        if (f.status !== 200) { ask(errMsg(f.status), false); resetBtn(); return }
        gid = f.id;
      }

      let remote = null;
      if (gid) {
        const res = await readRemote(gid, pat);
        if (res.status !== 200) { ask(errMsg(res.status), false); resetBtn(); return }
        remote = res.data;
      } else {
        S._ts = Date.now();
        const r = await gh("/gists", {
          method: "POST",
          body: JSON.stringify({
            description: "Monney - Finance Tracker Data",
            public: false,
            files: { [GIST_FILE]: { content: JSON.stringify(S, null, 1) } }
          })
        }, pat);
        if (!r.ok) { ask(bi("สร้าง Gist ไม่สำเร็จ: ", "Failed to create Gist: ") + errMsg(r.status), false); resetBtn(); return }
        gid = (await r.json()).id;
        try { localStorage.setItem(KEY, JSON.stringify(S)) } catch (e) {}
      }

      G = { pat, gid, ls: Date.now() };
      saveG();
      d.close();

      /* --- joining an existing gist: let the user choose which data wins --- */
      if (remote && Array.isArray(remote.items)) {
        const localHas = S.items.length || (S.funds && S.funds.length) || Object.keys(S.tax || {}).length;
        const useCloud = !localHas || await ask(bi(
          "พบข้อมูลบน Cloud แล้ว\nตกลง = ใช้ข้อมูลจาก Cloud (แทนที่ข้อมูลในเครื่องนี้)\nยกเลิก = อัปโหลดข้อมูลในเครื่องนี้ขึ้น Cloud",
          "Found existing cloud data.\nOK = use cloud data (replace this device)\nCancel = upload this device's data to the cloud"));
        if (useCloud) {
          S = remote; norm();
          _skip = true; save(); _skip = false;
          apply();
        } else {
          save(); /* stamps a fresh _ts and pushes */
        }
      } else if (remote === null && gid) {
        save(); /* gist exists but has no data file yet */
      }
      syncUI();
    } catch (e) {
      console.warn("sync connect:", e);
      ask(errMsg(0), false);
      resetBtn();
    }
  };

  d.showModal();
}
