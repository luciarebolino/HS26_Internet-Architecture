// Street View helpers for this exercise. You don't need to read this.

import { googleKey } from "../lib/tools.js";

export const SIZE = 640; // Street View photos are at most 640 x 640 pixels

// The address of a Street View photo: which panorama, which direction (heading,
// 0 = north, 90 = east), how wide the view is (fov, in degrees) and how far up or down (pitch).
export function photoUrl(pano, heading, fov = 90, pitch = 0, width = SIZE, height = SIZE) {
  return `https://maps.googleapis.com/maps/api/streetview?size=${width}x${height}&pano=${pano}` +
    `&heading=${heading}&fov=${fov}&pitch=${pitch}&return_error_code=true&key=${googleKey()}`;
}

export function metadataUrl(lat, lng, radius) {
  return `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}` +
    `&radius=${radius}&source=outdoor&key=${googleKey()}`;
}

// Where does a box in a photo point to? A 640 px photo with a 90° view has a
// "focal length" of 320 px: with a bit of trigonometry, pixels become degrees.
export function aimAt(photoHeading, [x, y, w, h]) {
  const focal = SIZE / 2 / Math.tan(Math.PI / 4);
  const dx = x + w / 2 - SIZE / 2, dy = y + h / 2 - SIZE / 2;
  const heading = (photoHeading + (Math.atan2(dx, focal) * 180) / Math.PI + 360) % 360;
  const pitch = (-Math.atan2(dy, Math.hypot(focal, dx)) * 180) / Math.PI;
  const width = (2 * Math.atan2(w / 2, focal) * 180) / Math.PI;     // how wide the truck looks, in degrees
  const fov = Math.max(10, Math.min(60, width * 1.4));               // zoom so the truck fills the photo
  return { heading, pitch, fov };
}

// Draw a red rectangle (4 px thick) on a Jimp image.
export function drawBox(image, [x, y, w, h]) {
  const red = 0xe61e28ff;
  for (let t = 0; t < 4; t++) {
    for (let i = Math.round(x); i < x + w; i++) {
      image.setPixelColor(red, i, Math.round(y) + t);
      image.setPixelColor(red, i, Math.min(image.height - 1, Math.round(y + h) - t));
    }
    for (let j = Math.round(y); j < y + h; j++) {
      image.setPixelColor(red, Math.round(x) + t, j);
      image.setPixelColor(red, Math.min(image.width - 1, Math.round(x + w) - t), j);
    }
  }
}
