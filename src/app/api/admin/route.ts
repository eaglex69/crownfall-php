import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, cards, ownedCards, clans, announcements, settings, auditLogs, globalMessages, leagues, tournaments, tournamentPlayers } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { getUser } from '@/lib/game';
const fail=(message:string,status=400)=>NextResponse.json({error:message},{status});
export async function GET() {
  const admin=await getUser(); if(admin?.role!=='admin') return fail('Доступ запрещён.',403);
  const [playerList,cardList,clanList,newsList,config,logs,stats,chatList]=await Promise.all([
    db.select({id:users.id,username:users.username,email:users.email,role:users.role,banned:users.banned,gold:users.gold,gems:users.gems,trophies:users.trophies,wins:users.wins,clanId:users.clanId,createdAt:users.createdAt}).from(users).orderBy(desc(users.id)).limit(200),
    db.select().from(cards).orderBy(cards.id),db.select().from(clans).orderBy(desc(clans.id)),
    db.select().from(announcements).orderBy(desc(announcements.id)),db.select().from(settings),
    db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(80),
    db.select({players:sql<number>`(select count(*)::int from users)`,battles:sql<number>`(select count(*)::int from battles)`,clans:sql<number>`(select count(*)::int from clans)`,totalGold:sql<number>`(select coalesce(sum(gold),0)::int from users)`}).from(users).limit(1),
    db.select({id:globalMessages.id,body:globalMessages.body,createdAt:globalMessages.createdAt,username:users.username}).from(globalMessages).innerJoin(users,eq(globalMessages.userId,users.id)).orderBy(desc(globalMessages.id)).limit(100)
  ]);
  const [leagueList,tournamentList]=await Promise.all([db.select().from(leagues).orderBy(leagues.order,leagues.minTrophies),db.select().from(tournaments).orderBy(desc(tournaments.startsAt)).limit(30)]);
  const participants=await db.select({tournamentId:tournamentPlayers.tournamentId,count:sql<number>`count(*)::int`}).from(tournamentPlayers).groupBy(tournamentPlayers.tournamentId);
  return NextResponse.json({players:playerList,cards:cardList,clans:clanList,news:newsList,settings:config,logs,stats:stats[0],chat:chatList,leagues:leagueList,tournaments:tournamentList.map(t=>({...t,players:participants.find(p=>p.tournamentId===t.id)?.count||0}))});
}
export async function POST(req:NextRequest) {
  try {
    const admin=await getUser(); if(admin?.role!=='admin') return fail('Доступ запрещён.',403);
    const b=await req.json(); const action=String(b.action||''); let detail='';
    if(action==='user') {
      const id=Number(b.id); const [target]=await db.select().from(users).where(eq(users.id,id)).limit(1); if(!target) return fail('Игрок не найден.');
      const field=String(b.field); if(!['gold','gems','trophies','role','banned'].includes(field)) return fail('Недопустимое поле.');
      if(field==='role') { if(id===admin.id && b.value!=='admin') return fail('Нельзя снять права с себя.'); await db.update(users).set({role:b.value==='admin'?'admin':'player'}).where(eq(users.id,id)); }
      else if(field==='banned') { if(id===admin.id) return fail('Нельзя заблокировать себя.'); await db.update(users).set({banned:Boolean(b.value)}).where(eq(users.id,id)); }
      else await db.update(users).set({[field]:Math.max(0,Math.min(9999999,Number(b.value)||0))}).where(eq(users.id,id));
      detail=`${target.username}: ${field} → ${b.value}`;
    } else if(action==='card') {
      const id=Number(b.id); const [target]=await db.select().from(cards).where(eq(cards.id,id)).limit(1); if(!target) return fail('Карта не найдена.');
      const field=String(b.field);
      const ints:Record<string,[number,number]>={cost:[0,10],damage:[0,99999],health:[1,99999],count:[1,12],lifetime:[0,300]};
      const reals:Record<string,[number,number]>={speed:[0,6],range:[0,15],attackSpeed:[0.2,10],splash:[0,8]};
      const texts=['description','name','rarity','role','pros','cons','image'];
      let value:string|number|boolean;
      if(field==='enabled') value=Boolean(b.value);
      else if(ints[field]) value=Math.round(Math.max(ints[field][0],Math.min(ints[field][1],Number(b.value)||0)));
      else if(reals[field]) value=Math.max(reals[field][0],Math.min(reals[field][1],Number(b.value)||0));
      else if(texts.includes(field)) {
        value=String(b.value||'').slice(0,240);
        if(field==='image'&&!/^\/images\/[\w./-]+$/.test(String(value))) return fail('Путь к изображению должен начинаться с /images/');
      }
      else return fail('Недопустимое поле.');
      await db.update(cards).set({[field]:value}).where(eq(cards.id,id)); detail=`Карта ${target.name}: ${field} → ${value}`;
    } else if(action==='newsCreate') {
      const title=String(b.title||'').trim().slice(0,80); const body=String(b.body||'').trim().slice(0,500);
      if(!title||!body) return fail('Заполните заголовок и текст.'); await db.insert(announcements).values({title,body}); detail=`Опубликована новость: ${title}`;
    } else if(action==='newsDelete') { await db.delete(announcements).where(eq(announcements.id,Number(b.id))); detail=`Удалена новость #${b.id}`;
    } else if(action==='newsToggle') { await db.update(announcements).set({active:Boolean(b.value)}).where(eq(announcements.id,Number(b.id))); detail=`Новость #${b.id}: активность ${b.value}`;
    } else if(action==='clanDelete') { const id=Number(b.id); await db.update(users).set({clanId:null}).where(eq(users.clanId,id)); await db.delete(clans).where(eq(clans.id,id)); detail=`Удалён клан #${id}`;
    } else if(action==='setting') {
      const key=String(b.key);
      const limits:Record<string,[number,number]>={gift_gold:[0,100000],gift_gems:[0,100000],elixir_seconds:[0.5,10],battle_seconds:[30,600],request_cooldown_minutes:[1,720]};
      if(key!=='maintenance'&&key!=='arena_difficulty'&&!limits[key]) return fail('Недопустимая настройка.');
      const value=key==='maintenance'?String(Boolean(b.value)):key==='arena_difficulty'?String(b.value):String(Math.max(limits[key][0],Math.min(limits[key][1],Number(b.value)||limits[key][0])));
      await db.insert(settings).values({key,value}).onConflictDoUpdate({target:settings.key,set:{value}}); detail=`Настройка ${key} → ${value}`;
    } else if(action==='chatDelete') { await db.delete(globalMessages).where(eq(globalMessages.id,Number(b.id))); detail=`Удалено сообщение общего чата #${b.id}`;
    } else if(action==='chatClear') { await db.delete(globalMessages); detail='Общий чат очищен';
    } else if(action==='league') {
      const field=String(b.field); const id=Number(b.id);
      const allowed=['name','chestType','rewardGold','rewardGems','color','minTrophies'];
      if(!allowed.includes(field)) return fail('Недопустимое поле.');
      if(field==='name'){const value=String(b.value||'').trim().slice(0,40);if(!value)return fail('Укажите название.');await db.update(leagues).set({name:value}).where(eq(leagues.id,id));}
      else if(field==='chestType'){const value=String(b.value||'');if(!['wood','silver','gold','magic','legendary','tournament'].includes(value))return fail('Неизвестный тип сундука.');await db.update(leagues).set({chestType:value}).where(eq(leagues.id,id));}
      else if(field==='color'){const value=String(b.value||'blue');await db.update(leagues).set({color:value}).where(eq(leagues.id,id));}
      else {const value=Math.max(0,Math.min(999999,Number(b.value)||0));await db.update(leagues).set({[field]:value}).where(eq(leagues.id,id));}
      detail=`Лига #${id}: ${field} → ${b.value}`;
    } else if(action==='leagueCreate') {
      const name=String(b.name||'').trim().slice(0,40);
      if(name.length<2) return fail('Укажите название лиги.');
      const chestType=String(b.chestType||'silver');
      if(!['wood','silver','gold','magic','legendary','tournament'].includes(chestType)) return fail('Неизвестный тип сундука.');
      const [max]=await db.select({o:sql<number>`coalesce(max(${leagues.order}),0)::int`}).from(leagues);
      await db.insert(leagues).values({name,minTrophies:Math.max(0,Math.min(99999,Number(b.minTrophies)||0)),order:(max?.o||0)+1,chestType,rewardGold:Math.max(0,Number(b.rewardGold)||0),rewardGems:Math.max(0,Number(b.rewardGems)||0),color:String(b.color||'blue')});
      detail=`Создана лига «${name}»`;
    } else if(action==='leagueDelete') { const id=Number(b.id); await db.delete(leagues).where(eq(leagues.id,id)); detail=`Удалена лига #${id}`;
    } else if(action==='leagueReset') {
      await db.update(users).set({trophies:sql`greatest(0, (${users.trophies} * 7) / 10)::int`,leagueChestSeason:''});
      await db.insert(settings).values({key:'league_season',value:''}).onConflictDoUpdate({target:settings.key,set:{value:''}});
      detail='Сброшены лиги: кубки −30%';
    } else if(action==='tournamentCreate') {
      const name=String(b.name||'').trim().slice(0,80); if(!name) return fail('Укажите название турнира.');
      const chestType=String(b.chestType||'tournament');
      if(!['wood','silver','gold','magic','legendary','tournament'].includes(chestType)) return fail('Неизвестный тип сундука.');
      const days=Math.max(1,Math.min(30,Number(b.days)||7));
      const [t]=await db.insert(tournaments).values({name,description:String(b.description||'').slice(0,400),startsAt:new Date(),endsAt:new Date(Date.now()+days*86400000),chestType,auto:false,active:true}).returning();
      detail=`Создан турнир «${name}»`;
      return NextResponse.json({ok:true,message:'Турнир создан.',id:t.id});
    } else if(action==='tournamentToggle') { const id=Number(b.id); await db.update(tournaments).set({active:Boolean(b.value)}).where(eq(tournaments.id,id)); detail=`Турнир #${id}: активность ${b.value}`;
    } else if(action==='tournamentDelete') { const id=Number(b.id); await db.delete(tournaments).where(eq(tournaments.id,id)); detail=`Удалён турнир #${id}`;
    } else if(action==='cardCreate') {
      const name=String(b.name||'').trim(); const image=String(b.image||'').trim();
      if(name.length<2||name.length>60) return fail('Название карты от 2 до 60 символов.');
      if(!/^\/images\/[\w./-]+$/.test(image)) return fail('Укажите путь к изображению вида /images/....');
      const rarity=String(b.rarity||'Обычная');
      if(!['Обычная','Редкая','Эпическая','Легендарная','Чемпион'].includes(rarity)) return fail('Неизвестная редкость.');
      const kind=String(b.kind||'ground');
      if(!['ground','air','building','spell'].includes(kind)) return fail('Неизвестный тип карты.');
      const clampInt=(v:unknown,min:number,max:number)=>Math.max(min,Math.min(max,Math.round(Number(v)||min)));
      const clampReal=(v:unknown,min:number,max:number)=>Math.max(min,Math.min(max,Number(v)||min));
      const [dup]=await db.select({id:cards.id}).from(cards).where(sql`lower(${cards.name}) = lower(${name})`).limit(1);
      if(dup) return fail('Карта с таким названием уже существует.');
      const [card]=await db.insert(cards).values({
        name,image,rarity,cost:clampInt(b.cost,0,10),damage:clampInt(b.damage,0,99999),health:clampInt(b.health,1,99999),
        description:String(b.description||'').slice(0,400),kind,targets:['ground','all','buildings'].includes(String(b.targets))?String(b.targets):'ground',
        speed:clampReal(b.speed,0,6),range:clampReal(b.range,0,15),attackSpeed:clampReal(b.attackSpeed,0.2,10),
        count:clampInt(b.count,1,12),splash:clampReal(b.splash,0,8),lifetime:clampInt(b.lifetime,0,300),
        ability:String(b.ability||'').slice(0,40),unlockTrophies:clampInt(b.unlockTrophies,0,99999),
        role:String(b.role||'').slice(0,60),pros:String(b.pros||'').slice(0,240),cons:String(b.cons||'').slice(0,240),enabled:true,
      }).returning();
      detail=`Создана карта «${name}» #${card.id}`;
      return NextResponse.json({ok:true,message:`Карта «${name}» создана.`,id:card.id});
    } else if(action==='cardDelete') { const id=Number(b.id); const [c]=await db.select().from(cards).where(eq(cards.id,id)).limit(1); if(!c) return fail('Карта не найдена.'); await db.delete(ownedCards).where(eq(ownedCards.cardId,id)); detail=`Удалена карта «${c.name}»`; await db.delete(cards).where(eq(cards.id,id));
    } else return fail('Неизвестное действие.');
    await db.insert(auditLogs).values({adminId:admin.id,action,detail}); return NextResponse.json({ok:true,message:'Изменения сохранены.'});
  } catch(e) { console.error('admin',e); return fail('Не удалось сохранить изменения.',500); }
}
