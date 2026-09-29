// STEP 4: name every texture after the place it comes from.
//
// Each texture is copied into squares/ and named after the centre of its tile:
// latitude_longitude.jpg, e.g. 47.38465_8.50571.jpg
// Paste the two numbers into Google Maps (with a comma between them) to see the spot.
//
// Saves: output/<NAME>/squares/

import fs from "node:fs";
import path from "node:path";
import { outputFolder, loadJson } from "../lib/tools.js";
import { NAME } from "./settings.js";

const out = outputFolder(import.meta.url, NAME);
const textures = loadJson(out, "textures.json", "step 2 (node 2-get-textures.js)");
const squares = path.join(out, "squares");
fs.rmSync(squares, { recursive: true, force: true });
fs.mkdirSync(squares);

const count = {};
for (const t of textures) {
  const [lonMin, latMin, lonMax, latMax] = t.footprint;
  let name = `${((latMin + latMax) / 2).toFixed(5)}_${((lonMin + lonMax) / 2).toFixed(5)}`;
  // several textures can share a spot (tiles stacked in height, or several per tile)
  count[name] = (count[name] || 0) + 1;
  if (count[name] > 1) name += `_${count[name]}`;
  fs.copyFileSync(path.join(out, "textures", t.file), path.join(squares, `${name}.jpg`));
}
console.log(`Saved ${textures.length} squares in output/${NAME}/squares/. Done!`);
