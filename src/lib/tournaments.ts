// Еженедельные турниры: автоматический турнир текущей недели + участие игроков.
import { db } from '@/db';
import { tournaments, tournamentPlayers } from '@/db/schema';
import { and, eq, desc, sql } from 'drizzle-orm';
import { weekKey } from './leagues';

export async function ensureWeeklyTournament(now = new Date()) {
  const key = weekKey(now);
  const existing = await db.select().from(tournaments).orderBy(desc(tournaments.startsAt)).limit(4);
  const same = existing.find((t) => weekKey(new Date(t.startsAt)) === key && t.auto);
  if (same) return same;
  const start = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)), 0, 0, 0));
  const end = new Date(start.getTime() + 7 * 86400000);
  const weekNo = Math.ceil((start.getUTCDate() + 6 - ((start.getUTCDay() + 6) % 7)) / 7) || 1;
  const [row] = await db.insert(tournaments).values({
    name: `Турнир недели · ${start.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' })}`,
    description: `Королевский турнир недели №${weekNo}. Одерживайте победы, набирайте короны и забирайте сундук награды.`,
    startsAt: start, endsAt: end, chestType: 'tournament', auto: true, active: true,
  }).returning();
  return row;
}

export async function currentTournament(now = new Date()) {
  await ensureWeeklyTournament(now);
  const [t] = await db.select().from(tournaments).where(eq(tournaments.active, true)).orderBy(desc(tournaments.startsAt)).limit(1);
  return t || null;
}

export async function joinTournament(tournamentId: number, userId: number) {
  await db.insert(tournamentPlayers).values({ tournamentId, userId }).onConflictDoNothing();
}

export async function addTournamentScore(tournamentId: number, userId: number, crowns: number, win: boolean) {
  await db.insert(tournamentPlayers).values({ tournamentId, userId, score: crowns, wins: win ? 1 : 0, battles: 1 }).onConflictDoUpdate({
    target: [tournamentPlayers.tournamentId, tournamentPlayers.userId],
    set: { score: sql`${tournamentPlayers.score}+${crowns}`, wins: sql`${tournamentPlayers.wins}+${win ? 1 : 0}`, battles: sql`${tournamentPlayers.battles}+1`, updatedAt: new Date() },
  });
}

export async function tournamentStandings(tournamentId: number) {
  return db.select({ id: tournamentPlayers.id, userId: tournamentPlayers.userId, username: sql<string>`u.username`, score: tournamentPlayers.score, wins: tournamentPlayers.wins, battles: tournamentPlayers.battles, claimed: tournamentPlayers.claimed })
    .from(tournamentPlayers).innerJoin(sql`users u`, sql`u.id = ${tournamentPlayers.userId}`)
    .where(eq(tournamentPlayers.tournamentId, tournamentId)).orderBy(desc(tournamentPlayers.score), desc(tournamentPlayers.wins)).limit(50);
}

export async function tournamentEnded(t: { endsAt: Date }) { return new Date(t.endsAt).getTime() <= Date.now(); }
