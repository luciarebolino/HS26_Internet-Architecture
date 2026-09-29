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

// What to look for in the photos. One thing, or several in a list:
//   export const LOOK_FOR = ["truck"];
//   export const LOOK_FOR = ["person"];
//   export const LOOK_FOR = ["truck", "bus", "car"];
// After changing it, you don't need to download the photos again: run step 3 and step 4.
export const LOOK_FOR = ["truck"];
//
// The AI model knows these 80 things (write them exactly like this, in quotes):
//   person, bicycle, car, motorcycle, airplane, bus, train, truck, boat, traffic light,
//   fire hydrant, stop sign, parking meter, bench, bird, cat, dog, horse, sheep, cow,
//   elephant, bear, zebra, giraffe, backpack, umbrella, handbag, tie, suitcase, frisbee,
//   skis, snowboard, sports ball, kite, baseball bat, baseball glove, skateboard, surfboard,
//   tennis racket, bottle, wine glass, cup, fork, knife, spoon, bowl, banana, apple,
//   sandwich, orange, broccoli, carrot, hot dog, pizza, donut, cake, chair, couch,
//   potted plant, bed, dining table, toilet, tv, laptop, mouse, remote, keyboard,
//   cell phone, microwave, oven, toaster, sink, refrigerator, book, clock, vase,
//   scissors, teddy bear, hair drier, toothbrush

// How sure the AI model must be that it sees one of them (0.5 = 50%).
export const MIN_CONFIDENCE = 0.5;
