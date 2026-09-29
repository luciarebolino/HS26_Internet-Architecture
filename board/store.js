// Where a board is saved.
//
// Shared (Firebase configured): everyone who opens the board reads and writes the
// same data, and sees each other's changes live.
// Local (no Firebase yet): saved in this browser only; other tabs of the same
// browser still update live, which is handy for testing.
//
// Both kinds offer the same few functions:
//   store.subscribe(fn)       fn(kind, id, data) for every tile/frame, now and on each change (data null = gone)
//   store.patch(paths)        write several things at once: { "tiles/123/x": 40, "frames/f1": null }
//   store.claim(kind, id, v)  write v only if nothing is there yet (so two people don't both place a new block)
//   store.onPeople(fn)        fn(number of people on the board right now)
//   store.ready()             resolves with the saved layout once it has arrived

function openStore(boardKey) {
  return typeof FIREBASE_CONFIG === "object" && FIREBASE_CONFIG ? firebaseStore(boardKey) : localStore(boardKey);
}

// ---------- shared: Firebase Realtime Database ----------

function firebaseStore(boardKey) {
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  const db = firebase.database();
  const ref = db.ref(`boards/${boardKey}`);

  // who is here: each open page adds itself to "online" and is removed when it closes
  const me = ref.child("online").push();
  db.ref(".info/connected").on("value", (snap) => {
    if (snap.val()) { me.onDisconnect().remove(); me.set(true); }
  });

  return {
    shared: true,
    ready() { return ref.once("value").then((snap) => snap.val() || {}); },
    subscribe(fn) {
      for (const kind of ["tiles", "frames"]) {
        const list = ref.child(kind);
        list.on("child_added", (s) => fn(kind, s.key, s.val()));
        list.on("child_changed", (s) => fn(kind, s.key, s.val()));
        list.on("child_removed", (s) => fn(kind, s.key, null));
      }
    },
    patch(paths) { return ref.update(paths); },
    claim(kind, id, value) { return ref.child(`${kind}/${id}`).transaction((now) => (now === null ? value : undefined)); },
    onPeople(fn) { ref.child("online").on("value", (s) => fn(s.numChildren())); },
  };
}

// ---------- local: this browser only ----------

function localStore(boardKey) {
  const key = `arena-board:${boardKey}`;
  let data = { tiles: {}, frames: {} };
  try { data = { ...data, ...JSON.parse(localStorage.getItem(key) || "{}") }; } catch {}
  const listeners = [];
  const channel = "BroadcastChannel" in window ? new BroadcastChannel(key) : null;

  function apply(paths, fromOtherTab) {
    const changed = new Set();
    for (const [path, value] of Object.entries(paths)) {
      const [kind, id, field] = path.split("/");
      data[kind] ||= {};
      if (field) {
        if (!data[kind][id]) continue;
        if (value === null) delete data[kind][id][field]; else data[kind][id][field] = value;
      } else if (value === null) delete data[kind][id];
      else data[kind][id] = structuredClone(value);
      changed.add(`${kind}/${id}`);
    }
    if (!fromOtherTab) {
      try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
      channel?.postMessage(paths);
    }
    for (const c of changed) {
      const [kind, id] = c.split("/");
      listeners.forEach((fn) => fn(kind, id, data[kind][id] ?? null));
    }
  }
  if (channel) channel.onmessage = (e) => apply(e.data, true);

  return {
    shared: false,
    ready() { return Promise.resolve(structuredClone(data)); },
    subscribe(fn) {
      listeners.push(fn);
      for (const kind of ["tiles", "frames"]) for (const [id, v] of Object.entries(data[kind] || {})) fn(kind, id, v);
    },
    patch(paths) { apply(paths, false); return Promise.resolve(); },
    claim(kind, id, value) { if (!data[kind]?.[id]) apply({ [`${kind}/${id}`]: value }, false); return Promise.resolve(); },
    onPeople(fn) { fn(1); },
  };
}
