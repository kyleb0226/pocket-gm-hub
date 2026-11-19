
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
// One-time repair: worlds built before Nov 2026 gave young drafted players a random 1-4 year deal.
// Anyone still on his draft team with no later signing gets what is left of a four-year rookie contract.
function fixRookieDeals(G){
  if (G.rcFix) return; G.rcFix = 1; const yr = G.year + (G.phase === "off" ? 1 : 0);
  proPlayers(G).forEach(p => {
    if (!p.draft || !p.c || p.c.tag || p.opt) return; const left = 4 - (yr - p.draft.y);
    if (left < 1 || left > 4 || p.c.yrs >= left || T(G, p.tid).abbr !== p.draft.t || p.tx.slice(p.tx.findIndex(x => /Drafted by/.test(x[1])) + 1).some(x => /Signed with|Re-signed|Traded/.test(x[1]))) return;
    p.c.yrs = left; delete p.expiring;
  });
}
// One-time repair: before Nov 2026 prestige had no anchor, so after a decade or two small-conference
// schools sat in the 90s and mid-table power-conference schools in the 40s. Pull every program the user
// doesn't coach halfway back to its historical level; the new drift rule does the rest.
function fixPrestige(G){ if (G.prFix) return; G.prFix = 1; G.col.forEach(t => { const b = basePrestige(t); if (!isUser(G, t.id) && Math.abs(t.prestige - b) > 8) t.prestige = round((b + (t.prestige - b) * .5) * 10) / 10; }); }
function migrate(G){ G.perks = G.perks || {}; if (G.ivLeft == null) G.ivLeft = 12; G.scouted = G.scouted || {}; G.pickOwn = G.pickOwn || {}; G.dc = G.dc || {}; G.pending = G.pending || []; G.events = G.events || []; G._pbp = {}; G.fac = G.fac || {}; if (G.fans == null) G.fans = 55; G.nego = G.nego || {}; if (G.coach && G.coach.sec == null) G.coach.sec = 62; try { fixRookieDeals(G); } catch (e) {} try { fixPrestige(G); } catch (e) {} try { rerateProLeague(G); } catch (e) {} try { backfillVotes(G); redoRookies(G); ensureStaff(G); if (G.awards && G.awards.pro) allStarGame(G); if (G.mode === "college" && G.phase === "off" && !G.nil) nilReset(G); } catch (e) {} return G; }
