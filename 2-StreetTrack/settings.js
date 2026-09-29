// ------------------------------------------------------------
//  SETTINGS: the only file you need to change for this exercise.
//  After a change: save the file (Cmd+S / Ctrl+S) and run the steps again from step 1.
// ------------------------------------------------------------

// A short name for your area. The results go in the folder output/<NAME>/
export const NAME = "schlachthof";

// The area: a place name, or the "Box" numbers from https://bboxfinder.com
export const AREA = "8.5025,47.3828,8.5088,47.3866"; // the streets around the Schlachthof in Zürich

// We put a point every SPACING metres over the area and look for the nearest
// Street View panorama. Smaller = more panoramas (more photos, slower).
export const SPACING = 20;

// How sure the AI model must be that it sees a truck (0.5 = 50%).
export const MIN_CONFIDENCE = 0.5;
