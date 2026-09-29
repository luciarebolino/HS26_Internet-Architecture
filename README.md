# Internet Architecture: three scraping exercises

A workshop on the spatial practice of web scraping: automatically collecting and transforming digital material found online.

We will learn how to scrape large quantities of material from the internet and reassemble them into an investigative narrative and visual essay that tell the story of a site. Using a counter-forensic lens, we will critically select a dataset and reverse-engineer how its images and spatial representations were produced. We will then curate the scraped images, videos and text into a contemporary digital form on narrative "internet architecture".

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
   (it's called `HS26_Internet-Architecture-main` if you downloaded the ZIP). If VS Code asks
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
Lucia may give you one, or you can [make your own](#get-your-own-google-key) (about 5 minutes).
Exercise 3 needs no key.

1. In VS Code's file list (left), right-click in the empty space → **New File**.
2. Call it exactly `google-key.txt`, in the main folder (next to this README).
3. Paste the key in it and save (`Cmd+S` / `Ctrl+S`).

This file is listed in `.gitignore`, so it never gets uploaded to GitHub. Don't share it.

### Get your own Google key

You need a Google account and a credit or debit card. Google asks for a card even though
normal use of these exercises stays inside the free monthly allowance (see the costs below).

1. **Open Google Cloud.** Go to https://console.cloud.google.com and sign in with your Google
   account. The first time, accept the terms of service.
2. **Make a project** (a folder for your keys and settings): https://console.cloud.google.com/projectcreate
   Name it e.g. `internet-architecture` and click **Create**. Wait a few seconds, then check that
   your new project is selected in the menu at the top left of the page.
3. **Turn on billing:** https://console.cloud.google.com/billing
   Click **Link a billing account** (or **Create account**) and add your card. Without this,
   Google refuses the key.
4. **Switch on the two services** the exercises use. Open each link and click **Enable**:
   - **Map Tiles API** (3D tiles, exercise 1): https://console.cloud.google.com/apis/library/tile.googleapis.com
   - **Street View Static API** (exercise 2): https://console.cloud.google.com/apis/library/street-view-image-backend.googleapis.com
5. **Make the key:** https://console.cloud.google.com/apis/credentials
   Click **+ Create credentials** → **API key**. Copy the key that appears (it starts with `AIza`).
6. **Protect it (recommended).** On the same page, click the key's name. Under
   **API restrictions** choose **Restrict key**, tick **Map Tiles API** and **Street View Static API**,
   and click **Save**. Leave "Application restrictions" on **None**, or the scripts stop working.
7. **Set a budget alert (recommended),** so Google emails you before anything costs money:
   https://console.cloud.google.com/billing/budgets → **Create budget**, e.g. 5 CHF, alerts at 50% and 100%.
8. Paste the key into `google-key.txt` (above), or into the key box of the web version.

If you get `Google said 403` right after enabling the services, wait 5 minutes and try again:
it takes Google a moment to switch them on.

**What it costs.** Google gives a free allowance every month
([prices](https://developers.google.com/maps/billing-and-pricing/pricing), checked September 2026):

| Exercise | What counts | Free each month | After that |
|---|---|---|---|
| 1 · 3Dminus1 | one run of step 1 = 1 "Photorealistic 3D Tiles" session | 1,000 | $6 per 1,000 |
| 2 · StreetTrack | every photo downloaded (default area: about 970 per run) | 10,000 photos | $7 per 1,000 |
| 2 · StreetTrack, step 1 | looking up where the panoramas are | unlimited | free |

So exercise 1 is practically free, and exercise 2 is free for about 10 full runs a month with the
default area. Bigger areas or a smaller `SPACING` mean more photos.

Official guides, if you get stuck: [key for the Map Tiles API](https://developers.google.com/maps/documentation/tile/get-api-key) ·
[key for the Street View Static API](https://developers.google.com/maps/documentation/streetview/get-api-key)

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
HS26_Internet-Architecture/
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
**https://luciarebolino.github.io/HS26_Internet-Architecture/web/** in **Google Chrome** and follow
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
| `No Google key` | create `google-key.txt` in the main folder (part 4), or [make your own key](#get-your-own-google-key) |
| `Missing output/...: run step X first` | run the steps in order |
| `SyntaxError` pointing at `settings.js` | a quote `"` or a comma is missing in what you changed |
| `Google said 403` | the key isn't valid, billing isn't on, or the service isn't enabled: see [Get your own Google key](#get-your-own-google-key), steps 3 and 4 (after enabling, wait 5 minutes) |

The 3D tiles and Street View photos are © Google, the webcam photos © Zürich Tourismus / Roundshot.
They are for this class exercise only: the `output` folders are never uploaded (see `.gitignore`).
