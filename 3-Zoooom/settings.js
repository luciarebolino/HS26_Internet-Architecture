// ------------------------------------------------------------
//  SETTINGS: the only file you need to change for this exercise.
//  After a change: save the file (Cmd+S / Ctrl+S) and run the steps again from step 1.
// ------------------------------------------------------------

// A short name for this video. The results go in the folder output/<NAME>/
export const NAME = "zuerich-west";

// Which photos: one per day, every EVERY days, from FROM to TO, at about TIME.
// Photos before June 2022 only exist as small previews (blurry when zoomed).
export const FROM = "2022-06-15";
export const TO = "2026-09-27";
export const EVERY = 30;          // days: 1 = every day, 7 = every week, 30 = every month
export const TIME = "13:40";

// Frame A (where the zoom starts) and Frame B (where it ends), in pixels of the
// full panorama, which is 10240 x 2048: x and y of the top-left corner, and the width.
export const FRAME_A = { x: 5472, y: 0, width: 3056 };   // the city
export const FRAME_B = { x: 6818, y: 864, width: 220 };  // one far-away block

// The video
export const FRAMES_PER_PHOTO = 3;  // how long each photo stays on screen
export const FPS = 24;              // frames per second
export const DATE_ON_VIDEO = true;  // write the date in the corner
