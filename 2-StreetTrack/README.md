# 2 · StreetTrack

Google's Street View cars have photographed every street around the Schlachthof, some of
them many times since 2010. We collect those photos, let a small AI model look for
**trucks** (or people, bicycles, dogs… you choose), and ask Street View for a new photo zoomed in
on everything it finds.

> After [James Bridle](https://jamesbridle.com/works/every-cctv-camera-cc), *Every CCTV Camera (CC)*:
> every CCTV camera on a walk around London's Congestion Charge Zone, from *The Nor*.
> Here the camera is Google's, and what we collect are the trucks.

**You get:**
- `zoom/`: a close-up photo of every find (JPG)
- `found/`: the original photos with each find marked in red
- `truck.csv` (named after what you looked for): a table with what, date, place and direction of every find, and a link that
  opens the spot in Google Maps (open it in Excel, Numbers or Google Sheets)

**You need:** the setup from the [main README](../README.md) and a Google key in `google-key.txt` ([how to get your own](../README.md#get-your-own-google-key)).

---

## Settings: `settings.js`

- `NAME`: a short name; your results go in `output/<NAME>/`
- `AREA`: a place name, or the **Box** numbers from [bboxfinder.com](https://bboxfinder.com).
  The default covers the streets around the Schlachthof (475 × 420 m).
- `SPACING`: we check for a panorama every `SPACING` metres. Smaller = more photos, slower.
- `LOOK_FOR`: what to look for, e.g. `["truck"]`, `["person"]` or `["truck", "bus", "car"]`.
  The AI model knows 80 kinds of things: the full list is in `settings.js`. Write them exactly like
  that (`"person"`, not `"people"`). After changing it you don't need to download the photos again:
  just run steps 3 and 4.
- `MIN_CONFIDENCE`: how sure the AI must be (`0.5` = 50%). Lower = more finds, but also more mistakes.

## The steps

In VS Code's terminal, go into the exercise folder once:

```
cd 2-StreetTrack
```

### Step 1: find the panoramas

```
node 1-find-panoramas.js
```

A **panorama** is one 360° photo from the Street View car. The script puts a point every
few metres over the area and asks Google where the nearest panorama is (these questions are
free). It prints how many it found and the months they were taken
(about 230 for the Schlachthof, from 2010 to today).

### Step 2: download the photos

```
node 2-download-photos.js
```

From every panorama we download 4 photos: looking north, east, south and west (640 × 640 px).
**Look at `output/<NAME>/photos/`.** If the step stops halfway, run it again: photos already
downloaded are skipped.

### Step 3: find what you're looking for

```
node 3-find-things.js
```

The AI model is called **COCO-SSD**. It was trained on thousands of labelled photos to
recognise 80 kinds of things ("person", "bicycle", "car", "dog"… and "truck") and runs right
here on your computer. The first time, it downloads the model (about 20 MB).
For every photo the model answers with a list of what it sees: what it is, how sure it is
(e.g. 83%) and a box around it. The script keeps only the things in `LOOK_FOR`. It checks every
photo (about 2 minutes for 900 photos) and saves the ones with a find in `output/<NAME>/found/`,
with each find marked in red.
**Look at them:** does it get it right? (Vans often count as trucks. Sometimes it's wrong.)

### Step 4: zoom in

```
node 4-zoom-in.js
```

For every find the script works out, with a bit of trigonometry, in which direction it is seen
from the car, and asks Street View for a new photo from the same spot, turned towards it, with a
narrow view. That's a real zoom, not a blurry enlargement.
**Open `output/<NAME>/zoom/`** and the `.csv` table (right-click → Reveal in Finder / File Explorer, then open it with Excel, Numbers or Google Sheets).

## Try

- Lower `MIN_CONFIDENCE` to `0.3`: what else does the model think is a truck?
- Change `LOOK_FOR` to `["person"]`, `["bicycle"]`, `["traffic light"]` or `["dog"]`, and run steps 3 and 4 again.
  (Google blurs faces in its own photos, but not always in photos shared by private users:
  don't publish photos where people can be recognised.)
- Another area: the train station, an industrial zone, your street.
- Look at the dates in `truck.csv`: which trucks come back year after year?

## How it works (if you're curious)

- `1-find-panoramas.js` … `4-zoom-in.js`: the steps. Read the `//` comments.
- `streetview.js`: the **Street View Static API** addresses (a photo = a panorama +
  a direction + a width of view), the trigonometry for the zoom, and drawing the red boxes.
- The model runs with TensorFlow.js. "wasm" (WebAssembly) makes it fast without
  installing anything else.

Street View imagery © Google. Class exercise only: don't publish the photos.
