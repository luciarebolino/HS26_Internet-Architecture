// The webcam archive and the zoom maths. You don't need to read this.

import { FRAME_A, FRAME_B } from "./settings.js";

// Found in the browser's Network tab while the myswitzerland.com webcam page loads:
export const ARCHIVE = "https://zuerichtourismus.roundshot.com/zuerichwest";
export const FULL_W = 10240, FULL_H = 2048;   // a full panorama
export const OUT_W = 1280, OUT_H = 720;       // a video frame
export const TILE = 1024;                     // full panoramas are also cut into 1024 x 1024 tiles

// The two frames, with the same shape as the video (16:9)
const box = ({ x, y, width }) => ({ x, y, w: width, h: (width * OUT_H) / OUT_W });
export const A = box(FRAME_A), B = box(FRAME_B);

// Which part of the panorama to show at moment p (0 = start, 1 = end of the video).
// The width shrinks by the same factor every frame, so the zoom feels smooth.
export function viewAt(p) {
  const e = p * p * (3 - 2 * p);                                           // ease in and out
  const w = A.w * Math.pow(B.w / A.w, e);
  const t = (A.w - w) / (A.w - B.w || 1);                                  // how far we are, 0 -> 1
  const cx = A.x + A.w / 2 + (B.x + B.w / 2 - (A.x + A.w / 2)) * t;
  const cy = A.y + A.h / 2 + (B.y + B.h / 2 - (A.y + A.h / 2)) * t;
  const h = (w * OUT_H) / OUT_W;
  return { x: cx - w / 2, y: Math.max(0, Math.min(FULL_H - h, cy - h / 2)), w, h };
}

// Close up, the half-size photo is not sharp enough: we use the full-size tiles.
export const needsTiles = (view) => view.w / OUT_W < 1.6;

// The tiles (column, row) that cover a part of the panorama
export function tilesFor(view) {
  const list = [];
  for (let row = Math.floor(view.y / TILE); row <= Math.floor((view.y + view.h - 1) / TILE); row++) {
    for (let col = Math.floor(view.x / TILE); col <= Math.floor((view.x + view.w - 1) / TILE); col++) list.push([col, row]);
  }
  return list;
}
