// Small tools shared by the three exercises.
// You don't need to read this file to do the exercises, but you are welcome to.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// Stop the script with a friendly message instead of a long error.
export function stop(message) {
  console.error("\n" + message + "\n");
  process.exit(1);
}

// The folder where an exercise saves its results: <exercise>/output/<name>/
export function outputFolder(scriptUrl, name) {
  const folder = path.join(path.dirname(fileURLToPath(scriptUrl)), "output", name);
  fs.mkdirSync(folder, { recursive: true });
  return folder;
}

// Save and load the lists that one step hands to the next.
export function saveJson(folder, file, data) {
  fs.writeFileSync(path.join(folder, file), JSON.stringify(data, null, 1));
}
export function loadJson(folder, file, madeBy) {
  const full = path.join(folder, file);
  if (!fs.existsSync(full)) stop(`Missing ${path.relative(ROOT, full)}: run ${madeBy} first.`);
  return JSON.parse(fs.readFileSync(full, "utf8"));
}

// The Google key lives in google-key.txt, in the main folder (never uploaded to GitHub).
export function googleKey() {
  const file = path.join(ROOT, "google-key.txt");
  if (!fs.existsSync(file)) stop("No Google key: create a file called google-key.txt in the main folder and paste the key in it.");
  return fs.readFileSync(file, "utf8").trim();
}

// An area is four numbers from bboxfinder.com (lon_min,lat_min,lon_max,lat_max)
// or a place name, which we look up on OpenStreetMap.
export async function readArea(text) {
  const numbers = text.replace(/\s/g, "").split(",").map(Number);
  if (numbers.length === 4 && numbers.every((n) => !Number.isNaN(n))) return numbers;
  const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + encodeURIComponent(text);
  const places = await (await fetch(url, { headers: { "User-Agent": "internet-architecture class" } })).json();
  if (!places.length) stop(`OpenStreetMap does not know "${text}". Try another name, or use bboxfinder.com.`);
  const [latMin, latMax, lonMin, lonMax] = places[0].boundingbox.map(Number);
  return [lonMin, latMin, lonMax, latMax];
}

// Size of an area in metres: [width, height]
export function areaSize([lonMin, latMin, lonMax, latMax]) {
  return [(lonMax - lonMin) * 111320 * Math.cos((latMin * Math.PI) / 180), (latMax - latMin) * 110540];
}

// Download something, trying again a few times if the server is busy.
export async function download(url, what = "a file") {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      if (response.status === 404) return null;                       // it simply doesn't exist
      if (response.status < 500 && response.status !== 429) {
        stop(`The server refused ${what} (${response.status}): ${(await response.text()).slice(0, 300)}`);
      }
    } catch {}                                                        // network hiccup: try again
    await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
  }
  stop(`Could not download ${what} after 4 tries. Check your internet connection and run the step again.`);
}

// Run tasks with at most `limit` at the same time (polite to servers, faster than one by one).
export async function runLimited(items, limit, task) {
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      await task(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
}

// Print progress on one line: "  120 / 480"
export function progress(done, total, extra = "") {
  process.stdout.write(`\r  ${done} / ${total} ${extra}      `);
  if (done === total) process.stdout.write("\n");
}
