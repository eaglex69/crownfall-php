'use client';
import { useEffect, useRef, useState } from 'react';
import CardArt from './CardArt';
import { parseArt } from '@/lib/cards';
import { draw } from '@/lib/battleRender';
import Icon from './Icon';
import { W, H, createSim, createBot, botTick, step, playCard, canDeployAt, pickBotDeck, hand, nextCard, type Sim, type BattleCard } from '@/lib/battleEngine';

type Reward = { trophies: number; gold: number; crowns: number; result: string };
type ChestDrop = { id: number; type: string; title: string };
type Hud = { left: number; elixir: number; hand: BattleCard[]; next?: BattleCard; crowns: [number, number] };
const STEP = 1 / 30;
const OPPONENTS = ['Страж арены', 'Тёмный лорд', 'Гроза башен', 'Королева льда', 'Мастер осады', 'Капитан Рык', 'Тень арены', 'Огненный Влад'];

export default function BattleView({ deck, allCards, level, elixirSec, duration, towerSkin, difficulty, opponentName, activeEmote, onFinish, onExit }: {
  deck: BattleCard[]; allCards: BattleCard[]; level: number; elixirSec: number; duration: number; towerSkin: string; difficulty?: string; opponentName?: string; activeEmote?: string;
  onFinish: (result: 'win' | 'loss' | 'draw', crowns: number, opponent: string, crownsLost?: number) => Promise<{ reward?: Reward; chest?: ChestDrop | null; error?: string }>;
  onExit: () => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null); const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Sim | null>(null); const selRef = useRef<number | null>(null); const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const viewRef = useRef({ scale: 1, ox: 0, oy: 0, cw: 1, ch: 1, dpr: 1 }); const doneRef = useRef(false); const hudNow = useRef<() => void>(() => {});
  const [opponent] = useState(() => OPPONENTS[Math.floor(Math.random() * OPPONENTS.length)]);
  const [hud, setHud] = useState<Hud>({ left: duration, elixir: 5, hand: [], crowns: [0, 0] });
  const [selected, setSelected] = useState<number | null>(null);
  const [msg, setMsg] = useState(''); const [outcome, setOutcome] = useState<{ result: 'win' | 'loss' | 'draw'; crowns: number } | null>(null);
  const [reward, setReward] = useState<Reward | null>(null); const [chestDrop, setChestDrop] = useState<ChestDrop | null>(null); const [rewardError, setRewardError] = useState('');
  const [activeBubble, setActiveBubble] = useState<string | null>(null);

  const flash = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(''), 1400); };
  const choose = (i: number | null) => { selRef.current = i; setSelected(i); };

  useEffect(() => {
    const diff = difficulty || 'Средне';
    const botElixirMultiplier = diff === 'Легко' ? 0.8 : diff === 'Сложно' ? 1.3 : diff === 'Безумие' ? 1.7 : 1.0;
    const botLvlOffset = diff === 'Легко' ? -1 : diff === 'Сложно' ? 2 : diff === 'Безумие' ? 4 : 0;
    const s = createSim({ deck0: deck, deck1: pickBotDeck(allCards.map((c) => ({ ...c })), Math.max(1, level + botLvlOffset)), elixirSec, duration, botElixirMultiplier });
    simRef.current = s; const bot = createBot(1);
    const imgs = new Map<string, HTMLImageElement>();
    const srcs = new Set<string>(['/images/units1_2.jpg']); [...s.queues[0], ...s.queues[1]].forEach((c) => srcs.add(parseArt(c.image).src));
    srcs.forEach((src) => { const im = new Image(); im.src = src; imgs.set(src, im); });
    const bg = new Image(); bg.src = '/images/arena.jpg';
    const canvas = canvasRef.current!; const stage = stageRef.current!; const ctx = canvas.getContext('2d')!;
    const resize = () => {
      const r = stage.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); canvas.style.width = r.width + 'px'; canvas.style.height = r.height + 'px';
      const scale = Math.min(r.width / W, r.height / H); viewRef.current = { scale, ox: (r.width - W * scale) / 2, oy: (r.height - H * scale) / 2, cw: r.width, ch: r.height, dpr };
    };
    resize(); const ro = new ResizeObserver(resize); ro.observe(stage);
    const snapshot = () => setHud({ left: Math.max(0, s.duration - s.t), elixir: s.elixir[0], hand: hand(s, 0), next: nextCard(s, 0), crowns: [s.crowns[0], s.crowns[1]] });
    hudNow.current = snapshot; snapshot();
    let raf = 0; let last = performance.now(); let acc = 0; let lastHud = 0; let cancelled = false;
    const loop = (now: number) => {
      if (cancelled) return;
      acc += Math.min(0.1, (now - last) / 1000); last = now;
      while (acc >= STEP) { if (!s.over) { botTick(s, bot, STEP); step(s, STEP); } acc -= STEP; }
      draw(ctx, s, viewRef.current, { sel: selRef.current !== null ? s.queues[0][selRef.current] ?? null : null, mouse: mouseRef.current }, imgs, bg, towerSkin);
      if (now - lastHud > 100) { lastHud = now; snapshot(); }
      if (s.over && !doneRef.current) {
        doneRef.current = true; snapshot(); const result = s.result || 'draw'; setOutcome({ result, crowns: s.crowns[0] });
        onFinish(result, s.crowns[0], opponent, s.crowns[1]).then((r) => { if (r.reward) setReward(r.reward); if (r.chest) setChestDrop(r.chest); if (r.error) setRewardError(r.error); }).catch(() => setRewardError('Не удалось сохранить результат боя.'));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const onKey = (e: KeyboardEvent) => { const n = Number(e.key); if (n >= 1 && n <= 4) choose(selRef.current === n - 1 ? null : n - 1); if (e.key === 'Escape') choose(null); };
    window.addEventListener('keydown', onKey);
    return () => { cancelled = true; cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('keydown', onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toWorld = (e: React.PointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(); const v = viewRef.current; return { x: (e.clientX - r.left - v.ox) / v.scale, y: (e.clientY - r.top - v.oy) / v.scale }; };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => { mouseRef.current = toWorld(e); };
  const onClick = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = simRef.current; const idx = selRef.current; const p = toWorld(e); mouseRef.current = p;
    if (!s || s.over || idx === null) return;
    const card = s.queues[0][idx]; if (!card) return;
    if (s.elixir[0] < card.cost) { flash('Не хватает эликсира'); return; }
    if (!canDeployAt(s, 0, card, p.x, p.y)) { flash('Сюда нельзя выставить карту'); return; }
    if (playCard(s, 0, idx, p.x, p.y)) { choose(null); hudNow.current(); }
  };
  const exit = async () => {
    const s = simRef.current;
    if (s && !s.over) {
      if (!window.confirm('Сдаться? Это засчитается как поражение.')) return;
      s.over = true; s.result = 'loss'; doneRef.current = true;
      try { await onFinish('loss', 0, opponent); } catch {}
    }
    onExit();
  };
  const mm = Math.floor(hud.left / 60); const ss = Math.floor(hud.left % 60);
  const title = outcome?.result === 'win' ? 'ПОБЕДА!' : outcome?.result === 'draw' ? 'НИЧЬЯ' : 'ПОРАЖЕНИЕ';

  return (
    <div className="battle-screen">
      <div className="battle-top">
        <div className="battle-vs"><span className="live-dot" /> <strong>Против: {opponent}</strong><small>Эликсир: 1 за {elixirSec.toFixed(1)} с</small></div>
        <div className="battle-score"><span className="crown-score blue">{hud.crowns[0]}</span><span className="battle-clock">{String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}</span><span className="crown-score red">{hud.crowns[1]}</span></div>
        <button className="close-btn" onClick={exit} aria-label="Выйти из боя">×</button>
      </div>
      <div className="battle-stage" ref={stageRef}>
        <canvas ref={canvasRef} onPointerMove={onMove} onPointerDown={onClick} onPointerLeave={() => { mouseRef.current = null; }} />
        {msg && <div className="battle-hint">{msg}</div>}
        {activeBubble && (
          <div className="battle-emote-bubble">
            <span className="emote-glow" />
            <Icon name="chat" size={24} />
            <strong>{activeBubble}</strong>
          </div>
        )}
        {!outcome && selected === null && hud.hand.length > 0 && hud.elixir < 10 && <div className="battle-tip">Выберите карту внизу, затем нажмите на поле</div>}
      </div>
      <div className="battle-controls">
        <div className="elixir-track"><span>ЭЛИКСИР</span><div className="elixir-bar"><i style={{ width: `${(hud.elixir / 10) * 100}%` }} />{Array.from({ length: 9 }, (_, i) => <b key={i} style={{ left: `${(i + 1) * 10}%` }} />)}</div><strong>{Math.floor(hud.elixir)}</strong></div>
        <div className="battle-hand">
          <div className="next-card">
            <small>Далее</small>
            {hud.next && <CardArt image={hud.next.image} alt={hud.next.name} />}
            {activeEmote && (
              <button className="battle-emote-trigger-btn" onClick={() => { setActiveBubble(activeEmote); setTimeout(() => setActiveBubble(null), 2500); }} title="Показать эмодзи">
                <Icon name="chat" size={16} />Эмодзи
              </button>
            )}
          </div>
          {hud.hand.map((c, i) => (
            <button key={c.id + '-' + i} className={'hand-card ' + c.rarity.toLowerCase() + (selected === i ? ' selected' : '') + (hud.elixir < c.cost ? ' dim' : '')} onClick={() => choose(selected === i ? null : i)} title={c.name}>
              <span className="card-cost">{c.cost}</span><CardArt image={c.image} alt={c.name} /><span className="hand-name">{c.name}</span>
            </button>
          ))}
        </div>
      </div>
      {outcome && (
        <div className="battle-result"><div className="result-box">
          <span className="eyebrow">БОЙ ЗАВЕРШЁН</span><h2>{title}</h2>
          <div className="result-crowns"><span className="crown-score blue">{outcome.crowns}</span><span>:</span><span className="crown-score red">{hud.crowns[1]}</span></div>
          <div className="result-reward">{reward ? `${reward.trophies > 0 ? '+' : ''}${reward.trophies} кубков  ·  +${reward.gold} золота` : rewardError || 'Начисляем награду...'}</div>
          {chestDrop&&<div className="battle-chest-drop"><img src="/images/chest.jpg" alt="Сундук за победу"/><div><strong>{chestDrop.title}</strong><small>Сундук добавлен в инвентарь</small></div></div>}
          <button className="btn btn-green" onClick={onExit}>{chestDrop?'Забрать сундук':'Вернуться в лобби'}</button>
        </div></div>
      )}
    </div>
  );
}
