# 1 · 3Dminus1

Google's 3D map of the city is made of 3D shapes (the geometry of buildings, trees,
streets) wrapped in flat images called **textures**. We download the 3D map of an area,
throw the shapes away and keep only the textures, as if every building had been smashed
flat.

> After [Clement Valla](https://clementvalla.com/), *3D-Maps-Minus-3D*: Google Earth's 3D map
> shown with all the 3D removed, leaving only the flat texture images that normally wrap its
> buildings, roads and hills.

**You get:**
- `map.jpg`: a map of your area made only of textures, each laid where its piece of city stands
- `squares/`: every texture as a JPG, named after the coordinates of its block,
  e.g. `47.38523_8.50307.jpg` (latitude_longitude)

**You need:** the setup from the [main README](../README.md) and the Google key in `google-key.txt`.

---

## Choose your area: `settings.js`

Open `settings.js` and change:

- `NAME`: a short name; your results go in `output/<NAME>/`
- `AREA`: where. Either a **place name**, like `"Stadion Letzigrund, Zürich"`, or a
  **rectangle**: go to [bboxfinder.com](https://bboxfinder.com), zoom to your area, click
  the rectangle tool (top left of the map), draw a box, and copy the numbers from the
  **Box** field at the bottom.

Keep the quotes `" "` and the `;` at the end. Save. Keep areas small (a few hundred metres):
the default, the Schlachthof block, is 355 × 291 m and takes about 20 seconds.

## The steps

In VS Code's terminal, go into the exercise folder once:

```
cd 1-3Dminus1
```

Then run the four steps, one after the other:

### Step 1: find the 3D tiles

```
node 1-find-tiles.js
```

Google's 3D city is cut into **tiles**, arranged like a tree: the first tile is the whole
planet, it splits into smaller ones, which split again, down to pieces of about 50 m.
The script starts at the planet and only opens the tiles near your area.
It prints how many tiles it found (about 200 for the Schlachthof).

### Step 2: download the tiles, keep only the textures

```
node 2-get-textures.js
```

Each tile is a `.glb` file: a small 3D model plus the images wrapped around it. The script
downloads every tile, ignores the 3D model and saves the images.
**Look at `output/<NAME>/textures/`**: roofs, facades, trees and streets, cut into pieces and
packed together like a puzzle. Only the 3D model knew where each piece belonged.

### Step 3: smash the city flat

```
node 3-make-map.js
```

Each texture is pasted on a map at the spot where its tile stands.
**Open `output/<NAME>/map.jpg`.** You'll recognise almost nothing: flat textures without
their 3D shapes carry very little geography. The black areas are the empty parts of Google's
texture sheets.

### Step 4: name every texture after its place

```
node 4-name-squares.js
```

Every texture is copied into `output/<NAME>/squares/` and named after the centre of its tile.
Take a file name like `47.38523_8.50307.jpg`, type `47.38523, 8.50307` into Google Maps,
and you'll see the block it comes from. `_2`, `_3` at the end mean several textures share the
same spot (tiles are also stacked in height: street level, rooftops).

## Try

- Flatten another place: a stadium, a train station, your street. Change `AREA` and `NAME`,
  then run the steps again from step 1.
- Compare the textures of a park, a dense old town and a new neighbourhood.
- Why do the textures look sharper in some places than others? (Google's resolution isn't
  the same everywhere.)

## How it works (if you're curious)

- `1-find-tiles.js` … `4-name-squares.js`: the steps. Read the `//` comments.
- `tiles.js`: the technical part: talking to Google's **Map Tiles API**, converting the
  tiles' Earth-centred coordinates (x, y, z in metres from the centre of the Earth) into
  latitude and longitude, and opening `.glb` files.
- Each step saves a small `.json` file (a list) that the next step reads: that's how the
  steps pass work to each other.

The 3D tiles and textures are © Google and its data providers. Class exercise only: don't publish them.
