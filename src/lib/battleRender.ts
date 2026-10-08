// Отрисовка боя на canvas (чистый код без React — легко тестировать).
import { parseArt } from '@/lib/cards';
import { W, H, RIVER_T, RIVER_B, BRIDGES, BRIDGE_HALF, canDeployAt, type Sim, type Ent, type BattleCard } from '@/lib/battleEngine';

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function drawArt(ctx: CanvasRenderingContext2D, imgs: Map<string, HTMLImageElement>, art: string, cx: number, cy: number, rad: number, square = false) {
  const { src, hue } = parseArt(art); const img = imgs.get(src);
  ctx.save();
  if (square) rr(ctx, cx - rad, cy - rad, rad * 2, rad * 2, rad * 0.25); else { ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); }
  ctx.clip();
  if (img && img.complete && img.naturalWidth) {
    const m = Math.min(img.naturalWidth, img.naturalHeight); const sx = (img.naturalWidth - m) / 2; const sy = (img.naturalHeight - m) * 0.3;
    if (hue) ctx.filter = `hue-rotate(${hue}deg)`;
    ctx.drawImage(img, sx, sy, m, m, cx - rad, cy - rad, rad * 2, rad * 2);
  } else { ctx.fillStyle = '#4a5a6a'; ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2); }
  ctx.restore();
}

function hpBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, frac: number, team: number) {
  ctx.fillStyle = 'rgba(10,14,22,.8)'; rr(ctx, x - w / 2 - 0.04, y - 0.04, w + 0.08, 0.2, 0.08); ctx.fill();
  ctx.fillStyle = team === 0 ? '#5fd6ff' : '#ff5c8a'; rr(ctx, x - w / 2, y, Math.max(0.02, w * Math.max(0, frac)), 0.13, 0.06); ctx.fill();
}

function drawTower(ctx: CanvasRenderingContext2D, e: Ent, skin: string) {
  const r = e.r; const x = e.x; const y = e.y; const blue = e.team === 0;
  const skinColors:Record<string,[string,string]>={
    'Башня аметистовой ночи':['#9c62ff','#4a218c'],
    'Башня ледяной крепости':['#59e4ff','#1871a5'],
    'Башня королевского золота':['#ffc83d','#9b5c0a'],
  };
  const ownColors=skinColors[skin];
  const col = blue ? (ownColors?.[0]||'#3d8cf0') : '#e8457a'; const colD = blue ? (ownColors?.[1]||'#1f4fa8') : '#8f1f4a';
  if (e.dead) {
    ctx.fillStyle = 'rgba(30,26,24,.55)'; ctx.beginPath(); ctx.ellipse(x, y + 0.2, r * 1.1, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6d675d'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(x + Math.cos(i * 1.7) * r * 0.7, y + Math.sin(i * 2.3) * r * 0.4 + 0.2, 0.2 + (i % 3) * 0.08, 0, Math.PI * 2); ctx.fill(); }
    return;
  }
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x + 0.2, y + r * 0.95, r * 1.05, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r); g.addColorStop(0, '#d4cebf'); g.addColorStop(1, '#8a8478');
  ctx.fillStyle = g; rr(ctx, x - r, y - r * 0.8, r * 2, r * 1.85, 0.25); ctx.fill(); ctx.strokeStyle = '#5c574e'; ctx.lineWidth = 0.08; ctx.stroke();
  ctx.fillStyle = '#a8a294'; for (let i = 0; i < 4; i++) ctx.fillRect(x - r + i * (r / 2) + 0.06, y - r * 0.8 - 0.26, r / 2 - 0.14, 0.3);
  ctx.fillStyle = col; rr(ctx, x - r * 0.72, y - r * 0.48, r * 1.44, r * 0.85, 0.15); ctx.fill(); ctx.strokeStyle = colD; ctx.lineWidth = 0.07; ctx.stroke();
  const cr = e.towerKind === 'king' ? r * 0.5 : r * 0.36; ctx.fillStyle = '#ffd45c'; ctx.beginPath();
  ctx.moveTo(x - cr, y + cr * 0.35); ctx.lineTo(x - cr, y - cr * 0.4); ctx.lineTo(x - cr * 0.5, y); ctx.lineTo(x, y - cr * 0.7); ctx.lineTo(x + cr * 0.5, y); ctx.lineTo(x + cr, y - cr * 0.4); ctx.lineTo(x + cr, y + cr * 0.35); ctx.closePath(); ctx.fill();
  if (e.towerKind === 'king' && !e.active) { ctx.fillStyle = 'rgba(20,24,40,.35)'; rr(ctx, x - r, y - r * 0.8, r * 2, r * 1.85, 0.25); ctx.fill(); }
  if (e.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${e.flash * 3})`; rr(ctx, x - r, y - r * 0.8, r * 2, r * 1.85, 0.25); ctx.fill(); }
  if (e.stunUntil > 0) { /* визуал заморозки рисуется в draw() */ }
  const w = e.towerKind === 'king' ? 3 : 2.4; hpBar(ctx, x, y - r - 0.6, w, e.hp / e.maxHp, e.team);
  ctx.font = 'bold 0.4px Arial'; ctx.textAlign = 'center'; ctx.lineWidth = 0.08; ctx.strokeStyle = '#0a121e'; ctx.fillStyle = '#fff';
  const txt = String(Math.max(0, Math.ceil(e.hp))); ctx.strokeText(txt, x, y - r - 0.75); ctx.fillText(txt, x, y - r - 0.75);
}

function drawUnit(ctx: CanvasRenderingContext2D, imgs: Map<string, HTMLImageElement>, e: Ent, t: number) {
  const deploying = t < e.spawnAt; const prog = deploying ? 1 - (e.spawnAt - t) / 1 : 1;
  const lift = e.flying ? 0.5 : 0;
  const lunge = e.range < 1.6 && e.cd > e.atkSpeed - 0.14 && e.atkSpeed > 0 ? 0.2 * e.face : 0;
  const x = e.x + lunge; const y = e.y - lift; const rad = e.r * 1.12 * (deploying ? 0.55 + 0.45 * Math.max(0, Math.min(1, prog)) : 1);
  ctx.save();
  const glow = ctx.createRadialGradient(e.x, e.y + e.r * 0.5, 0, e.x, e.y + e.r * 0.5, e.r * 1.6);
  glow.addColorStop(0, e.team === 0 ? 'rgba(80,200,255,.45)' : 'rgba(255,90,140,.45)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.5, e.r * 1.6, e.r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.72, e.r * 0.95, e.r * 0.38, 0, 0, Math.PI * 2); ctx.fill();
  if (deploying) ctx.globalAlpha = 0.6;
  if (e.flying) { // крылья
    const flap = Math.sin(t * 18 + e.id) * 0.3; ctx.fillStyle = e.team === 0 ? 'rgba(160,215,255,.8)' : 'rgba(255,170,150,.8)';
    ctx.beginPath(); ctx.ellipse(x - rad * 1.0, y - 0.05, rad * 0.75, rad * (0.35 + flap), -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + rad * 1.0, y - 0.05, rad * 0.75, rad * (0.35 + flap), 0.4, 0, Math.PI * 2); ctx.fill();
  }
  if (e.type === 'building') {
    drawArt(ctx, imgs, e.art, x, y, rad, true);
    ctx.strokeStyle = e.team === 0 ? '#66d4ff' : '#ff5c8a'; ctx.lineWidth = 0.16; rr(ctx, x - rad, y - rad, rad * 2, rad * 2, rad * 0.25); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 0.05; rr(ctx, x - rad + 0.1, y - rad + 0.1, rad * 2 - 0.2, rad * 2 - 0.2, rad * 0.2); ctx.stroke();
  } else {
    drawArt(ctx, imgs, e.art, x, y, rad);
    ctx.strokeStyle = e.team === 0 ? '#66d4ff' : '#ff5c8a'; ctx.lineWidth = 0.17; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.arc(x, y, rad - 0.1, 0, Math.PI * 2); ctx.stroke();
  }
  if (e.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.7, e.flash * 4)})`; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill(); }
  if (e.stunUntil > t) { ctx.fillStyle = 'rgba(170,230,255,.55)'; ctx.beginPath(); ctx.arc(x, y, rad + 0.05, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#e8fbff'; ctx.lineWidth = 0.08; ctx.stroke(); }
  else if (e.slowUntil > t) { ctx.strokeStyle = 'rgba(140,215,255,.95)'; ctx.setLineDash([0.18, 0.12]); ctx.lineWidth = 0.1; ctx.beginPath(); ctx.arc(x, y, rad + 0.12, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
  if (e.ability === 'berserk' && e.hp < e.maxHp * 0.5) { ctx.strokeStyle = 'rgba(255,80,60,.9)'; ctx.lineWidth = 0.09; ctx.beginPath(); ctx.arc(x, y, rad + 0.1, 0, Math.PI * 2); ctx.stroke(); }
  if (e.ability === 'charge' && e.charge >= 3) { ctx.strokeStyle = 'rgba(255,230,120,.95)'; ctx.lineWidth = 0.1; ctx.beginPath(); ctx.arc(x, y, rad + 0.1, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
  if (e.type === 'building') hpBar(ctx, x, y - rad - 0.35, rad * 2.2, e.hp / e.maxHp, e.team);
  else if (!deploying && e.hp < e.maxHp) hpBar(ctx, x, y - rad - 0.3, Math.max(0.9, rad * 2), e.hp / e.maxHp, e.team);
}

export function draw(ctx: CanvasRenderingContext2D, s: Sim, v: { scale: number; ox: number; oy: number; cw: number; ch: number; dpr: number }, ui: { sel: BattleCard | null; mouse: { x: number; y: number } | null }, imgs: Map<string, HTMLImageElement>, bg: HTMLImageElement | null, towerSkin = 'classic') {
  const { scale, ox, oy, cw, ch, dpr } = v;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const bgG = ctx.createLinearGradient(0, 0, 0, ch); bgG.addColorStop(0, '#2a0f4a'); bgG.addColorStop(1, '#0d1538'); ctx.fillStyle = bgG; ctx.fillRect(0, 0, cw, ch);
  if (bg && bg.complete && bg.naturalWidth) { ctx.globalAlpha = 0.4; const k = Math.max(cw / bg.naturalWidth, ch / bg.naturalHeight); ctx.drawImage(bg, (cw - bg.naturalWidth * k) / 2, (ch - bg.naturalHeight * k) / 2, bg.naturalWidth * k, bg.naturalHeight * k); ctx.globalAlpha = 1; }
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
  // трава
  for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) { ctx.fillStyle = (xx + yy) % 2 ? '#5f9d4e' : '#6aab56'; ctx.fillRect(xx, yy, 1.01, 1.01); }
  ctx.fillStyle = 'rgba(255,60,120,.10)'; ctx.fillRect(0, 0, W, RIVER_T); ctx.fillStyle = 'rgba(70,150,255,.10)'; ctx.fillRect(0, RIVER_B, W, H - RIVER_B);
  const edge = ctx.createLinearGradient(0, 0, W, 0); edge.addColorStop(0, 'rgba(120,40,200,.35)'); edge.addColorStop(0.15, 'rgba(0,0,0,0)'); edge.addColorStop(0.85, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(120,40,200,.35)'); ctx.fillStyle = edge; ctx.fillRect(0, 0, W, H);
  // дорожки
  ctx.fillStyle = '#cdb98a';
  for (const bx of BRIDGES) { ctx.fillRect(bx - 1.2, 4.6, 2.4, RIVER_T - 4.6); ctx.fillRect(bx - 1.2, RIVER_B, 2.4, 23.4 - RIVER_B); }
  ctx.fillRect(7, 1.2, 4, 2.6); ctx.fillRect(7, 24.2, 4, 2.6);
  // река
  const wg = ctx.createLinearGradient(0, RIVER_T, 0, RIVER_B); wg.addColorStop(0, '#5fd0ff'); wg.addColorStop(0.5, '#3a8ff0'); wg.addColorStop(1, '#6a5cf0');
  ctx.fillStyle = wg; ctx.fillRect(0, RIVER_T, W, RIVER_B - RIVER_T);
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 0.07;
  for (let i = 0; i < 12; i++) { const xx = (i * 1.7 + s.t * 0.9) % W; const yy = RIVER_T + 0.4 + ((i * 7) % 5) * 0.32; ctx.beginPath(); ctx.moveTo(xx, yy); ctx.quadraticCurveTo(xx + 0.4, yy - 0.18, xx + 0.8, yy); ctx.stroke(); }
  // мосты
  for (const bx of BRIDGES) {
    ctx.fillStyle = '#9b6a3a'; ctx.fillRect(bx - BRIDGE_HALF, RIVER_T - 0.25, BRIDGE_HALF * 2, RIVER_B - RIVER_T + 0.5);
    ctx.strokeStyle = '#6b4523'; ctx.lineWidth = 0.05; for (let k = 0; k <= 7; k++) { const yy = RIVER_T - 0.25 + k * ((RIVER_B - RIVER_T + 0.5) / 7); ctx.beginPath(); ctx.moveTo(bx - BRIDGE_HALF, yy); ctx.lineTo(bx + BRIDGE_HALF, yy); ctx.stroke(); }
    ctx.strokeStyle = '#4a2f16'; ctx.lineWidth = 0.14; ctx.beginPath(); ctx.moveTo(bx - BRIDGE_HALF, RIVER_T - 0.25); ctx.lineTo(bx - BRIDGE_HALF, RIVER_B + 0.25); ctx.moveTo(bx + BRIDGE_HALF, RIVER_T - 0.25); ctx.lineTo(bx + BRIDGE_HALF, RIVER_B + 0.25); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 0.06; ctx.strokeRect(0, 0, W, H);
  // зона выставления
  if (ui.sel && ui.sel.kind !== 'spell') {
    ctx.fillStyle = 'rgba(130,255,150,.15)'; ctx.fillRect(0, RIVER_B + 0.6, W, H - RIVER_B - 0.6);
    for (const lane of [0, 1]) { const p = s.ents.find((e) => e.type === 'tower' && e.team === 1 && e.towerKind === 'princess' && e.lane === lane); if (p?.dead) ctx.fillRect(lane === 0 ? 0 : W / 2, 8.5, W / 2, RIVER_T - 8.5); }
  }
  // зоны яда
  for (const z of s.zones) { ctx.fillStyle = 'rgba(110,230,80,.28)'; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(160,255,120,.7)'; ctx.lineWidth = 0.1; ctx.stroke(); for (let i = 0; i < 6; i++) { const a = i * 1.1 + s.t * 1.3; ctx.fillStyle = 'rgba(190,255,150,.6)'; ctx.beginPath(); ctx.arc(z.x + Math.cos(a) * z.r * 0.6, z.y + Math.sin(a * 1.3) * z.r * 0.6, 0.12, 0, Math.PI * 2); ctx.fill(); } }
  // башни и здания
  for (const e of s.ents) if (e.type === 'tower') { drawTower(ctx, e, e.team===0?towerSkin:'classic'); if (!e.dead && e.stunUntil > s.t) { ctx.fillStyle = 'rgba(170,230,255,.45)'; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 1.1, 0, Math.PI * 2); ctx.fill(); } }
  for (const e of s.ents) if (e.type === 'building' && !e.dead) drawUnit(ctx, imgs, e, s.t);
  // наземные юниты
  const ground = s.ents.filter((e) => e.type === 'troop' && !e.dead && !e.flying).sort((a, b) => a.y - b.y);
  for (const e of ground) drawUnit(ctx, imgs, e, s.t);
  // снаряды
  for (const p of s.projs) {
    if (p.style === 'arrow') { const a = Math.atan2(p.ty - p.y, p.tx - p.x); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a); ctx.strokeStyle = '#f5e7c0'; ctx.lineWidth = 0.1; ctx.beginPath(); ctx.moveTo(-0.45, 0); ctx.lineTo(0.2, 0); ctx.stroke(); ctx.fillStyle = '#d9d2c0'; ctx.beginPath(); ctx.moveTo(0.35, 0); ctx.lineTo(0.15, 0.12); ctx.lineTo(0.15, -0.12); ctx.fill(); ctx.restore(); }
    else { const col = p.style === 'ice' ? ['#e8fbff', '#6cc8ff'] : p.style === 'tower' ? ['#fff8c8', '#ffb73a'] : ['#fff1b0', '#ff7a1c']; const rad = p.style === 'tower' ? 0.2 : 0.3; const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad * 1.8); g.addColorStop(0, col[0]); g.addColorStop(0.5, col[1]); g.addColorStop(1, 'rgba(255,120,30,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, rad * 1.8, 0, Math.PI * 2); ctx.fill(); }
  }
  // летающие
  const air = s.ents.filter((e) => e.type === 'troop' && !e.dead && e.flying).sort((a, b) => a.y - b.y);
  for (const e of air) drawUnit(ctx, imgs, e, s.t);
  // эффекты
  for (const f of s.fx) {
    const k = (s.t - f.t0) / f.dur; if (k < 0 || k > 1) continue;
    if (f.kind === 'ring') { ctx.strokeStyle = f.col || '#fff'; ctx.globalAlpha = 1 - k; ctx.lineWidth = 0.16; ctx.beginPath(); ctx.arc(f.x, f.y, (f.r || 1) * (0.3 + 0.7 * k), 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = f.col || '#fff'; ctx.globalAlpha = (1 - k) * 0.18; ctx.fill(); ctx.globalAlpha = 1; }
    else if (f.kind === 'puff') { ctx.fillStyle = `rgba(90,80,70,${0.5 * (1 - k)})`; ctx.beginPath(); ctx.arc(f.x, f.y, (f.r || 1) * (0.6 + k), 0, Math.PI * 2); ctx.fill(); }
    else if (f.kind === 'bolt' && f.x2 !== undefined && f.y2 !== undefined) { ctx.strokeStyle = `rgba(190,245,255,${1 - k})`; ctx.lineWidth = 0.22; ctx.beginPath(); ctx.moveTo(f.x2, f.y2); const n = 6; for (let i = 1; i < n; i++) { const t2 = i / n; ctx.lineTo(f.x2 + (f.x - f.x2) * t2 + (Math.sin(i * 7 + f.t0 * 9) * 0.5), f.y2 + (f.y - f.y2) * t2); } ctx.lineTo(f.x, f.y); ctx.stroke(); }
    else if (f.kind === 'text') { ctx.globalAlpha = 1 - k * k; ctx.font = 'bold 0.55px Arial'; ctx.textAlign = 'center'; ctx.lineWidth = 0.1; ctx.strokeStyle = '#1a1208'; ctx.fillStyle = f.col || '#fff'; const yy = f.y - k * 1.2; ctx.strokeText(f.txt || '', f.x, yy); ctx.fillText(f.txt || '', f.x, yy); ctx.globalAlpha = 1; }
  }
  // курсор выставления
  if (ui.sel && ui.mouse) {
    const ok = canDeployAt(s, 0, ui.sel, ui.mouse.x, ui.mouse.y);
    if (ui.sel.kind === 'spell') { ctx.strokeStyle = 'rgba(255,230,140,.95)'; ctx.fillStyle = 'rgba(255,200,80,.18)'; ctx.lineWidth = 0.12; ctx.beginPath(); ctx.arc(ui.mouse.x, ui.mouse.y, ui.sel.splash, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    else { ctx.globalAlpha = 0.75; drawArt(ctx, imgs, ui.sel.image, ui.mouse.x, ui.mouse.y, 0.6, ui.sel.kind === 'building'); ctx.globalAlpha = 1; ctx.strokeStyle = ok ? 'rgba(120,255,140,.95)' : 'rgba(255,90,80,.95)'; ctx.lineWidth = 0.14; ctx.beginPath(); ctx.arc(ui.mouse.x, ui.mouse.y, 0.75, 0, Math.PI * 2); ctx.stroke(); }
  }
}

