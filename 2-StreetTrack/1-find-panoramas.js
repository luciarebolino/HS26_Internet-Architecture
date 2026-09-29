// STEP 1: find the Street View panoramas in the area.
//
// A panorama is one 360° photo taken by the Street View car. We put a point every
// few metres over the area and ask Google where the nearest panorama is. These
// "metadata" questions are free.
//
// Saves: output/<NAME>/panoramas.json

import { readArea, areaSize, outputFolder, saveJson, runLimited, progress, download, stop } from "../lib/tools.js";
import { metadataUrl } from "./streetview.js";
import { NAME, AREA, SPACING } from "./settings.js";

const out = outputFolder(import.meta.url, NAME);
const area = await readArea(AREA);
const [w, h] = areaSize(area);

// 1. A grid of points over the area
const points = [];
for (let y = 0; y <= h; y += SPACING) {
  for (let x = 0; x <= w; x += SPACING) {
    points.push([area[1] + (y / h) * (area[3] - area[1]), area[0] + (x / w) * (area[2] - area[0])]);
  }
}
console.log(`Area ${w.toFixed(0)} x ${h.toFixed(0)} m: asking Google about ${points.length} points...`);

// 2. The nearest panorama to each point (many points find the same one)
const found = {};
let done = 0;
await runLimited(points, 8, async ([lat, lng]) => {
  const meta = await (await download(metadataUrl(lat, lng, SPACING), "Street View metadata")).json();
  if (meta.status === "REQUEST_DENIED") stop("Google refused the key: " + meta.error_message);
  if (meta.status === "OK") {
    found[meta.pano_id] = { id: meta.pano_id, lat: meta.location.lat, lng: meta.location.lng, date: meta.date || "" };
  }
  progress(++done, points.length, "points");
});

const panoramas = Object.values(found);
saveJson(out, "panoramas.json", panoramas);
const dates = [...new Set(panoramas.map((p) => p.date))].sort();
console.log(`Found ${panoramas.length} panoramas, taken in ${dates.join(", ")}. Next: node 2-download-photos.js`);
