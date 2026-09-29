// STEP 3: find the things you're looking for in the photos (trucks, unless you changed LOOK_FOR).
//
// We use a small AI model called COCO-SSD. It was trained on thousands of labelled
// photos to recognise 80 kinds of things ("person", "car", "dog", ... "truck") and
// runs right here on your computer. The first time it downloads the model (about 20 MB).
// For every photo it answers with a list of what it sees: what it is, how sure it is,
// and a box around it. We keep only the things in LOOK_FOR (see settings.js).
//
// Saves: output/<NAME>/found/  (photos with each find marked in red)  and  found.json

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { Jimp } from "jimp";
import * as tf from "@tensorflow/tfjs";
import { setWasmPaths } from "@tensorflow/tfjs-backend-wasm";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import { outputFolder, loadJson, saveJson, progress, stop } from "../lib/tools.js";
import { SIZE, THINGS, label, drawBox } from "./streetview.js";
import { NAME, LOOK_FOR, MIN_CONFIDENCE } from "./settings.js";

// 0. Check LOOK_FOR only contains things the model knows
const lookFor = [LOOK_FOR].flat();
const unknown = lookFor.filter((thing) => !THINGS.includes(thing));
if (unknown.length) stop(`The model doesn't know "${unknown.join('", "')}". Use names from the list in settings.js, e.g. "person" (not "people").`);

const out = outputFolder(import.meta.url, NAME);
const photos = loadJson(out, "photos.json", "step 2 (node 2-download-photos.js)");
fs.rmSync(path.join(out, "found"), { recursive: true, force: true });
fs.mkdirSync(path.join(out, "found"));

// 1. Start the AI model (WebAssembly makes it fast without installing anything else)
setWasmPaths(path.dirname(createRequire(import.meta.url).resolve("@tensorflow/tfjs-backend-wasm")) + "/");
await tf.setBackend("wasm");
console.log(`Loading the AI model... (looking for: ${lookFor.join(", ")})`);
const model = await cocoSsd.load({ base: "mobilenet_v2" });

// 2. Look at every photo
const found = [];
for (const [i, photo] of photos.entries()) {
  const image = await Jimp.read(path.join(out, "photos", photo.file));
  const pixels = tf.tensor3d(rgb(image), [image.height, image.width, 3], "int32");
  const seen = await model.detect(pixels, 20, MIN_CONFIDENCE);     // everything the model sees
  pixels.dispose();
  const keep = seen
    .filter((d) => lookFor.includes(d.class))                        // only what we're looking for
    .filter((d) => d.bbox[2] >= 20 && d.bbox[3] >= 20)               // not too tiny
    .filter((d) => !(d.bbox[1] + d.bbox[3] > SIZE - 10 && d.bbox[2] > SIZE * 0.6)); // not the photographer's own car roof
  for (const [k, d] of keep.entries()) {
    const name = `${photo.pano.id}_${photo.heading}_${k + 1}`;
    const marked = image.clone();
    drawBox(marked, d.bbox);
    await marked.write(path.join(out, "found", `${name}.jpg`), { quality: 92 });
    found.push({ name, what: d.class, box: d.bbox, confidence: d.score, ...photo });
  }
  progress(i + 1, photos.length, `photos checked, ${found.length} found`);
}

saveJson(out, "found.json", found);
saveJson(out, "found-what.json", { lookFor, label: label(lookFor) });
console.log(`Found ${found.length} (${lookFor.join(", ")}): output/${NAME}/found/. Next: node 4-zoom-in.js`);

// The model wants the colours as a list of numbers: red, green, blue, red, green, blue...
function rgb(image) {
  const { data } = image.bitmap, values = new Int32Array((data.length / 4) * 3);
  for (let i = 0, j = 0; i < data.length; i += 4) { values[j++] = data[i]; values[j++] = data[i + 1]; values[j++] = data[i + 2]; }
  return values;
}
