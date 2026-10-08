import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, clanMessages, globalMessages, cardRequests, requestDonations } from '@/db/schema';
import { eq, desc, inArray, sql } from 'drizzle-orm';
import { getUser } from '@/lib/game';

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function GET(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return fail('Войдите в аккаунт.', 401);
    const scope = req.nextUrl.searchParams.get('scope') === 'clan' ? 'clan' : 'global';

    if (scope === 'global') {
      const rows = await db
        .select({ id: globalMessages.id, body: globalMessages.body, createdAt: globalMessages.createdAt, userId: globalMessages.userId, username: users.username, role: users.role })
        .from(globalMessages).innerJoin(users, eq(globalMessages.userId, users.id))
        .orderBy(desc(globalMessages.id)).limit(80);
      return NextResponse.json({ messages: rows.reverse().map((m) => ({ ...m, kind: 'text', requestId: null })), requests: [] });
    }

    if (!user.clanId) return NextResponse.json({ messages: [], requests: [], noClan: true });
    const rows = await db
      .select({ id: clanMessages.id, body: clanMessages.body, createdAt: clanMessages.createdAt, userId: clanMessages.userId, username: users.username, role: users.role, kind: clanMessages.kind, requestId: clanMessages.requestId })
      .from(clanMessages).innerJoin(users, eq(clanMessages.userId, users.id))
      .where(eq(clanMessages.clanId, user.clanId)).orderBy(desc(clanMessages.id)).limit(60);
    const ids = rows.map((r) => r.requestId).filter((x): x is number => x != null);
    let requests: Record<string, unknown>[] = [];
    if (ids.length) {
      const rq = await db
        .select({ id: cardRequests.id, userId: cardRequests.userId, username: users.username, cardId: cardRequests.cardId, amount: cardRequests.amount, received: cardRequests.received, expiresAt: cardRequests.expiresAt })
        .from(cardRequests).innerJoin(users, eq(cardRequests.userId, users.id)).where(inArray(cardRequests.id, ids));
      const dn = await db
        .select({ requestId: requestDonations.requestId, username: users.username, count: sql<number>`sum(${requestDonations.amount})::int` })
        .from(requestDonations).innerJoin(users, eq(requestDonations.donorId, users.id))
        .where(inArray(requestDonations.requestId, ids)).groupBy(requestDonations.requestId, users.username);
      requests = rq.map((r) => ({ ...r, donors: dn.filter((d) => d.requestId === r.id).map((d) => ({ username: d.username, count: d.count })) }));
    }
    return NextResponse.json({ messages: rows.reverse(), requests });
  } catch (e) {
    console.error('chat get', e);
    return fail('Не удалось загрузить чат.', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return fail('Войдите в аккаунт.', 401);
    const b = await req.json();
    const scope = b.scope === 'clan' ? 'clan' : 'global';
    const body = String(b.body || '').trim().slice(0, scope === 'global' ? 200 : 300);
    if (!body) return fail('Введите сообщение.');

    if (scope === 'global') {
      const [last] = await db.select({ createdAt: globalMessages.createdAt }).from(globalMessages).where(eq(globalMessages.userId, user.id)).orderBy(desc(globalMessages.id)).limit(1);
      if (last && Date.now() - new Date(last.createdAt).getTime() < 1200) return fail('Не так быстро. Подождите секунду.', 429);
      await db.insert(globalMessages).values({ userId: user.id, body });
    } else {
      if (!user.clanId) return fail('Вы не состоите в клане.');
      const [last] = await db.select({ createdAt: clanMessages.createdAt }).from(clanMessages).where(eq(clanMessages.userId, user.id)).orderBy(desc(clanMessages.id)).limit(1);
      if (last && Date.now() - new Date(last.createdAt).getTime() < 1200) return fail('Не так быстро. Подождите секунду.', 429);
      await db.insert(clanMessages).values({ clanId: user.clanId, userId: user.id, body });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('chat post', e);
    return fail('Не удалось отправить сообщение.', 500);
  }
}
