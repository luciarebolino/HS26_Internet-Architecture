// StreetTrack — find trucks in Google Street View around an area.
// Everything happens in this browser tab; nothing is installed.

const SV = "https://maps.googleapis.com/maps/api/streetview";
const SIZE = 640;                       // Street View gives at most 640 x 640 pixels
let panoramas = [];                     // { id, lat, lng, date }
let photos = [];                        // { pano, heading, blob }
let trucks = [];                        // { pano, heading, score, zoomBlob, foundBlob, ... }

// ---------- STEP 1: find the panoramas ----------
// The "metadata" request is free: it tells us where the nearest panorama is.

onClick("b1", "st1", async () => {
  const area = await readArea($("#area").value);
  const spacing = Number($("#spacing").value);
  const [w, h] = areaSize(area);
  const points = [];
  for (let y = 0; y <= h; y += spacing) {
    for (let x = 0; x <= w; x += spacing) {
      points.push([area[1] + (y / h) * (area[3] - area[1]), area[0] + (x / w) * (area[2] - area[0])]);
    }
  }
  status("st1", `Asking Google about ${points.length} points...`);
  const found = {};
  let done = 0;
  await runLimited(points, 8, async ([lat, lng]) => {
    const url = `${SV}/metadata?location=${lat},${lng}&radius=${spacing}&source=outdoor&key=${googleKey()}`;
    const meta = await (await fetch(url)).json();
    if (meta.status === "REQUEST_DENIED") throw new Error("Google refused the key: " + meta.error_message);
    if (meta.status === "OK") found[meta.pano_id] = { id: meta.pano_id, lat: meta.location.lat, lng: meta.location.lng, date: meta.date || "" };
    progress("p1", ++done / points.length);
  });
  panoramas = Object.values(found);
  const dates = [...new Set(panoramas.map((p) => p.date))].sort();
  status("st1", `Found ${panoramas.length} panoramas, taken in ${dates.join(", ")}. Go to step 2.`);
  stepDone("s1", "b2");
});

// ---------- STEP 2: download 4 photos per panorama ----------

function photoUrl(pano, heading, fov = 90, pitch = 0, width = SIZE, height = SIZE) {
  return `${SV}?size=${width}x${height}&pano=${pano}&heading=${heading}&fov=${fov}&pitch=${pitch}&return_error_code=true&key=${googleKey()}`;
}

onClick("b2", "st2", async () => {
  const jobs = panoramas.flatMap((pano) => [0, 90, 180, 270].map((heading) => ({ pano, heading })));
  photos = [];
  $("#g2").innerHTML = "";
  let done = 0;
  await runLimited(jobs, 6, async ({ pano, heading }) => {
    const response = await fetch(photoUrl(pano.id, heading));
    if (response.ok) {
      const blob = await response.blob();
      photos.push({ pano, heading, blob });
      if ($("#g2").children.length < 48) {                       // show the first 48
        const img = document.createElement("img");
        img.src = URL.createObjectURL(blob);
        $("#g2").appendChild(img);
      }
    }
    progress("p2", ++done / jobs.length);
    status("st2", `${done} / ${jobs.length} photos`);
  });
  status("st2", `Downloaded ${photos.length} photos (showing the first 48). Go to step 3.`);
  stepDone("s2", "b3");
});

// ---------- STEP 3: find trucks, then zoom in on each ----------

// Where in the panorama is a point of the photo? A photo with a 90° view is
// 640 px wide, so the camera's "focal length" is 320 px. With a bit of
// trigonometry we turn pixels into degrees (heading = left/right, pitch = up/down).
function aimAt(photo, [x, y, w, h]) {
  const focal = SIZE / 2 / Math.tan(Math.PI / 4);
  const dx = x + w / 2 - SIZE / 2, dy = y + h / 2 - SIZE / 2;
  const heading = (photo.heading + (Math.atan2(dx, focal) * 180) / Math.PI + 360) % 360;
  const pitch = (-Math.atan2(dy, Math.hypot(focal, dx)) * 180) / Math.PI;
  const width = (2 * Math.atan2(w / 2, focal) * 180) / Math.PI;       // how wide the truck looks, in degrees
  const fov = Math.max(10, Math.min(60, width * 1.4));                 // zoom so the truck fills the photo
  return { heading, pitch, fov };
}

onClick("b3", "st3", async () => {
  status("st3", "Loading the AI model (about 20 MB, only the first time)...");
  const model = await cocoSsd.load({ base: "mobilenet_v2" });
  const minScore = Number($("#minScore").value);
  trucks = [];
  $("#g3").innerHTML = "";
  for (const [i, photo] of photos.entries()) {
    const img = await createImageBitmap(photo.blob);
    const found = (await model.detect(img, 20, minScore))
      .filter((d) => d.class === "truck" && d.bbox[2] >= 30)              // trucks, not too tiny
      .filter((d) => !(d.bbox[1] + d.bbox[3] > SIZE - 10 && d.bbox[2] > SIZE * 0.6)); // not the photographer's own car roof
    for (const d of found) {
      const aim = aimAt(photo, d.bbox);
      const zoom = await fetch(photoUrl(photo.pano.id, aim.heading.toFixed(1), aim.fov.toFixed(1), aim.pitch.toFixed(1), 640, 480));
      if (!zoom.ok) continue;
      const zoomBlob = await zoom.blob();
      // the original photo with the truck marked in red
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = SIZE;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      ctx.strokeStyle = "#e61e28"; ctx.lineWidth = 4;
      ctx.strokeRect(...d.bbox);
      const truck = { ...aim, pano: photo.pano, score: d.score, zoomBlob, foundBlob: await canvasToJpg(canvas) };
      trucks.push(truck);
      const fig = document.createElement("figure");
      fig.innerHTML = `<img src="${URL.createObjectURL(zoomBlob)}"><figcaption>${Math.round(d.score * 100)}% · ${photo.pano.date} · ${photo.pano.lat.toFixed(5)}, ${photo.pano.lng.toFixed(5)}</figcaption>`;
      $("#g3").appendChild(fig);
    }
    progress("p3", (i + 1) / photos.length);
    status("st3", `Checked ${i + 1} / ${photos.length} photos, ${trucks.length} trucks so far`);
  }
  status("st3", `Found ${trucks.length} trucks in ${photos.length} photos. Go to step 4.`);
  stepDone("s3", "b4");
});

// ---------- STEP 4: save ----------

onClick("b4", "st4", async () => {
  const files = [];
  const rows = ["file,date,lat,lng,heading,pitch,zoom_fov,confidence,google_maps"];
  trucks.forEach((t, i) => {
    const name = `${String(i + 1).padStart(3, "0")}_${t.pano.date}_${t.pano.lat.toFixed(5)}_${t.pano.lng.toFixed(5)}`;
    files.push({ name: `zoom/${name}.jpg`, data: t.zoomBlob });
    files.push({ name: `found/${name}.jpg`, data: t.foundBlob });
    const link = `https://www.google.com/maps/@?api=1&map_action=pano&pano=${t.pano.id}&heading=${t.heading.toFixed(0)}&pitch=${t.pitch.toFixed(0)}&fov=${t.fov.toFixed(0)}`;
    rows.push([`${name}.jpg`, t.pano.date, t.pano.lat, t.pano.lng, t.heading.toFixed(1), t.pitch.toFixed(1), t.fov.toFixed(1), t.score.toFixed(2), link].join(","));
  });
  files.push({ name: "trucks.csv", data: new Blob([rows.join("\n")], { type: "text/csv" }) });
  await saveZip(files, "StreetTrack.zip", "st4");
  status("st4", `Saved StreetTrack.zip with ${trucks.length} trucks. Look in your Downloads folder.`);
  stepDone("s4");
});
