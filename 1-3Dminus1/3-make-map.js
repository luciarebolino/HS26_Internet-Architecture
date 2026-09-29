// STEP 3: smash the city flat.
//
// We make an empty map of our area and paste each texture where its tile stands.
// Without the 3D shapes the textures are just flat pieces of roofs, walls and
// streets, cut up and packed together.
//
// Saves: output/<NAME>/map.jpg

import path from "node:path";
import { Jimp } from "jimp";
import { outputFolder, loadJson, areaSize, progress } from "../lib/tools.js";
import { toPixels } from "./tiles.js";
import { NAME } from "./settings.js";

const out = outputFolder(import.meta.url, NAME);
const { area } = loadJson(out, "area.json", "step 1 (node 1-find-tiles.js)");
const textures = loadJson(out, "textures.json", "step 2 (node 2-get-textures.js)");

// 1. An empty white map. Small areas get 10 cm per pixel, big ones 25 cm (so the file stays reasonable).
const [w, h] = areaSize(area);
const metresPerPixel = w * h < 500000 ? 0.1 : 0.25;
const map = new Jimp({ width: Math.round(w / metresPerPixel), height: Math.round(h / metresPerPixel), color: 0xffffffff });

// 2. Paste every texture over the ground area of its tile.
//    A tile can hold several textures: put them side by side.
const byTile = {};
textures.forEach((t) => (byTile[t.footprint.join()] ||= []).push(t));
let done = 0;
for (const group of Object.values(byTile)) {
  const [lonMin, latMin, lonMax, latMax] = group[0].footprint;
  const [left, top] = toPixels(lonMin, latMax, area, metresPerPixel);
  const [right, bottom] = toPixels(lonMax, latMin, area, metresPerPixel);
  const step = (right - left) / group.length;
  for (const [k, t] of group.entries()) {
    const texture = await Jimp.read(path.join(out, "textures", t.file));
    texture.resize({ w: Math.max(1, Math.round(step)), h: Math.max(1, Math.round(bottom - top)) });
    map.composite(texture, Math.round(left + k * step), Math.round(top));
    progress(++done, textures.length, "textures pasted");
  }
}

await map.write(path.join(out, "map.jpg"), { quality: 95 });
console.log(`Saved output/${NAME}/map.jpg (${map.width} x ${map.height} px). Open it! Next: node 4-name-squares.js`);
