import type { ChestReward } from '@/db/schema';

type CardForLoot = { id: number; name: string; image: string; rarity: string; unlockTrophies: number; enabled: boolean };
type ChestType = 'wood' | 'silver' | 'gold' | 'magic' | 'legendary' | 'tournament';

export const CHEST_INFO: Record<ChestType, { title: string; priceGold: number; priceGems: number; cards: number; gold: [number, number]; gems: [number, number] }> = {
  wood: { title: 'Деревянный сундук', priceGold: 0, priceGems: 0, cards: 2, gold: [35, 80], gems: [0, 2] },
  silver: { title: 'Серебряный сундук', priceGold: 450, priceGems: 0, cards: 4, gold: [100, 220], gems: [0, 5] },
  gold: { title: 'Золотой сундук', priceGold: 1250, priceGems: 0, cards: 6, gold: [250, 500], gems: [2, 10] },
  magic: { title: 'Магический сундук', priceGold: 0, priceGems: 85, cards: 8, gold: [450, 850], gems: [8, 22] },
  legendary: { title: 'Легендарный сундук', priceGold: 0, priceGems: 300, cards: 9, gold: [700, 1200], gems: [25, 60] },
  tournament: { title: 'Турнирный сундук', priceGold: 0, priceGems: 0, cards: 7, gold: [350, 700], gems: [10, 30] },
};
export type ChestTypeName = keyof typeof CHEST_INFO;
const rarities = ['Обычная', 'Редкая', 'Эпическая', 'Легендарная', 'Чемпион'];
const wildKey: Record<string, string> = { Обычная: 'common', Редкая: 'rare', Эпическая: 'epic', Легендарная: 'legendary', Чемпион: 'champion' };
const range = (r: [number, number]) => Math.floor(r[0] + Math.random() * (r[1] - r[0] + 1));
const pick = <T,>(a: T[]): T | undefined => a.length ? a[Math.floor(Math.random() * a.length)] : undefined;

function rollRarity(type: ChestTypeName, i: number): string {
  if (type === 'legendary' && i === 0) return 'Легендарная';
  const n = Math.random();
  if (type === 'magic' || type === 'legendary' || type === 'tournament') {
    if (n < (type === 'tournament' ? 0.025 : 0.05)) return 'Чемпион';
    if (n < 0.24) return 'Легендарная';
    if (n < 0.58) return 'Эпическая';
    if (n < 0.84) return 'Редкая';
    return 'Обычная';
  }
  if (type === 'gold') return n < 0.08 ? 'Эпическая' : n < 0.40 ? 'Редкая' : 'Обычная';
  if (type === 'silver') return n < 0.10 ? 'Эпическая' : n < 0.34 ? 'Редкая' : 'Обычная';
  return n < 0.05 ? 'Эпическая' : n < 0.28 ? 'Редкая' : 'Обычная';
}

export function rollChest(type: ChestTypeName, cards: CardForLoot[], trophies: number): ChestReward[] {
  const info = CHEST_INFO[type];
  const eligible = cards.filter((c) => c.enabled && c.unlockTrophies <= trophies);
  const out: ChestReward[] = [];
  const gold = range(info.gold); out.push({ kind: 'gold', name: 'Золото', amount: gold });
  const gems = range(info.gems); if (gems > 0) out.push({ kind: 'gems', name: 'Кристаллы', amount: gems });
  for (let i = 0; i < info.cards; i++) {
    let rarity = rollRarity(type, i);
    let pool = eligible.filter((c) => c.rarity === rarity);
    while (!pool.length && rarity !== 'Обычная') { rarity = rarities[rarities.indexOf(rarity) - 1] || 'Обычная'; pool = eligible.filter((c) => c.rarity === rarity); }
    const card = pick(pool);
    if (card) out.push({ kind: 'card', name: card.name, amount: type === 'legendary' && i === 0 ? 1 : rarity === 'Чемпион' || rarity === 'Легендарная' ? 1 : rarity === 'Эпическая' ? 2 : rarity === 'Редкая' ? 3 : 5, cardId: card.id, image: card.image });
  }
  const wildcardCount = type === 'wood' ? 1 : type === 'silver' ? 2 : type === 'gold' ? 4 : type === 'magic' ? 7 : type === 'legendary' ? 9 : 6;
  for (let i = 0; i < wildcardCount; i++) {
    const rarity = pick(['Обычная', 'Редкая', ...(type === 'wood' || type === 'silver' ? [] : ['Эпическая']), ...(type === 'legendary' ? ['Легендарная'] : []), ...(type === 'tournament' ? ['Чемпион'] : [])]) || 'Обычная';
    out.push({ kind: 'wildcard', name: `Дикая карта · ${rarity.toLowerCase()}`, amount: type === 'magic' || type === 'legendary' ? 2 : 1, image: wildKey[rarity] });
  }
  const evoChance = type === 'wood' ? 0 : type === 'silver' ? 0.08 : type === 'gold' ? 0.25 : 0.7;
  if (Math.random() < evoChance) out.push({ kind: 'evolution', name: 'Фрагменты эволюции', amount: type === 'legendary' ? 4 : type === 'magic' ? 3 : 1 + Math.floor(Math.random() * 2) });
  if (type === 'magic' || type === 'legendary' || type === 'tournament' || Math.random() < 0.16) {
    const cosmeticType = pick(['emote', 'banner', 'towerSkin']) || 'emote';
    const cosmetics: Record<string, string[]> = {
      emote: ['Смех гоблина', 'Коронный салют', 'Ледяное подмигивание', 'Огненный рёв', 'Привет с арены'],
      banner: ['Знамя синего льва', 'Знамя алой короны', 'Знамя ночного неба', 'Знамя золотого шторма'],
      towerSkin: ['Башня аметистовой ночи', 'Башня ледяной крепости', 'Башня королевского золота'],
    };
    const name = pick(cosmetics[cosmeticType]) || cosmetics.emote[0];
    out.push({ kind: 'cosmetic', name, amount: 1, image: cosmeticType });
  }
  return out;
}

export function isChestType(x: unknown): x is ChestTypeName { return typeof x === 'string' && x in CHEST_INFO; }
