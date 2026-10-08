// Лиги игроков и ежемесячный сброс (первый понедельник месяца).
export type League = { id: number; name: string; minTrophies: number; order: number; chestType: string; rewardGold: number; rewardGems: number; color: string };

export const DEFAULT_LEAGUES: { name: string; minTrophies: number; chestType: string; rewardGold: number; rewardGems: number; color: string }[] = [
  { name: 'Деревянная лига', minTrophies: 0, chestType: 'wood', rewardGold: 100, rewardGems: 2, color: 'wood' },
  { name: 'Бронзовая лига', minTrophies: 300, chestType: 'silver', rewardGold: 200, rewardGems: 5, color: 'bronze' },
  { name: 'Серебряная лига', minTrophies: 700, chestType: 'silver', rewardGold: 350, rewardGems: 8, color: 'silver' },
  { name: 'Золотая лига', minTrophies: 1200, chestType: 'gold', rewardGold: 500, rewardGems: 15, color: 'gold' },
  { name: 'Магическая лига', minTrophies: 1800, chestType: 'magic', rewardGold: 700, rewardGems: 25, color: 'magic' },
  { name: 'Легендарная лига', minTrophies: 2500, chestType: 'legendary', rewardGold: 1000, rewardGems: 40, color: 'legendary' },
  { name: 'Лига чемпионов', minTrophies: 3200, chestType: 'legendary', rewardGold: 1500, rewardGems: 60, color: 'champion' },
];

export function firstMondayOfMonth(d = new Date()): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
  const day = x.getUTCDay();
  const delta = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  x.setUTCDate(x.getUTCDate() + delta);
  return x;
}
export function nextLeagueReset(d = new Date()): Date {
  const cur = firstMondayOfMonth(d);
  if (cur.getTime() > d.getTime()) return cur;
  return firstMondayOfMonth(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)));
}
export function seasonKey(d = new Date()) { return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; }
export function weekKey(d = new Date()) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() - (day - 1));
  return x.toISOString().slice(0, 10);
}
export function leagueFor(list: League[], trophies: number): League | null {
  const sorted = [...list].sort((a, b) => a.order - b.order || a.minTrophies - b.minTrophies);
  let current: League | null = null;
  for (const l of sorted) if (trophies >= l.minTrophies) current = l;
  return current;
}
export function nextLeague(list: League[], trophies: number): League | null {
  const sorted = [...list].sort((a, b) => a.order - b.order || a.minTrophies - b.minTrophies);
  return sorted.find((l) => l.minTrophies > trophies) || null;
}
export const resetTrophies = (t: number) => Math.max(0, Math.round(t * 0.7));
