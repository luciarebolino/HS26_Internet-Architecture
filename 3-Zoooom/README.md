# 3 · Zoooom

The **Zürich West webcam** on
[myswitzerland.com](https://www.myswitzerland.com/en-us/destinations/panoramas/zuerich-west/)
takes a 360° photo of the city every few minutes and keeps them all, back to 2016.
The website only shows one photo at a time. We read its archive directly, pick one
photo per day, and make a video that travels through time while zooming from
**Frame A** (the whole city) to **Frame B** (one far-away block).

> After [Sam Lavigne](https://lav.io/projects/the-zooms/), *The Zooms* (2023): every single
> zooming shot extracted from 600 hours of leaked police helicopter surveillance footage.

**You get:**
- `zoooom.mp4`: the video
- `frames/`: every frame of the video as a JPG
- `photos/`: the webcam photos that were used

**You need:** the setup from the [main README](../README.md). No key needed.

---

## How we found the archive

This is the real scraping part. The website doesn't say where its photos come from,
but your browser knows:

1. Open the webcam page in **Chrome**.
2. Open the developer tools: **View → Developer → Developer Tools** (or `Cmd+Option+I` / `F12`).
3. Click the **Network** tab, then reload the page.
4. Type `json` in the filter box. Among the files the page loads you'll see
   `archive_calendar.json` and `archive_sliderfeed.json`, from `zuerichtourismus.roundshot.com`.
   Click one to see what's inside: a list of dates, and addresses of photos.

The page is just a window onto that archive. Our scripts read the same files.
Each panorama is **10240 × 2048 pixels**, and its address contains its date and time:
`…/2026-09-27/13-40-00/2026-09-27-13-40-00_half.jpg`

---

## Settings: `settings.js`

- `NAME`: a short name; the results go in `output/<NAME>/`
- `FROM`, `TO`: the period, as `"YYYY-MM-DD"`
- `EVERY`: one photo every … days (`1` = every day, `7` = every week, `30` = every month)
- `TIME`: the time of day, e.g. `"13:40"` (the closest photo is used)
- `FRAME_A`, `FRAME_B`: where the zoom starts and ends, in pixels of the full panorama
  (`x`, `y` of the top-left corner, and the `width`). Frame B is a small block far away.
- `FRAMES_PER_PHOTO`, `FPS`: how long each photo stays on screen, frames per second
- `DATE_ON_VIDEO`: write the date in the corner (`true` / `false`)

**Good to know:** photos before June 2022 only exist as small previews, so the zoom gets
blurry there. Older photos also download slowly (a few seconds each): start with
`EVERY = 30` (about 50 photos, 4 minutes in total).

For a pure zoom on one moment: set `FROM` and `TO` to the same day and `FRAMES_PER_PHOTO = 120`.

## The steps

In VS Code's terminal, go into the exercise folder once:

```
cd 3-Zoooom
```

### Step 1: find the photos

```
node 1-find-photos.js
```

Reads the archive's calendar, then for each chosen day the list of that day's photos, and
keeps the one closest to `TIME`.

### Step 2: download them

```
node 2-download-photos.js
```

Downloads every photo at half size (5120 × 1024). For the photos at the end of the video,
where we zoom in close, it also downloads the full-size **tiles** around Frame B (the full
panorama is also cut into squares of 1024 × 1024, so we only take the pieces we need).
Takes a few minutes; if it stops, run it again and it continues where it left off.

### Step 3: make the frames

```
node 3-make-frames.js
```

Frame after frame, cuts a smaller and smaller piece out of the panorama, moving from A to B,
while the photos move forward in time. **Look at `output/<NAME>/frames/`.**

### Step 4: make the video

```
node 4-make-video.js
```

Glues the frames together with **ffmpeg** (the tool inside most video software, it came with
`npm install`). **Open `output/<NAME>/zoooom.mp4`**: right-click it → Reveal in Finder / File Explorer, and double-click it there.

## Try

- Every day for one month, at 20:00: the city at night, day after day.
- `TIME = "08:00"` over four years, `EVERY = 7`: seasons and weather.
- Find your own Frame B: open a photo from `photos/`, find a detail, and work out its
  position (the half-size photo is 5120 px wide, so multiply its pixels by 2).

## How it works (if you're curious)

- `1-find-photos.js` … `4-make-video.js`: the steps. Read the `//` comments.
- `camera.js`: the archive address, and the zoom maths. The width of the view shrinks by the
  same factor every frame, which is what makes a zoom feel smooth.

Webcam images © Zürich Tourismus / Roundshot. Class exercise only. Be polite to their server:
keep the number of photos reasonable.
