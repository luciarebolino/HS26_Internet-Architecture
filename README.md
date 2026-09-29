# Internet Architecture: three scraping exercises

Three small experiments in collecting images from the internet, all around the
**Schlachthof** (the slaughterhouse) in Zürich West.

| | Exercise | What it does | You get | After |
|---|---|---|---|---|
| 1 | [**3Dminus1**](1-3Dminus1/) | Google's 3D city with the 3D taken away: only the flat textures, as if the buildings were smashed | a map made of textures + every texture named by its coordinates (JPG) | [Clement Valla](https://clementvalla.com/), *3D-Maps-Minus-3D* |
| 2 | [**StreetTrack**](2-StreetTrack/) | Street View photos of the streets around the Schlachthof, searched by an AI model for trucks | a zoomed-in photo of every truck (JPG) + a table of where and when | [James Bridle](https://jamesbridle.com/works/every-cctv-camera-cc), *Every CCTV Camera (CC)* |
| 3 | [**Zoooom**](3-Zoooom/) | a tourism webcam's hidden archive: years of photos, zooming from the whole city into one block | a video (MP4) + all its frames (JPG) | [Sam Lavigne](https://lav.io/projects/the-zooms/), *The Zooms* |

You don't need to know how to code. Each exercise is a short series of steps: you
type one command in the terminal, it does one thing, saves the result in a folder
and tells you what to do next.

---

## 1. Get ready (once)

You need two free programs:

1. **Visual Studio Code**, the editor where you'll do everything: https://code.visualstudio.com
2. **Node.js**, which runs JavaScript files on your computer: https://nodejs.org
   (click the big **LTS** button and install it like any other app)

## 2. Get this project

**Easiest:** on this project's GitHub page, click the green **Code** button → **Download ZIP**,
and unzip it somewhere you'll find it again (e.g. your Desktop).

If you know Git, you can `git clone` it instead.

## 3. Open it in VS Code

1. Open VS Code → **File → Open Folder…** → choose the folder you unzipped
   (it's called `internet-architecture-main` if you downloaded the ZIP). If VS Code asks
   "Do you trust the authors of the files in this folder?", click **Yes, I trust the authors**.
2. Open the terminal inside VS Code: **Terminal → New Terminal** (or press `` Ctrl+` ``).
   A panel opens at the bottom. That's where you type commands. The line where you type
   ends with the folder's name: that means you're in the right place.
3. Type this and press **Enter**. It downloads the few libraries the exercises use
   (images, the AI model, video). It takes a minute or two and only needs to be done once:

   ```
   npm install
   ```

## 4. Add the Google key (exercises 1 and 2)

Exercises 1 and 2 use Google's map services, which need a **key** (a kind of password).
Your teacher gives it to you.

1. In VS Code's file list (left), right-click in the empty space → **New File**.
2. Call it exactly `google-key.txt`, in the main folder (next to this README).
3. Paste the key in it and save (`Cmd+S` / `Ctrl+S`).

This file is listed in `.gitignore`, so it never gets uploaded to GitHub. Don't share it.

## 5. Run an exercise

Every exercise works the same way. For example, exercise 1:

```
cd 1-3Dminus1
node 1-find-tiles.js
node 2-get-textures.js
node 3-make-map.js
node 4-name-squares.js
```

- `cd 1-3Dminus1` means "go into the folder 1-3Dminus1". Do it once, then run the steps.
- Each `node …` line runs one step. Wait until it says **Next: …** before running the next one.
- Results appear in the exercise's **`output`** folder, visible in VS Code's file list.
  Click an image to see it. For the video, the table (`.csv`) or to see all images at once:
  right-click the file or folder → **Reveal in Finder** (Mac) / **Reveal in File Explorer** (Windows).
- To change the area, the dates, etc., open the exercise's **`settings.js`**, change it,
  save, and run the steps again from step 1.
- To go back to the main folder: `cd ..`

Each exercise has its own README with the steps explained:
[1-3Dminus1](1-3Dminus1/README.md) · [2-StreetTrack](2-StreetTrack/README.md) · [3-Zoooom](3-Zoooom/README.md)

> **Terminal tips.** Press the **up arrow** to get the previous command back.
> Press **Tab** to complete a file name. If something runs forever, press `Ctrl+C` to stop it.

---

## What's in this project

```
internet-architecture/
├── README.md            ← you are here
├── package.json         ← the list of libraries that "npm install" downloads
├── google-key.txt       ← your Google key (you create it; never uploaded)
├── lib/tools.js         ← small helpers shared by the exercises
├── 1-3Dminus1/          ← exercise 1: settings.js, the steps, README.md
├── 2-StreetTrack/       ← exercise 2
├── 3-Zoooom/            ← exercise 3
└── web/                 ← the same exercises as web pages (see below)
```

Inside each exercise, the files you run are numbered (`1-…js`, `2-…js`, …). Open them:
the grey lines starting with `//` explain what each part does. The files without a
number (`tiles.js`, `streetview.js`, `camera.js`) hold the technical details.

## Prefer clicking? The web version

The same three exercises also exist as web pages. Open
**https://luciarebolino.github.io/internet-architecture/web/** in **Google Chrome** and follow
the buttons: nothing to install, and results go to your Downloads folder. (They're also in the
[`web/`](web/) folder: double-click `web/index.html`.)

## When something goes wrong

| Message | What to do |
|---|---|
| `node: command not found` / `npm: command not found` / `'node' is not recognized` | install Node.js (part 1), then **quit VS Code completely and open it again** |
| Windows: `running scripts is disabled on this system` | in the terminal, click the **˅** next to the **+** and choose **Command Prompt**, then run the command again |
| `Cannot find module` / `Cannot find package` | run `npm install` in the main folder (part 3) |
| `Cannot find module '.../1-find-tiles.js'` | you are in the wrong folder: `cd` into the exercise first (`cd ..` goes back up) |
| `npm error enoent Could not read package.json` | you ran `npm install` in the wrong folder: open the main project folder in VS Code (part 3) |
| `No Google key` | create `google-key.txt` in the main folder (part 4) |
| `Missing output/...: run step X first` | run the steps in order |
| `SyntaxError` pointing at `settings.js` | a quote `"` or a comma is missing in what you changed |
| `Google said 403` | the key isn't valid, or the needed Google API isn't enabled (ask your teacher) |

The 3D tiles and Street View photos are © Google, the webcam photos © Zürich Tourismus / Roundshot.
They are for this class exercise only: the `output` folders are never uploaded (see `.gitignore`).
