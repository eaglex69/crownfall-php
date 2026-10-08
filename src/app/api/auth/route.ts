import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, ownedCards, cards, loginTokens } from '@/db/schema';
import { eq, sql, and, inArray } from 'drizzle-orm';
import { STARTER_CARDS } from '@/lib/cards';
import { hashPassword, verifyPassword, createSession, clearSession, getUser, seedGame, sessionCookieOptions, createLoginToken } from '@/lib/game';

function withSession(userId: number) {
  return createSession(userId).then((token) => {
    const res = NextResponse.json({ ok: true, token });
    res.cookies.set('royale_session', token, sessionCookieOptions());
    return res;
  });
}

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ user: null });
  const [count] = await db.select({ n: sql<number>`count(*)::int` }).from(loginTokens).where(eq(loginTokens.userId, user.id));
  return NextResponse.json({ user: { id: user.id, username: user.username, role: user.role, gold: user.gold, gems: user.gems, trophies: user.trophies }, linkCount: count?.n || 0 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = String(body.action || '');

    if (action === 'logout') {
      await clearSession();
      const res = NextResponse.json({ ok: true });
      res.cookies.set('royale_session', '', { ...sessionCookieOptions(), maxAge: 0, value: '' });
      return res;
    }

    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (action === 'register') {
      const username = String(body.username || '').trim();
      if (!/^[\p{L}\p{N}_ -]{3,20}$/u.test(username)) return NextResponse.json({ error: 'Имя: от 3 до 20 букв или цифр.' }, { status: 400 });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Укажите корректную почту.' }, { status: 400 });
      if (password.length < 8) return NextResponse.json({ error: 'Пароль должен содержать минимум 8 символов.' }, { status: 400 });
      await seedGame();
      const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (existing.length) return NextResponse.json({ error: 'Этот email уже зарегистрирован.' }, { status: 409 });
      const existingName = await db.select({ id: users.id }).from(users).where(sql`lower(${users.username}) = lower(${username})`).limit(1);
      if (existingName.length) return NextResponse.json({ error: 'Это имя уже занято.' }, { status: 409 });
      const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
      const [user] = await db.insert(users).values({ username, email, passwordHash: hashPassword(password), role: count === 0 ? 'admin' : 'player' }).returning();
      const starter = await db.select().from(cards).where(inArray(cards.name, STARTER_CARDS));
      starter.sort((a, b) => STARTER_CARDS.indexOf(a.name) - STARTER_CARDS.indexOf(b.name));
      if (starter.length) {
        await db.insert(ownedCards).values(starter.map((card, i) => ({ userId: user.id, cardId: card.id, copies: i < 6 ? 12 : 4 }))).onConflictDoNothing();
        await db.update(users).set({ deck: starter.slice(0, 8).map((c) => c.id).join(',') }).where(eq(users.id, user.id));
      }
      return withSession(user.id);
    }

    if (action === 'login') {
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user || !verifyPassword(password, user.passwordHash)) return NextResponse.json({ error: 'Неверная почта или пароль.' }, { status: 401 });
      if (user.banned) return NextResponse.json({ error: 'Аккаунт заблокирован.' }, { status: 403 });
      return withSession(user.id);
    }

    if (action === 'link') {
      const admin = await getUser();
      if (!admin) return NextResponse.json({ error: 'Требуется вход.' }, { status: 401 });
      const targetId = admin.role === 'admin' ? Number(body.id) : admin.id;
      if (!Number.isFinite(targetId) || targetId <= 0) return NextResponse.json({ error: 'Игрок не найден.' }, { status: 400 });
      const [target] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
      if (!target) return NextResponse.json({ error: 'Игрок не найден.' }, { status: 404 });
      if (target.banned) return NextResponse.json({ error: 'Игрок заблокирован.' }, { status: 403 });
      const token = await createLoginToken(target.id, body.minutes ? Number(body.minutes) : 1440);
      return NextResponse.json({ ok: true, token, url: `/api/auth/link?token=${encodeURIComponent(token)}`, username: target.username });
    }

    return NextResponse.json({ error: 'Неизвестное действие.' }, { status: 400 });
  } catch (e) {
    console.error('auth', e);
    return NextResponse.json({ error: 'Не удалось выполнить запрос. Попробуйте ещё раз.' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ ok: true });
    await db.delete(loginTokens).where(and(eq(loginTokens.userId, user.id), sql`${loginTokens.expiresAt} > now()`));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
