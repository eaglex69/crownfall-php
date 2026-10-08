import { db } from '@/db';
import { users, sessions, loginTokens, cards, ownedCards, clans, clanMessages, friends, battles, announcements, settings, chests, leagues, tournaments, tournamentPlayers, pvpMatches } from '@/db/schema';
import { eq, and, or, desc, sql } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { CARD_CATALOG, CARDS_VERSION } from './cards';
import { DEFAULT_LEAGUES, firstMondayOfMonth, leagueFor, nextLeague, nextLeagueReset, resetTrophies, seasonKey } from './leagues';
import { currentTournament, tournamentStandings } from './tournaments';

export const DEFAULT_SETTINGS: Record<string, string> = { gift_gold: '500', gift_gems: '15', maintenance: 'false', elixir_seconds: '2.5', battle_seconds: '180', request_cooldown_minutes: '30', league_season: '', pvp_enabled: 'true', arena_difficulty: 'Средне' };

let seeded = false;
export async function seedGame() {
  if (seeded) return;
  await db.insert(settings).values(Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value }))).onConflictDoNothing();
  const [ver] = await db.select().from(settings).where(eq(settings.key, 'cards_version')).limit(1);
  if (ver?.value !== CARDS_VERSION) {
    await db.insert(cards).values(CARD_CATALOG).onConflictDoUpdate({
      target: cards.name,
      set: {
        image: sql`excluded.image`, rarity: sql`excluded.rarity`, cost: sql`excluded.cost`, damage: sql`excluded.damage`, health: sql`excluded.health`,
        description: sql`excluded.description`, kind: sql`excluded.kind`, targets: sql`excluded.targets`, speed: sql`excluded.speed`, range: sql`excluded.range`,
        attackSpeed: sql`excluded.attack_speed`, count: sql`excluded.count`, splash: sql`excluded.splash`, lifetime: sql`excluded.lifetime`,
        ability: sql`excluded.ability`, unlockTrophies: sql`excluded.unlock_trophies`, role: sql`excluded.role`, pros: sql`excluded.pros`, cons: sql`excluded.cons`,
      },
    });
    await db.insert(settings).values({ key: 'cards_version', value: CARDS_VERSION }).onConflictDoUpdate({ target: settings.key, set: { value: CARDS_VERSION } });
  }
  const leagueCount = await db.select({ n: sql<number>`count(*)::int` }).from(leagues);
  if (!leagueCount[0]?.n) {
    await db.insert(leagues).values(DEFAULT_LEAGUES.map((l, i) => ({ ...l, order: i })));
  }
  await runLeagueSeason();
  seeded = true;
}

// Ежемесячный сброс лиг: первый понедельник месяца кубки снижаются на 30%.
export async function runLeagueSeason() {
  const season = seasonKey();
  const [row] = await db.select().from(settings).where(eq(settings.key, 'league_season')).limit(1);
  if (row?.value === season) return { changed: false, season };
  const first = firstMondayOfMonth();
  const isResetDay = first.getTime() <= Date.now();
  if (row && isResetDay) {
    await db.update(users).set({ trophies: sql`greatest(0, (${users.trophies} * 7) / 10)::int`, leagueChestSeason: '' });
  } else if (!row) {
    await db.update(users).set({ leagueSeason: season, leagueChestSeason: '' });
  }
  await db.insert(settings).values({ key: 'league_season', value: season }).onConflictDoUpdate({ target: settings.key, set: { value: season } });
  return { changed: true, season };
}

export function hashPassword(password: string) { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`; }
export function verifyPassword(password: string, hash: string) { try { const [salt, stored] = hash.split(':'); const a = Buffer.from(stored, 'hex'); const b = scryptSync(password, salt, 64); return a.length === b.length && timingSafeEqual(a, b); } catch { return false; } }

export async function getUser() {
  const jar = await cookies();
  let token = jar.get('royale_session')?.value;
  if (!token) {
    try { const { headers } = await import('next/headers'); const headerList = await headers(); const auth = headerList.get('authorization') || ''; token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''; } catch {}
  }
  if (!token) return null;
  const [session] = await db.select().from(sessions).where(and(eq(sessions.id, token), sql`${sessions.expiresAt} > now()`)).limit(1);
  if (!session) return null;
  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  return user && !user.banned ? user : null;
}
export async function createSession(userId: number) {
  const token = randomBytes(32).toString('hex');
  await db.insert(sessions).values({ id: token, userId, expiresAt: new Date(Date.now() + 30 * 86400000) });
  return token;
}
export async function createLoginToken(userId: number, minutes = 1440) {
  const token = randomBytes(24).toString('base64url');
  await db.insert(loginTokens).values({ token, userId, expiresAt: new Date(Date.now() + minutes * 60000) });
  return token;
}
export function sessionCookieOptions() {
  return process.env.NODE_ENV === 'production'
    ? { httpOnly: true, sameSite: 'none' as const, secure: true, path: '/', maxAge: 30 * 86400 }
    : { httpOnly: true, sameSite: 'lax' as const, secure: false, path: '/', maxAge: 30 * 86400 };
}
export async function clearSession() {
  const jar = await cookies(); const token = jar.get('royale_session')?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, token));
}

export function resolveDeck(deckText: string, ownedIds: Set<number>, list: { id: number; cost: number }[]): number[] {
  const enabled = new Set(list.map((c) => c.id));
  let ids = (deckText || '').split(',').map(Number).filter((n) => ownedIds.has(n) && enabled.has(n));
  ids = [...new Set(ids)];
  if (ids.length < 8) {
    const rest = list.filter((c) => ownedIds.has(c.id) && !ids.includes(c.id)).sort((a, b) => a.cost - b.cost);
    for (const c of rest) { if (ids.length >= 8) break; ids.push(c.id); }
  }
  return ids.slice(0, 8);
}

export async function getGameData(user: typeof users.$inferSelect | null) {
  await seedGame();
  const [allCards, leaderboard, news, clanList, settingRows] = await Promise.all([
    db.select().from(cards).where(eq(cards.enabled, true)).orderBy(cards.id),
    db.select({ id: users.id, username: users.username, trophies: users.trophies, wins: users.wins, clanId: users.clanId }).from(users).where(eq(users.banned, false)).orderBy(desc(users.trophies)).limit(30),
    db.select().from(announcements).where(eq(announcements.active, true)).orderBy(desc(announcements.createdAt)).limit(5),
    db.select().from(clans).orderBy(desc(clans.id)).limit(40),
    db.select().from(settings),
  ]);
  const [leagueList, tournament] = await Promise.all([db.select().from(leagues).orderBy(leagues.order, leagues.minTrophies), currentTournament()]);
  const st = (k: string) => settingRows.find((x) => x.key === k)?.value ?? DEFAULT_SETTINGS[k];
  const giftSettings = { gold: Number(st('gift_gold')) || 500, gems: Number(st('gift_gems')) || 15 };
  const battleSettings = { elixirSeconds: Math.max(0.5, Number(st('elixir_seconds')) || 2.5), battleSeconds: Math.max(30, Number(st('battle_seconds')) || 180), difficulty: st('arena_difficulty') };
  const requestCooldownMinutes = Math.max(1, Number(st('request_cooldown_minutes')) || 30);
  const leagueInfo = {
    list: leagueList.map((l) => ({ id: l.id, name: l.name, minTrophies: l.minTrophies, chestType: l.chestType, rewardGold: l.rewardGold, rewardGems: l.rewardGems, color: l.color })),
    resetAt: nextLeagueReset().toISOString(),
  };
  if (!user) return { user: null, cards: allCards, owned: [], deck: [] as number[], chests: [], leaderboard, news, clans: clanList, clanMembers: [], clanChat: [], friendships: [], history: [], giftSettings, battleSettings, requestCooldownMinutes, leagues: leagueInfo, tournament: tournament ? { id: tournament.id, name: tournament.name, description: tournament.description, startsAt: tournament.startsAt, endsAt: tournament.endsAt, chestType: tournament.chestType } : null, tournamentStandings: [], pvp: { enabled: st('pvp_enabled') !== 'false', attacks: [] }, league: null, leagueChestReady: false, nextLeague: null, tournamentMe: null };
  const [owned, clanMembers, clanChat, friendships, history, chestList] = await Promise.all([
    db.select().from(ownedCards).where(eq(ownedCards.userId, user.id)),
    user.clanId ? db.select({ id: users.id, username: users.username, trophies: users.trophies, role: users.role }).from(users).where(eq(users.clanId, user.clanId)).orderBy(desc(users.trophies)) : Promise.resolve([]),
    user.clanId ? db.select({ id: clanMessages.id, body: clanMessages.body, createdAt: clanMessages.createdAt, username: users.username }).from(clanMessages).innerJoin(users, eq(clanMessages.userId, users.id)).where(eq(clanMessages.clanId, user.clanId)).orderBy(desc(clanMessages.id)).limit(30) : Promise.resolve([]),
    db.select({ id: friends.id, requesterId: friends.requesterId, recipientId: friends.recipientId, status: friends.status, requester: sql<string>`a.username`, recipient: sql<string>`b.username` }).from(friends).innerJoin(sql`users a`, sql`a.id = ${friends.requesterId}`).innerJoin(sql`users b`, sql`b.id = ${friends.recipientId}`).where(or(eq(friends.requesterId, user.id), eq(friends.recipientId, user.id))),
    db.select().from(battles).where(eq(battles.userId, user.id)).orderBy(desc(battles.createdAt)).limit(20),
    db.select().from(chests).where(and(eq(chests.userId, user.id), sql`${chests.openedAt} is null`)).orderBy(chests.createdAt).limit(30),
  ]);
  const deck = resolveDeck(user.deck, new Set(owned.map((o) => o.cardId)), allCards);
  const season = seasonKey();
  const myLeague = leagueFor(leagueList, user.trophies);
  const upcoming = nextLeague(leagueList, user.trophies);
  const leagueChestReady = !!myLeague && user.leagueChestSeason !== season;
  const [standings, attacks] = await Promise.all([
    tournament ? tournamentStandings(tournament.id) : Promise.resolve([]),
    db.select({ id: pvpMatches.id, attackerId: pvpMatches.attackerId, username: sql<string>`u.username`, attackerCrowns: pvpMatches.attackerCrowns, defenderCrowns: pvpMatches.defenderCrowns, result: pvpMatches.result, trophies: pvpMatches.trophies, createdAt: pvpMatches.createdAt })
      .from(pvpMatches).innerJoin(sql`users u`, sql`u.id = ${pvpMatches.attackerId}`)
      .where(and(eq(pvpMatches.defenderId, user.id), eq(pvpMatches.seen, false))).orderBy(desc(pvpMatches.createdAt)).limit(20),
  ]);
  return {
    user: { ...user, passwordHash: undefined }, cards: allCards, owned, deck, chests: chestList, leaderboard, news, clans: clanList,
    clanMembers, clanChat: clanChat.reverse(), friendships, history, giftSettings, battleSettings, requestCooldownMinutes,
    leagues: leagueInfo,
    league: myLeague ? { id: myLeague.id, name: myLeague.name, minTrophies: myLeague.minTrophies, chestType: myLeague.chestType, rewardGold: myLeague.rewardGold, rewardGems: myLeague.rewardGems, color: myLeague.color } : null,
    leagueChestReady, nextLeague: upcoming ? { name: upcoming.name, minTrophies: upcoming.minTrophies } : null,
    tournament: tournament ? { id: tournament.id, name: tournament.name, description: tournament.description, startsAt: tournament.startsAt, endsAt: tournament.endsAt, chestType: tournament.chestType } : null,
    tournamentStandings: standings, tournamentMe: standings.find((r) => r.userId === user.id) || null,
    pvp: { enabled: st('pvp_enabled') !== 'false', attacks },
  };
}
