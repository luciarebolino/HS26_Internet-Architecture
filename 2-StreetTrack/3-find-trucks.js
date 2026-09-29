// STEP 3: find the trucks in the photos.
//
// We use a small AI model called COCO-SSD. It was trained to recognise 80 kinds of
// things in photos ("person", "car", "dog", ... "truck") and runs right here on
// your computer. The first time it downloads the model (about 20 MB).
//
// Saves: output/<NAME>/found/  (photos with the truck marked in red)  and  trucks.json

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { Jimp } from "jimp";
import * as tf from "@tensorflow/tfjs";
import { setWasmPaths } from "@tensorflow/tfjs-backend-wasm";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import { outputFolder, loadJson, saveJson, progress } from "../lib/tools.js";
import { SIZE, drawBox } from "./streetview.js";
import { NAME, MIN_CONFIDENCE } from "./settings.js";

const out = outputFolder(import.meta.url, NAME);
const photos = loadJson(out, "photos.json", "step 2 (node 2-download-photos.js)");
fs.rmSync(path.join(out, "found"), { recursive: true, force: true });
fs.mkdirSync(path.join(out, "found"));

// 1. Start the AI model (WebAssembly makes it fast without installing anything else)
setWasmPaths(path.dirname(createRequire(import.meta.url).resolve("@tensorflow/tfjs-backend-wasm")) + "/");
await tf.setBackend("wasm");
console.log("Loading the AI model...");
const model = await cocoSsd.load({ base: "mobilenet_v2" });

// 2. Look at every photo
const trucks = [];
for (const [i, photo] of photos.entries()) {
  const image = await Jimp.read(path.join(out, "photos", photo.file));
  const pixels = tf.tensor3d(rgb(image), [image.height, image.width, 3], "int32");
  const seen = await model.detect(pixels, 20, MIN_CONFIDENCE);
  pixels.dispose();
  const found = seen
    .filter((d) => d.class === "truck" && d.bbox[2] >= 30)                        // trucks, not too tiny
    .filter((d) => !(d.bbox[1] + d.bbox[3] > SIZE - 10 && d.bbox[2] > SIZE * 0.6)); // not the photographer's own car roof
  for (const [k, d] of found.entries()) {
    const name = `${photo.pano.id}_${photo.heading}_${k + 1}`;
    const marked = image.clone();
    drawBox(marked, d.bbox);
    await marked.write(path.join(out, "found", `${name}.jpg`), { quality: 92 });
    trucks.push({ name, box: d.bbox, confidence: d.score, ...photo });
  }
  progress(i + 1, photos.length, `photos checked, ${trucks.length} trucks`);
}

saveJson(out, "trucks.json", trucks);
console.log(`Found ${trucks.length} trucks: output/${NAME}/found/. Next: node 4-zoom-in.js`);

// The model wants the colours as a list of numbers: red, green, blue, red, green, blue...
function rgb(image) {
  const { data } = image.bitmap, values = new Int32Array((data.length / 4) * 3);
  for (let i = 0, j = 0; i < data.length; i += 4) { values[j++] = data[i]; values[j++] = data[i + 1]; values[j++] = data[i + 2]; }
  return values;
}
