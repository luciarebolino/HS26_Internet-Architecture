// STEP 3: make the frames of the video.
//
// Frame after frame we cut a smaller and smaller piece out of the panorama,
// moving from Frame A to Frame B, while the photos move forward in time.
// Every frame is a 1280 x 720 JPG.
//
// Saves: output/<NAME>/frames/00001.jpg, 00002.jpg, ...

import fs from "node:fs";
import path from "node:path";
import { Jimp, loadFont } from "jimp";
import { SANS_32_WHITE } from "jimp/fonts";
import { outputFolder, loadJson, progress } from "../lib/tools.js";
import { viewAt, needsTiles, tilesFor, FULL_W, FULL_H, OUT_W, OUT_H, TILE } from "./camera.js";
import { NAME, FRAMES_PER_PHOTO, DATE_ON_VIDEO } from "./settings.js";

const out = outputFolder(import.meta.url, NAME);
const photos = loadJson(out, "photos.json", "step 1 (node 1-find-photos.js)");
const photoFolder = path.join(out, "photos"), frameFolder = path.join(out, "frames");
fs.rmSync(frameFolder, { recursive: true, force: true });
fs.mkdirSync(frameFolder);
const font = await loadFont(SANS_32_WHITE);
const open = async (file) => (fs.existsSync(path.join(photoFolder, file)) ? Jimp.read(path.join(photoFolder, file)) : null);

const total = photos.length * FRAMES_PER_PHOTO;
let photo = null, picture = null, tiles = {};
for (let f = 0; f < total; f++) {
  // 1. The photo for this frame (open it once, use it for several frames)
  const index = Math.floor(f / FRAMES_PER_PHOTO);
  if (photo !== photos[index]) {
    photo = photos[index];
    const id = `${photo.date}_${photo.time.replace(":", "-")}`;
    picture = (await open(`${id}_half.jpg`)) || (await open(`${id}_small.jpg`));
    tiles = { id };
  }

  // 2. The part of the panorama to show, cut out and resized to 1280 x 720
  const view = viewAt(total > 1 ? f / (total - 1) : 0);
  const frame = new Jimp({ width: OUT_W, height: OUT_H, color: 0x000000ff });
  const tileList = needsTiles(view) ? tilesFor(view) : [];
  const haveTiles = tileList.length && fs.existsSync(path.join(photoFolder, `${tiles.id}_tile_${tileList[0].join("_")}.jpg`));
  if (haveTiles) {                                                   // close up: sharp full-size tiles
    for (const [col, row] of tileList) {
      const key = `${col}_${row}`;
      tiles[key] ||= await open(`${tiles.id}_tile_${key}.jpg`);
      if (!tiles[key]) continue;
      const x0 = Math.max(view.x, col * TILE), y0 = Math.max(view.y, row * TILE);
      const x1 = Math.min(view.x + view.w, col * TILE + TILE), y1 = Math.min(view.y + view.h, row * TILE + TILE);
      const piece = tiles[key].clone().crop({ x: Math.round(x0 - col * TILE), y: Math.round(y0 - row * TILE), w: Math.round(x1 - x0), h: Math.round(y1 - y0) });
      piece.resize({ w: Math.ceil(((x1 - x0) / view.w) * OUT_W), h: Math.ceil(((y1 - y0) / view.h) * OUT_H) });
      frame.composite(piece, Math.floor(((x0 - view.x) / view.w) * OUT_W), Math.floor(((y0 - view.y) / view.h) * OUT_H));
    }
  } else if (picture) {                                              // further away: the half-size photo
    const kx = picture.width / FULL_W, ky = picture.height / FULL_H;
    const piece = picture.clone().crop({ x: Math.round(view.x * kx), y: Math.round(view.y * ky), w: Math.max(1, Math.round(view.w * kx)), h: Math.max(1, Math.round(view.h * ky)) });
    frame.composite(piece.resize({ w: OUT_W, h: OUT_H }), 0, 0);
  }

  // 3. The date in the corner
  if (DATE_ON_VIDEO) {
    frame.composite(new Jimp({ width: 312, height: 50, color: 0x00000099 }), 24, OUT_H - 74);
    frame.print({ font, x: 38, y: OUT_H - 67, text: `${photo.date}  ${photo.time}` });
  }
  await frame.write(path.join(frameFolder, `${String(f + 1).padStart(5, "0")}.jpg`), { quality: 92 });
  progress(f + 1, total, `frames (photo ${photo.date})`);
}
console.log(`Saved ${total} frames in output/${NAME}/frames/. Next: node 4-make-video.js`);
