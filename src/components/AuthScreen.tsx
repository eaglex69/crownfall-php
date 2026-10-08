'use client';
import { useState } from 'react';
import { setToken } from '@/lib/clientFetch';
import Icon from './Icon';
import Logo from './Logo';

export default function AuthScreen({ onClose, initialMode = 'register', closable = true }: { onClose?: () => void; initialMode?: 'login' | 'register'; closable?: boolean }) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [username, setUsername] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const r = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: mode, email, password, username }) });
      const j = await r.json();
      if (!r.ok) { setError(j.error || 'Не удалось войти.'); return; }
      setToken(j.token || null); window.location.reload();
    } catch { setError('Нет соединения с сервером.'); } finally { setBusy(false); }
  };

  return (
    <div className="splash">
      <div className="splash-art"><div className="splash-glow" /><div className="splash-bolt" /><div className="splash-petals">{Array.from({ length: 14 }, (_, i) => <b key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 0.9) % 7}s`, animationDuration: `${7 + (i % 5)}s` }} />)}</div></div>
      <div className="splash-content">
        {closable && onClose && <button className="splash-close" onClick={onClose} aria-label="Закрыть">×</button>}
        <div className="logo-block"><Logo width="min(74vw,360px)" /></div>
        <div className="splash-card">
          <div className="auth-switch neon"><button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(''); }}>Регистрация</button><button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); }}>Вход</button></div>
          <form onSubmit={submit} className="auth-form">
            {mode === 'register' && <label>Имя игрока<input className="field neon" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Как вас будут звать на арене?" required minLength={3} maxLength={20} autoComplete="nickname" /></label>}
            <label>Электронная почта<input className="field neon" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" /></label>
            <label>Пароль<input className="field neon" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === 'register' ? 'Не менее 8 символов' : 'Ваш пароль'} required minLength={mode === 'register' ? 8 : 1} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} /></label>
            {error && <div className="form-error">{error}</div>}
            <button className="btn btn-play full" type="submit" disabled={busy}><Icon name="swords" size={22} />{busy ? 'Подождите...' : mode === 'register' ? 'НАЧАТЬ ИГРУ' : 'ВОЙТИ В ИГРУ'}</button>
          </form>
          <small className="auth-foot">{mode === 'register' ? 'Уже есть аккаунт?' : 'Нет аккаунта?'} <button onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }}>{mode === 'register' ? 'Войти' : 'Зарегистрироваться'}</button></small>
        </div>
        <div className="splash-features"><span><Icon name="cards" size={20} /> 38 карт</span><span><Icon name="shield" size={20} /> Кланы</span><span><Icon name="trophy" size={20} /> Рейтинг</span><span><Icon name="chest" size={20} /> Подарки</span></div>
      </div>
    </div>
  );
}
