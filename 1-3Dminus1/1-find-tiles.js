// STEP 1: find the 3D tiles over your area.
//
// Google's 3D city is cut into tiles arranged like a tree: the first tile is the
// whole planet, it splits into smaller tiles, which split again, down to pieces
// of about 50 metres. We start at the planet and only open the tiles near our area.
//
// Saves: output/<NAME>/tiles.json

import { readArea, areaSize, outputFolder, saveJson } from "../lib/tools.js";
import { API, google, withSession, touchesArea } from "./tiles.js";
import { NAME, AREA } from "./settings.js";

const out = outputFolder(import.meta.url, NAME);

// 1. Where is our area?
const area = await readArea(AREA);
const [width, height] = areaSize(area);
console.log(`Your area "${NAME}" is ${width.toFixed(0)} x ${height.toFixed(0)} metres.`);

// 2. Walk down the tree of tiles
const start = API + "/v1/3dtiles/root.json";
const toOpen = [{ tile: (await (await google(start)).json()).root, address: start }];
const tiles = [];
while (toOpen.length) {
  const { tile, address } = toOpen.pop();
  if (!touchesArea(tile.boundingVolume.box, area)) continue;   // not near our area: skip it
  const content = tile.content?.uri || "";
  if (content.includes(".json")) {                               // a link to more of the tree
    const next = new URL(content, address).toString();
    toOpen.push({ tile: (await (await google(next)).json()).root, address: next });
  } else if (tile.children) {                                    // it splits into smaller tiles
    tile.children.forEach((child) => toOpen.push({ tile: child, address }));
  } else if (content.includes(".glb")) {                         // the smallest tile: a 3D model
    tiles.push({ url: withSession(new URL(content, address).toString()), box: tile.boundingVolume.box });
    process.stdout.write(`\r  found ${tiles.length} tiles`);
  }
}

// 3. Save the list for the next step
saveJson(out, "area.json", { area });
saveJson(out, "tiles.json", tiles);
console.log(`\nFound ${tiles.length} tiles. Next: node 2-get-textures.js`);
