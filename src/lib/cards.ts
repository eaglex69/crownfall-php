// Каталог карт и общие хелперы (без зависимостей от БД — можно использовать и на клиенте).
export type CardDef = {
  name: string; image: string; rarity: string; cost: number; damage: number; health: number;
  kind: 'ground' | 'air' | 'building' | 'spell'; targets: 'ground' | 'all' | 'buildings';
  speed: number; range: number; attackSpeed: number; count: number; splash: number; lifetime: number;
  ability: string; unlockTrophies: number; role: string; pros: string; cons: string; description: string;
};
export const CARDS_VERSION = '5';

type T = Partial<CardDef> & Pick<CardDef, 'name' | 'image' | 'rarity' | 'cost' | 'damage' | 'health' | 'role' | 'pros' | 'cons' | 'description'>;
const c = (x: T): CardDef => ({ kind: 'ground', targets: 'ground', speed: 1.3, range: 0.5, attackSpeed: 1.2, count: 1, splash: 0, lifetime: 0, ability: '', unlockTrophies: 0, ...x });

const ORIGINAL_CARDS: CardDef[] = [
  // ---- Прежние карты (характеристики пересмотрены) ----
  c({ name: 'Тёмный рыцарь', image: '/images/knight.jpg', rarity: 'Обычная', cost: 3, damage: 120, health: 950, attackSpeed: 1.2, speed: 1.3, role: 'Универсал', pros: 'Крепкий и надёжный боец за свою цену', cons: 'Не может атаковать воздушные цели', description: 'Отважный воин, который всегда первым вступает в бой.' }),
  c({ name: 'Белый маг', image: '/images/mage.jpg', rarity: 'Редкая', cost: 4, damage: 150, health: 430, attackSpeed: 1.4, speed: 1.2, range: 5, splash: 1, targets: 'all', role: 'Маг', pros: 'Бьёт по площади и достаёт воздушные цели', cons: 'Очень хрупкий — боится быстрых бойцов', description: 'Поражает врагов магическими снарядами на расстоянии.' }),
  c({ name: 'Красный бес', image: '/images/demon.jpg', rarity: 'Эпическая', cost: 5, damage: 280, health: 800, attackSpeed: 1.3, speed: 2.1, ability: 'deathbomb', role: 'Штурмовик', pros: 'Быстрый, а после гибели взрывается', cons: 'Дорогой и не атакует воздух', description: 'Стремительный боец. Погибая, он взрывается и ранит всех вокруг.' }),
  c({ name: 'Ледяной голем', image: '/images/golem.jpg', rarity: 'Редкая', cost: 4, damage: 70, health: 1550, attackSpeed: 2.0, speed: 0.9, range: 0.6, targets: 'buildings', ability: 'slow', role: 'Танк', pros: 'Огромный запас здоровья, замедляет цели', cons: 'Слабый урон, игнорирует войска', description: 'Идёт прямо к башням, замораживая всё на своём пути.' }),
  c({ name: 'Королевский страж', image: '/images/knight.jpg@40', rarity: 'Обычная', cost: 3, damage: 85, health: 1150, attackSpeed: 1.0, speed: 1.1, role: 'Страж', pros: 'Очень прочный для своей цены', cons: 'Медленный, невысокий урон', description: 'Верный защитник королевской башни.' }),
  c({ name: 'Архимаг', image: '/images/mage.jpg@180', rarity: 'Эпическая', cost: 6, damage: 360, health: 500, attackSpeed: 1.9, speed: 1.1, range: 6.5, splash: 1.5, targets: 'all', role: 'Артиллерия', pros: 'Огромный урон по площади с дальней дистанции', cons: 'Дорогой и беззащитен вблизи', description: 'Его древнее заклинание не оставляет врагам шансов.' }),
  c({ name: 'Огненный демон', image: '/images/demon.jpg@300', rarity: 'Редкая', cost: 4, damage: 140, health: 560, attackSpeed: 1.0, speed: 2.0, range: 1.5, kind: 'air', targets: 'all', role: 'Воздушный', pros: 'Летает и быстро добирается до цели', cons: 'Уязвим для стрелков и магов', description: 'Пламя сопровождает каждый его взмах крыльев.' }),
  c({ name: 'Каменный титан', image: '/images/golem.jpg@150', rarity: 'Эпическая', cost: 7, damage: 230, health: 3300, attackSpeed: 1.8, speed: 0.8, range: 0.8, splash: 1.2, targets: 'buildings', role: 'Осадный танк', pros: 'Невероятная живучесть, удар по площади', cons: 'Самый дорогой и медленный, игнорирует войска', description: 'Несокрушимая сила на поле боя.' }),
  // ---- Новые войска ----
  c({ name: 'Лучница', image: '/images/units1_0.jpg', rarity: 'Обычная', cost: 3, damage: 70, health: 300, attackSpeed: 0.9, speed: 1.3, range: 5.5, targets: 'all', role: 'Стрелок', pros: 'Дальняя атака по земле и по воздуху', cons: 'Хрупкая, слабый урон за выстрел', description: 'Меткая лучница держит врагов на расстоянии.' }),
  c({ name: 'Варвары', image: '/images/units1_1.jpg', rarity: 'Обычная', cost: 5, damage: 100, health: 480, count: 3, attackSpeed: 1.2, speed: 1.3, role: 'Отряд', pros: 'Три бойца — большой суммарный урон', cons: 'Уязвимы к урону по площади', description: 'Отряд свирепых воинов с севера.' }),
  c({ name: 'Скелеты', image: '/images/units1_2.jpg', rarity: 'Обычная', cost: 1, damage: 50, health: 65, count: 4, attackSpeed: 1.0, speed: 2.2, range: 0.4, role: 'Рой', pros: 'Дёшево и быстро, отвлекают танков', cons: 'Гибнут от любого урона по площади', description: 'Четыре костяных бойца за один эликсир.' }),
  c({ name: 'Гоблины-налётчики', image: '/images/units1_3.jpg', rarity: 'Обычная', cost: 2, damage: 75, health: 180, count: 2, attackSpeed: 0.8, speed: 2.5, range: 0.4, role: 'Налётчики', pros: 'Очень быстрые, высокий урон', cons: 'Хрупкие и дёшево умирают', description: 'Быстрые гоблины режут всё, до чего дотянутся.' }),
  c({ name: 'Дракончик', image: '/images/units2_0.jpg', rarity: 'Редкая', cost: 4, damage: 105, health: 700, kind: 'air', targets: 'all', attackSpeed: 1.5, speed: 1.3, range: 3, splash: 1.2, role: 'Воздушный (площадь)', pros: 'Летает и бьёт по площади', cons: 'Средний урон, уязвим для стрелков', description: 'Маленький дракон, плюющийся огнём.' }),
  c({ name: 'Летучие мыши', image: '/images/units2_1.jpg', rarity: 'Обычная', cost: 2, damage: 50, health: 80, count: 4, kind: 'air', targets: 'all', attackSpeed: 1.0, speed: 2.6, range: 0.4, role: 'Воздушный рой', pros: 'Летают и очень быстры', cons: 'Умирают от любого заклинания', description: 'Стая голодных летучих мышей.' }),
  c({ name: 'Огр', image: '/images/units2_2.jpg', rarity: 'Редкая', cost: 5, damage: 180, health: 2000, attackSpeed: 1.8, speed: 1.0, range: 0.6, splash: 0.9, role: 'Танк', pros: 'Крепкий и бьёт по площади', cons: 'Медленный, не бьёт воздух', description: 'Огромный громила, сметающий всё вокруг.' }),
  c({ name: 'Наездник на кабане', image: '/images/units2_3.jpg', rarity: 'Редкая', cost: 4, damage: 160, health: 780, targets: 'buildings', attackSpeed: 1.4, speed: 2.8, role: 'Штурмовик', pros: 'Молниеносно добирается до башни', cons: 'Игнорирует войска, быстро тает под огнём башен', description: 'Несётся прямо на башни, не обращая внимания на защитников.' }),
  c({ name: 'Пиромант', image: '/images/units3_0.jpg', rarity: 'Редкая', cost: 4, damage: 200, health: 400, attackSpeed: 1.7, speed: 1.2, range: 5, splash: 1.6, role: 'Огненный маг', pros: 'Мощный урон по площади', cons: 'Не бьёт воздух, хрупкий', description: 'Мастер огня, превращающий рои в пепел.' }),
  c({ name: 'Ледяная колдунья', image: '/images/units3_1.jpg', rarity: 'Редкая', cost: 3, damage: 55, health: 360, targets: 'all', attackSpeed: 1.4, speed: 1.2, range: 5, splash: 1.4, ability: 'slow', role: 'Контроль', pros: 'Замедляет врагов по площади', cons: 'Очень слабый урон', description: 'Её холод сковывает даже самых быстрых бойцов.' }),
  c({ name: 'Некромант', image: '/images/units3_2.jpg', rarity: 'Эпическая', cost: 5, damage: 80, health: 560, targets: 'all', attackSpeed: 1.2, speed: 1.1, range: 5, ability: 'spawner', role: 'Призыватель', pros: 'Постоянно призывает скелетов', cons: 'Хрупкий и дорогой, слабая собственная атака', description: 'Каждые несколько секунд поднимает новых скелетов.' }),
  c({ name: 'Принц', image: '/images/knight.jpg@200', rarity: 'Эпическая', cost: 5, damage: 180, health: 1200, attackSpeed: 1.3, speed: 1.3, ability: 'charge', role: 'Кавалерия', pros: 'Разгон удваивает скорость и урон первого удара', cons: 'Дорогой; без разгона — обычный боец', description: 'Разогнавшись, сносит всё на своём пути.' }),
  c({ name: 'Громовой жрец', image: '/images/units3_3.jpg', rarity: 'Редкая', cost: 4, damage: 95, health: 520, targets: 'all', attackSpeed: 0.8, speed: 1.2, range: 5, role: 'Скорострел', pros: 'Быстрая атака по любым целям', cons: 'Низкий урон за удар, хрупкий', description: 'Метает молнии с невероятной скоростью.' }),
  c({ name: 'Великий дракон', image: '/images/units2_0.jpg@150', rarity: 'Легендарная', cost: 6, damage: 185, health: 1250, kind: 'air', targets: 'all', attackSpeed: 1.5, speed: 1.2, range: 3.5, splash: 1.6, role: 'Воздушный босс', pros: 'Сильнейший воздушный боец с уроном по площади', cons: 'Дорогой; боится массы стрелков', description: 'Древний дракон, повелитель небес арены.' }),
  c({ name: 'Повелитель тьмы', image: '/images/demon.jpg@240', rarity: 'Легендарная', cost: 6, damage: 270, health: 1650, attackSpeed: 1.3, speed: 1.2, range: 0.7, splash: 1.3, ability: 'berserk', role: 'Тёмный чемпион', pros: 'Впадает в ярость: бьёт быстрее при потере здоровья', cons: 'Дорогой, не бьёт воздух', description: 'Чем сильнее он ранен, тем страшнее становится.' }),
  c({ name: 'Берсерк', image: '/images/units1_1.jpg@30', rarity: 'Обычная', cost: 3, damage: 110, health: 680, attackSpeed: 1.0, speed: 1.6, ability: 'berserk', role: 'Воин ярости', pros: 'Быстрый, набирает силу в бою', cons: 'Не бьёт воздух, средняя живучесть', description: 'В ярости он забывает о боли.' }),
  c({ name: 'Арбалетчик', image: '/images/units1_0.jpg@120', rarity: 'Редкая', cost: 5, damage: 150, health: 460, attackSpeed: 1.4, speed: 0.9, range: 9, role: 'Дальнобой', pros: 'Бьёт с огромной дистанции', cons: 'Медленный, не бьёт воздух', description: 'Тяжёлый арбалет пробивает башни издалека.' }),
  c({ name: 'Гоблины-копейщики', image: '/images/units1_3.jpg@80', rarity: 'Обычная', cost: 2, damage: 50, health: 110, count: 3, targets: 'all', attackSpeed: 1.1, speed: 2.1, range: 2.5, role: 'Копейщики', pros: 'Дёшево, бьют издали и по воздуху', cons: 'Очень хрупкие', description: 'Метают копья в любого, кто приблизится.' }),
  c({ name: 'Бомбардир', image: '/images/units1_3.jpg@200', rarity: 'Обычная', cost: 3, damage: 190, health: 250, attackSpeed: 1.9, speed: 1.2, range: 4.5, splash: 1.4, role: 'Подрывник', pros: 'Отлично расчищает рои', cons: 'Хрупкий, не бьёт воздух', description: 'Бросает бомбы, от которых не спастись толпой.' }),
  c({ name: 'Горный великан', image: '/images/units2_2.jpg@150', rarity: 'Редкая', cost: 5, damage: 120, health: 2500, targets: 'buildings', attackSpeed: 1.5, speed: 1.0, range: 0.7, role: 'Осадный танк', pros: 'Прочнейший танк для штурма башен', cons: 'Игнорирует войска, медленный', description: 'Живая гора, шагающая к вражеским башням.' }),
  c({ name: 'Теневой убийца', image: '/images/units1_2.jpg@220', rarity: 'Эпическая', cost: 3, damage: 250, health: 420, attackSpeed: 1.1, speed: 2.5, range: 0.4, role: 'Убийца', pros: 'Мгновенно убивает хрупких бойцов', cons: 'Тает под любым давлением', description: 'Бьёт из тени — и всегда насмерть.' }),
  // ---- Заклинания ----
  c({ name: 'Огненный шар', image: '/images/items_0.jpg', rarity: 'Редкая', cost: 4, damage: 560, health: 1, kind: 'spell', targets: 'all', splash: 2.5, ability: 'area', role: 'Заклинание', pros: 'Мощный урон по площади, бьёт и воздух', cons: 'Слабо ранит башни (35%)', description: 'Раскалённый шар, разносящий всё в радиусе взрыва.' }),
  c({ name: 'Залп стрел', image: '/images/items_2.jpg', rarity: 'Обычная', cost: 3, damage: 230, health: 1, kind: 'spell', targets: 'all', splash: 4, ability: 'area', role: 'Заклинание', pros: 'Дёшево, огромная площадь, убивает рои', cons: 'Слабый урон по крупным целям', description: 'Тучи стрел накрывают большую область.' }),
  c({ name: 'Молния', image: '/images/items_1.jpg', rarity: 'Эпическая', cost: 6, damage: 700, health: 1, kind: 'spell', targets: 'all', splash: 3.5, ability: 'bolt', role: 'Заклинание', pros: 'Бьёт три самые крепкие цели и оглушает их', cons: 'Дорогая, неэффективна против роёв', description: 'Небесная кара для самых опасных врагов.' }),
  c({ name: 'Заморозка', image: '/images/items_1.jpg@110', rarity: 'Эпическая', cost: 4, damage: 90, health: 1, kind: 'spell', targets: 'all', splash: 3.5, ability: 'freeze', role: 'Заклинание', pros: 'Замораживает врагов и башни на 4 секунды', cons: 'Почти не наносит урона', description: 'Всё в области действия застывает на месте.' }),
  c({ name: 'Ядовитое облако', image: '/images/items_0.jpg@250', rarity: 'Эпическая', cost: 4, damage: 85, health: 1, kind: 'spell', targets: 'all', splash: 3.5, ability: 'poison', role: 'Заклинание', pros: 'Долгий урон по площади для защиты и осады', cons: 'Действует медленно', description: 'Ядовитый туман наносит урон каждую секунду в течение 8 секунд.' }),
  // ---- Здания ----
  c({ name: 'Пушечная башня', image: '/images/items_3.jpg', rarity: 'Обычная', cost: 3, damage: 130, health: 900, kind: 'building', targets: 'ground', speed: 0, range: 5.5, attackSpeed: 0.9, lifetime: 30, role: 'Защитное здание', pros: 'Мощная защита от наземных целей', cons: 'Не бьёт воздух, исчезает через 30 секунд', description: 'Надёжная пушка, останавливающая любой штурм.' }),
  c({ name: 'Башня Теслы', image: '/images/items_3.jpg@180', rarity: 'Редкая', cost: 4, damage: 110, health: 900, kind: 'building', targets: 'all', speed: 0, range: 5.5, attackSpeed: 0.7, lifetime: 35, role: 'Защитное здание', pros: 'Атакует землю и воздух', cons: 'Невысокий урон, ограниченное время жизни', description: 'Разряды бьют по любым целям.' }),
  c({ name: 'Мортира', image: '/images/items_3.jpg@40', rarity: 'Редкая', cost: 4, damage: 220, health: 750, kind: 'building', targets: 'ground', speed: 0, range: 10.5, attackSpeed: 4.0, splash: 1.3, lifetime: 30, ability: 'artillery', role: 'Осадное здание', pros: 'Бьёт издалека по площади', cons: 'Очень медленная, не достаёт близкие цели', description: 'Тяжёлые снаряды долетают почти до вражеской башни.' }),
  c({ name: 'Костяная гробница', image: '/images/units1_2.jpg@300', rarity: 'Редкая', cost: 4, damage: 0, health: 700, kind: 'building', targets: 'ground', speed: 0, range: 0, attackSpeed: 1, lifetime: 28, ability: 'spawner', role: 'Призывающее здание', pros: 'Бесконечно создаёт скелетов', cons: 'Сама не атакует и живёт 28 секунд', description: 'Из гробницы постоянно выбираются новые воины.' }),
];

const EXTRA_NAMES: Record<string, string[]> = {
  'Обычная': [
    'Страж ворот','Огненный дух','Ледяной дух','Дух исцеления','Копейщики','Метатель камней','Гоблин-подрывник','Дозорный','Мушкетёр-новобранец','Лесной зверёк','Королевский курьер','Мини-пушка','Огненная ловушка','Гнездо гоблинов','Снежок','Ритуал костей','Караван тележек',
  ],
  'Редкая': [
    'Охотница','Валькирия','Пушка','Магический лучник','Летучие копейщики','Гоблинская бочка','Шахтёр','Таран','Боевой лекарь','Электромаг','Всадник на волке','Лесная ведьма','Боевые бочки','Дух грозы','Кулак горы','Хижина охотников','Торнадо','Пушка с огнём',
  ],
  'Эпическая': [
    'Феникс','Голем лавы','Голем льда','Тёмная ведьма','Королевский призрак','Стрелок-фантом','Ведьма теней','Адская башня','Магическая пушка','Боевой таран','Всадник на драконе','Маг огня','Костяной дракон','Рой призраков','Землетрясение','Клон','Портал демонов','Ярость','Клетка голема','Вихревая башня','Ледяной дух-хранитель',
  ],
  'Легендарная': [
    'Королева лучниц','Владыка шахт','Золотой рыцарь','Мать драконов','Принцесса шипов','Электро-дракон','Король призраков','Лесной титан','Морозный феникс','Рыцарь солнечного света','Хранитель портала','Королева ветров','Древний голем','Палач пустоты','Императрица льда','Страж времени','Дух древнего леса','Песчаный король','Демон хаоса','Звёздный дракон',
  ],
  'Чемпион': [
    'Чемпион арены','Король королей','Серафим','Хранитель короны','Кровавый паладин','Верховный маг','Дракон-император','Повелитель стихий',
  ],
};
const ART_POOL = ['/images/knight.jpg','/images/mage.jpg','/images/demon.jpg','/images/golem.jpg','/images/units1_0.jpg','/images/units1_1.jpg','/images/units1_2.jpg','/images/units1_3.jpg','/images/units2_0.jpg','/images/units2_1.jpg','/images/units2_2.jpg','/images/units2_3.jpg','/images/units3_0.jpg','/images/units3_1.jpg','/images/units3_2.jpg','/images/units3_3.jpg'];
const EXTRA_SPELLS = new Set(['Снежок','Ритуал костей','Гоблинская бочка','Торнадо','Землетрясение','Клон','Ярость']);
const EXTRA_BUILDINGS = new Set(['Мини-пушка','Огненная ловушка','Гнездо гоблинов','Пушка','Хижина охотников','Пушка с огнём','Адская башня','Магическая пушка','Клетка голема','Вихревая башня']);
const EXTRA_AIR = new Set(['Феникс','Голем лавы','Всадник на драконе','Костяной дракон','Мать драконов','Электро-дракон','Морозный феникс','Звёздный дракон','Серафим','Дракон-император']);
const EXTRA_SWARMS = new Set(['Копейщики','Летучие копейщики','Боевые бочки','Рой призраков','Караван тележек']);
const EXTRA_SPELL_ABILITIES: Record<string,string> = { 'Снежок':'area','Ритуал костей':'area','Гоблинская бочка':'area','Торнадо':'freeze','Землетрясение':'area','Клон':'area','Ярость':'area' };
const ARENA_GATES = [0,0,100,250,400,600,800,1000,1250,1500,1800,2200,2600,3000];
function makeExtra(name: string, rarity: string, index: number, total: number): CardDef {
  const champ = rarity === 'Чемпион';
  const kind = EXTRA_SPELLS.has(name) ? 'spell' : EXTRA_BUILDINGS.has(name) ? 'building' : EXTRA_AIR.has(name) ? 'air' : 'ground';
  const base = rarity === 'Чемпион' ? 5 : rarity === 'Легендарная' ? 5 : rarity === 'Эпическая' ? 4 : rarity === 'Редкая' ? 3 : 2;
  const cost = kind === 'spell' ? (index % 3 === 0 ? 3 : 4) : Math.max(1, Math.min(8, base + ((index % 5) - 2 + 2)));
  const swarm = EXTRA_SWARMS.has(name); const spell = kind === 'spell'; const building = kind === 'building';
  const image = ART_POOL[(index * 5 + rarity.length * 3) % ART_POOL.length] + ((index % 5 === 0) ? `@${(index * 39) % 320}` : '');
  const gatesIndex = Math.min(ARENA_GATES.length - 1, Math.floor(index * ARENA_GATES.length / Math.max(total, 1)));
  const damage = spell ? 160 + (index % 5) * 65 : 55 + ((index * 37 + rarity.length * 11) % 240);
  const health = spell ? 1 : building ? 700 + (index % 5) * 160 : 260 + ((index * 97 + rarity.length * 23) % 1900);
  const ability = spell ? (EXTRA_SPELL_ABILITIES[name] || 'area') : name === 'Феникс' || name === 'Морозный феникс' ? 'deathbomb' : name.includes('Ведьма') || name.includes('Гнездо') || name.includes('Портал') ? 'spawner' : name.includes('Дух') || name.includes('Мороз') ? 'slow' : name.includes('Золот') || champ ? 'berserk' : '';
  const targets = spell || EXTRA_AIR.has(name) ? 'all' : name.includes('Шахтёр') || name.includes('Таран') || name.includes('Голем') || name.includes('Титан') || name.includes('Великан') ? 'buildings' : building ? 'all' : (index % 4 === 0 ? 'all' : 'ground');
  const role = champ ? 'Чемпион' : spell ? 'Заклинание' : building ? 'Здание' : EXTRA_AIR.has(name) ? 'Воздушный боец' : swarm ? 'Отряд' : rarity === 'Легендарная' ? 'Легендарный боец' : 'Боец арены';
  return c({ name, image, rarity, cost, damage, health, kind, targets, speed: building ? 0 : 0.85 + (index % 6) * 0.34, range: spell ? 0.5 : building ? 4.8 + (index % 4) : index % 3 === 0 ? 3 + (index % 5) : 0.5, attackSpeed: 0.7 + (index % 6) * 0.24, count: swarm ? 3 + index % 3 : 1, splash: spell ? 2 + (index % 4) * 0.4 : index % 5 === 0 ? 0.8 + (index % 3) * 0.4 : 0, lifetime: building ? 25 + (index % 4) * 5 : 0, ability, unlockTrophies: ARENA_GATES[gatesIndex], role, pros: champ ? 'Уникальная способность чемпиона меняет ход боя' : spell ? 'Мгновенно влияет на большую область поля' : building ? 'Защищает арену и отвлекает вражеские войска' : swarm ? 'Численное преимущество и быстрый урон' : 'Специализированная карта с сильной стороной', cons: champ ? 'Высокая стоимость и уязвимость к контр-картам' : spell ? 'Одноразовое применение — выбирайте момент' : building ? 'Неподвижна и исчезает по истечении времени' : swarm ? 'Уязвимы для урона по площади' : 'Слабее против неподходящего типа цели', description: `${name} — ${champ ? 'чемпион арены с собственной боевой способностью' : spell ? 'заклинание для тактического контроля поля' : building ? 'оборонительное сооружение для защиты башен' : 'воин для вашей боевой колоды'}.` });
}
const EXTRA_CARDS: CardDef[] = Object.entries(EXTRA_NAMES).flatMap(([rarity, names]) => names.map((name, i) => makeExtra(name, rarity, i, names.length)));
export const CARD_CATALOG: CardDef[] = [...ORIGINAL_CARDS, ...EXTRA_CARDS];

export const STARTER_CARDS = ['Тёмный рыцарь', 'Лучница', 'Скелеты', 'Гоблины-налётчики', 'Варвары', 'Бомбардир', 'Белый маг', 'Дракончик', 'Королевский страж', 'Огненный шар', 'Залп стрел', 'Пушечная башня'];

export function cardPrice(rarity: string) { return rarity === 'Чемпион' ? 2500 : rarity === 'Легендарная' ? 1200 : rarity === 'Эпическая' ? 420 : rarity === 'Редкая' ? 160 : 60; }
export function kindLabel(kind: string) { return kind === 'air' ? 'Воздушный' : kind === 'building' ? 'Здание' : kind === 'spell' ? 'Заклинание' : 'Наземный'; }
export function targetLabel(t: string, kind: string) { if (kind === 'spell') return 'Область'; return t === 'buildings' ? 'Только здания и башни' : t === 'all' ? 'Земля и воздух' : 'Только земля'; }
export function speedLabel(s: number) { return s <= 0 ? 'Неподвижно' : s <= 1.05 ? 'Медленная' : s <= 1.75 ? 'Средняя' : s <= 2.4 ? 'Быстрая' : 'Очень быстрая'; }
export function levelMul(level: number) { return Math.pow(1.1, Math.max(0, level - 1)); }
export function parseArt(image: string) { const [src, hue] = image.split('@'); return { src, hue: hue ? Number(hue) : 0 }; }

export function requestAmount(rarity: string) { return rarity === 'Чемпион' || rarity === 'Легендарная' ? 1 : rarity === 'Эпическая' ? 2 : rarity === 'Редкая' ? 4 : 8; }
export function donateReward(rarity: string) { return rarity === 'Чемпион' || rarity === 'Легендарная' ? 100 : rarity === 'Эпическая' ? 40 : rarity === 'Редкая' ? 15 : 5; }
