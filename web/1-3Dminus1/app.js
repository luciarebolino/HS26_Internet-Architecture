// 3Dminus1 — Google's 3D city, flattened.
// Everything happens in this browser tab; nothing is installed.

const API = "https://tile.googleapis.com";
let area = null;       // [lon_min, lat_min, lon_max, lat_max]
let tiles = [];        // the 3D tiles over our area
let textures = [];     // { blob, footprint, name }
let mapCanvas = null;
let session = null;    // Google gives us a session id with the first answer

// ---------- talking to Google's Map Tiles API ----------

async function google(address) {
  const url = new URL(address, API);
  if (url.searchParams.get("session")) session = url.searchParams.get("session");
  else if (session && !url.pathname.endsWith("root.json")) url.searchParams.set("session", session);
  url.searchParams.set("key", googleKey());
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(url);
    if (response.ok) return response;
    if ([429, 500, 502, 503].includes(response.status)) { await sleep(3000 * (attempt + 1)); continue; }
    const text = await response.text();
    throw new Error(`Google said ${response.status}: ${text.slice(0, 200)}`);
  }
  throw new Error("Google is too busy right now, try again in a minute.");
}

// ---------- where is a tile? (Earth-centred x, y, z in metres) ----------

const A = 6378137, E2 = 6.69437999014e-3; // the shape of the Earth (WGS84)
const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;

function xyzToLatLon([x, y, z]) {
  const lon = Math.atan2(y, x), p = Math.hypot(x, y);
  let lat = Math.atan2(z, p * (1 - E2));
  for (let i = 0; i < 5; i++) {
    const n = A / Math.sqrt(1 - E2 * Math.sin(lat) ** 2);
    lat = Math.atan2(z, p * (1 - (E2 * n) / (n + (p / Math.cos(lat) - n))));
  }
  return [deg(lat), deg(lon)];
}
function latLonToXyz(lat, lon, h = 460) { // 460 m: about the height of the ground in Zürich
  const n = A / Math.sqrt(1 - E2 * Math.sin(rad(lat)) ** 2);
  return [(n + h) * Math.cos(rad(lat)) * Math.cos(rad(lon)), (n + h) * Math.cos(rad(lat)) * Math.sin(rad(lon)), (n * (1 - E2) + h) * Math.sin(rad(lat))];
}
// The lat/lon rectangle a tile covers on the ground
function footprint(box) {
  const c = box.slice(0, 3), u = box.slice(3, 6), v = box.slice(6, 9), w = box.slice(9, 12);
  const lats = [], lons = [];
  for (const a of [-1, 1]) for (const b of [-1, 1]) for (const g of [-1, 1]) {
    const [lat, lon] = xyzToLatLon([0, 1, 2].map((i) => c[i] + a * u[i] + b * v[i] + g * w[i]));
    lats.push(lat); lons.push(lon);
  }
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}
// Does this tile come near our area? (distance from the area's centre to the tile's box)
function touchesArea(box) {
  const radius = Math.hypot(...areaSize(area)) / 2;
  const p = latLonToXyz((area[1] + area[3]) / 2, (area[0] + area[2]) / 2);
  const c = box.slice(0, 3), d = [0, 1, 2].map((i) => p[i] - c[i]);
  let closest = [...c];
  for (const u of [box.slice(3, 6), box.slice(6, 9), box.slice(9, 12)]) {
    const len = Math.hypot(...u);
    if (!len) continue;
    const t = Math.max(-len, Math.min(len, (d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / len));
    closest = closest.map((value, i) => value + (u[i] * t) / len);
  }
  return Math.hypot(...[0, 1, 2].map((i) => p[i] - closest[i])) <= radius;
}

// ---------- STEP 1: walk down the tree of tiles ----------
// The first tile is the whole planet. It splits into smaller tiles, which split
// again, down to pieces of about 50 m. We only open the tiles near our area.

onClick("b1", "st1", async () => {
  area = await readArea($("#area").value);
  const [w, h] = areaSize(area);
  status("st1", `Area: ${w.toFixed(0)} x ${h.toFixed(0)} m. Walking down the tile tree...`);
  if (w * h > 2e6) status("st1", "That area is very big: it will take long. Try a smaller one?", "error");
  const start = API + "/v1/3dtiles/root.json";
  const toOpen = [{ tile: (await (await google(start)).json()).root, address: start }];
  tiles = [];
  while (toOpen.length) {
    const { tile, address } = toOpen.pop();
    if (!touchesArea(tile.boundingVolume.box)) continue;             // not near us: skip
    const content = tile.content?.uri || "";
    if (content.includes(".json")) {                                  // more of the tree
      const next = new URL(content, address).toString();
      toOpen.push({ tile: (await (await google(next)).json()).root, address: next });
    } else if (tile.children) {                                       // splits into smaller tiles
      tile.children.forEach((child) => toOpen.push({ tile: child, address }));
    } else if (content.includes(".glb")) {                            // smallest tile: a 3D model
      tiles.push({ url: new URL(content, address).toString(), box: tile.boundingVolume.box });
      status("st1", `Area: ${w.toFixed(0)} x ${h.toFixed(0)} m. Found ${tiles.length} tiles...`);
    }
  }
  status("st1", `Area: ${w.toFixed(0)} x ${h.toFixed(0)} m. Found ${tiles.length} tiles. Go to step 2.`);
  stepDone("s1", "b2");
});

// ---------- STEP 2: download each tile, keep only its images ----------
// A .glb file = a JSON description + one binary blob. The JSON lists "images",
// each pointing at a slice of the blob. We copy those slices out.

function imagesInGlb(buffer) {
  const view = new DataView(buffer);
  const jsonLength = view.getUint32(12, true);
  const gltf = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)));
  const blobStart = 20 + jsonLength + 8;
  return (gltf.images || []).map((image) => {
    const bv = gltf.bufferViews[image.bufferView];
    const start = blobStart + (bv.byteOffset || 0);
    return new Blob([buffer.slice(start, start + bv.byteLength)], { type: image.mimeType || "image/jpeg" });
  });
}

onClick("b2", "st2", async () => {
  textures = [];
  $("#g2").innerHTML = "";
  let done = 0;
  await runLimited(tiles, 8, async (tile) => {
    const glb = await (await google(tile.url)).arrayBuffer();
    for (const blob of imagesInGlb(glb)) {
      textures.push({ blob, footprint: footprint(tile.box) });
      if ($("#g2").children.length < 60) {                            // show the first 60
        const img = document.createElement("img");
        img.src = URL.createObjectURL(blob);
        $("#g2").appendChild(img);
      }
    }
    done++;
    progress("p2", done / tiles.length);
    status("st2", `${done} / ${tiles.length} tiles, ${textures.length} textures`);
  });
  status("st2", `Got ${textures.length} textures from ${tiles.length} tiles (showing the first 60). Go to step 3.`);
  stepDone("s2", "b3");
});

// ---------- STEP 3: paste every texture where its tile stands ----------

onClick("b3", "st3", async () => {
  const [w, h] = areaSize(area);
  let metresPerPixel = w * h < 500000 ? 0.1 : 0.25;                  // small areas: sharper
  while (Math.max(w, h) / metresPerPixel > 14000) metresPerPixel *= 2; // browsers can't make endless images
  const toPixels = (lon, lat) => [areaSize([area[0], area[1], lon, area[3]])[0] / metresPerPixel, ((area[3] - lat) * 110540) / metresPerPixel];

  mapCanvas = $("#map");
  mapCanvas.width = Math.round(w / metresPerPixel);
  mapCanvas.height = Math.round(h / metresPerPixel);
  const ctx = mapCanvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);

  // a tile can hold several textures: put them side by side in its footprint
  const byTile = {};
  textures.forEach((t) => (byTile[t.footprint.join()] ||= []).push(t));
  for (const group of Object.values(byTile)) {
    const [lonMin, latMin, lonMax, latMax] = group[0].footprint;
    const [left, top] = toPixels(lonMin, latMax), [right, bottom] = toPixels(lonMax, latMin);
    const step = (right - left) / group.length;
    for (const [k, t] of group.entries()) {
      const img = await createImageBitmap(t.blob);
      ctx.drawImage(img, left + k * step, top, step, bottom - top);
    }
  }
  mapCanvas.hidden = false;
  status("st3", `Map: ${mapCanvas.width} x ${mapCanvas.height} pixels (1 pixel = ${metresPerPixel} m). Go to step 4.`);
  stepDone("s3", "b4");
});

// ---------- STEP 4: name the textures by coordinates and save a zip ----------

onClick("b4", "st4", async () => {
  const files = [{ name: "map.jpg", data: await canvasToJpg(mapCanvas, 0.95) }];
  const count = {};
  for (const t of textures) {
    const [lonMin, latMin, lonMax, latMax] = t.footprint;
    let name = `${((latMin + latMax) / 2).toFixed(5)}_${((lonMin + lonMax) / 2).toFixed(5)}`;
    count[name] = (count[name] || 0) + 1;              // several textures can share a spot
    if (count[name] > 1) name += `_${count[name]}`;
    files.push({ name: `squares/${name}.jpg`, data: t.blob });
  }
  await saveZip(files, "3Dminus1.zip", "st4");
  status("st4", `Saved 3Dminus1.zip: map.jpg + ${textures.length} squares. Look in your Downloads folder.`);
  stepDone("s4");
});
