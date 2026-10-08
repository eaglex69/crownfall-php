'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, getToken } from '@/lib/clientFetch';
import CardArt from './CardArt';
import { donateReward } from '@/lib/cards';

type Msg = { id: number; body: string; createdAt: string; userId: number; username: string; role?: string; kind: string; requestId: number | null };
type Req = { id: number; userId: number; username: string; cardId: number; amount: number; received: number; expiresAt: string; donors: { username: string; count: number }[] };
type CardLite = { id: number; name: string; image: string; rarity: string };

const clock = (s: string) => new Date(s).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

export default function ChatPanel({ scope, meId, cards, ownedCopies, notify, onChanged }: {
  scope: 'global' | 'clan'; meId: number; cards: CardLite[]; ownedCopies: Record<number, number>;
  notify: (m: string) => void; onChanged: () => void | Promise<void>;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [noClan, setNoClan] = useState(false);
  const [ready, setReady] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  const load = useCallback(async () => {
    try {
      const t = getToken();
      const r = await fetch(`/api/chat?scope=${scope}`, { cache: 'no-store', credentials: 'same-origin', headers: t ? { authorization: `Bearer ${t}` } : {} });
      if (!r.ok) return;
      const j = await r.json();
      setMessages(j.messages || []); setReqs(j.requests || []); setNoClan(!!j.noClan); setReady(true);
    } catch { /* сеть недоступна — повторим при следующем опросе */ }
  }, [scope]);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 4000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => { const el = listRef.current; if (el && stick.current) el.scrollTop = el.scrollHeight; }, [messages, reqs]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const r = await apiFetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope, body }) });
      const j = await r.json();
      if (!r.ok) notify(j.error || 'Не удалось отправить сообщение.');
      else { setText(''); stick.current = true; await load(); }
    } catch { notify('Нет соединения с сервером.'); } finally { setBusy(false); }
  };

  const donate = async (id: number) => {
    setBusy(true);
    try {
      const r = await apiFetch('/api/game', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'donate', requestId: id }) });
      const j = await r.json();
      notify(j.message || j.error || 'Ошибка');
      await load();
      if (r.ok) await onChanged();
    } catch { notify('Нет соединения с сервером.'); } finally { setBusy(false); }
  };

  const renderMessage = (m: Msg) => {
    if (m.kind === 'request') {
      const rq = reqs.find((r) => r.id === m.requestId);
      const card = rq && cards.find((c) => c.id === rq.cardId);
      if (!rq || !card) return <div className="cmsg" key={m.id}><p>{m.body}</p></div>;
      const done = rq.received >= rq.amount;
      const expired = new Date(rq.expiresAt).getTime() < Date.now();
      const mine = rq.userId === meId;
      const have = ownedCopies[rq.cardId] || 0;
      const label = mine ? 'Ваша просьба' : done ? 'Выполнено' : expired ? 'Истекла' : have < 1 ? 'Нет копий' : `Дать 1 (у вас ${have})`;
      return (
        <div className="req-card" key={m.id}>
          <div className="req-thumb"><CardArt image={card.image} alt={card.name} /></div>
          <div className="req-body">
            <span><strong>{rq.username}</strong> просит фрагменты</span>
            <span className="req-title">{card.name} <small>({card.rarity})</small></span>
            <div className="req-bar"><i style={{ width: `${Math.min(100, (rq.received / rq.amount) * 100)}%` }} /></div>
            <div className="req-meta"><span>Получено {rq.received} из {rq.amount}</span><span>{clock(m.createdAt)}</span></div>
            {rq.donors.length > 0 && <div className="req-donors">Помогли: {rq.donors.map((d) => `${d.username}${d.count > 1 ? ` ×${d.count}` : ''}`).join(', ')}</div>}
            {!mine && !done && !expired && <div className="req-donors">Награда: +{donateReward(card.rarity)} золота за копию</div>}
          </div>
          <button className="tiny-btn" disabled={busy || mine || done || expired || have < 1} onClick={() => donate(rq.id)}>{label}</button>
        </div>
      );
    }
    const own = m.userId === meId;
    return (
      <div className={'cmsg' + (own ? ' mine' : '')} key={m.id}>
        <div className="cmsg-head"><strong>{m.username}</strong>{m.role === 'admin' && <span className="cbadge">АДМИН</span>}<small>{clock(m.createdAt)}</small></div>
        <p>{m.body}</p>
      </div>
    );
  };

  return (
    <div className="chat-wrap">
      <div className="chat-list" ref={listRef} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; }}>
        {scope === 'clan' && noClan && <div className="empty-state">Вы не состоите в клане. Вступите в клан, чтобы общаться с соклановцами и просить у них фрагменты карт.</div>}
        {!noClan && ready && messages.length === 0 && <div className="empty-state">Здесь пока тихо. Напишите первым!</div>}
        {!ready && <div className="empty-state">Загрузка чата...</div>}
        {messages.map(renderMessage)}
      </div>
      {!noClan && (
        <form className="chat-form" onSubmit={send}>
          <input className="field" placeholder={scope === 'global' ? 'Написать в общий чат...' : 'Написать клану...'} value={text} onChange={(e) => setText(e.target.value)} maxLength={scope === 'global' ? 200 : 300} />
          <button className="btn btn-gold" disabled={busy || !text.trim()}>Отправить</button>
        </form>
      )}
    </div>
  );
}
