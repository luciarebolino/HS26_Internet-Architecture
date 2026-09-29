// STEP 2: download the photos.
//
// Every photo is downloaded at half size (5120 x 1024). For the photos shown at
// the end of the video, where we zoom in close, we also download the full-size
// tiles around Frame B (only recent photos still have them).
// Older photos come from a slower archive server: this step can take a few minutes.
// If it stops, just run it again: photos already downloaded are skipped.
//
// Saves: output/<NAME>/photos/

import fs from "node:fs";
import path from "node:path";
import { outputFolder, loadJson, runLimited, progress, download } from "../lib/tools.js";
import { viewAt, needsTiles, tilesFor } from "./camera.js";
import { NAME, FRAMES_PER_PHOTO } from "./settings.js";

const out = outputFolder(import.meta.url, NAME);
const photos = loadJson(out, "photos.json", "step 1 (node 1-find-photos.js)");
const folder = path.join(out, "photos");
fs.mkdirSync(folder, { recursive: true });

// Save the first address that works (the live server first, then the archive server).
async function saveFirst(urls, file) {
  const target = path.join(folder, file);
  if (fs.existsSync(target)) return true;                           // already downloaded
  for (const url of urls) {
    const response = await download(url, "a webcam photo");
    if (response) { fs.writeFileSync(target, Buffer.from(await response.arrayBuffer())); return true; }
  }
  return false;
}

const total = photos.length * FRAMES_PER_PHOTO;
let done = 0, small = 0, tiles = 0;
await runLimited(photos, 4, async (photo, index) => {
  const id = `${photo.date}_${photo.time.replace(":", "-")}`;
  const archived = photo.base.replace("//storage4.", "//archive2.");
  const half = await saveFirst([`${photo.base}_half.jpg`, `${archived}_half.jpg`], `${id}_half.jpg`);
  if (!half) { await saveFirst([`${photo.base}_thumbnail.jpg`], `${id}_small.jpg`); small++; }

  // which tiles do this photo's frames need?
  const needed = new Set();
  for (let f = index * FRAMES_PER_PHOTO; f < (index + 1) * FRAMES_PER_PHOTO; f++) {
    const view = viewAt(total > 1 ? f / (total - 1) : 0);
    if (needsTiles(view)) tilesFor(view).forEach(([c, r]) => needed.add(`${c}_${r}`));
  }
  for (const tile of needed) {
    if (await saveFirst([`${photo.base}_full/${tile}.jpg`], `${id}_tile_${tile}.jpg`)) tiles++;
  }
  progress(++done, photos.length, "photos");
});

console.log(`Downloaded ${photos.length} photos${small ? ` (${small} only as small previews)` : ""}, plus ${tiles} full-size tiles.`);
console.log("Next: node 3-make-frames.js");
