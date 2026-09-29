// Zoooom — travel through the Zürich West webcam archive while zooming in.
// Everything happens in this browser tab; nothing is installed.

// Found in the browser's Network tab while the myswitzerland.com page loads:
const ARCHIVE = "https://zuerichtourismus.roundshot.com/zuerichwest";
const FULL_W = 10240, FULL_H = 2048;   // size of one full panorama
const OUT_W = 1280, OUT_H = 720;       // size of the video
let days = [];                          // days that have photos, "YYYY-MM-DD"
let photos = [];                        // { date, time, base }

// ---------- STEP 1: the calendar ----------

onClick("b1", "st1", async () => {
  const calendar = await (await fetch(`${ARCHIVE}/archive_calendar.json`)).json();
  days = calendar.flatMap((y) => y.months.flatMap((m) => m.days.map((d) =>
    `${y.y}-${String(m.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`)));
  $("#from").min = $("#to").min = days[0];
  $("#from").max = $("#to").max = days.at(-1);
  $("#to").value = days.at(-1);
  status("st1", `The archive has photos on ${days.length} days, from ${days[0]} to ${days.at(-1)}. Go to step 2.`);
  stepDone("s1", "b2");
});

// ---------- STEP 2: one photo per chosen day ----------
// For each day the archive has a list of all photos ("slider feed").
// The address of a photo contains its date and time, e.g. .../2026-09-27/13-40-00/...

onClick("b2", "st2", async () => {
  const from = new Date($("#from").value), to = new Date($("#to").value), every = Number($("#every").value);
  const [hh, mm] = $("#time").value.split(":").map(Number);
  const available = new Set(days);
  const wanted = [];
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + every)) {
    const day = d.toISOString().slice(0, 10);
    if (available.has(day)) wanted.push(day);
  }
  if (wanted.length > 400) throw new Error(`That is ${wanted.length} photos: choose a shorter period or a longer step (max 400).`);
  photos = [];
  $("#g2").innerHTML = "";
  let done = 0;
  await runLimited(wanted, 4, async (day) => {
    const [y, m, d] = day.split("-").map(Number);
    const feed = await (await fetch(`${ARCHIVE}/archive_sliderfeed.json?year=${y}&month=${m}&day=${d}&range=d`)).json();
    let best = null, bestGap = Infinity;
    for (const entry of [...feed.slider_feed, ...feed.carou_feed]) {
      const url = entry.structure.thumbnail.url_full;                  // .../2026-09-27/13-40-00/..._thumbnail.jpg
      const [, time] = url.match(/\/\d{4}-\d\d-\d\d\/(\d\d-\d\d)-\d\d\//) || [];
      if (!time) continue;
      const [h, mi] = time.split("-").map(Number);
      const gap = Math.abs(h * 60 + mi - (hh * 60 + mm));
      if (gap < bestGap) { bestGap = gap; best = { date: day, time: time.replace("-", ":"), base: url.replace("_thumbnail.jpg", "") }; }
    }
    if (best) photos.push(best);
    progress("p2", ++done / wanted.length);
    status("st2", `${done} / ${wanted.length} days`);
  });
  photos.sort((a, b) => a.date.localeCompare(b.date));
  for (const p of photos.slice(0, 12)) {                                // show the first 12
    const fig = document.createElement("figure");
    fig.innerHTML = `<img src="${p.base}_thumbnail.jpg"><figcaption>${p.date} ${p.time}</figcaption>`;
    $("#g2").appendChild(fig);
  }
  status("st2", `Found ${photos.length} photos (showing the first 12). Go to step 3.`);
  stepDone("s2", "b3");
  stepDone("s2", "b4");
});

// ---------- loading a photo ----------
// Recent photos exist in full size, cut into 1024 x 1024 tiles, and in half size.
// Older ones moved to an archive server that only keeps the half size.
// Before mid-2022 only a small preview is left.

async function firstThatLoads(urls) {
  for (const url of urls) {
    try { return await loadImage(url); } catch {}
  }
  return null;
}

async function openPhoto(photo) {
  const archived = photo.base.replace("//storage4.", "//archive2.");
  const half = await firstThatLoads([`${photo.base}_half.jpg`, `${archived}_half.jpg`]);
  const small = half || await firstThatLoads([`${photo.base}_thumbnail.jpg`]);
  return { ...photo, picture: small, tiles: {}, hasTiles: undefined };
}

async function tile(photo, x, y) {
  const key = `${x}_${y}`;
  if (!(key in photo.tiles)) photo.tiles[key] = await firstThatLoads([`${photo.base}_full/${key}.jpg`]);
  return photo.tiles[key];
}

// Draw the part (sx, sy, w, h) of the panorama, in full-size coordinates, onto the canvas.
async function drawView(ctx, photo, sx, sy, w, h) {
  const zoomedIn = w / OUT_W < 1.6;                  // close up: the half-size photo is not sharp enough
  if (zoomedIn && photo.hasTiles !== false) {
    const first = await tile(photo, Math.floor(sx / 1024), Math.floor(sy / 1024));
    photo.hasTiles = Boolean(first);
    if (photo.hasTiles) {
      for (let ty = Math.floor(sy / 1024); ty <= Math.floor((sy + h - 1) / 1024); ty++) {
        for (let tx = Math.floor(sx / 1024); tx <= Math.floor((sx + w - 1) / 1024); tx++) {
          const img = await tile(photo, tx, ty);
          if (!img) continue;
          const ix = Math.max(sx, tx * 1024), iy = Math.max(sy, ty * 1024);
          const iw = Math.min(sx + w, tx * 1024 + 1024) - ix, ih = Math.min(sy + h, ty * 1024 + 1024) - iy;
          ctx.drawImage(img, ix - tx * 1024, iy - ty * 1024, iw, ih,
            ((ix - sx) / w) * OUT_W, ((iy - sy) / h) * OUT_H, (iw / w) * OUT_W, (ih / h) * OUT_H);
        }
      }
      return;
    }
  }
  const pic = photo.picture;                            // half size or small preview
  const kx = pic.naturalWidth / FULL_W, ky = pic.naturalHeight / FULL_H;
  ctx.drawImage(pic, sx * kx, sy * ky, w * kx, h * ky, 0, 0, OUT_W, OUT_H);
}

// ---------- STEP 3: show the two frames ----------

function frames() {
  const v = (id) => Number($("#" + id).value);
  const box = (x, y, w) => ({ x, y, w, h: (w * OUT_H) / OUT_W });        // same shape as the video
  return { A: box(v("ax"), v("ay"), v("aw")), B: box(v("bx"), v("by"), v("bw")) };
}

onClick("b3", "st3", async () => {
  status("st3", "Loading the first photo...");
  const photo = await openPhoto(photos[0]);
  if (!photo.picture) throw new Error("Could not load that photo.");
  const canvas = $("#framesPreview"), ctx = canvas.getContext("2d");
  canvas.width = 2048; canvas.height = 410;
  ctx.drawImage(photo.picture, 0, 0, canvas.width, canvas.height);
  const k = canvas.width / FULL_W, { A, B } = frames();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#fff"; ctx.strokeRect(A.x * k, A.y * k, A.w * k, A.h * k);
  ctx.strokeStyle = "#e61e28"; ctx.strokeRect(B.x * k - 3, B.y * k - 3, B.w * k + 6, B.h * k + 6);
  canvas.hidden = false;
  status("st3", `The whole panorama of ${photo.date} ${photo.time}. Go to step 4.`);
  stepDone("s3");
});

// ---------- STEP 4: render every frame and record an MP4 ----------
// The zoom is smooth because the width shrinks by the same factor every frame.

function viewAt(p, A, B) {
  const e = p * p * (3 - 2 * p);                                          // ease in and out
  const w = A.w * Math.pow(B.w / A.w, e);
  const t = (A.w - w) / (A.w - B.w || 1);                                 // how far we are, 0 -> 1
  const cx = A.x + A.w / 2 + (B.x + B.w / 2 - (A.x + A.w / 2)) * t;
  const cy = A.y + A.h / 2 + (B.y + B.h / 2 - (A.y + A.h / 2)) * t;
  const h = (w * OUT_H) / OUT_W;
  return { sx: cx - w / 2, sy: Math.max(0, Math.min(FULL_H - h, cy - h / 2)), w, h };
}

async function videoEncoder(fps, muxer) {
  if (!("VideoEncoder" in window)) throw new Error("This browser can't make videos: please use Chrome.");
  for (const codec of ["avc1.640028", "avc1.4d0028", "avc1.42001f"]) {
    const config = { codec, width: OUT_W, height: OUT_H, bitrate: 8_000_000, framerate: fps };
    if ((await VideoEncoder.isConfigSupported(config)).supported) {
      const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => console.error(e) });
      encoder.configure(config);
      return encoder;
    }
  }
  throw new Error("This browser can't make MP4 videos: please use Chrome.");
}

onClick("b4", "st4", async () => {
  const fps = Number($("#fps").value), perPhoto = Number($("#fpp").value), stamp = $("#stamp").value === "1";
  const { A, B } = frames();
  const total = photos.length * perPhoto;
  const screen = $("#screen"), ctx = screen.getContext("2d");
  screen.hidden = false;
  const muxer = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: "avc", width: OUT_W, height: OUT_H }, fastStart: "in-memory" });
  const encoder = await videoEncoder(fps, muxer);

  // Download photos ahead of time, 6 at once: older photos come from a slow archive server.
  const loading = [];
  const loadAhead = (upTo) => {
    for (let i = loading.length; i < Math.min(upTo, photos.length); i++) loading[i] = openPhoto(photos[i]);
  };
  const started = Date.now();
  let current = null;
  for (let f = 0; f < total; f++) {
    const index = Math.floor(f / perPhoto);
    if (!current || current.index !== index) {                            // time for the next photo
      loadAhead(index + 6);
      status("st4", `Frame ${f + 1} / ${total}: downloading photo ${index + 1} / ${photos.length}...`);
      current = { ...(await loading[index]), index };
      loading[index] = null;                                              // free the memory
    }
    const view = viewAt(total > 1 ? f / (total - 1) : 0, A, B);
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, OUT_W, OUT_H);
    if (current.picture) await drawView(ctx, current, view.sx, view.sy, view.w, view.h);
    if (stamp) {
      ctx.font = "bold 26px Arial, Helvetica, sans-serif";
      const label = `${current.date}  ${current.time}`;
      ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(24, OUT_H - 64, ctx.measureText(label).width + 28, 42);
      ctx.fillStyle = "#fff"; ctx.fillText(label, 38, OUT_H - 34);
    }
    const frame = new VideoFrame(screen, { timestamp: Math.round((f * 1e6) / fps), duration: Math.round(1e6 / fps) });
    encoder.encode(frame, { keyFrame: f % (fps * 2) === 0 });
    frame.close();
    while (encoder.encodeQueueSize > 8) await sleep(5);
    progress("p4", (f + 1) / total);
    const secondsLeft = ((Date.now() - started) / (f + 1)) * (total - f - 1) / 1000;
    status("st4", `Frame ${f + 1} / ${total}, photo ${current.date} ${current.time} · about ${Math.ceil(secondsLeft / 60)} min left`);
  }
  await encoder.flush();
  muxer.finalize();
  const video = new Blob([muxer.target.buffer], { type: "video/mp4" });
  saveFile(video, "Zoooom.mp4");                                          // goes to the Downloads folder
  // show the finished video on the page, in place of the recording screen
  const url = URL.createObjectURL(video);
  screen.hidden = true;
  $("#result").src = url;
  $("#result").hidden = false;
  $("#againLink").href = url;
  $("#again").hidden = false;
  status("st4", `Done: ${total} frames, ${(total / fps).toFixed(1)} seconds. Saved as Zoooom.mp4 in your Downloads folder, and playing below.`);
  stepDone("s4");
});
