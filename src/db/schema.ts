import { pgTable, serial, text, integer, boolean, timestamp, uniqueIndex, real, jsonb } from 'drizzle-orm/pg-core';

export type ChestReward = { kind: string; name: string; amount: number; cardId?: number; image?: string };
export type CosmeticItem = { type: string; name: string; art: string };

export const users = pgTable('users', {
  id: serial('id').primaryKey(), username: text('username').notNull().unique(), email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(), role: text('role').notNull().default('player'), banned: boolean('banned').notNull().default(false),
  gold: integer('gold').notNull().default(2500), gems: integer('gems').notNull().default(120), trophies: integer('trophies').notNull().default(120),
  wins: integer('wins').notNull().default(0), losses: integer('losses').notNull().default(0), xp: integer('xp').notNull().default(0),
  clanId: integer('clan_id'), lastGiftAt: timestamp('last_gift_at'), deck: text('deck').notNull().default(''),
  battleStartedAt: timestamp('battle_started_at'), battleMode: text('battle_mode').notNull().default('ladder'), lastRequestAt: timestamp('last_request_at'),
  tournamentWins: integer('tournament_wins').notNull().default(0), tournamentClaims: integer('tournament_claims').notNull().default(0),
  leagueSeason: text('league_season').notNull().default(''), leagueChestSeason: text('league_chest_season').notNull().default(''),
  pvpOpponentId: integer('pvp_opponent_id'), lastPvpAt: timestamp('last_pvp_at'),
  wildcards: jsonb('wildcards').$type<Record<string, number>>().notNull().default({ common: 0, rare: 0, epic: 0, legendary: 0, champion: 0 }),
  evolutionFragments: integer('evolution_fragments').notNull().default(0),
  cosmetics: jsonb('cosmetics').$type<CosmeticItem[]>().notNull().default([]), towerSkin: text('tower_skin').notNull().default('classic'),
  activeEmote: text('active_emote').notNull().default(''), activeBanner: text('active_banner').notNull().default(''),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
export const loginTokens = pgTable('login_tokens', { token: text('token').primaryKey(), userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), expiresAt: timestamp('expires_at').notNull(), createdAt: timestamp('created_at').notNull().defaultNow() });
export const sessions = pgTable('sessions', { id: text('id').primaryKey(), userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), expiresAt: timestamp('expires_at').notNull(), createdAt: timestamp('created_at').notNull().defaultNow() });
export const clans = pgTable('clans', { id: serial('id').primaryKey(), name: text('name').notNull().unique(), description: text('description').notNull().default(''), badge: text('badge').notNull().default('blue'), ownerId: integer('owner_id').notNull(), createdAt: timestamp('created_at').notNull().defaultNow() });
export const clanMessages = pgTable('clan_messages', {
  id: serial('id').primaryKey(), clanId: integer('clan_id').notNull().references(() => clans.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), body: text('body').notNull(),
  kind: text('kind').notNull().default('text'), requestId: integer('request_id'), createdAt: timestamp('created_at').notNull().defaultNow(),
});
export const friends = pgTable('friends', { id: serial('id').primaryKey(), requesterId: integer('requester_id').notNull().references(() => users.id, { onDelete: 'cascade' }), recipientId: integer('recipient_id').notNull().references(() => users.id, { onDelete: 'cascade' }), status: text('status').notNull().default('pending'), createdAt: timestamp('created_at').notNull().defaultNow() }, t => [uniqueIndex('friend_pair_idx').on(t.requesterId, t.recipientId)]);
export const cards = pgTable('cards', {
  id: serial('id').primaryKey(), name: text('name').notNull().unique(), image: text('image').notNull(), rarity: text('rarity').notNull().default('Обычная'),
  cost: integer('cost').notNull().default(3), damage: integer('damage').notNull().default(100), health: integer('health').notNull().default(500),
  description: text('description').notNull().default(''), enabled: boolean('enabled').notNull().default(true), kind: text('kind').notNull().default('ground'),
  targets: text('targets').notNull().default('ground'), speed: real('speed').notNull().default(1.3), range: real('range').notNull().default(0.5),
  attackSpeed: real('attack_speed').notNull().default(1.2), count: integer('count').notNull().default(1), splash: real('splash').notNull().default(0),
  lifetime: integer('lifetime').notNull().default(0), ability: text('ability').notNull().default(''), unlockTrophies: integer('unlock_trophies').notNull().default(0),
  role: text('role').notNull().default(''), pros: text('pros').notNull().default(''), cons: text('cons').notNull().default(''),
});
export const ownedCards = pgTable('owned_cards', { id: serial('id').primaryKey(), userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), cardId: integer('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }), level: integer('level').notNull().default(1), copies: integer('copies').notNull().default(0) }, t => [uniqueIndex('owned_card_idx').on(t.userId, t.cardId)]);
export const battles = pgTable('battles', { id: serial('id').primaryKey(), userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), opponent: text('opponent').notNull(), result: text('result').notNull(), crowns: integer('crowns').notNull().default(0), trophies: integer('trophies').notNull().default(0), gold: integer('gold').notNull().default(0), mode: text('mode').notNull().default('ladder'), opponentId: integer('opponent_id'), crownsLost: integer('crowns_lost').notNull().default(0), createdAt: timestamp('created_at').notNull().defaultNow() });
export const leagues = pgTable('leagues', { id: serial('id').primaryKey(), name: text('name').notNull().unique(), minTrophies: integer('min_trophies').notNull().default(0), order: integer('order').notNull().default(0), chestType: text('chest_type').notNull().default('silver'), rewardGold: integer('reward_gold').notNull().default(0), rewardGems: integer('reward_gems').notNull().default(0), color: text('color').notNull().default('blue'), createdAt: timestamp('created_at').notNull().defaultNow() });
export const tournaments = pgTable('tournaments', { id: serial('id').primaryKey(), name: text('name').notNull(), description: text('description').notNull().default(''), startsAt: timestamp('starts_at').notNull(), endsAt: timestamp('ends_at').notNull(), chestType: text('chest_type').notNull().default('tournament'), auto: boolean('auto').notNull().default(true), active: boolean('active').notNull().default(true), createdAt: timestamp('created_at').notNull().defaultNow() });
export const tournamentPlayers = pgTable('tournament_players', { id: serial('id').primaryKey(), tournamentId: integer('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }), userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), score: integer('score').notNull().default(0), wins: integer('wins').notNull().default(0), battles: integer('battles').notNull().default(0), claimed: boolean('claimed').notNull().default(false), updatedAt: timestamp('updated_at').notNull().defaultNow() }, t => [uniqueIndex('tournament_player_idx').on(t.tournamentId, t.userId)]);
export const pvpMatches = pgTable('pvp_matches', { id: serial('id').primaryKey(), attackerId: integer('attacker_id').notNull().references(() => users.id, { onDelete: 'cascade' }), defenderId: integer('defender_id').notNull().references(() => users.id, { onDelete: 'cascade' }), attackerCrowns: integer('attacker_crowns').notNull().default(0), defenderCrowns: integer('defender_crowns').notNull().default(0), result: text('result').notNull(), trophies: integer('trophies').notNull().default(0), seen: boolean('seen').notNull().default(false), createdAt: timestamp('created_at').notNull().defaultNow() });
export const announcements = pgTable('announcements', { id: serial('id').primaryKey(), title: text('title').notNull(), body: text('body').notNull(), active: boolean('active').notNull().default(true), createdAt: timestamp('created_at').notNull().defaultNow() });
export const settings = pgTable('settings', { key: text('key').primaryKey(), value: text('value').notNull() });
export const auditLogs = pgTable('audit_logs', { id: serial('id').primaryKey(), adminId: integer('admin_id').notNull(), action: text('action').notNull(), detail: text('detail').notNull(), createdAt: timestamp('created_at').notNull().defaultNow() });
export const cardRequests = pgTable('card_requests', { id: serial('id').primaryKey(), userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), clanId: integer('clan_id').notNull().references(() => clans.id, { onDelete: 'cascade' }), cardId: integer('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }), amount: integer('amount').notNull(), received: integer('received').notNull().default(0), expiresAt: timestamp('expires_at').notNull(), createdAt: timestamp('created_at').notNull().defaultNow() });
export const requestDonations = pgTable('request_donations', { id: serial('id').primaryKey(), requestId: integer('request_id').notNull().references(() => cardRequests.id, { onDelete: 'cascade' }), donorId: integer('donor_id').notNull().references(() => users.id, { onDelete: 'cascade' }), amount: integer('amount').notNull().default(1), createdAt: timestamp('created_at').notNull().defaultNow() });
export const globalMessages = pgTable('global_messages', { id: serial('id').primaryKey(), userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), body: text('body').notNull(), createdAt: timestamp('created_at').notNull().defaultNow() });
export const chests = pgTable('chests', { id: serial('id').primaryKey(), userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), type: text('type').notNull().default('silver'), source: text('source').notNull().default('victory'), rewards: jsonb('rewards').$type<ChestReward[]>(), openedAt: timestamp('opened_at'), createdAt: timestamp('created_at').notNull().defaultNow() });
