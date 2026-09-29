# Are.na Board

A shared board for an Are.na channel. Paste your channel's link: every block becomes a
square tile you can move, rotate, tilt in 3D, flip (its Are.na description is on the back)
and group into clusters. **Anyone with the board's link can rearrange it with you, live**, and
the blocks you add to the channel on Are.na appear on the board by themselves.

**Open it:** https://luciarebolino.github.io/HS26_Internet-Architecture/board/

---

## For students

1. **Make or open a channel on [Are.na](https://www.are.na)** and add blocks: images, links,
   text. On each block you can write a **description**: it will be on the back of its tile.
2. The channel must be **open** or **closed** (both are public), not private.
   You can check in the channel's settings on Are.na.
3. **Copy the channel's link** from the address bar, e.g. `https://www.are.na/your-name/your-channel`.
4. **Open the board** (link above), paste it and click **Open board**.
5. **Share the board:** click **Copy link** and send it to your group. Everyone who opens that link
   works on the same board.
6. **Keep adding blocks on Are.na:** the board checks every 30 seconds and puts new blocks in a
   column on the right.

### On the board

| Do this | To |
|---|---|
| drag a tile | move it (and every selected tile) |
| double-click a tile | flip it and read its description |
| ⟳ handle on top | rotate (Shift snaps to 15°) |
| ✥ handle, bottom-left (or Alt/Option + drag) | tilt it in 3D |
| ◢ handle, bottom-right | resize |
| Shift + click, or Shift + drag on the background | select several tiles |
| **Cluster** (or G) | group the selected tiles into a named frame |
| drag a cluster's title bar | move the cluster with its tiles; double-click the title to rename |
| Delete | remove a tile from the board (**Removed** brings it back) |
| **Undo** (Cmd/Ctrl + Z) | undo your last change |
| **Tidy up** | put all tiles back in a grid (for everyone; can be undone) |
| drag the background · pinch or Ctrl + scroll | move around · zoom |

Your zoom and position are only yours; the tiles and clusters are shared.

---

## Make the board shared (once, for the teacher)

Until this is done, the board works but saves only in each person's own browser (a yellow note
says so at the bottom). To share it, it needs a small free database: **Firebase Realtime Database**
by Google. No credit card needed. About 10 minutes.

1. **Create a Firebase project:** go to https://console.firebase.google.com, sign in with a Google
   account, click **Create a project** (or **Add project**), name it e.g. `hs26-board`, and continue.
   You can switch Google Analytics off. Click **Create project**.
2. **Create the database:** in the left menu, **Build → Realtime Database** → **Create Database**.
   Location: **Belgium (europe-west1)**. Choose **Start in locked mode** → **Enable**.
3. **Set who can read and write:** open the **Rules** tab, replace everything with this, and click **Publish**:

   ```json
   {
     "rules": {
       "boards": {
         "$board": {
           ".read": true,
           ".write": true,
           "tiles": { "$tile": { ".validate": "newData.hasChildren(['x', 'y', 's'])" } },
           "frames": { "$frame": { ".validate": "newData.hasChildren(['x', 'y', 'w', 'h'])" } }
         }
       }
     }
   }
   ```

   This lets anyone read and edit boards (that's the point: they're public, like the channels),
   and nothing else in the database.
4. **Get the settings for the web page:** click the gear ⚙ next to **Project Overview** →
   **Project settings** → under **Your apps**, click the **web** icon `</>`. Give it a nickname
   (e.g. `board`), leave "Firebase Hosting" unticked, click **Register app**. Google shows a block
   of code with `const firebaseConfig = { … }`. Copy what's between the `{ }`.
5. **Paste them into `board/firebase-config.js`,** replacing `null`:

   ```js
   const FIREBASE_CONFIG = {
     apiKey: "AIza...",
     authDomain: "hs26-board.firebaseapp.com",
     databaseURL: "https://hs26-board-default-rtdb.europe-west1.firebasedatabase.app",
     projectId: "hs26-board",
     storageBucket: "hs26-board.firebasestorage.app",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123",
   };
   ```

   If `databaseURL` is missing, copy it from the top of the **Realtime Database → Data** tab.
6. **Save and push** the file to GitHub. After a minute the board at the link above is shared:
   the yellow note disappears, and the top bar shows how many people are on the board.

**Good to know**
- The `apiKey` in that file is not a secret: every Firebase website shows it. What protects the
  database are the rules from step 3.
- The free plan allows 100 people connected at the same time, 1 GB of data and 10 GB of traffic a
  month: plenty for a class. (Boards only store positions; the images stay on Are.na.)
- Anyone with a board's link can change it. If someone messes it up: **Undo** only undoes your own
  changes, but **Tidy up** puts everything back in a grid. In Firebase, under **Realtime Database → Data**,
  you can also see and delete boards (`boards/<channel-name>`).

## How it works

- `index.html`, `style.css`: the page.
- `board.js`: loads the channel from the Are.na API (`api.are.na/v2`), checks it again every
  30 seconds, draws the tiles and clusters, and handles moving, rotating, flipping, clusters and undo.
- `store.js`: saves the board. With Firebase, every change is sent to the database and everyone
  connected receives it at once; without it, it's kept in the browser.
- `firebase-config.js`: your Firebase settings.
