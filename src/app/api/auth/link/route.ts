import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, loginTokens } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { createSession, sessionCookieOptions } from '@/lib/game';

function buildCookie(token: string) {
  const o = sessionCookieOptions();
  const parts = [`royale_session=${token}`, `Path=${o.path || '/'}`, `Max-Age=${o.maxAge || 2592000}`, 'HttpOnly', `SameSite=${o.sameSite}`];
  if (o.secure) parts.push('Secure');
  return parts.join('; ');
}

function redirect(path: string, cookie?: string) {
  const headers: Record<string, string> = { Location: path };
  if (cookie) headers['Set-Cookie'] = cookie;
  return new Response(null, { status: 307, headers });
}

export async function GET(req: NextRequest) {
  const token = (req.nextUrl.searchParams.get('token') || '').trim();
  if (!token) return redirect('/?link=invalid');
  try {
    const [row] = await db.select().from(loginTokens).where(sql`${loginTokens.token} = ${token} and ${loginTokens.expiresAt} > now()`).limit(1);
    if (!row) return redirect('/?link=invalid');
    const [user] = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
    if (!user || user.banned) return redirect('/?link=invalid');
    const sessionToken = await createSession(user.id);
    return redirect('/?link=ok', buildCookie(sessionToken));
  } catch (e) {
    console.error('login link', e);
    return redirect('/?link=invalid');
  }
}
