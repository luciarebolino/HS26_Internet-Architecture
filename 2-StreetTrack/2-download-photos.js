// STEP 2: download 4 photos from every panorama (looking north, east, south, west).
//
// Saves: output/<NAME>/photos/   and  output/<NAME>/photos.json

import fs from "node:fs";
import path from "node:path";
import { outputFolder, loadJson, saveJson, runLimited, progress, download } from "../lib/tools.js";
import { photoUrl } from "./streetview.js";
import { NAME } from "./settings.js";

const out = outputFolder(import.meta.url, NAME);
const panoramas = loadJson(out, "panoramas.json", "step 1 (node 1-find-panoramas.js)");
fs.mkdirSync(path.join(out, "photos"), { recursive: true });

const jobs = panoramas.flatMap((pano) => [0, 90, 180, 270].map((heading) => ({ pano, heading })));
console.log(`Downloading ${jobs.length} photos...`);
const photos = [];
let done = 0;
await runLimited(jobs, 6, async ({ pano, heading }) => {
  const file = `${pano.id}_${heading}.jpg`;
  const target = path.join(out, "photos", file);
  if (!fs.existsSync(target)) {                                     // already downloaded? skip it
    const response = await download(photoUrl(pano.id, heading), "a Street View photo");
    if (!response) return progress(++done, jobs.length, "photos");
    fs.writeFileSync(target, Buffer.from(await response.arrayBuffer()));
  }
  photos.push({ file, heading, pano });
  progress(++done, jobs.length, "photos");
});

saveJson(out, "photos.json", photos);
console.log(`Saved ${photos.length} photos in output/${NAME}/photos/. Have a look! Next: node 3-find-trucks.js`);
