// Are.na Board: a shared board for one Are.na channel.
//
// The blocks come from Are.na (and are checked again every 30 seconds).
// Where each tile sits comes from the store (store.js): shared by everyone who
// opens the board when Firebase is set up, otherwise saved in this browser.

const ARENA = "https://api.are.na/v2";
const CHECK_EVERY = 30000;                 // ms between checks for new blocks
const COLORS = ["#f5c542", "#6fcf97", "#56ccf2", "#bb6bd9", "#eb5757", "#f2994a"];
const $ = (s) => document.querySelector(s);
const board = $("#board"), world = $("#world"), marquee = $("#marquee");
let statusTimer;                            // used by status(), at the bottom

// ---------- which channel? ----------

function slugFrom(text) {
  text = (text || "").trim();
  if (!text) return null;
  try { return new URL(text).pathname.split("/").filter(Boolean).pop() || null; }
  catch { return text.replace(/^\/+|\/+$/g, "").split("/").pop(); }
}

const slug = slugFrom(new URLSearchParams(location.search).get("channel"));
if (!slug) {
  $("#start").hidden = false;
  $("#start-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const s = slugFrom($("#start-input").value);
    if (s) location.search = "?channel=" + encodeURIComponent(s);
  });
} else {
  startBoard(slug);
}

// ---------- the board ----------

function startBoard(slug) {
  $("#bar").hidden = false;
  board.hidden = false;
  const boardKey = slug.replace(/[.#$\[\]\/]/g, "_");
  const store = openStore(boardKey);
  if (!store.shared) $("#local-note").hidden = false;

  const blocks = {};                         // Are.na blocks by id (in channel order)
  let order = [];                            // block ids in channel order
  const model = { tiles: {}, frames: {} };   // what the store says
  const els = { tiles: {}, frames: {} };     // their elements on the page
  let selected = new Set();
  const dragging = new Set();                // tiles this person is dragging right now
  const undoStack = [];
  let lastSeen = null;                       // Are.na channel "updated_at", to notice changes

  // this person's own view (zoom and position), remembered in this browser
  const viewKey = `arena-board-view:${boardKey}`;
  let view = { x: 40, y: 80, k: 0.6 };
  try { view = JSON.parse(localStorage.getItem(viewKey)) || view; } catch {}

  // ---------- Are.na ----------

  async function loadChannel(first) {
    const res = await fetch(`${ARENA}/channels/${encodeURIComponent(slug)}?per=1`);
    if (!res.ok) {
      status(res.status === 404 ? `Can't find the channel "${slug}". Is it public?` : `Are.na error ${res.status}`, 8000);
      return;
    }
    const info = await res.json();
    if (first) {
      document.title = `${info.title} · Are.na Board`;
      $("#channel-link").textContent = info.title;
      $("#channel-link").href = `https://www.are.na/${info.user?.slug || ""}/${info.slug}`;
    }
    if (info.updated_at === lastSeen) return;           // nothing new since last time
    lastSeen = info.updated_at;

    const all = [];
    for (let page = 1; ; page++) {
      if (first) status(`Loading "${info.title}": ${all.length} / ${info.length} blocks`);
      const r = await fetch(`${ARENA}/channels/${encodeURIComponent(slug)}/contents?per=100&page=${page}`);
      const { contents = [] } = await r.json();
      all.push(...contents);
      if (contents.length < 100) break;
    }
    const usable = all.filter((b) => b.class !== "Channel");
    const before = new Set(order);
    order = usable.map((b) => String(b.id));
    usable.forEach((b) => (blocks[b.id] = b));
    placeNewBlocks(order.filter((id) => !model.tiles[id]));
    renderAllTiles();
    const added = order.filter((id) => !before.has(id)).length;
    if (first) { status(`${usable.length} blocks from "${info.title}"`, 2500); setTimeout(fitIfFirstVisit, 400); }
    else if (added) status(`${added} new block${added > 1 ? "s" : ""} from Are.na`, 3000);
  }

  // New blocks: on an empty board, lay everything out in a grid (the same grid for
  // everyone). Otherwise put the new ones in a column to the right of the board.
  // "claim" only writes where nothing exists yet, so nobody's layout is ever overwritten.
  function placeNewBlocks(ids) {
    if (!ids.length) return;
    const size = 200, gap = 40, empty = !Object.keys(model.tiles).length;
    const cols = Math.max(4, Math.ceil(Math.sqrt(ids.length * 1.6)));
    const b = bounds() || { maxX: 0, minY: 0 };
    ids.forEach((id, i) => store.claim("tiles", id, empty
      ? newTile((i % cols) * (size + gap), Math.floor(i / cols) * (size + gap))
      : newTile(b.maxX + 80, b.minY + i * (size + gap))));
  }
  const newTile = (x, y) => ({ x, y, s: 200, rz: 0, rx: 0, ry: 0, z: 0 });

  // ---------- keeping the page in step with the store ----------

  store.subscribe((kind, id, data) => {
    if (kind === "tiles" && dragging.has(id)) return;   // my own drag wins while I'm dragging
    if (data) model[kind][id] = data; else delete model[kind][id];
    if (kind === "tiles") renderTile(id); else renderFrame(id);
    updateRemovedCount();
  });
  store.onPeople((n) => ($("#people").textContent = n === 1 ? "just you" : `${n} people here`));

  // Write changes. Unless told otherwise, remember the old values so Undo can put them back.
  function current(path) {
    const [kind, id, field] = path.split("/");
    const obj = model[kind][id];
    if (!field) return obj ? structuredClone(obj) : null;
    return obj && field in obj ? obj[field] : null;
  }
  function write(paths, { undo = true, before = null } = {}) {
    if (undo) {
      undoStack.push(before || Object.fromEntries(Object.keys(paths).map((p) => [p, current(p)])));
      if (undoStack.length > 50) undoStack.shift();
    }
    return store.patch(paths);
  }
  function undo() {
    const step = undoStack.pop();
    if (!step) return status("Nothing to undo", 1500);
    store.patch(step);
  }
  // During a drag we write about 10 times a second, so others see the tile moving.
  let pending = {}, timer = null;
  function writeSoon(paths) {
    Object.assign(pending, paths);
    if (!timer) timer = setTimeout(() => { store.patch(pending); pending = {}; timer = null; }, 100);
  }
  function flush() { if (timer) { clearTimeout(timer); timer = null; store.patch(pending); pending = {}; } }

  // ---------- drawing ----------

  function applyView() {
    world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.k})`;
    world.style.setProperty("--inv", 1 / view.k);
    board.style.backgroundPosition = `${view.x}px ${view.y}px`;
    board.style.backgroundSize = `${24 * view.k}px ${24 * view.k}px`;
    try { localStorage.setItem(viewKey, JSON.stringify(view)); } catch {}
  }

  function renderAllTiles() { Object.keys(model.tiles).forEach(renderTile); }

  function renderTile(id) {
    const t = model.tiles[id], b = blocks[id];
    let el = els.tiles[id];
    if (!t || !b || t.hidden || !order.includes(id)) { el?.remove(); delete els.tiles[id]; return; }
    if (!el) { el = els.tiles[id] = buildTile(id, b); world.appendChild(el); }
    el.style.setProperty("--s", `${t.s}px`);
    el.style.transform = `translate(${t.x}px, ${t.y}px) rotate(${t.rz || 0}deg)`;
    el.style.zIndex = 10 + (t.z || 0);
    el.querySelector(".card").style.transform = `rotateX(${t.rx || 0}deg) rotateY(${t.ry || 0}deg)`;
    el.classList.toggle("selected", selected.has(id));
    const img = el.querySelector("img");
    if (img && t.s * view.k > 420 && !img.dataset.big && b.image) { img.src = (b.image.large || b.image.display).url; img.dataset.big = 1; }
  }

  function buildTile(id, b) {
    const el = document.createElement("div");
    el.className = "tile";
    el.dataset.id = id;
    const title = b.title || b.generated_title || "Untitled";
    const front = b.image
      ? `<div class="face front"><img alt="" loading="lazy" draggable="false" src="${(b.image.square || b.image.display).url}"></div>`
      : `<div class="face front text"><div class="t"></div><div class="c"></div></div>`;
    const desc = b.description_html?.trim()
      ? `<div class="desc">${clean(b.description_html)}</div>`
      : `<div class="desc none">No description on Are.na yet.</div>`;
    el.innerHTML = `
      <div class="card">${front}
        <div class="face back"><h3></h3>${desc}
          <div class="meta"><a href="https://www.are.na/block/${id}" target="_blank" rel="noopener">are.na/block/${id}</a></div></div>
        <div class="edge t"></div><div class="edge b"></div><div class="edge l"></div><div class="edge r"></div>
      </div>
      <div class="h h-rot" title="Rotate">⟳</div><div class="h h-tilt" title="Tilt in 3D">✥</div>
      <div class="h h-size" title="Resize">◢</div><div class="h h-flip" title="Flip">⇆</div>`;
    el.querySelector("h3").textContent = title;
    if (!b.image) {                                        // text blocks show their text
      el.querySelector(".front .t").textContent = b.title || "";
      el.querySelector(".front .c").textContent = (b.content || "").slice(0, 600);
    }
    return el;
  }

  function renderFrame(id) {
    const f = model.frames[id];
    let el = els.frames[id];
    if (!f) { el?.remove(); delete els.frames[id]; return; }
    if (!el) {
      el = els.frames[id] = document.createElement("div");
      el.className = "frame";
      el.dataset.fid = id;
      el.innerHTML = `<div class="frame-head"><button class="frame-dot" title="Change colour"></button>
        <span class="frame-title"></span><button class="frame-x" title="Delete cluster (the tiles stay)">×</button></div>
        <div class="frame-size"></div>`;
      world.prepend(el);
    }
    Object.assign(el.style, { left: `${f.x}px`, top: `${f.y}px`, width: `${f.w}px`, height: `${f.h}px` });
    el.style.setProperty("--c", f.color);
    const title = el.querySelector(".frame-title");
    if (title.contentEditable !== "true") title.textContent = f.title;
  }

  function updateRemovedCount() {
    const n = Object.entries(model.tiles).filter(([id, t]) => t.hidden && order.includes(id)).length;
    $("#removed-btn").textContent = `Removed (${n})`;
    $("#removed-btn").disabled = !n;
  }

  // ---------- geometry ----------

  const toWorld = (sx, sy) => ({ x: (sx - view.x) / view.k, y: (sy - view.y) / view.k });
  const center = (t) => ({ x: t.x + t.s / 2, y: t.y + t.s / 2 });
  const visibleTiles = () => Object.keys(els.tiles);

  function bounds() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [id, t] of Object.entries(model.tiles)) {
      if (t.hidden) continue;
      minX = Math.min(minX, t.x); minY = Math.min(minY, t.y);
      maxX = Math.max(maxX, t.x + t.s); maxY = Math.max(maxY, t.y + t.s);
    }
    for (const f of Object.values(model.frames)) {
      minX = Math.min(minX, f.x); minY = Math.min(minY, f.y);
      maxX = Math.max(maxX, f.x + f.w); maxY = Math.max(maxY, f.y + f.h);
    }
    return minX === Infinity ? null : { minX, minY, maxX, maxY };
  }

  function fit() {
    const b = bounds();
    if (!b) return;
    const top = $("#bar").offsetHeight + 16, w = innerWidth - 60, h = innerHeight - top - 30;
    const k = Math.min(1.5, Math.max(0.08, Math.min(w / (b.maxX - b.minX), h / (b.maxY - b.minY))));
    view = { k, x: (innerWidth - (b.maxX - b.minX) * k) / 2 - b.minX * k, y: top + (h - (b.maxY - b.minY) * k) / 2 - b.minY * k };
    applyView();
    renderAllTiles();
  }
  function fitIfFirstVisit() { if (!localStorage.getItem(viewKey + ":seen")) { fit(); localStorage.setItem(viewKey + ":seen", "1"); } }

  function zoomAt(sx, sy, factor) {
    const k = Math.min(4, Math.max(0.08, view.k * factor));
    view.x = sx - (sx - view.x) * (k / view.k);
    view.y = sy - (sy - view.y) * (k / view.k);
    view.k = k;
    applyView();
    renderAllTiles();
  }

  // ---------- dragging ----------

  // Calls onMove(dx, dy, event) in screen pixels until the pointer is released.
  function track(e, onMove, onEnd) {
    const sx = e.clientX, sy = e.clientY;
    let moved = false;
    const move = (ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      moved = true;
      onMove(dx, dy, ev);
    };
    const up = (ev) => {
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
      onEnd?.(moved, ev);
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
  }

  // Change some tiles while dragging, then save one undo step at the end.
  function dragTiles(e, ids, change) {
    const before = {};
    ids.forEach((id) => { dragging.add(id); before[`tiles/${id}`] = current(`tiles/${id}`); });
    track(e, (dx, dy, ev) => {
      const paths = {};
      ids.forEach((id) => {
        Object.assign(model.tiles[id], change(id, dx, dy, ev));
        paths[`tiles/${id}`] = model.tiles[id];
        renderTile(id);
      });
      writeSoon(structuredClone(paths));
    }, (moved) => {
      ids.forEach((id) => dragging.delete(id));
      if (!moved) return;
      flush();
      const after = Object.fromEntries(ids.map((id) => [`tiles/${id}`, structuredClone(model.tiles[id])]));
      write(after, { before });
    });
  }

  const zTop = () => Math.floor(Date.now() / 100) % 2e9;   // later = in front, for everyone

  function select(ids, add = false) {
    if (!add) selected.clear();
    ids.forEach((id) => selected.add(id));
    visibleTiles().forEach(renderTile);
  }

  world.addEventListener("pointerdown", (e) => {
    const tileEl = e.target.closest(".tile");
    if (tileEl) return onTileDown(e, tileEl.dataset.id);
    const frameEl = e.target.closest(".frame");
    if (frameEl) return onFrameDown(e, frameEl.dataset.fid);
  });

  function onTileDown(e, id) {
    if (e.button !== 0) return;
    const desc = e.target.closest(".desc");
    if (desc && desc.scrollHeight > desc.clientHeight && e.offsetX > desc.clientWidth - 4) return; // scrollbar
    e.stopPropagation();
    const t = model.tiles[id], k = view.k, cls = e.target.classList;

    if (cls.contains("h-flip")) return flip([id]);
    if (cls.contains("h-rot")) {
      const r = els.tiles[id].getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const a0 = Math.atan2(e.clientY - cy, e.clientX - cx), rz0 = t.rz || 0;
      return dragTiles(e, [id], (_, dx, dy, ev) => {
        let rz = rz0 + ((Math.atan2(ev.clientY - cy, ev.clientX - cx) - a0) * 180) / Math.PI;
        if (ev.shiftKey) rz = Math.round(rz / 15) * 15;
        return { rz };
      });
    }
    if (cls.contains("h-tilt") || e.altKey) {
      const rx0 = t.rx || 0, ry0 = t.ry || 0;
      return dragTiles(e, [id], (_, dx, dy) => ({ rx: Math.max(-85, Math.min(85, rx0 - dy * 0.5)), ry: ry0 + dx * 0.5 }));
    }
    if (cls.contains("h-size")) {
      const s0 = t.s;
      return dragTiles(e, [id], (_, dx, dy) => ({ s: Math.max(80, Math.min(800, s0 + (dx + dy) / 2 / k)) }));
    }
    // move every selected tile together
    if (e.shiftKey) { selected.has(id) ? selected.delete(id) : selected.add(id); select([], true); }
    else if (!selected.has(id)) select([id]);
    const ids = selected.has(id) ? [...selected] : [id];
    const start = Object.fromEntries(ids.map((i) => [i, { x: model.tiles[i].x, y: model.tiles[i].y }]));
    const z = zTop();
    dragTiles(e, ids, (i, dx, dy) => ({ x: start[i].x + dx / k, y: start[i].y + dy / k, z }));
  }

  world.addEventListener("dblclick", (e) => {
    const title = e.target.closest(".frame-title");
    if (title) return renameFrame(title);
    const tileEl = e.target.closest(".tile");
    if (tileEl && !e.target.closest(".h, a")) flip([tileEl.dataset.id]);
  });

  function animate(ids, change) {
    const paths = {};
    ids.forEach((id) => {
      const card = els.tiles[id]?.querySelector(".card");
      card?.classList.add("anim");
      setTimeout(() => card?.classList.remove("anim"), 520);
      paths[`tiles/${id}`] = { ...model.tiles[id], ...change(model.tiles[id]) };
    });
    write(paths);
  }
  const flip = (ids) => animate(ids, (t) => ({ ry: Math.round((t.ry || 0) / 180) * 180 + 180 }));
  const straighten = (ids) => animate(ids, () => ({ rx: 0, ry: 0, rz: 0 }));
  const remove = (ids) => { write(Object.fromEntries(ids.map((id) => [`tiles/${id}/hidden`, true]))); selected.clear(); };

  // ---------- clusters ----------

  function newFrame(x, y, w, h, title) {
    const id = "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    return [id, { x, y, w, h, title, color: COLORS[Object.keys(model.frames).length % COLORS.length] }];
  }

  function cluster() {
    const ids = [...selected];
    if (!ids.length) return status("Select some tiles first (Shift + click, or Shift + drag)", 2500);
    const ts = ids.map((i) => model.tiles[i]);
    const cell = Math.max(...ts.map((t) => t.s)), gap = 24, pad = 30, head = 40;
    const cols = Math.ceil(Math.sqrt(ids.length)), rows = Math.ceil(ids.length / cols);
    const x0 = Math.min(...ts.map((t) => t.x)), y0 = Math.min(...ts.map((t) => t.y));
    const [fid, frame] = newFrame(x0 - pad, y0 - pad - head, cols * cell + (cols - 1) * gap + pad * 2,
      rows * cell + (rows - 1) * gap + pad * 2 + head, `Cluster ${Object.keys(model.frames).length + 1}`);
    const paths = { [`frames/${fid}`]: frame };
    ids.forEach((id, i) => {
      const t = model.tiles[id];
      paths[`tiles/${id}`] = { ...t, x: x0 + (i % cols) * (cell + gap) + (cell - t.s) / 2, y: y0 + Math.floor(i / cols) * (cell + gap) + (cell - t.s) / 2 };
    });
    write(paths);
  }

  function onFrameDown(e, fid) {
    const f = model.frames[fid];
    if (!f || e.button !== 0) return;
    e.stopPropagation();
    const k = view.k, cls = e.target.classList;
    if (cls.contains("frame-x")) return write({ [`frames/${fid}`]: null });
    if (cls.contains("frame-dot")) return write({ [`frames/${fid}/color`]: COLORS[(COLORS.indexOf(f.color) + 1) % COLORS.length] });
    if (e.target.isContentEditable) return;
    const before = { [`frames/${fid}`]: structuredClone(f) };
    if (cls.contains("frame-size")) {
      const w0 = f.w, h0 = f.h;
      return track(e, (dx, dy) => {
        f.w = Math.max(160, w0 + dx / k); f.h = Math.max(120, h0 + dy / k);
        renderFrame(fid); writeSoon({ [`frames/${fid}`]: structuredClone(f) });
      }, (moved) => { if (moved) { flush(); write({ [`frames/${fid}`]: structuredClone(f) }, { before }); } });
    }
    // drag the title bar: the frame and every tile whose centre is inside it move together
    const inside = visibleTiles().filter((id) => {
      const c = center(model.tiles[id]);
      return c.x > f.x && c.x < f.x + f.w && c.y > f.y && c.y < f.y + f.h;
    });
    inside.forEach((id) => { dragging.add(id); before[`tiles/${id}`] = current(`tiles/${id}`); });
    const fx = f.x, fy = f.y, start = Object.fromEntries(inside.map((i) => [i, { x: model.tiles[i].x, y: model.tiles[i].y }]));
    track(e, (dx, dy) => {
      f.x = fx + dx / k; f.y = fy + dy / k;
      renderFrame(fid);
      const paths = { [`frames/${fid}`]: structuredClone(f) };
      inside.forEach((i) => {
        model.tiles[i].x = start[i].x + dx / k; model.tiles[i].y = start[i].y + dy / k;
        renderTile(i); paths[`tiles/${i}`] = structuredClone(model.tiles[i]);
      });
      writeSoon(paths);
    }, (moved) => {
      inside.forEach((id) => dragging.delete(id));
      if (!moved) return;
      flush();
      const after = { [`frames/${fid}`]: structuredClone(f) };
      inside.forEach((i) => (after[`tiles/${i}`] = structuredClone(model.tiles[i])));
      write(after, { before });
    });
  }

  function renameFrame(el) {
    const fid = el.closest(".frame").dataset.fid;
    el.contentEditable = "true";
    el.focus();
    document.getSelection().selectAllChildren(el);
    el.onkeydown = (ev) => { if (ev.key === "Enter" || ev.key === "Escape") { ev.preventDefault(); el.blur(); } };
    el.onblur = () => {
      el.contentEditable = "false";
      const title = el.textContent.trim() || "Cluster";
      if (title !== model.frames[fid]?.title) write({ [`frames/${fid}/title`]: title });
      el.textContent = title;
    };
  }

  // ---------- tidy up ----------

  function tidy() {
    const ids = order.filter((id) => model.tiles[id] && !model.tiles[id].hidden);
    if (!ids.length || !confirm("Put every tile back in a grid, for everyone? (You can undo it.)")) return;
    const cols = Math.max(4, Math.ceil(Math.sqrt(ids.length * 1.6))), size = 200, gap = 40;
    const paths = {};
    ids.forEach((id, i) => (paths[`tiles/${id}`] = { ...model.tiles[id], ...newTile((i % cols) * (size + gap), Math.floor(i / cols) * (size + gap)) }));
    Object.keys(model.frames).forEach((fid) => (paths[`frames/${fid}`] = null));
    write(paths);
    setTimeout(fit, 300);
  }

  // ---------- moving around and selecting an area ----------

  board.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".tile, .frame-head, .frame-size")) return;
    document.activeElement?.isContentEditable && document.activeElement.blur();
    if (e.shiftKey && e.button === 0) {
      const a = toWorld(e.clientX, e.clientY), base = new Set(selected);
      marquee.hidden = false;
      Object.assign(marquee.style, { left: `${e.clientX}px`, top: `${e.clientY}px`, width: 0, height: 0 });
      return track(e, (dx, dy, ev) => {
        Object.assign(marquee.style, { left: `${Math.min(e.clientX, ev.clientX)}px`, top: `${Math.min(e.clientY, ev.clientY)}px`, width: `${Math.abs(dx)}px`, height: `${Math.abs(dy)}px` });
        const b = toWorld(ev.clientX, ev.clientY);
        const [x1, x2, y1, y2] = [Math.min(a.x, b.x), Math.max(a.x, b.x), Math.min(a.y, b.y), Math.max(a.y, b.y)];
        selected = new Set(base);
        visibleTiles().forEach((id) => { const c = center(model.tiles[id]); if (c.x > x1 && c.x < x2 && c.y > y1 && c.y < y2) selected.add(id); });
        visibleTiles().forEach(renderTile);
      }, () => (marquee.hidden = true));
    }
    const vx = view.x, vy = view.y;
    board.classList.add("panning");
    track(e, (dx, dy) => { view.x = vx + dx; view.y = vy + dy; applyView(); }, (moved) => {
      board.classList.remove("panning");
      if (!moved) select([]);
    });
  });

  board.addEventListener("wheel", (e) => {
    const desc = e.target.closest(".desc");
    if (desc && !e.ctrlKey && desc.scrollHeight > desc.clientHeight) return;   // scroll a long description
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) zoomAt(e.clientX, e.clientY, Math.exp(-Math.max(-30, Math.min(30, e.deltaY)) * 0.006));
    else { view.x -= e.deltaX; view.y -= e.deltaY; applyView(); }
  }, { passive: false });

  // ---------- buttons and keys ----------

  $("#cluster-btn").onclick = cluster;
  $("#frame-btn").onclick = () => {
    const c = toWorld(innerWidth / 2, innerHeight / 2);
    const [fid, frame] = newFrame(c.x - 250, c.y - 175, 500, 350, `Cluster ${Object.keys(model.frames).length + 1}`);
    write({ [`frames/${fid}`]: frame });
  };
  $("#undo-btn").onclick = undo;
  $("#tidy-btn").onclick = tidy;
  $("#removed-btn").onclick = () => write(Object.fromEntries(
    Object.entries(model.tiles).filter(([, t]) => t.hidden).map(([id]) => [`tiles/${id}/hidden`, null])));
  $("#fit-btn").onclick = fit;
  $("#zoomin-btn").onclick = () => zoomAt(innerWidth / 2, innerHeight / 2, 1.25);
  $("#zoomout-btn").onclick = () => zoomAt(innerWidth / 2, innerHeight / 2, 0.8);
  $("#copy-btn").onclick = async () => {
    try { await navigator.clipboard.writeText(location.href); status("Link copied: send it to whoever should work on this board", 2500); }
    catch { prompt("Copy this link:", location.href); }
  };
  $("#help-btn").onclick = () => ($("#help").hidden = !$("#help").hidden);
  $("#help-close").onclick = () => ($("#help").hidden = true);

  addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea, [contenteditable='true']")) return;
    const ids = [...selected], key = e.key.toLowerCase();
    if (key === "z" && (e.metaKey || e.ctrlKey)) undo();
    else if (key === "f" && ids.length) flip(ids);
    else if (key === "r" && ids.length) straighten(ids);
    else if (key === "g") cluster();
    else if (key === "0") fit();
    else if (key === "=" || key === "+") zoomAt(innerWidth / 2, innerHeight / 2, 1.25);
    else if (key === "-") zoomAt(innerWidth / 2, innerHeight / 2, 0.8);
    else if ((key === "delete" || key === "backspace") && ids.length) remove(ids);
    else if (key === "escape") select([]);
    else if (key === "a" && (e.metaKey || e.ctrlKey)) select(visibleTiles());
    else return;
    e.preventDefault();
  });

  // ---------- go ----------

  applyView();
  status("Opening the board...");
  store.ready()                                   // wait for the saved layout before placing anything
    .then((saved) => {
      for (const kind of ["tiles", "frames"]) {
        for (const [id, v] of Object.entries(saved[kind] || {})) if (!model[kind][id]) model[kind][id] = v;
      }
      return loadChannel(true);
    })
    .catch((err) => status("Could not open the board: " + err.message, 8000));
  setInterval(() => loadChannel(false).catch(() => {}), CHECK_EVERY);   // new blocks appear by themselves
}

// ---------- small helpers ----------

// Are.na already cleans descriptions; this is a second safety pass.
function clean(html) {
  const t = document.createElement("template");
  t.innerHTML = html || "";
  t.content.querySelectorAll("script,style,iframe,object,embed").forEach((n) => n.remove());
  t.content.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((a) => a.name.startsWith("on") && el.removeAttribute(a.name));
    if (el.tagName === "A") { el.target = "_blank"; el.rel = "noopener"; }
  });
  return t.innerHTML;
}

function status(message, hideAfter) {
  const el = document.getElementById("status");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(statusTimer);
  if (hideAfter) statusTimer = setTimeout(() => (el.hidden = true), hideAfter);
}
