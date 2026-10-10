/* Pocket GM save transfer — one backup file for every game's saves.
 *
 * Each game keeps a small slot index in localStorage and the save blobs in an
 * IndexedDB database with a single out-of-line-keyed "saves" store (hockey also
 * mirrors each blob into localStorage). A backup is all of that, as JSON:
 *
 *   { format: "pocketgm-saves", version: 1, created, source,
 *     localStorage: { key: value, ... },
 *     idb: { dbName: { key: value, ... }, ... } }
 *
 * Restoring MERGES — it never overwrites a save that is already here:
 *   - soccer/baseball slot ids are unique timestamps, so their entries are added
 *     and the slot-index arrays are merged by id;
 *   - hockey has three numbered slots, so an imported career moves to a free
 *     slot, and is skipped (and reported) if all three are taken.
 *
 * Plain script, no dependencies: the menu page loads it, and the old single-game
 * iOS apps inject it to export their saves before they're retired.
 */
(function () {
  const DBS = ["pgsoccer_db", "pgbaseball_db", "pgmh"];
  const STORE = "saves";
  // Hockey caches its Babel output under pgmh:build:<hash>; that's not a save.
  const isSaveKey = k =>
    (k.startsWith("pgsoccer_") || k.startsWith("pocketgm_") || k.startsWith("pgmh:")) &&
    !k.startsWith("pgmh:build:");

  function openDb(name) {
    return new Promise((res, rej) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }

  async function readDb(name) {
    const db = await openDb(name);
    try {
      return await new Promise((res, rej) => {
        const out = {};
        const tx = db.transaction(STORE, "readonly");
        const cur = tx.objectStore(STORE).openCursor();
        cur.onsuccess = () => {
          const c = cur.result;
          if (!c) return;
          out[c.key] = c.value;
          c.continue();
        };
        tx.oncomplete = () => res(out);
        tx.onerror = () => rej(tx.error);
      });
    } finally {
      db.close();
    }
  }

  async function writeDb(name, entries) {
    const db = await openDb(name);
    try {
      await new Promise((res, rej) => {
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);
        for (const [k, v] of Object.entries(entries)) store.put(v, k);
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
        tx.onabort = () => rej(tx.error || new Error("aborted"));
      });
    } finally {
      db.close();
    }
  }

  async function exportAll(source) {
    const ls = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && isSaveKey(k)) ls[k] = localStorage.getItem(k);
    }
    const idb = {};
    for (const name of DBS) {
      try {
        const entries = await readDb(name);
        if (Object.keys(entries).length) idb[name] = entries;
      } catch (e) { /* no IndexedDB here — localStorage is all there is */ }
    }
    return { format: "pocketgm-saves", version: 1, created: new Date().toISOString(), source: source || location.href, localStorage: ls, idb };
  }

  const readJson = (k, fallback) => {
    try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? fallback : v; } catch (e) { return fallback; }
  };

  /** Merge a backup in. Returns { soccer, baseball, hockey, skipped: [...] } counts. */
  async function importBackup(b) {
    if (!b || b.format !== "pocketgm-saves") throw new Error("That file isn't a Pocket GM saves backup.");
    const ls = b.localStorage || {};
    const idb = b.idb || {};
    const added = { soccer: 0, baseball: 0, hockey: 0, skipped: [] };

    // soccer + baseball: unique slot ids, so just add what isn't here yet.
    const idGames = [
      { game: "soccer", index: "pgsoccer_slots", prefix: "pgsoccer_slot_", db: "pgsoccer_db" },
      { game: "baseball", index: "pocketgm_slots", prefix: "pocketgm_slot_", db: "pgbaseball_db" },
    ];
    for (const g of idGames) {
      const mine = readJson(g.index, []);
      const theirs = Array.isArray(readJsonFrom(ls, g.index)) ? readJsonFrom(ls, g.index) : [];
      const have = new Set(mine.map(s => s.id));
      const fresh = theirs.filter(s => s && !have.has(s.id));
      const blobs = {};
      for (const s of fresh) {
        const key = g.prefix + s.id;
        if (idb[g.db] && key in idb[g.db]) blobs[key] = idb[g.db][key];
        else if (key in ls) blobs[key] = ls[key];
      }
      if (Object.keys(blobs).length) await writeDb(g.db, blobs);
      if (fresh.length) {
        localStorage.setItem(g.index, JSON.stringify(mine.concat(fresh)));
        added[g.game] += fresh.length;
      }
    }
    // baseball's pre-slots single save, if this device doesn't have one.
    if (ls.pocketgm_baseball_v2 && localStorage.getItem("pocketgm_baseball_v2") == null) {
      try { localStorage.setItem("pocketgm_baseball_v2", ls.pocketgm_baseball_v2); added.baseball++; } catch (e) {}
    }

    // hockey: three numbered slots; move each imported career to a free one.
    const hockeyBlob = slot => (idb.pgmh && idb.pgmh[`pgmh:slot${slot}`]) || ls[`pgmh:slot${slot}`];
    // A career already here with the same last-saved time is the same career.
    const free = [0, 1, 2].filter(s => localStorage.getItem(`pgmh:meta${s}`) == null);
    const savedAt = new Set([0, 1, 2].map(s => (readJson(`pgmh:meta${s}`, null) || {}).at).filter(Boolean));
    for (const s of [0, 1, 2]) {
      const meta = ls[`pgmh:meta${s}`];
      const blob = hockeyBlob(s);
      if (!meta || !blob) continue;
      if (savedAt.has((readJsonFrom(ls, `pgmh:meta${s}`) || {}).at)) continue;
      const to = free.shift();
      if (to == null) { added.skipped.push(`hockey: ${JSON.parse(meta).team || "a career"} (all three hockey slots are full)`); continue; }
      await writeDb("pgmh", { [`pgmh:slot${to}`]: blob });
      try { localStorage.setItem(`pgmh:slot${to}`, blob); } catch (e) { /* quota — IndexedDB carries it */ }
      localStorage.setItem(`pgmh:meta${to}`, meta);
      added.hockey++;
    }
    return added;
  }

  function readJsonFrom(obj, k) {
    try { return JSON.parse(obj[k]); } catch (e) { return null; }
  }

  window.PGMSaves = { exportAll, importBackup };
})();
