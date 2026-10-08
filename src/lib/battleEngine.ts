// Симулятор боя: чистая логика без зависимостей от React/DOM (можно тестировать в Node).
export const W = 18;
export const H = 28;
export const RIVER_T = 13;
export const RIVER_B = 15;
export const BRIDGES = [3.5, 14.5];
export const BRIDGE_HALF = 1.6;
export const DEPLOY_TIME = 0.9;
const SIGHT = 5.5;

export type Team = 0 | 1;
export interface BattleCard {
  id: number; name: string; image: string; rarity: string; cost: number; damage: number; health: number;
  kind: string; targets: string; speed: number; range: number; attackSpeed: number; count: number;
  splash: number; lifetime: number; ability: string; level: number;
}
export interface Ent {
  id: number; team: Team; type: 'troop' | 'building' | 'tower';
  name: string; art: string; x: number; y: number; r: number;
  hp: number; maxHp: number; dmg: number; atkSpeed: number; cd: number;
  range: number; minRange: number; speed: number;
  flying: boolean; targets: string; splash: number; ability: string;
  spawnAt: number; target: number | null; retargetAt: number;
  slowUntil: number; stunUntil: number; life: number;
  towerKind?: 'king' | 'princess'; active: boolean; lane: number;
  dead: boolean; flash: number; charge: number; spawnCd: number; level: number; face: number;
}
export interface Proj { id: number; team: Team; x: number; y: number; tid: number | null; tx: number; ty: number; dmg: number; splash: number; speed: number; style: string; slow: boolean; hitAir: boolean; done?: boolean }
export interface Fx { kind: 'ring' | 'text' | 'bolt' | 'puff'; x: number; y: number; t0: number; dur: number; r?: number; txt?: string; col?: string; x2?: number; y2?: number }
export interface Zone { x: number; y: number; r: number; until: number; nextTick: number; dmg: number; team: Team }
export interface Sim {
  t: number; duration: number; elixirSec: number; nextId: number;
  ents: Ent[]; projs: Proj[]; fx: Fx[]; zones: Zone[]; delayed: { t: number; run: () => void }[];
  elixir: [number, number]; queues: [BattleCard[], BattleCard[]];
  crowns: [number, number]; over: boolean; result: 'win' | 'loss' | 'draw' | null;
  botElixirMultiplier?: number;
}

export const levelMul = (level: number) => Math.pow(1.1, Math.max(0, level - 1));
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
function shuffle<T>(arr: T[]): T[] { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

const SKELETON: BattleCard = { id: -1, name: 'Скелет', image: '/images/units1_2.jpg', rarity: 'Обычная', cost: 0, damage: 45, health: 60, kind: 'ground', targets: 'ground', speed: 2.2, range: 0.4, attackSpeed: 1, count: 1, splash: 0, lifetime: 0, ability: '', level: 1 };

function blank(s: Sim, team: Team): Ent {
  return { id: s.nextId++, team, type: 'troop', name: '', art: '', x: 0, y: 0, r: 0.5, hp: 1, maxHp: 1, dmg: 0, atkSpeed: 1, cd: 0.4, range: 0.5, minRange: 0, speed: 0, flying: false, targets: 'ground', splash: 0, ability: '', spawnAt: 0, target: null, retargetAt: 0, slowUntil: 0, stunUntil: 0, life: Infinity, active: true, lane: 0, dead: false, flash: 0, charge: 0, spawnCd: 4, level: 1, face: 1 };
}

export function createSim(o: { deck0: BattleCard[]; deck1: BattleCard[]; elixirSec: number; duration: number; botElixirMultiplier?: number }): Sim {
  const s: Sim = { t: 0, duration: o.duration, elixirSec: Math.max(0.5, o.elixirSec), nextId: 1, ents: [], projs: [], fx: [], zones: [], delayed: [], elixir: [5, 5], queues: [shuffle(o.deck0), shuffle(o.deck1)], crowns: [0, 0], over: false, result: null, botElixirMultiplier: o.botElixirMultiplier || 1.0 };
  const tower = (team: Team, kind: 'king' | 'princess', x: number, y: number) => {
    const e = blank(s, team); const king = kind === 'king';
    Object.assign(e, { type: 'tower', name: king ? 'Королевская башня' : 'Башня', towerKind: kind, x, y, r: king ? 1.5 : 1.15, hp: king ? 2400 : 1400, maxHp: king ? 2400 : 1400, dmg: king ? 110 : 80, atkSpeed: king ? 1.0 : 0.8, range: king ? 6.5 : 6, targets: 'all', active: !king, lane: x < W / 2 ? 0 : 1, spawnAt: 0 });
    s.ents.push(e);
  };
  tower(1, 'king', 9, 2.4); tower(1, 'princess', 3.5, 5.6); tower(1, 'princess', 14.5, 5.6);
  tower(0, 'king', 9, 25.6); tower(0, 'princess', 3.5, 22.4); tower(0, 'princess', 14.5, 22.4);
  return s;
}

export function hand(s: Sim, team: Team) { return s.queues[team].slice(0, 4); }
export function nextCard(s: Sim, team: Team) { return s.queues[team][4]; }

export function canDeployAt(s: Sim, team: Team, card: BattleCard, x: number, y: number): boolean {
  if (x < 0.6 || x > W - 0.6 || y < 0.6 || y > H - 0.6) return false;
  if (card.kind === 'spell') return true;
  for (const e of s.ents) if (e.type === 'tower' && !e.dead && dist(e, { x, y }) < e.r + 0.55) return false;
  const own = team === 0 ? y >= RIVER_B + 0.6 : y <= RIVER_T - 0.6;
  if (own) return true;
  if (y > RIVER_T - 0.3 && y < RIVER_B + 0.3) return false;
  const lane = x < W / 2 ? 0 : 1;
  const enemyP = s.ents.find((e) => e.type === 'tower' && e.towerKind === 'princess' && e.team !== team && e.lane === lane);
  if (!enemyP || !enemyP.dead) return false;
  return team === 0 ? y >= 8.5 && y < RIVER_T : y <= H - 8.5 && y > RIVER_B;
}

function makeUnit(s: Sim, team: Team, card: BattleCard, x: number, y: number, delay: number): Ent {
  const mul = levelMul(card.level);
  const e = blank(s, team);
  const building = card.kind === 'building';
  const hp = card.health * mul;
  Object.assign(e, {
    type: building ? 'building' : 'troop', name: card.name, art: card.image, x, y,
    r: building ? 1.0 : card.count > 1 ? 0.46 : 0.62 + Math.min(0.5, card.health / 5000),
    hp, maxHp: hp, dmg: card.damage * mul, atkSpeed: card.attackSpeed, range: card.range, minRange: card.ability === 'artillery' ? 3 : 0,
    speed: building ? 0 : card.speed, flying: card.kind === 'air', targets: card.targets, splash: card.splash, ability: card.ability,
    spawnAt: s.t + delay, life: building ? Math.max(5, card.lifetime) : Infinity, level: card.level, cd: card.attackSpeed * 0.5,
    face: team === 0 ? 1 : -1, lane: x < W / 2 ? 0 : 1,
  });
  return e;
}

export function deployCard(s: Sim, team: Team, card: BattleCard, x: number, y: number) {
  if (card.kind === 'spell') { castSpell(s, team, card, x, y); return; }
  const n = Math.max(1, card.count);
  const delay = card.kind === 'building' ? 1.2 : DEPLOY_TIME;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const rad = n > 1 ? 0.55 : 0;
    s.ents.push(makeUnit(s, team, card, clamp(x + Math.cos(ang) * rad, 0.5, W - 0.5), y + Math.sin(ang) * rad, delay));
  }
  s.fx.push({ kind: 'ring', x, y, t0: s.t, dur: 0.7, r: 1.1, col: team === 0 ? '#58b8ff' : '#ff6a5a' });
}

export function playCard(s: Sim, team: Team, idx: number, x: number, y: number): boolean {
  if (s.over || idx < 0 || idx > 3) return false;
  const q = s.queues[team]; const card = q[idx];
  if (!card || s.elixir[team] < card.cost || !canDeployAt(s, team, card, x, y)) return false;
  s.elixir[team] -= card.cost;
  deployCard(s, team, card, x, y);
  q.splice(idx, 1); q.push(card);
  return true;
}

function later(s: Sim, sec: number, run: () => void) { s.delayed.push({ t: s.t + sec, run }); }

function castSpell(s: Sim, team: Team, card: BattleCard, x: number, y: number) {
  const dmg = card.damage * levelMul(card.level); const rad = card.splash;
  const foes = () => s.ents.filter((e) => !e.dead && e.team !== team);
  const hit = (e: Ent, d: number) => hurt(s, e, e.type === 'tower' ? d * 0.35 : d);
  const inside = (e: Ent) => dist(e, { x, y }) - e.r * 0.6 <= rad;
  if (card.ability === 'area') {
    s.fx.push({ kind: 'ring', x, y, t0: s.t, dur: 0.6, r: rad, col: '#ffcf70' });
    later(s, 0.6, () => { s.fx.push({ kind: 'ring', x, y, t0: s.t, dur: 0.5, r: rad, col: '#ff7a2a' }); foes().filter(inside).forEach((e) => hit(e, dmg)); });
  } else if (card.ability === 'bolt') {
    s.fx.push({ kind: 'ring', x, y, t0: s.t, dur: 0.5, r: rad, col: '#8fe8ff' });
    later(s, 0.5, () => {
      foes().filter(inside).sort((a, b) => b.hp - a.hp).slice(0, 3).forEach((e) => {
        s.fx.push({ kind: 'bolt', x: e.x, y: e.y, x2: e.x + (Math.random() - 0.5) * 2, y2: e.y - 9, t0: s.t, dur: 0.35 });
        hit(e, dmg); e.stunUntil = Math.max(e.stunUntil, s.t + 0.7);
      });
    });
  } else if (card.ability === 'freeze') {
    s.fx.push({ kind: 'ring', x, y, t0: s.t, dur: 0.5, r: rad, col: '#bfefff' });
    later(s, 0.4, () => { s.fx.push({ kind: 'ring', x, y, t0: s.t, dur: 0.9, r: rad, col: '#9fe4ff' }); foes().filter(inside).forEach((e) => { hit(e, dmg); e.stunUntil = Math.max(e.stunUntil, s.t + 4); }); });
  } else if (card.ability === 'poison') {
    s.fx.push({ kind: 'ring', x, y, t0: s.t, dur: 0.6, r: rad, col: '#8bff6a' });
    s.zones.push({ x, y, r: rad, until: s.t + 8, nextTick: s.t + 0.5, dmg: dmg * 0.5, team });
  }
}

function fxText(s: Sim, x: number, y: number, txt: string, col = '#fff') {
  if (s.fx.length > 70) return;
  s.fx.push({ kind: 'text', x, y, t0: s.t, dur: 0.8, txt, col });
}

export function hurt(s: Sim, e: Ent, d: number) {
  if (e.dead || d <= 0 || s.over) return;
  e.hp -= d; e.flash = 0.16;
  if (e.towerKind === 'king') e.active = true;
  if (e.type === 'tower' || d >= 250) fxText(s, e.x, e.y - e.r - 0.2, String(Math.round(d)), e.team === 0 ? '#ffd2d2' : '#fff6c0');
  if (e.hp <= 0) kill(s, e);
}

function splashDamage(s: Sim, team: Team, x: number, y: number, r: number, dmg: number, hitAir: boolean, skip: number | null, slow: boolean) {
  for (const o of s.ents.slice()) {
    if (o.dead || o.team === team || o.id === skip) continue;
    if (o.flying && !hitAir) continue;
    if (dist(o, { x, y }) - o.r * 0.6 <= r) { hurt(s, o, dmg); if (slow) o.slowUntil = s.t + 2; }
  }
}

function kill(s: Sim, e: Ent) {
  if (e.dead) return;
  e.dead = true; e.hp = 0;
  if (e.type === 'tower') {
    s.fx.push({ kind: 'puff', x: e.x, y: e.y, t0: s.t, dur: 1.2, r: e.r * 1.6 });
    if (e.towerKind === 'king') { s.crowns[(1 - e.team) as Team] = 3; finish(s); }
    else {
      s.crowns[(1 - e.team) as Team]++;
      const king = s.ents.find((k) => k.type === 'tower' && k.team === e.team && k.towerKind === 'king'); if (king) king.active = true;
    }
    return;
  }
  s.fx.push({ kind: 'puff', x: e.x, y: e.y, t0: s.t, dur: 0.5, r: e.r });
  if (e.ability === 'deathbomb') {
    s.fx.push({ kind: 'ring', x: e.x, y: e.y, t0: s.t, dur: 0.5, r: 2, col: '#ff8a3a' });
    splashDamage(s, e.team, e.x, e.y, 2, e.dmg * 0.8, true, null, false);
  }
}

export function finish(s: Sim) {
  if (s.over) return;
  s.over = true;
  const hp = (team: Team) => s.ents.filter((e) => e.type === 'tower' && e.team === team && !e.dead).reduce((a, e) => a + e.hp, 0);
  if (s.crowns[0] > s.crowns[1]) s.result = 'win';
  else if (s.crowns[0] < s.crowns[1]) s.result = 'loss';
  else { const a = hp(0), b = hp(1); s.result = a > b * 1.03 ? 'win' : b > a * 1.03 ? 'loss' : 'draw'; }
}

function canTarget(a: Ent, o: Ent) {
  if (o.flying && a.targets !== 'all') return false;
  if (a.targets === 'buildings' && o.type === 'troop') return false;
  return true;
}

function marchTower(s: Sim, e: Ent): Ent | null {
  const lane = e.x < W / 2 ? 0 : 1;
  const towers = s.ents.filter((o) => o.type === 'tower' && o.team !== e.team && !o.dead && canTarget(e, o));
  if (!towers.length) return null;
  const same = towers.find((o) => o.towerKind === 'princess' && o.lane === lane);
  if (same) return same;
  return towers.sort((a, b) => dist(a, e) - dist(b, e))[0];
}

function pickTarget(s: Sim, e: Ent): Ent | null {
  let best: Ent | null = null; let bd = Infinity;
  const fixed = e.type !== 'troop';
  const sight = Math.max(SIGHT, e.range + 0.5);
  for (const o of s.ents) {
    if (o.dead || o.team === e.team || !canTarget(e, o)) continue;
    const d = dist(e, o) - e.r - o.r;
    if (fixed) { if (d > e.range || d < e.minRange) continue; }
    else if (o.type === 'tower') continue;
    else if (d > sight) continue;
    if (d < bd) { bd = d; best = o; }
  }
  if (best || fixed) return best;
  return marchTower(s, e);
}

function onBridge(x: number) { return BRIDGES.some((b) => Math.abs(x - b) <= BRIDGE_HALF + 0.2); }

function waypoint(e: Ent, tx: number, ty: number): [number, number] {
  if (e.flying) return [tx, ty];
  const mid = (RIVER_T + RIVER_B) / 2;
  const inBand = e.y > RIVER_T - 0.3 && e.y < RIVER_B + 0.3;
  const south = e.y >= RIVER_B + 0.3; const north = e.y <= RIVER_T - 0.3;
  const targetNorth = ty < mid;
  const needs = inBand || (south && targetNorth) || (north && !targetNorth);
  if (!needs) return [tx, ty];
  const bx = inBand
    ? (Math.abs(e.x - BRIDGES[0]) < Math.abs(e.x - BRIDGES[1]) ? BRIDGES[0] : BRIDGES[1])
    : (Math.abs(e.x - BRIDGES[0]) + Math.abs(tx - BRIDGES[0]) <= Math.abs(e.x - BRIDGES[1]) + Math.abs(tx - BRIDGES[1]) ? BRIDGES[0] : BRIDGES[1]);
  const destY = targetNorth ? RIVER_T - 0.9 : RIVER_B + 0.9;
  if (inBand) return [bx, destY];
  if (Math.abs(e.x - bx) > 0.45) return [bx, south ? RIVER_B + 0.9 : RIVER_T - 0.9];
  return [bx, destY];
}

function moveToward(e: Ent, tx: number, ty: number, dt: number, mul: number) {
  const [wx, wy] = waypoint(e, tx, ty);
  const dx = wx - e.x, dy = wy - e.y; const d = Math.hypot(dx, dy);
  if (d < 1e-3) return;
  let sp = e.speed * mul; if (e.ability === 'charge' && e.charge >= 3) sp *= 2;
  const st = Math.min(d, sp * dt);
  e.x += (dx / d) * st; e.y += (dy / d) * st;
  if (Math.abs(dx) > 0.05) e.face = dx > 0 ? 1 : -1;
  if (e.ability === 'charge') e.charge += st;
}

function doAttack(s: Sim, e: Ent, t: Ent) {
  e.face = t.x >= e.x ? 1 : -1;
  e.cd = e.atkSpeed * (e.ability === 'berserk' && e.hp < e.maxHp * 0.5 ? 0.6 : 1);
  let dmg = e.dmg;
  if (e.ability === 'charge') { if (e.charge >= 3) dmg *= 2; e.charge = 0; }
  const hitAir = e.targets === 'all';
  if (e.range > 1.6 || e.type === 'tower') {
    const style = e.type === 'tower' ? 'tower' : e.ability === 'slow' ? 'ice' : e.splash > 0 ? 'fire' : 'arrow';
    s.projs.push({ id: s.nextId++, team: e.team, x: e.x, y: e.y, tid: t.id, tx: t.x, ty: t.y, dmg, splash: e.splash, speed: e.ability === 'artillery' ? 6 : e.type === 'tower' ? 12 : e.splash > 0 ? 8 : 11, style, slow: e.ability === 'slow', hitAir });
  } else {
    hurt(s, t, dmg);
    if (e.ability === 'slow') t.slowUntil = s.t + 2;
    if (e.splash > 0) splashDamage(s, e.team, t.x, t.y, e.splash, dmg, hitAir, t.id, e.ability === 'slow');
  }
}

function spawnSkeletons(s: Sim, e: Ent) {
  const dir = e.team === 0 ? -1 : 1;
  for (let i = 0; i < 2; i++) {
    const sk = makeUnit(s, e.team, { ...SKELETON, level: e.level }, clamp(e.x + (i ? 0.6 : -0.6), 0.5, W - 0.5), e.y + dir * 0.9 * (e.type === 'building' ? 1.2 : 0.8), 0.3);
    s.ents.push(sk);
  }
  s.fx.push({ kind: 'ring', x: e.x, y: e.y, t0: s.t, dur: 0.5, r: 1, col: '#c9ffb8' });
}

function updateEnt(s: Sim, e: Ent, dt: number) {
  if (s.t < e.spawnAt || e.stunUntil > s.t) return;
  if (e.type === 'building') { e.hp -= (e.maxHp / e.life) * dt; if (e.hp <= 0) { kill(s, e); return; } }
  if (e.ability === 'spawner') { e.spawnCd -= dt; if (e.spawnCd <= 0) { e.spawnCd = 5; spawnSkeletons(s, e); } }
  if (e.towerKind === 'king' && !e.active) return;
  e.cd -= dt;
  let t = e.target != null ? s.ents.find((o) => o.id === e.target) : undefined;
  if (t && (t.dead || !canTarget(e, t))) t = undefined;
  if (!t || s.t >= e.retargetAt) { t = pickTarget(s, e) || undefined; e.retargetAt = s.t + 0.35; }
  e.target = t ? t.id : null;
  if (!t) return;
  const d = dist(e, t) - e.r - t.r;
  if (e.dmg > 0 && d <= e.range && d >= e.minRange) { if (e.cd <= 0) doAttack(s, e, t); }
  else if (e.speed > 0) moveToward(e, t.x, t.y, dt, e.slowUntil > s.t ? 0.6 : 1);
}

function separate(s: Sim) {
  const L = s.ents.filter((e) => !e.dead);
  for (let i = 0; i < L.length; i++) {
    const a = L[i];
    for (let j = i + 1; j < L.length; j++) {
      const b = L[j];
      if (a.type !== 'troop' && b.type !== 'troop') continue;
      if (a.flying !== b.flying) continue;
      const minD = a.r + b.r - 0.06;
      let dx = b.x - a.x, dy = b.y - a.y; let d = Math.hypot(dx, dy);
      if (d >= minD) continue;
      if (d < 1e-3) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d = Math.hypot(dx, dy) || 1; }
      const inRiver = (a.y > RIVER_T - 1 && a.y < RIVER_B + 1) || (b.y > RIVER_T - 1 && b.y < RIVER_B + 1);
      const push = Math.min(inRiver ? 0.08 : 0.2, (minD - d) * (inRiver ? 0.5 : 1));
      const ma = a.type !== 'troop' ? Infinity : Math.sqrt(a.maxHp) + 10; const mb = b.type !== 'troop' ? Infinity : Math.sqrt(b.maxHp) + 10;
      const fa = ma === Infinity ? 0 : mb === Infinity ? 1 : mb / (ma + mb); const fb = mb === Infinity ? 0 : ma === Infinity ? 1 : ma / (ma + mb);
      const nx = dx / d, ny = dy / d;
      a.x -= nx * push * fa; a.y -= ny * push * fa; b.x += nx * push * fb; b.y += ny * push * fb;
    }
  }
  for (const e of L) {
    if (e.type !== 'troop') continue;
    e.x = clamp(e.x, 0.4, W - 0.4); e.y = clamp(e.y, 0.4, H - 0.4);
    if (!e.flying && e.y > RIVER_T && e.y < RIVER_B && !onBridge(e.x)) e.y = e.y - RIVER_T < RIVER_B - e.y ? RIVER_T : RIVER_B;
  }
}

function updateProjs(s: Sim, dt: number) {
  for (const p of s.projs) {
    const tgt = p.tid != null ? s.ents.find((o) => o.id === p.tid && !o.dead) : undefined;
    if (tgt) { p.tx = tgt.x; p.ty = tgt.y; }
    const dx = p.tx - p.x, dy = p.ty - p.y; const d = Math.hypot(dx, dy); const st = p.speed * dt;
    if (d <= st + 0.05) {
      p.done = true;
      if (tgt) { hurt(s, tgt, p.dmg); if (p.slow) tgt.slowUntil = s.t + 2; }
      if (p.splash > 0) { s.fx.push({ kind: 'ring', x: p.tx, y: p.ty, t0: s.t, dur: 0.35, r: p.splash, col: p.style === 'ice' ? '#a8e4ff' : '#ffb04a' }); splashDamage(s, p.team, p.tx, p.ty, p.splash, p.dmg, p.hitAir, tgt ? tgt.id : null, p.slow); }
    } else { p.x += (dx / d) * st; p.y += (dy / d) * st; }
  }
  s.projs = s.projs.filter((p) => !p.done);
}

export function step(s: Sim, dt: number) {
  if (s.over) return;
  s.t += dt;
  const botMul = s.botElixirMultiplier || 1.0;
  s.elixir[0] = Math.min(10, s.elixir[0] + dt / s.elixirSec);
  s.elixir[1] = Math.min(10, s.elixir[1] + (dt * botMul) / s.elixirSec);
  if (s.delayed.length) {
    const due = s.delayed.filter((d) => d.t <= s.t);
    if (due.length) { s.delayed = s.delayed.filter((d) => d.t > s.t); due.forEach((d) => d.run()); }
  }
  for (const z of s.zones) {
    if (s.t >= z.nextTick) { z.nextTick += 0.5; for (const e of s.ents.slice()) if (!e.dead && e.team !== z.team && dist(e, z) - e.r * 0.5 <= z.r) hurt(s, e, e.type === 'tower' ? z.dmg * 0.35 : z.dmg); }
  }
  s.zones = s.zones.filter((z) => z.until > s.t);
  for (const e of s.ents.slice()) { if (e.dead) continue; e.flash = Math.max(0, e.flash - dt); updateEnt(s, e, dt); if (s.over) return; }
  separate(s);
  updateProjs(s, dt);
  s.ents = s.ents.filter((e) => !e.dead || e.type === 'tower');
  s.fx = s.fx.filter((f) => s.t - f.t0 < f.dur);
  if (!s.over && s.t >= s.duration - 1e-6) finish(s);
}

// ---------------- ИИ противника ----------------
export interface Bot { team: Team; timer: number }
export function createBot(team: Team): Bot { return { team, timer: 3 + Math.random() * 2 }; }

function cluster(foes: Ent[], r: number) {
  let best = { x: 0, y: 0, count: 0, hp: 0 };
  for (const c of foes) {
    const near = foes.filter((o) => dist(o, c) <= r);
    const hp = near.reduce((a, o) => a + o.hp, 0);
    if (near.length > best.count || (near.length === best.count && hp > best.hp)) best = { x: c.x, y: c.y, count: near.length, hp };
  }
  return best;
}

export function botTick(s: Sim, bot: Bot, dt: number) {
  bot.timer -= dt;
  if (bot.timer > 0 || s.over) return;
  const team = bot.team; const enemy = (1 - team) as Team;
  const el = s.elixir[team];
  const options = hand(s, team).map((c, i) => ({ c, i })).filter((o) => o.c.cost <= el);
  bot.timer = 0.5 + Math.random() * 0.4;
  if (!options.length) return;
  const foes = s.ents.filter((e) => !e.dead && e.team === enemy && e.type === 'troop');
  const kingY = team === 1 ? 2.4 : 25.6;
  const near = (e: Ent) => (team === 1 ? e.y < RIVER_T + 4 : e.y > RIVER_B - 4);
  const threats = foes.filter(near).sort((a, b) => Math.abs(a.y - kingY) - Math.abs(b.y - kingY));
  for (const o of options.filter((q) => q.c.kind === 'spell')) {
    const cl = cluster(foes, o.c.splash);
    const ab = o.c.ability;
    const worth = ab === 'area' ? cl.count >= 3 || (cl.hp > 900 && el >= 8) : ab === 'bolt' ? cl.hp > 1700 : cl.count >= 3;
    if (worth && playCard(s, team, o.i, cl.x, cl.y)) { bot.timer = 1 + Math.random(); return; }
  }
  const units = options.filter((q) => q.c.kind !== 'spell');
  if (!units.length) return;
  if (threats.length) {
    const th = threats[0];
    const tHp = threats.reduce((a, o) => a + o.hp, 0);
    if (tHp < 220 && el < 9) return;
    const canHit = (c: BattleCard) => (c.targets !== 'buildings') && (c.targets === 'all' || !th.flying) && (c.kind !== 'building' || c.ability !== 'spawner');
    let pool = units.filter((o) => canHit(o.c)); if (!pool.length) pool = units;
    pool.sort((a, b) => (b.c.health * b.c.count + b.c.damage * b.c.count * 5) - (a.c.health * a.c.count + a.c.damage * a.c.count * 5));
    const o = pool[Math.floor(Math.random() * Math.min(2, pool.length))];
    let x = th.x; let y = team === 1 ? clamp(th.y - 2.5, 4, 11.5) : clamp(th.y + 2.5, 16.5, 24);
    if (o.c.kind === 'building') { x = W / 2 + (Math.random() < 0.5 ? -1.8 : 1.8); y = team === 1 ? 8.5 : 19.5; }
    if (playCard(s, team, o.i, x, y)) bot.timer = 0.9 + Math.random() * 0.7;
    return;
  }
  if (el < 6 + Math.random() * 2.5) return;
  const att = units.filter((o) => o.c.kind !== 'building' || Math.random() < 0.3);
  if (!att.length) return;
  const eP = s.ents.filter((e) => e.type === 'tower' && e.team === enemy && e.towerKind === 'princess');
  const hpOf = (lane: number) => { const t = eP.find((e) => e.lane === lane); return t && !t.dead ? t.hp : 0; };
  let lane = hpOf(0) < hpOf(1) ? 0 : 1; if (Math.random() < 0.4) lane = 1 - lane;
  const o = att[Math.floor(Math.random() * att.length)];
  const tank = o.c.health * o.c.count > 1300 || o.c.targets === 'buildings';
  let x = lane === 0 ? 3.5 : 14.5; let y = team === 1 ? (tank ? 8.6 : 8) : (tank ? 19.4 : 20);
  if (o.c.kind === 'building') { x = W / 2 + (Math.random() < 0.5 ? -1.8 : 1.8); y = team === 1 ? 8.5 : 19.5; }
  if (playCard(s, team, o.i, x, y)) bot.timer = 1.2 + Math.random() * 1.4;
}

export function pickBotDeck(all: BattleCard[], level: number): BattleCard[] {
  const pool = all.filter((c) => c.cost > 0);
  let best: BattleCard[] = [];
  for (let k = 0; k < 60; k++) {
    const d = shuffle(pool).slice(0, 8).map((c) => ({ ...c, level }));
    const avg = d.reduce((a, c) => a + c.cost, 0) / d.length;
    const spells = d.filter((c) => c.kind === 'spell').length; const bld = d.filter((c) => c.kind === 'building').length;
    const troops = d.filter((c) => c.kind === 'ground' || c.kind === 'air').length;
    best = d;
    if (avg >= 3.1 && avg <= 4.5 && spells <= 2 && bld <= 1 && troops >= 5) return d;
  }
  return best;
}
