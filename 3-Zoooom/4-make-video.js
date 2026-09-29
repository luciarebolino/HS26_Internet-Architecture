// STEP 4: glue the frames together into a video.
//
// We use ffmpeg, the tool behind most video software. It came with "npm install"
// (the ffmpeg-static package), so there is nothing else to install.
//
// Saves: output/<NAME>/zoooom.mp4

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";
import { outputFolder, stop } from "../lib/tools.js";
import { NAME, FPS } from "./settings.js";

const out = outputFolder(import.meta.url, NAME);
const frames = path.join(out, "frames");
if (!fs.existsSync(frames) || !fs.readdirSync(frames).length) stop("No frames yet: run step 3 (node 3-make-frames.js) first.");

const video = path.join(out, "zoooom.mp4");
execFileSync(ffmpeg, [
  "-y", "-loglevel", "error",
  "-framerate", String(FPS), "-i", path.join(frames, "%05d.jpg"),   // the frames, in order
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18",            // a normal MP4 that plays everywhere
  video,
]);
const count = fs.readdirSync(frames).length;
console.log(`Saved output/${NAME}/zoooom.mp4 (${count} frames, ${(count / FPS).toFixed(1)} seconds). Done!`);
