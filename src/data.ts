/** Configuration shared by the simulator, UI and renderer. No Phaser dependencies. */
export const SIZE = 64;
export type Resource = 'wood' | 'stone' | 'metal' | 'seeds' | 'water' | 'food' | 'eggs' | 'manure' | 'fertilizer' | 'waste';
export type Stock = Record<Resource, number>;
export type Kind = 'bed' | 'tank' | 'feeder' | 'coop' | 'composter' | 'warehouse' | 'pipe' | 'lamp' | 'pump' | 'generator';
export type Crop = 'potato' | 'carrot' | 'wheat';
export type Stage = 'empty' | 'sown' | 'sprout' | 'young' | 'adult' | 'ripe' | 'harvested';
export type Terrain = 'grass' | 'tree' | 'rock' | 'water' | 'wall' | 'floor';
export interface Tile { terrain: Terrain; restoration: number }
export interface Entity {
  id: number; kind: Kind; x: number; y: number; level: number;
  width: number; height: number; rotation: 0 | 1; legacy: boolean;
  stock: Stock; capacity: number; progress: number; planted: boolean;
  fertilized: boolean; health: number; cycles: number; crop: Crop; stage: Stage;
  autoHarvest: boolean; autoSupply: boolean; chickens: number;
  allowed: Resource[]; powered: boolean; output: number; load: number;
}
export interface State {
  version: 2; time: number; nextId: number; resources: Stock;
  baseCapacity: number; tiles: Tile[][]; entities: Entity[];
}
export const labels: Record<Resource, string> = {
  wood: 'Дерево', stone: 'Камень', metal: 'Металл', seeds: 'Семена', water: 'Вода',
  food: 'Корм / еда', eggs: 'Яйца', manure: 'Навоз', fertilizer: 'Удобрение', waste: 'Биоотходы',
};
export const resourceKeys = Object.keys(labels) as Resource[];
export const emptyStock = (): Stock => Object.fromEntries(resourceKeys.map(k => [k, 0])) as Stock;
export const volume = (stock: Stock) => resourceKeys.reduce((n, k) => n + stock[k], 0);
export const crops: Record<Crop, { name: string; duration: number; water: number; food: number; min: number; max: number; color: number }> = {
  potato: { name: 'Картофель', duration: 60, water: .07, food: 8, min: 5, max: 30, color: 0x86aa64 },
  carrot: { name: 'Морковь', duration: 80, water: .06, food: 11, min: 8, max: 28, color: 0xe9a153 },
  wheat: { name: 'Пшеница', duration: 100, water: .045, food: 15, min: 3, max: 32, color: 0xe6ce7c },
};
interface Definition {
  name: string; icon: string; category: string; width: number; height: number;
  cost: Partial<Stock>; capacity: number; demand: number; description: string;
}
export const definitions: Record<Kind, Definition> = {
  bed: { name: 'Грядка', icon: '✿', category: 'Биосфера', width: 1, height: 1, cost: { wood: 4 }, capacity: 12, demand: 0, description: 'Выберите культуру и посейте семя. Автосбор, полив и посев настраиваются отдельно. Удобрение ускоряет рост.' },
  coop: { name: 'Курятник', icon: '♧', category: 'Биосфера', width: 2, height: 2, cost: { wood: 20, stone: 5 }, capacity: 40, demand: 0, description: '2 курицы / 4 места. За 24 с при полном здоровье: 2 яйца и 2 навоза. Расход: 2 еды и 2 воды. Производство замедляется при болезни.' },
  feeder: { name: 'Кормушка', icon: '▤', category: 'Биосфера', width: 1, height: 1, cost: { wood: 6 }, capacity: 24, demand: 0, description: 'Передаёт корм и воду соседним курятникам. Можно пополнить вручную или из подключённого склада.' },
  warehouse: { name: 'Склад', icon: '▥', category: 'Логистика', width: 3, height: 3, cost: { wood: 15, stone: 10 }, capacity: 300, demand: 0, description: 'Хранит 300 единиц. Принимает только разрешённые ресурсы. Соседние объекты и конвейеры образуют локальную сеть.' },
  pipe: { name: 'Конвейер', icon: '↔', category: 'Логистика', width: 1, height: 1, cost: { wood: 1, metal: 1 }, capacity: 0, demand: 0, description: 'Связывает объекты через стороны клеток. Передаёт ресурсы и электричество; не соединяет уровни.' },
  tank: { name: 'Резервуар', icon: '◉', category: 'Инженерия', width: 2, height: 2, cost: { stone: 8, metal: 2 }, capacity: 100, demand: 0, description: 'Хранит до 100 воды и снабжает свою сеть. На поверхности собирает конденсат: 1 воду за 3 с, у воды — 1/с. Под землёй нужен насос.' },
  pump: { name: 'Насос', icon: '≋', category: 'Инженерия', width: 1, height: 2, cost: { metal: 4, stone: 4 }, capacity: 20, demand: 2, description: 'У источника воды производит 2 воды/с. Требует 2 кВт из своей сети. R — поворот.' },
  generator: { name: 'Генератор', icon: 'ϟ', category: 'Инженерия', width: 2, height: 2, cost: { metal: 6, stone: 5 }, capacity: 20, demand: 0, description: 'Выдаёт до 8 кВт. Расходует 1 дерево за 40 с при наличии нагрузки. Запас топлива ограничен; работает и под землёй.' },
  lamp: { name: 'Светильник', icon: '✧', category: 'Инженерия', width: 1, height: 1, cost: { metal: 3, stone: 2 }, capacity: 0, demand: 1, description: 'Требует 1 кВт. Освещает растения в радиусе 4 клеток, включая подземелье.' },
  composter: { name: 'Компостер', icon: '♻', category: 'Переработка', width: 2, height: 2, cost: { wood: 10, stone: 5 }, capacity: 40, demand: 0, description: 'За 18 с: 3 навоза или 5 биоотходов → 2 удобрения. При заполнении останавливается без потери сырья.' },
};
export const stageNames: Record<Stage, string> = {
  empty: 'Подготовленная почва', sown: 'Посев', sprout: 'Прорастание', young: 'Молодое растение',
  adult: 'Взрослое растение', ripe: 'Урожай созрел', harvested: 'Убрано · готово к посеву',
};
export const chickenCapacity = 4;
