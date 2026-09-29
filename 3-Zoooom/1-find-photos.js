// STEP 1: find one webcam photo for every chosen day.
//
// The webcam page on myswitzerland.com doesn't say where its photos come from,
// but the browser's Network tab does: a camera archive with a calendar
// (archive_calendar.json) and, for every day, a list of photos (archive_sliderfeed.json).
// The address of each photo contains its date and time, e.g. .../2026-09-27/13-40-00/...
//
// Saves: output/<NAME>/photos.json

import { outputFolder, saveJson, runLimited, progress, download, stop } from "../lib/tools.js";
import { ARCHIVE } from "./camera.js";
import { NAME, FROM, TO, EVERY, TIME } from "./settings.js";

const out = outputFolder(import.meta.url, NAME);

// 1. The calendar: every day that has photos
const calendar = await (await download(`${ARCHIVE}/archive_calendar.json`, "the calendar")).json();
const days = new Set(calendar.flatMap((y) => y.months.flatMap((m) => m.days.map((d) =>
  `${y.y}-${String(m.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`))));
console.log(`The archive has photos on ${days.size} days.`);

// 2. The days we want
const wanted = [];
for (let d = new Date(FROM); d <= new Date(TO); d.setDate(d.getDate() + EVERY)) {
  const day = d.toISOString().slice(0, 10);
  if (days.has(day)) wanted.push(day);
}
if (!wanted.length) stop("No photos between FROM and TO: check the dates in settings.js.");
if (wanted.length > 500) stop(`That's ${wanted.length} photos: choose a shorter period or a bigger EVERY in settings.js (max 500).`);

// 3. For each day, the photo closest to TIME
const [hh, mm] = TIME.split(":").map(Number);
const photos = [];
let done = 0;
await runLimited(wanted, 4, async (day) => {
  const [y, m, d] = day.split("-").map(Number);
  const feed = await (await download(`${ARCHIVE}/archive_sliderfeed.json?year=${y}&month=${m}&day=${d}&range=d`, "a day's photo list")).json();
  let best = null, bestGap = Infinity;
  for (const entry of [...feed.slider_feed, ...feed.carou_feed]) {
    const url = entry.structure.thumbnail.url_full;
    const [, time] = url.match(/\/\d{4}-\d\d-\d\d\/(\d\d-\d\d)-\d\d\//) || [];
    if (!time) continue;
    const [h, mi] = time.split("-").map(Number);
    const gap = Math.abs(h * 60 + mi - (hh * 60 + mm));
    if (gap < bestGap) { bestGap = gap; best = { date: day, time: time.replace("-", ":"), base: url.replace("_thumbnail.jpg", "") }; }
  }
  if (best) photos.push(best);
  progress(++done, wanted.length, "days");
});

photos.sort((a, b) => a.date.localeCompare(b.date));
saveJson(out, "photos.json", photos);
console.log(`Found ${photos.length} photos, from ${photos[0].date} to ${photos.at(-1).date}. Next: node 2-download-photos.js`);
