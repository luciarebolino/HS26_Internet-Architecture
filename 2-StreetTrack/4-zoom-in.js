// STEP 4: zoom in on every truck.
//
// For each truck we ask Street View for a new photo from the same spot, turned
// towards the truck and with a narrow view: a real zoom, not a blurry enlargement.
//
// Saves: output/<NAME>/zoom/  and  output/<NAME>/trucks.csv (a table you can open in Excel)

import fs from "node:fs";
import path from "node:path";
import { outputFolder, loadJson, runLimited, progress, download } from "../lib/tools.js";
import { photoUrl, aimAt } from "./streetview.js";
import { NAME } from "./settings.js";

const out = outputFolder(import.meta.url, NAME);
const trucks = loadJson(out, "trucks.json", "step 3 (node 3-find-trucks.js)");
fs.rmSync(path.join(out, "zoom"), { recursive: true, force: true });
fs.mkdirSync(path.join(out, "zoom"));

const rows = ["zoom_file,date,lat,lng,heading,pitch,zoom_degrees,confidence,google_maps_link"];
let done = 0;
await runLimited(trucks, 4, async (truck, i) => {
  const aim = aimAt(truck.heading, truck.box);
  const url = photoUrl(truck.pano.id, aim.heading.toFixed(1), aim.fov.toFixed(1), aim.pitch.toFixed(1), 640, 480);
  const response = await download(url, "a zoomed Street View photo");
  if (response) {
    const file = `${String(i + 1).padStart(3, "0")}_${truck.pano.date}_${truck.pano.lat.toFixed(5)}_${truck.pano.lng.toFixed(5)}.jpg`;
    fs.writeFileSync(path.join(out, "zoom", file), Buffer.from(await response.arrayBuffer()));
    const link = `https://www.google.com/maps/@?api=1&map_action=pano&pano=${truck.pano.id}&heading=${aim.heading.toFixed(0)}&pitch=${aim.pitch.toFixed(0)}&fov=${aim.fov.toFixed(0)}`;
    rows.push([file, truck.pano.date, truck.pano.lat, truck.pano.lng, aim.heading.toFixed(1), aim.pitch.toFixed(1), aim.fov.toFixed(1), truck.confidence.toFixed(2), link].join(","));
  }
  progress(++done, trucks.length, "zooms");
});

fs.writeFileSync(path.join(out, "trucks.csv"), rows.sort().join("\n") + "\n");
console.log(`Saved ${rows.length - 1} zoomed trucks in output/${NAME}/zoom/ and a table in trucks.csv. Done!`);
