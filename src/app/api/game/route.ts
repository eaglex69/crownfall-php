import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, cards, ownedCards, battles, clans, clanMessages, friends, settings, cardRequests, requestDonations, chests, leagues, tournaments, tournamentPlayers, pvpMatches } from '@/db/schema';
import { eq, and, or, sql, desc } from 'drizzle-orm';
import { getUser, getGameData, runLeagueSeason, resolveDeck } from '@/lib/game';
import { leagueFor, nextLeague, seasonKey } from '@/lib/leagues';
import { currentTournament, joinTournament, addTournamentScore, tournamentStandings } from '@/lib/tournaments';
import { cardPrice, requestAmount, donateReward } from '@/lib/cards';
import { CHEST_INFO, isChestType, rollChest, type ChestTypeName } from '@/lib/chestRewards';
class RuleError extends Error {}

const error=(message:string,status=400)=>NextResponse.json({error:message},{status});
export async function GET() { const user=await getUser(); return NextResponse.json(await getGameData(user)); }
export async function POST(req:NextRequest) {
  try {
    const user=await getUser(); if(!user) return error('Войдите в аккаунт, чтобы продолжить.',401);
    if(user.role!=='admin') { const [maintenance]=await db.select().from(settings).where(eq(settings.key,'maintenance')).limit(1); if(maintenance?.value==='true') return error('Сейчас идут технические работы. Попробуйте позже.',503); }
    const b=await req.json(); const action=String(b.action||'');
    if(action==='gift') {
      if(user.lastGiftAt && Date.now()-new Date(user.lastGiftAt).getTime()<86400000) return error('Подарок уже получен. Возвращайтесь завтра.');
      const rows=await db.select().from(settings);
      const gold=Number(rows.find(x=>x.key==='gift_gold')?.value||500); const gems=Number(rows.find(x=>x.key==='gift_gems')?.value||15);
      const updated=await db.update(users).set({gold:sql`${users.gold}+${gold}`,gems:sql`${users.gems}+${gems}`,lastGiftAt:new Date()}).where(and(eq(users.id,user.id),or(sql`${users.lastGiftAt} is null`,sql`${users.lastGiftAt} < now() - interval '24 hours'`))).returning();
      if(!updated.length) return error('Подарок уже получен.');
      return NextResponse.json({ok:true,message:`Получено: ${gold} золота и ${gems} кристаллов!`});
    }
    if(action==='upgrade') {
      const cardId=Number(b.cardId); const [owned]=await db.select().from(ownedCards).where(and(eq(ownedCards.userId,user.id),eq(ownedCards.cardId,cardId))).limit(1);
      if(!owned) return error('Карта не найдена.'); const needed=owned.level*10; const price=owned.level*500;
      if(owned.copies<needed || user.gold<price) return error('Недостаточно копий карты или золота.');
      await db.update(users).set({gold:sql`${users.gold}-${price}`,xp:sql`${users.xp}+50`}).where(eq(users.id,user.id));
      await db.update(ownedCards).set({level:owned.level+1,copies:owned.copies-needed}).where(eq(ownedCards.id,owned.id));
      return NextResponse.json({ok:true,message:'Карта улучшена!'});
    }
    if(action==='buy') {
      const cardId=Number(b.cardId); const [card]=await db.select().from(cards).where(eq(cards.id,cardId)).limit(1); if(!card||!card.enabled) return error('Карта недоступна.');
      if(card.unlockTrophies>user.trophies) return error(`Эта карта откроется на арене при ${card.unlockTrophies} кубках.`);
      const price=cardPrice(card.rarity);
      const updated=await db.update(users).set({gold:sql`${users.gold}-${price}`}).where(and(eq(users.id,user.id),sql`${users.gold} >= ${price}`)).returning();
      if(!updated.length) return error('Недостаточно золота.');
      await db.insert(ownedCards).values({userId:user.id,cardId,copies:1}).onConflictDoUpdate({target:[ownedCards.userId,ownedCards.cardId],set:{copies:sql`${ownedCards.copies}+1`}});
      return NextResponse.json({ok:true,message:`Карта «${card.name}» получена!`});
    }
    if(action==='pvpFind') {
      const [cfg]=await db.select().from(settings).where(eq(settings.key,'pvp_enabled')).limit(1);
      if(cfg?.value==='false') return error('PvP-арена временно отключена.');
      const ownedForPvp=await db.select({cardId:ownedCards.cardId}).from(ownedCards).where(eq(ownedCards.userId,user.id));
      const enabledForPvp=await db.select({id:cards.id,cost:cards.cost}).from(cards).where(eq(cards.enabled,true));
      const deckCards=resolveDeck(user.deck,new Set(ownedForPvp.map(o=>o.cardId)),enabledForPvp);
      if(deckCards.length!==8) return error('Сначала соберите колоду из 8 карт.');
      const rivals=await db.select({id:users.id,username:users.username,trophies:users.trophies,deck:users.deck,xp:users.xp,wildcards:users.wildcards}).from(users)
        .where(and(eq(users.banned,false),sql`${users.id} <> ${user.id}`,sql`${users.deck} <> ''`,sql`${users.battleStartedAt} is null or ${users.battleStartedAt} < now() - interval '10 minutes'`))
        .orderBy(sql`abs(${users.trophies} - ${user.trophies})`).limit(12);
      if(!rivals.length) return error('Сейчас нет свободных противников. Попробуйте через минуту.');
      const pick=rivals[Math.floor(Math.random()*Math.min(5,rivals.length))];
      const owned=await db.select({cardId:ownedCards.cardId,level:ownedCards.level}).from(ownedCards).where(eq(ownedCards.userId,pick.id));
      const lvl=new Map(owned.map(o=>[o.cardId,o.level]));
      const deck=pick.deck.split(',').map(Number).filter(n=>lvl.has(n));
      if(deck.length<4) return error('Противник ещё не собрал колоду. Попробуйте другого.');
      return NextResponse.json({ok:true,opponent:{id:pick.id,username:pick.username,trophies:pick.trophies,deck:deck.slice(0,8),levels:Object.fromEntries(deck.map(id=>[id,lvl.get(id)||1]))}});
    }
    if(action==='battleStart') {
      const mode=b.mode==='tournament'?'tournament':b.mode==='pvp'?'pvp':'ladder';
      if(mode==='pvp'){
        const opponentId=Number(b.opponentId);
        const [rival]=await db.select({id:users.id,username:users.username,banned:users.banned}).from(users).where(eq(users.id,opponentId)).limit(1);
        if(!rival||rival.banned) return error('Противник недоступен.');
        const started=await db.update(users).set({battleStartedAt:new Date(),battleMode:'pvp',pvpOpponentId:rival.id}).where(and(eq(users.id,user.id),sql`${users.battleStartedAt} is null`)).returning({id:users.id});
        if(!started.length) return error('У вас уже идёт бой.');
        return NextResponse.json({ok:true,mode});
      }
      const started=await db.update(users).set({battleStartedAt:new Date(),battleMode:mode,pvpOpponentId:null}).where(and(eq(users.id,user.id),sql`${users.battleStartedAt} is null`)).returning({id:users.id});
      if(!started.length) return error('У вас уже идёт бой.');
      if(mode==='tournament'){const t=await currentTournament();if(t)await joinTournament(t.id,user.id);}
      return NextResponse.json({ok:true,mode});
    }
    if(action==='battle') {
      if(!user.battleStartedAt) return error('Бой не найден или уже завершён.');
      const elapsed=(Date.now()-new Date(user.battleStartedAt).getTime())/1000;
      const result:'win'|'loss'|'draw'=b.result==='win'?'win':b.result==='draw'?'draw':'loss';
      const crowns=Math.max(0,Math.min(3,Math.floor(Number(b.crowns))||0));
      if(result!=='loss' && elapsed<25) return error('Бой слишком короткий, чтобы засчитать результат.');
      const trophyChange=result==='win'?20+crowns*5:result==='draw'?0:-15;
      const gold=result==='win'?100+crowns*25:result==='draw'?60:40;
      const chestType:ChestTypeName=result==='win'?(Math.random()<0.14?'magic':Math.random()<0.28?'gold':'silver'):'silver';
      try {
        const settled=await db.transaction(async(tx)=>{
          const cleared=await tx.update(users).set({battleStartedAt:null,battleMode:'ladder',trophies:sql`greatest(0,${users.trophies}+${trophyChange})`,gold:sql`${users.gold}+${gold}`,xp:sql`${users.xp}+${result==='win'?80:result==='draw'?40:20}`,wins:sql`${users.wins}+${result==='win'?1:0}`,losses:sql`${users.losses}+${result==='loss'?1:0}`,tournamentWins:sql`${users.tournamentWins}+${result==='win'&&user.battleMode==='tournament'?1:0}`}).where(and(eq(users.id,user.id),sql`${users.battleStartedAt} is not null`)).returning({id:users.id});
          if(!cleared.length) throw new RuleError('Бой уже завершён.');
          await tx.insert(battles).values({userId:user.id,opponent:String(b.opponent||'Страж арены').slice(0,40),result,crowns,trophies:trophyChange,gold,mode:user.battleMode,opponentId:user.pvpOpponentId||null,crownsLost:Math.max(0,Math.min(3,Math.floor(Number(b.crownsLost))||0))});
          if(user.battleMode==='pvp'&&user.pvpOpponentId){
            const crownsLost=Math.max(0,Math.min(3,Math.floor(Number(b.crownsLost))||0));
            const pvpResult=crowns>crownsLost?'win':crowns<crownsLost?'loss':'draw';
            await tx.insert(pvpMatches).values({attackerId:user.id,defenderId:user.pvpOpponentId,attackerCrowns:crowns,defenderCrowns:crownsLost,result:pvpResult,trophies:trophyChange});
            await tx.update(users).set({pvpOpponentId:null}).where(eq(users.id,user.id));
          }
          if(user.battleMode==='tournament'&&result==='win'){const t=await currentTournament();if(t)await addTournamentScore(t.id,user.id,crowns,true);}
          else if(user.battleMode==='tournament'){const t=await currentTournament();if(t)await addTournamentScore(t.id,user.id,crowns,false);}
          let chestRow:{id:number}|undefined;
          if(result==='win') [chestRow]=await tx.insert(chests).values({userId:user.id,type:chestType,source:user.battleMode==='tournament'?'tournament-victory':'victory'}).returning({id:chests.id});
          return chestRow;
        });
        const message=result==='win'?`Победа! +${trophyChange} кубков, +${gold} золота${settled?` · получен ${CHEST_INFO[chestType].title.toLowerCase()}`:''}`:result==='draw'?`Ничья. +${gold} золота`:`Поражение. ${trophyChange} кубков, +${gold} золота`;
        return NextResponse.json({ok:true,message,reward:{trophies:trophyChange,gold,crowns,result},chest:settled?{id:settled.id,type:chestType,title:CHEST_INFO[chestType].title}:null});
      } catch(e) { if(e instanceof RuleError) return error(e.message); throw e; }
    }
    if(action==='equipTowerSkin') {
      const name=String(b.name||''); const cosmetic=(user.cosmetics||[]).find((c)=>c.type==='towerSkin'&&c.name===name);
      if(!cosmetic) return error('Этот облик башни ещё не открыт.');
      await db.update(users).set({towerSkin:name}).where(eq(users.id,user.id));
      return NextResponse.json({ok:true,message:`Экипирован облик «${name}».`});
    }
    if(action==='equipEmote') {
      const name=String(b.name||''); const cosmetic=(user.cosmetics||[]).find((c)=>c.type==='emote'&&c.name===name);
      if(!cosmetic) return error('Этот эмодзи ещё не открыт.');
      await db.update(users).set({activeEmote:name}).where(eq(users.id,user.id));
      return NextResponse.json({ok:true,message:`Выбран эмодзи «${name}».`});
    }
    if(action==='equipBanner') {
      const name=String(b.name||''); const cosmetic=(user.cosmetics||[]).find((c)=>c.type==='banner'&&c.name===name);
      if(!cosmetic) return error('Этот боевой баннер ещё не открыт.');
      await db.update(users).set({activeBanner:name}).where(eq(users.id,user.id));
      return NextResponse.json({ok:true,message:`Экипирован баннер «${name}».`});
    }
    if(action==='buyChest') {
      const type=b.type as ChestTypeName;
      if(!isChestType(type)||type==='wood'||type==='tournament') return error('Этот сундук нельзя купить.');
      const info=CHEST_INFO[type];
      const priceField=info.priceGems?'gems':'gold'; const price=info.priceGems||info.priceGold;
      try {
        const opened=await db.transaction(async(tx)=>{
          const debit=priceField==='gems'
            ? await tx.update(users).set({gems:sql`${users.gems}-${price}`}).where(and(eq(users.id,user.id),sql`${users.gems} >= ${price}`)).returning({id:users.id})
            : await tx.update(users).set({gold:sql`${users.gold}-${price}`}).where(and(eq(users.id,user.id),sql`${users.gold} >= ${price}`)).returning({id:users.id});
          if(!debit.length) throw new RuleError(`Недостаточно ${priceField==='gems'?'кристаллов':'золота'}.`);
          const [row]=await tx.insert(chests).values({userId:user.id,type,source:'shop'}).returning({id:chests.id});
          return row;
        });
        return NextResponse.json({ok:true,message:`Куплен ${info.title}.`,chestId:opened.id});
      } catch(e) { if(e instanceof RuleError) return error(e.message); throw e; }
    }
    if(action==='openChest') {
      const chestId=Number(b.chestId);
      try {
        const rewards=await db.transaction(async(tx)=>{
          const [chest]=await tx.select().from(chests).where(and(eq(chests.id,chestId),eq(chests.userId,user.id),sql`${chests.openedAt} is null`)).limit(1);
          if(!chest) throw new RuleError('Сундук уже открыт или не найден.');
          const [lootPlayer]=await tx.select({trophies:users.trophies,wildcards:users.wildcards,cosmetics:users.cosmetics}).from(users).where(eq(users.id,user.id)).limit(1);
          if(!lootPlayer) throw new RuleError('Игрок не найден.');
          const pool=await tx.select().from(cards).where(and(eq(cards.enabled,true),sql`${cards.unlockTrophies} <= ${lootPlayer.trophies}`));
          const rolled=rollChest((isChestType(chest.type)?chest.type:'silver'),pool,lootPlayer.trophies);
          const claimed=await tx.update(chests).set({openedAt:new Date(),rewards:rolled}).where(and(eq(chests.id,chest.id),eq(chests.userId,user.id),sql`${chests.openedAt} is null`)).returning({id:chests.id});
          if(!claimed.length) throw new RuleError('Сундук уже открыт.');
          let goldAdd=0,gemsAdd=0,evoAdd=0;
          const wild={...(lootPlayer.wildcards||{common:0,rare:0,epic:0,legendary:0,champion:0})};
          const cosmetics=[...(lootPlayer.cosmetics||[])];
          for(const r of rolled){
            if(r.kind==='gold') goldAdd+=r.amount;
            else if(r.kind==='gems') gemsAdd+=r.amount;
            else if(r.kind==='evolution') evoAdd+=r.amount;
            else if(r.kind==='wildcard') { const key=String(r.image||'common');wild[key]=(wild[key]||0)+r.amount; }
            else if(r.kind==='cosmetic') {
              const cosType=String(r.image||'emote');
              const have=cosmetics.some(c=>c.type===cosType&&c.name===r.name);
              if(have) gemsAdd+=25;
              else cosmetics.push({type:cosType,name:r.name,art:cosType==='towerSkin'?'tower':cosType});
            } else if(r.kind==='card'&&r.cardId) {
              await tx.insert(ownedCards).values({userId:user.id,cardId:r.cardId,copies:r.amount}).onConflictDoUpdate({target:[ownedCards.userId,ownedCards.cardId],set:{copies:sql`${ownedCards.copies}+${r.amount}`}});
            }
          }
          await tx.update(users).set({gold:sql`${users.gold}+${goldAdd}`,gems:sql`${users.gems}+${gemsAdd}`,evolutionFragments:sql`${users.evolutionFragments}+${evoAdd}`,wildcards:wild,cosmetics}).where(eq(users.id,user.id));
          return rolled;
        });
        return NextResponse.json({ok:true,message:`Сундук открыт! Получено наград: ${rewards.length}.`,rewards});
      } catch(e) { if(e instanceof RuleError) return error(e.message); throw e; }
    }
    if(action==='tournamentChest') {
      try {
        const row=await db.transaction(async(tx)=>{
          const [p]=await tx.select({wins:users.tournamentWins,claims:users.tournamentClaims}).from(users).where(eq(users.id,user.id)).limit(1);
          if(!p||p.wins<(p.claims+1)*3) throw new RuleError('Нужно одержать ещё победы в турнире.');
          const got=await tx.update(users).set({tournamentClaims:sql`${users.tournamentClaims}+1`}).where(and(eq(users.id,user.id),sql`${users.tournamentWins} >= (${users.tournamentClaims}+1)*3`)).returning({id:users.id});
          if(!got.length) throw new RuleError('Награда за эти победы уже получена.');
          const [chest]=await tx.insert(chests).values({userId:user.id,type:'tournament',source:'tournament-prize'}).returning({id:chests.id});
          return chest;
        });
        return NextResponse.json({ok:true,message:'Турнирный сундук добавлен в инвентарь.',chestId:row.id});
      } catch(e) { if(e instanceof RuleError) return error(e.message); throw e; }
    }
    if(action==='leagueClaim') {
      try {
        const season=seasonKey();
        const out=await db.transaction(async(tx)=>{
          const [me]=await tx.select({trophies:users.trophies,leagueChestSeason:users.leagueChestSeason,leagueSeason:users.leagueSeason}).from(users).where(eq(users.id,user.id)).limit(1);
          if(!me) throw new RuleError('Игрок не найден.');
          const list=await tx.select().from(leagues).orderBy(leagues.order,leagues.minTrophies);
          const league=leagueFor(list,me.trophies);
          if(!league) throw new RuleError('Лига не найдена.');
          if(me.leagueChestSeason===season) throw new RuleError('Награда за эту лигу в текущем сезоне уже получена.');
          const claimed=await tx.update(users).set({leagueChestSeason:season,leagueSeason:season,gold:sql`${users.gold}+${league.rewardGold}`,gems:sql`${users.gems}+${league.rewardGems}`}).where(and(eq(users.id,user.id),sql`${users.leagueChestSeason} <> ${season}`)).returning({id:users.id});
          if(!claimed.length) throw new RuleError('Награда за эту лигу уже получена.');
          const [chest]=await tx.insert(chests).values({userId:user.id,type:league.chestType,source:'league'}).returning({id:chests.id});
          return {league,chest};
        });
        return NextResponse.json({ok:true,message:`Награда лиги «${out.league.name}» получена: сундук, +${out.league.rewardGold} золота и +${out.league.rewardGems} кристаллов.`,chestId:out.chest.id});
      } catch(e) { if(e instanceof RuleError) return error(e.message); throw e; }
    }
    if(action==='tournamentClaim') {
      try {
        const t=await currentTournament();
        if(!t) return error('Турнир сейчас не проводится.');
        if(new Date(t.endsAt).getTime()>Date.now()) return error('Турнир ещё не завершён.');
        const [row]=await db.select().from(tournamentPlayers).where(and(eq(tournamentPlayers.tournamentId,t.id),eq(tournamentPlayers.userId,user.id))).limit(1);
        if(!row) return error('Вы не участвовали в этом турнире.');
        const standings=await tournamentStandings(t.id);
        const place=standings.findIndex(s=>s.userId===user.id)+1;
        if(!place) return error('Результат не найден.');
        const claimed=await db.update(tournamentPlayers).set({claimed:true}).where(and(eq(tournamentPlayers.id,row.id),eq(tournamentPlayers.claimed,false))).returning({id:tournamentPlayers.id});
        if(!claimed.length) return error('Награда за этот турнир уже получена.');
        const [chest]=await db.insert(chests).values({userId:user.id,type:place<=3?'legendary':place<=10?'magic':'tournament',source:'tournament-prize'}).returning({id:chests.id});
        const bonus=place<=3?1500:place<=10?800:300;
        await db.update(users).set({gold:sql`${users.gold}+${bonus}`}).where(eq(users.id,user.id));
        return NextResponse.json({ok:true,message:`Турнир завершён! Ваше место: ${place}. Награда: сундук и +${bonus} золота.`,chestId:chest.id,place});
      } catch(e) { if(e instanceof RuleError) return error(e.message); throw e; }
    }
    if(action==='pvpSeen') {
      await db.update(pvpMatches).set({seen:true}).where(and(eq(pvpMatches.defenderId,user.id),eq(pvpMatches.seen,false)));
      return NextResponse.json({ok:true});
    }
    if(action==='setDeck') {
      const ids:number[]=Array.isArray(b.deck)?b.deck.map(Number):[]; const uniq=[...new Set(ids)];
      if(uniq.length!==8||uniq.some(n=>!Number.isInteger(n))) return error('В колоде должно быть ровно 8 разных карт.');
      const own=await db.select({cardId:ownedCards.cardId}).from(ownedCards).where(eq(ownedCards.userId,user.id)); const set=new Set(own.map(o=>o.cardId));
      if(!uniq.every(n=>set.has(n))) return error('В колоду можно поставить только открытые карты.');
      await db.update(users).set({deck:uniq.join(',')}).where(eq(users.id,user.id));
      return NextResponse.json({ok:true,message:'Колода сохранена.'});
    }
    if(action==='requestCards') {
      if(!user.clanId) return error('Чтобы просить фрагменты, вступите в клан.');
      const cardId=Number(b.cardId);
      const [owned]=await db.select().from(ownedCards).where(and(eq(ownedCards.userId,user.id),eq(ownedCards.cardId,cardId))).limit(1);
      if(!owned) return error('Просить можно только открытые карты.');
      const [card]=await db.select().from(cards).where(eq(cards.id,cardId)).limit(1);
      if(!card||!card.enabled) return error('Карта недоступна.');
      const [cd]=await db.select().from(settings).where(eq(settings.key,'request_cooldown_minutes')).limit(1);
      const minutes=Math.max(1,Math.round(Number(cd?.value)||30));
      const claimed=await db.update(users).set({lastRequestAt:new Date()}).where(and(eq(users.id,user.id),or(sql`${users.lastRequestAt} is null`,sql`${users.lastRequestAt} < now() - make_interval(mins => ${minutes})`))).returning({id:users.id});
      if(!claimed.length) return error(`Просить фрагменты можно раз в ${minutes} мин. Подождите немного.`);
      const amount=requestAmount(card.rarity);
      const [reqRow]=await db.insert(cardRequests).values({userId:user.id,clanId:user.clanId,cardId,amount,expiresAt:new Date(Date.now()+8*3600000)}).returning();
      await db.insert(clanMessages).values({clanId:user.clanId,userId:user.id,body:`Просит фрагменты: ${card.name}`,kind:'request',requestId:reqRow.id});
      return NextResponse.json({ok:true,message:`Просьба отправлена в чат клана: «${card.name}», до ${amount} шт.`});
    }
    if(action==='donate') {
      if(!user.clanId) return error('Вы не состоите в клане.');
      const requestId=Number(b.requestId); const clanId=user.clanId;
      try {
        const message=await db.transaction(async(tx)=>{
          const [r]=await tx.select().from(cardRequests).where(eq(cardRequests.id,requestId)).limit(1);
          if(!r||r.clanId!==clanId) throw new RuleError('Просьба не найдена.');
          if(r.userId===user.id) throw new RuleError('Нельзя отправить фрагмент самому себе.');
          if(r.expiresAt.getTime()<Date.now()) throw new RuleError('Срок просьбы истёк.');
          const [card]=await tx.select().from(cards).where(eq(cards.id,r.cardId)).limit(1);
          if(!card) throw new RuleError('Карта не найдена.');
          const taken=await tx.update(ownedCards).set({copies:sql`${ownedCards.copies}-1`}).where(and(eq(ownedCards.userId,user.id),eq(ownedCards.cardId,r.cardId),sql`${ownedCards.copies} >= 1`)).returning({id:ownedCards.id});
          if(!taken.length) throw new RuleError('У вас нет копий этой карты.');
          const bumped=await tx.update(cardRequests).set({received:sql`${cardRequests.received}+1`}).where(and(eq(cardRequests.id,r.id),sql`${cardRequests.received} < ${cardRequests.amount}`)).returning({id:cardRequests.id});
          if(!bumped.length) throw new RuleError('Эта просьба уже выполнена.');
          await tx.insert(ownedCards).values({userId:r.userId,cardId:r.cardId,copies:1}).onConflictDoUpdate({target:[ownedCards.userId,ownedCards.cardId],set:{copies:sql`${ownedCards.copies}+1`}});
          const reward=donateReward(card.rarity);
          await tx.update(users).set({gold:sql`${users.gold}+${reward}`,xp:sql`${users.xp}+10`}).where(eq(users.id,user.id));
          await tx.insert(requestDonations).values({requestId:r.id,donorId:user.id,amount:1});
          return `Вы отправили фрагмент «${card.name}». Награда: +${reward} золота.`;
        });
        return NextResponse.json({ok:true,message});
      } catch(e) { if(e instanceof RuleError) return error(e.message); throw e; }
    }
    if(action==='createClan') {
      if(user.clanId) return error('Сначала покиньте текущий клан.'); const name=String(b.name||'').trim(); const description=String(b.description||'').trim().slice(0,180);
      if(name.length<3||name.length>25) return error('Название клана: от 3 до 25 символов.');
      if(user.gold<1000) return error('Для создания клана нужно 1000 золота.');
      const existing=await db.select().from(clans).where(sql`lower(${clans.name})=lower(${name})`).limit(1); if(existing.length) return error('Такой клан уже существует.');
      const [clan]=await db.insert(clans).values({name,description,ownerId:user.id,badge:['blue','red','purple','green'].includes(b.badge)?b.badge:'blue'}).returning();
      await db.update(users).set({clanId:clan.id,gold:sql`${users.gold}-1000`}).where(eq(users.id,user.id));
      return NextResponse.json({ok:true,message:'Клан создан!'});
    }
    if(action==='joinClan') { if(user.clanId) return error('Сначала покиньте текущий клан.'); const [clan]=await db.select().from(clans).where(eq(clans.id,Number(b.clanId))).limit(1); if(!clan) return error('Клан не найден.'); await db.update(users).set({clanId:clan.id}).where(eq(users.id,user.id)); return NextResponse.json({ok:true,message:`Вы вступили в клан «${clan.name}»!`}); }
    if(action==='leaveClan') { if(!user.clanId) return error('Вы не состоите в клане.'); const [clan]=await db.select().from(clans).where(eq(clans.id,user.clanId)).limit(1); await db.update(users).set({clanId:null}).where(eq(users.id,user.id)); if(clan?.ownerId===user.id) { const [next]=await db.select().from(users).where(eq(users.clanId,clan.id)).orderBy(desc(users.trophies)).limit(1); if(next) await db.update(clans).set({ownerId:next.id}).where(eq(clans.id,clan.id)); else await db.delete(clans).where(eq(clans.id,clan.id)); } return NextResponse.json({ok:true,message:'Вы покинули клан.'}); }
    if(action==='clanChat') { if(!user.clanId) return error('Вы не состоите в клане.'); const body=String(b.body||'').trim().slice(0,300); if(!body) return error('Введите сообщение.'); await db.insert(clanMessages).values({clanId:user.clanId,userId:user.id,body}); return NextResponse.json({ok:true,message:'Сообщение отправлено.'}); }
    if(action==='friendRequest') {
      const name=String(b.username||'').trim(); const [target]=await db.select().from(users).where(sql`lower(${users.username})=lower(${name})`).limit(1); if(!target) return error('Игрок не найден.'); if(target.id===user.id) return error('Нельзя добавить себя.');
      const existing=await db.select().from(friends).where(or(and(eq(friends.requesterId,user.id),eq(friends.recipientId,target.id)),and(eq(friends.requesterId,target.id),eq(friends.recipientId,user.id)))).limit(1);
      if(existing.length) return error('Заявка уже отправлена или вы уже друзья.');
      await db.insert(friends).values({requesterId:user.id,recipientId:target.id}); return NextResponse.json({ok:true,message:'Заявка в друзья отправлена.'});
    }
    if(action==='acceptFriend') { const [f]=await db.update(friends).set({status:'accepted'}).where(and(eq(friends.id,Number(b.id)),eq(friends.recipientId,user.id),eq(friends.status,'pending'))).returning(); if(!f) return error('Заявка не найдена.'); return NextResponse.json({ok:true,message:'Теперь вы друзья!'}); }
    if(action==='removeFriend') { await db.delete(friends).where(and(eq(friends.id,Number(b.id)),or(eq(friends.requesterId,user.id),eq(friends.recipientId,user.id)))); return NextResponse.json({ok:true,message:'Список друзей обновлён.'}); }
    return error('Неизвестное действие.');
  } catch(e) { console.error('game',e); return error('Ошибка сервера. Попробуйте ещё раз.',500); }
}
