// Small helpers shared by the three exercises.

const $ = (selector) => document.querySelector(selector);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Show a message under a step. kind = "error" makes it red.
function status(id, message, kind = "") {
  const el = document.getElementById(id);
  el.textContent = message;
  el.className = "status " + kind;
}

// Progress bar inside a step (0 to 1).
function progress(id, fraction) {
  document.querySelector(`#${id} > div`).style.width = `${Math.round(fraction * 100)}%`;
}

// Mark a step as done (green number) and enable the next button.
function stepDone(stepId, nextButtonId) {
  document.getElementById(stepId).classList.add("done");
  if (nextButtonId) document.getElementById(nextButtonId).disabled = false;
}

// The Google key is typed once and remembered by this browser.
function setupKeyField() {
  const field = $("#key");
  if (!field) return;
  try { field.value = localStorage.getItem("google-key") || ""; } catch {}
  field.addEventListener("change", () => {
    try { localStorage.setItem("google-key", field.value.trim()); } catch {}
  });
}
function googleKey() {
  const key = $("#key").value.trim();
  if (!key) throw new Error("Paste the Google key in step 0 first.");
  return key;
}

// An area is either four numbers from bboxfinder.com (lon_min,lat_min,lon_max,lat_max)
// or a place name, which we look up on OpenStreetMap.
async function readArea(text) {
  const numbers = text.replace(/\s/g, "").split(",").map(Number);
  if (numbers.length === 4 && numbers.every((n) => !Number.isNaN(n))) return numbers;
  const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + encodeURIComponent(text);
  const places = await (await fetch(url)).json();
  if (!places.length) throw new Error(`OpenStreetMap does not know "${text}". Try another name, or use bboxfinder.com.`);
  const [latMin, latMax, lonMin, lonMax] = places[0].boundingbox.map(Number);
  return [lonMin, latMin, lonMax, latMax];
}

// Size of an area in metres: [width, height]
function areaSize([lonMin, latMin, lonMax, latMax]) {
  return [(lonMax - lonMin) * 111320 * Math.cos((latMin * Math.PI) / 180), (latMax - latMin) * 110540];
}

// Load an image from another website so we can draw it on a canvas and save it.
// Gives up after `timeout` milliseconds, so a slow server never blocks the page forever.
function loadImage(src, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => { img.src = ""; reject(new Error("Too slow: " + src)); }, timeout);
    img.crossOrigin = "anonymous";
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); reject(new Error("Could not load " + src)); };
    img.src = src;
  });
}

// Canvas -> JPG file (quality 0.95 = high quality)
function canvasToJpg(canvas, quality = 0.95) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

// Ask the browser to save a file.
function saveFile(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

// Put many files into one .zip and save it. files = [{ name: "folder/file.jpg", data: Blob }]
async function saveZip(files, zipName, statusId) {
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f.data);
  const blob = await zip.generateAsync({ type: "blob" }, (meta) => {
    if (statusId) status(statusId, `Packing the zip... ${Math.round(meta.percent)}%`);
  });
  saveFile(blob, zipName);
}

// Run tasks with at most `limit` at the same time (polite to the servers, and faster than one by one).
async function runLimited(items, limit, task) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await task(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

// Wrap a button's work: disable it while running, show errors in its status line.
function onClick(buttonId, statusId, work) {
  const button = document.getElementById(buttonId);
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await work();
    } catch (err) {
      console.error(err);
      status(statusId, err.message || String(err), "error");
    }
    button.disabled = false;
  });
}

document.addEventListener("DOMContentLoaded", setupKeyField);
