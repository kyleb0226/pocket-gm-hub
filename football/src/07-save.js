
/* ----------------------------- saves ----------------------------- */
// Slot index in localStorage (pgfootball_slots); the worlds themselves in IndexedDB
// (pgfootball_db / store "saves" / key pgfootball_slot_<id>) because a world is several MB.
const SLOTS_KEY = "pgfootball_slots", DB_NAME = "pgfootball_db", slotKey = id => "pgfootball_slot_" + id;
function stripForSave(G){ const o = {}; for (const k in G) if (k[0] !== "_") o[k] = G[k]; return o; }
const listSlots = () => { try { return (JSON.parse(localStorage.getItem(SLOTS_KEY)) || []).sort((a, b) => b.ts - a.ts); } catch (e) { return []; } };
function openDb(){ return new Promise((res, rej) => { const r = indexedDB.open(DB_NAME, 1); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains("saves")) r.result.createObjectStore("saves"); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function idb(mode, fn){ const db = await openDb(); try { return await new Promise((res, rej) => { const tx = db.transaction("saves", mode), rq = fn(tx.objectStore("saves")); tx.oncomplete = () => res(rq && rq.result); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); }); } finally { db.close(); } }
async function saveGame(G){
  if (!G.slotId) G.slotId = Date.now().toString(36);
  const t = userTeam(G);
  await idb("readwrite", s => s.put(JSON.stringify(stripForSave(G)), slotKey(G.slotId)));
  const meta = { id: G.slotId, name: tname(t), abbr: t.abbr, c1: t.c1, c2: t.c2, mode: G.mode, coach: G.coach.name, year: G.year, week: G.week, phase: G.phase, rec: t.w + "-" + t.l, ts: Date.now() };
  localStorage.setItem(SLOTS_KEY, JSON.stringify([meta, ...listSlots().filter(s => s.id !== G.slotId)]));
}
async function loadSlot(id){ const raw = await idb("readonly", s => s.get(slotKey(id))); if (!raw) return null; const G = typeof raw === "string" ? JSON.parse(raw) : raw; return migrate(G); }
async function deleteSlot(id){ try { await idb("readwrite", s => s.delete(slotKey(id))); } catch (e) {} localStorage.setItem(SLOTS_KEY, JSON.stringify(listSlots().filter(s => s.id !== id))); }
// Add fields that older saves lack here, rather than changing the keys.
function migrate(G){ G.perks = G.perks || {}; if (G.ivLeft == null) G.ivLeft = 12; G.scouted = G.scouted || {}; G.pickOwn = G.pickOwn || {}; G.dc = G.dc || {}; G.pending = G.pending || []; G.events = G.events || []; G._pbp = {}; try { backfillVotes(G); } catch (e) {} return G; }
