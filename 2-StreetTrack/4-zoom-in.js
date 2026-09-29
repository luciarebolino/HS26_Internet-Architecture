// STEP 4: zoom in on everything that was found.
//
// For each find we ask Street View for a new photo from the same spot, turned
// towards it and with a narrow view: a real zoom, not a blurry enlargement.
//
// Saves: output/<NAME>/zoom/  and a table you can open in Excel, named after what
// you looked for: output/<NAME>/truck.csv (or person.csv, truck+bus.csv...)

import fs from "node:fs";
import path from "node:path";
import { outputFolder, loadJson, runLimited, progress, download } from "../lib/tools.js";
import { photoUrl, aimAt } from "./streetview.js";
import { NAME } from "./settings.js";

const out = outputFolder(import.meta.url, NAME);
const found = loadJson(out, "found.json", "step 3 (node 3-find-things.js)");
const { label } = loadJson(out, "found-what.json", "step 3 (node 3-find-things.js)");
fs.rmSync(path.join(out, "zoom"), { recursive: true, force: true });
fs.mkdirSync(path.join(out, "zoom"));

const rows = [];
let done = 0;
await runLimited(found, 4, async (thing, i) => {
  const aim = aimAt(thing.heading, thing.box);
  const url = photoUrl(thing.pano.id, aim.heading.toFixed(1), aim.fov.toFixed(1), aim.pitch.toFixed(1), 640, 480);
  const response = await download(url, "a zoomed Street View photo");
  if (response) {
    const file = `${String(i + 1).padStart(3, "0")}_${thing.what.replace(/ /g, "-")}_${thing.pano.date}_${thing.pano.lat.toFixed(5)}_${thing.pano.lng.toFixed(5)}.jpg`;
    fs.writeFileSync(path.join(out, "zoom", file), Buffer.from(await response.arrayBuffer()));
    const link = `https://www.google.com/maps/@?api=1&map_action=pano&pano=${thing.pano.id}&heading=${aim.heading.toFixed(0)}&pitch=${aim.pitch.toFixed(0)}&fov=${aim.fov.toFixed(0)}`;
    rows.push([file, thing.what, thing.pano.date, thing.pano.lat, thing.pano.lng, aim.heading.toFixed(1), aim.pitch.toFixed(1), aim.fov.toFixed(1), thing.confidence.toFixed(2), link].join(","));
  }
  progress(++done, found.length, "zooms");
});

const header = "zoom_file,what,date,lat,lng,heading,pitch,zoom_degrees,confidence,google_maps_link";
fs.writeFileSync(path.join(out, `${label}.csv`), [header, ...rows.sort()].join("\n") + "\n");
console.log(`Saved ${rows.length} zoomed photos in output/${NAME}/zoom/ and a table in ${label}.csv. Done!`);
