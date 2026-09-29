// STEP 2: download the 3D tiles and keep only their textures.
//
// Each tile is a .glb file: a 3D model (the shape of the buildings) plus one or
// more images (the textures wrapped around the shape). We download every tile,
// throw the 3D shape away and save the images.
//
// Saves: output/<NAME>/textures/  and  output/<NAME>/textures.json

import fs from "node:fs";
import path from "node:path";
import { outputFolder, loadJson, saveJson, runLimited, progress } from "../lib/tools.js";
import { google, imagesInGlb, footprint } from "./tiles.js";
import { NAME } from "./settings.js";

const out = outputFolder(import.meta.url, NAME);
const tiles = loadJson(out, "tiles.json", "step 1 (node 1-find-tiles.js)");
fs.mkdirSync(path.join(out, "textures"), { recursive: true });

console.log(`Downloading ${tiles.length} tiles...`);
const textures = [];
let done = 0;
await runLimited(tiles, 8, async (tile, number) => {
  const glb = await (await google(tile.url)).arrayBuffer();      // the 3D model
  imagesInGlb(glb).forEach((jpg, k) => {                          // only its images
    const file = `tile${String(number).padStart(4, "0")}_${k}.jpg`;
    fs.writeFileSync(path.join(out, "textures", file), jpg);
    textures.push({ file, footprint: footprint(tile.box) });
  });
  progress(++done, tiles.length, "tiles");
});

textures.sort((a, b) => a.file.localeCompare(b.file));
saveJson(out, "textures.json", textures);
console.log(`Saved ${textures.length} textures in output/${NAME}/textures/. Have a look! Next: node 3-make-map.js`);
