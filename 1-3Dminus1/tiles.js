// The technical part of this exercise: talking to Google's Map Tiles API and
// working out where a 3D tile is on Earth. You don't need to read this.

import { googleKey, areaSize, stop } from "../lib/tools.js";

export const API = "https://tile.googleapis.com";
let session = null;

// Every request needs our key, and (after the first one) the session id Google gave us.
export async function google(address) {
  const url = new URL(address, API);
  if (url.searchParams.get("session")) session = url.searchParams.get("session");
  else if (session && !url.pathname.endsWith("root.json")) url.searchParams.set("session", session);
  url.searchParams.set("key", googleKey());
  for (let attempt = 1; attempt <= 5; attempt++) {
    const response = await fetch(url);
    if (response.ok) return response;
    if ([403, 429, 500, 502, 503].includes(response.status) && attempt < 5) {
      await new Promise((resolve) => setTimeout(resolve, 4000 * attempt));
      continue;
    }
    stop(`Google said ${response.status}: ${(await response.text()).slice(0, 300)}\n` +
      "(If step 1 was run long ago, Google's session may have expired: run step 1 again.)");
  }
}

export function withSession(address) {
  const url = new URL(address, API);
  if (session && !url.searchParams.get("session")) url.searchParams.set("session", session);
  return url.toString();
}

// 3D tiles use x, y, z in metres from the centre of the Earth.
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

// The lat/lon rectangle a tile covers on the ground: [lon_min, lat_min, lon_max, lat_max]
export function footprint(box) {
  const c = box.slice(0, 3), u = box.slice(3, 6), v = box.slice(6, 9), w = box.slice(9, 12);
  const lats = [], lons = [];
  for (const a of [-1, 1]) for (const b of [-1, 1]) for (const g of [-1, 1]) {
    const [lat, lon] = xyzToLatLon([0, 1, 2].map((i) => c[i] + a * u[i] + b * v[i] + g * w[i]));
    lats.push(lat); lons.push(lon);
  }
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

// Does a tile come near our area? (distance from the area's centre to the tile's box, in metres)
export function touchesArea(box, area) {
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

// A .glb file = a JSON description + a binary blob. The JSON lists the "images",
// each pointing at a slice of the blob: we copy those slices out and ignore the 3D mesh.
export function imagesInGlb(arrayBuffer) {
  const data = Buffer.from(arrayBuffer);
  const jsonLength = data.readUInt32LE(12);
  const gltf = JSON.parse(data.subarray(20, 20 + jsonLength).toString("utf8"));
  const blob = data.subarray(20 + jsonLength + 8);
  return (gltf.images || []).map((image) => {
    const view = gltf.bufferViews[image.bufferView];
    const start = view.byteOffset || 0;
    return blob.subarray(start, start + view.byteLength);
  });
}

// Position on the flat map, in pixels from its top-left corner.
export function toPixels(lon, lat, area, metresPerPixel) {
  return [areaSize([area[0], area[1], lon, area[3]])[0] / metresPerPixel, ((area[3] - lat) * 110540) / metresPerPixel];
}
