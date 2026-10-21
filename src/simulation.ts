import { SIZE, definitions, crops, emptyStock, resourceKeys, volume, stageNames, chickenCapacity,
  type Stock, type Resource, type Kind, type Crop, type Entity, type State, type Tile } from './data';
export * from './data';
export function createState():State {
 let seed=9371; const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const tiles:Tile[][]=[[],[]];
 for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
 const r=rand(), lake=(x-43)**2/65+(y-24)**2/32<1 || (x-16)**2/20+(y-43)**2/30<1;
 tiles[0].push({restoration:0,terrain:lake?'water':Math.abs(x-31)<7&&Math.abs(y-31)<6?'grass':r<.11?'tree':r<.15?'rock':'grass'});
 tiles[1].push({restoration:0,terrain:Math.abs(x-31)<5&&Math.abs(y-31)<5?'floor':'wall'});
 }
 return {version:2,baseCapacity:600,time:8*60,nextId:1,resources:{...emptyStock(),wood:100,stone:60,metal:30,seeds:20,water:50,food:40},tiles,entities:[]};
}
const EPS = 1e-7;
export function adjacent(a: Entity, b: Entity) {
  return a.level === b.level && (
    ((a.x + a.width === b.x || b.x + b.width === a.x) && a.y < b.y + b.height && b.y < a.y + a.height) ||
    ((a.y + a.height === b.y || b.y + b.height === a.y) && a.x < b.x + b.width && b.x < a.x + a.width));
}
export function makeEntity(kind: Kind, x: number, y: number, level: number, id: number, rotation: 0 | 1 = 0): Entity {
  const d = definitions[kind];
  return { id, kind, x, y, level, width: rotation ? d.height : d.width, height: rotation ? d.width : d.height,
    rotation, legacy: false, stock: emptyStock(), capacity: d.capacity, progress: 0,
    planted: false, fertilized: false, health: 100, cycles: 0, crop: 'potato', stage: 'empty',
    autoHarvest: kind !== 'bed', autoSupply: true, chickens: kind === 'coop' ? 2 : 0,
    allowed: [...resourceKeys], powered: false, output: 0, load: 0 };
}
export class Simulation {
  state: State;
  message = 'Комплекс «Возрождение» онлайн. Постройте склад и восстановите первую зелёную зону.';
  constructor(state = createState()) { this.state = state; }
  tile(x: number, y: number, l: number) {
    return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < SIZE && y < SIZE ? this.state.tiles[l]?.[y * SIZE + x] : undefined;
  }
  at(x: number, y: number, l: number) {
    return this.state.entities.find(e => e.level === l && x >= e.x && y >= e.y && x < e.x + e.width && y < e.y + e.height);
  }
  /** Manual building / servicing can use the landing depot and any warehouse. Machines use only their network. */
  totals(): Stock {
    const total = { ...this.state.resources };
    for (const e of this.state.entities.filter(e => e.kind === 'warehouse')) for (const k of resourceKeys) total[k] += e.stock[k];
    return total;
  }
  afford(cost: Partial<Stock>) { const total = this.totals(); return Object.entries(cost).every(([k, n]) => total[k as Resource] + EPS >= n!); }
  private sources() { return [this.state.resources, ...this.state.entities.filter(e => e.kind === 'warehouse').map(e => e.stock)]; }
  private withdraw(k: Resource, amount: number, stocks: Stock[]) {
    let remaining = amount;
    for (const stock of stocks) { const n = Math.min(stock[k], remaining); stock[k] = Math.max(0, stock[k] - n); remaining -= n; if (remaining < EPS) break; }
    return amount - Math.max(0, remaining);
  }
  pay(cost: Partial<Stock>) { for (const [k, n] of Object.entries(cost)) this.withdraw(k as Resource, n!, this.sources()); }
  fail(s: string) { this.message = s; return false; }
  placement(kind: Kind, x: number, y: number, level: number, rotation: 0 | 1 = 0): string | null {
    const d = definitions[kind], w = rotation ? d.height : d.width, h = rotation ? d.width : d.height;
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
      const t = this.tile(x + dx, y + dy, level);
      if (!t || !['grass', 'floor'].includes(t.terrain) || this.at(x + dx, y + dy, level)) return 'Площадь занята, недоступна или выходит за карту.';
    }
    return this.afford(d.cost) ? null : 'Недостаточно ресурсов для строительства.';
  }
  build(kind: Kind, x: number, y: number, level: number, rotation: 0 | 1 = 0) {
    const error = this.placement(kind, x, y, level, rotation); if (error) return this.fail(error);
    this.pay(definitions[kind].cost);
    this.state.entities.push(makeEntity(kind, x, y, level, this.state.nextId++, rotation));
    this.message = `${definitions[kind].name}: построено`; return true;
  }
  private warehouses(group?: Entity[]) { return (group ?? this.state.entities).filter(e => e.kind === 'warehouse'); }
  private deposit(k: Resource, amount: number, group?: Entity[], manual = false) {
    let left = amount;
    for (const e of this.warehouses(group)) {
      if (!e.allowed.includes(k)) continue;
      const n = Math.min(left, Math.max(0, e.capacity - volume(e.stock))); e.stock[k] += n; left -= n;
    }
    if (manual) { const n = Math.min(left, Math.max(0, this.state.baseCapacity - volume(this.state.resources))); this.state.resources[k] += n; left -= n; }
    return amount - left;
  }
  remove(x: number, y: number, level: number) {
    const e = this.at(x, y, level); if (!e) return this.fail('Выберите здание для сноса.');
    // Full material refund keeps an early construction mistake recoverable. No seeds or fuel are refunded twice.
    const refund = { ...e.stock };
    for (const [k, n] of Object.entries(definitions[e.kind].cost)) refund[k as Resource] += n!;
    const remaining = this.state.entities.filter(a => a !== e);
    // Check shared space once: per-type checks alone would overbook the same free slots.
    const free = Math.max(0, this.state.baseCapacity - volume(this.state.resources)) + remaining.filter(a => a.kind === 'warehouse').reduce((n, a) => n + Math.max(0, a.capacity - volume(a.stock)), 0);
    if (volume(refund) > free + EPS) return this.fail('Нет места для возврата материалов. Освободите склад или стройте ещё один.');
    // A disabled filter must not silently destroy stock on demolition.
    let baseNeed = 0;
    for (const k of resourceKeys) if (refund[k] > 0 && !remaining.some(a => a.kind === 'warehouse' && a.allowed.includes(k))) baseNeed += refund[k];
    if (baseNeed > this.state.baseCapacity - volume(this.state.resources) + EPS) return this.fail('Склад не принимает возвращаемые материалы. Разрешите их хранение.');
    // Simulate exact filtered placement before mutating anything.
    const backup = remaining.filter(a => a.kind === 'warehouse').map(a => ({ ...a, stock: { ...a.stock } }));
    let baseFree = this.state.baseCapacity - volume(this.state.resources);
    for (const k of resourceKeys) { let n = refund[k]; for (const a of backup) if (a.allowed.includes(k)) { const v = Math.min(n, a.capacity - volume(a.stock)); a.stock[k] += v; n -= v; } baseFree -= n; }
    if (baseFree < -EPS) return this.fail('Недостаточно места с учётом фильтров складов.');
    this.state.entities = remaining;
    for (const k of resourceKeys) this.deposit(k, refund[k], undefined, true);
    this.message = 'Здание разобрано. Материалы и внутренние запасы возвращены.'; return true;
  }
  gather(x: number, y: number, l: number) {
    const t = this.tile(x, y, l); if (!t || this.at(x, y, l)) return this.fail('Клетка занята.');
    let reward: Partial<Stock> = {};
    if (t.terrain === 'tree') reward = { wood: 12 };
    else if (t.terrain === 'rock') reward = { stone: 10, metal: 2 };
    else if (t.terrain === 'water') reward = { water: 10 };
    else if (t.terrain === 'wall') {
      if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.tile(x + dx, y + dy, l)?.terrain === 'floor')) return this.fail('Расширяйте подземелье от открытых клеток.');
      if (!this.afford({ wood: 2 })) return this.fail('Для укрепления нужны 2 дерева.');
      reward = { stone: 6 };
    } else return this.fail('Здесь нечего добывать.');
    // Deposit atomically, restoring inventory if the filters/capacity cannot accept the entire reward.
    const snapshots = this.sources().map(s => ({ stock: s, copy: { ...s } }));
    for (const [k, n] of Object.entries(reward)) if (this.deposit(k as Resource, n!, undefined, true) + EPS < n!) {
      for (const b of snapshots) Object.assign(b.stock, b.copy); return this.fail('Нет места для добытых ресурсов.');
    }
    if (t.terrain === 'wall') this.pay({ wood: 2 });
    if (t.terrain !== 'water') t.terrain = l ? 'floor' : 'grass';
    this.message = 'Ресурсы собраны.'; return true;
  }
  groups(): Entity[][] {
    const unseen = new Set(this.state.entities); const groups: Entity[][] = [];
    while (unseen.size) {
      const group = [unseen.values().next().value!]; unseen.delete(group[0]);
      for (let i = 0; i < group.length; i++) for (const other of unseen) if (adjacent(group[i], other)) { unseen.delete(other); group.push(other); }
      groups.push(group);
    }
    return groups;
  }
  connected() { return new Set(this.groups().filter(g => g.some(e => e.kind === 'warehouse')).flat().map(e => e.id)); }
  temperature() { return 17 + 10 * Math.sin((this.state.time % 1440 - 360) / 1440 * Math.PI * 2); }
  light(e: Entity) {
    return (e.level === 0 && this.state.time % 1440 >= 360 && this.state.time % 1440 < 1200) ||
      this.state.entities.some(a => a.kind === 'lamp' && a.powered && a.level === e.level && Math.hypot(a.x - e.x, a.y - e.y) <= 4);
  }
  growthRate(e: Entity) {
    const c = crops[e.crop], temp = e.level ? 16 : this.temperature();
    if (!e.planted || e.health <= 0 || e.stock.water < .02 || !this.light(e) || temp < c.min || temp > c.max) return 0;
    const climate = Math.min(1, (temp - c.min + 1) / 5, (c.max - temp + 1) / 5);
    return climate * Math.max(.25, e.health / 100) * (e.fertilized ? 1.7 : 1);
  }
  private input(e: Entity, k: Resource, target: number, group?: Entity[], manual = false) {
    const n = Math.max(0, Math.min(target - e.stock[k], e.capacity - volume(e.stock)));
    const stocks = manual ? this.sources() : this.warehouses(group).map(a => a.stock);
    // Water reservoirs and pumps act as sources only inside the same network.
    if (!manual && k === 'water') stocks.push(...(group ?? []).filter(a => a !== e && (a.kind === 'tank' || a.kind === 'pump')).map(a => a.stock));
    e.stock[k] += this.withdraw(k, n, stocks);
  }
  private supply(e: Entity, group?: Entity[], manual = false) {
    if (e.kind === 'bed') this.input(e, 'water', 8, group, manual);
    if (e.kind === 'coop' || e.kind === 'feeder') { this.input(e, 'food', 10, group, manual); this.input(e, 'water', 10, group, manual); }
    if (e.kind === 'composter') { this.input(e, 'manure', 9, group, manual); this.input(e, 'waste', 10, group, manual); }
    if (e.kind === 'generator') this.input(e, 'wood', 5, group, manual);
    if (e.kind === 'tank') this.input(e, 'water', e.capacity, group, manual);
    if (e.kind === 'bed' && !e.fertilized && e.planted) {
      const sources = manual ? this.sources() : this.warehouses(group).map(a => a.stock);
      if (sources.reduce((n, s) => n + s.fertilizer, 0) >= 1) { this.withdraw('fertilizer', 1, sources); e.fertilized = true; }
    }
  }
  seed(e: Entity, group?: Entity[], manual = false) {
    if (e.kind !== 'bed' || e.planted) return false;
    const sources = manual ? this.sources() : this.warehouses(group).map(a => a.stock);
    if (sources.reduce((n, s) => n + s.seeds, 0) < 1) return this.fail('Для посева нужно 1 семя.');
    this.withdraw('seeds', 1, sources); e.planted = true; e.stage = 'sown'; e.progress = 0; e.health = 100; return true;
  }
  setCrop(e: Entity, crop: Crop) { if (e.kind !== 'bed' || e.planted) return this.fail('Смените культуру после уборки.'); e.crop = crop; return true; }
  clearCrop(e: Entity) {
    if (e.kind !== 'bed' || !e.planted) return false;
    const waste = Math.min(1, e.capacity - volume(e.stock)); e.stock.waste += waste;
    e.planted = false; e.progress = 0; e.stage = 'empty'; e.health = 100; e.fertilized = false;
    this.message = 'Посев удалён. Семя не возвращается.'; return true;
  }
  interact(e: Entity) {
    if (e.kind === 'bed') {
      if (e.stage === 'ripe') return this.harvest(e, undefined, true);
      if (!e.planted && !this.seed(e, undefined, true)) return false;
    }
    if (['bed', 'coop', 'feeder', 'composter', 'generator', 'tank'].includes(e.kind)) {
      this.supply(e, undefined, true); this.message = 'Ручное пополнение выполнено в пределах доступных ресурсов и ёмкости.'; return true;
    }
    return this.collect(e);
  }
  collect(e: Entity, group?: Entity[], manual = true) {
    const keys: Resource[] = e.kind === 'warehouse' ? [] : e.kind === 'tank' || e.kind === 'pump' ? ['water'] : e.kind === 'composter' ? ['fertilizer'] : e.kind === 'bed' ? ['waste'] : ['eggs', 'manure'];
    let moved = 0;
    for (const k of keys) { const n = this.deposit(k, e.stock[k], group, manual); e.stock[k] -= n; moved += n; }
    if (manual) this.message = moved > EPS ? 'Продукция перенесена в хранилища.' : 'Нет продукции или принимающее хранилище заполнено.';
    return moved > EPS;
  }
  harvest(e: Entity, group?: Entity[], manual = false) {
    if (e.kind !== 'bed' || e.stage !== 'ripe') return false;
    const reward = { food: crops[e.crop].food, seeds: 2, waste: 1 };
    const stores = this.warehouses(group), snapshots = [...stores.map(a => a.stock), ...(manual ? [this.state.resources] : [])].map(stock => ({ stock, copy: { ...stock } }));
    for (const [k, n] of Object.entries(reward)) if (this.deposit(k as Resource, n, group, manual) + EPS < n) {
      for (const b of snapshots) Object.assign(b.stock, b.copy);
      if (manual) this.fail('Урожай готов, но нет места или склад запрещает один из ресурсов.'); return false;
    }
    e.progress = 0; e.planted = false; e.fertilized = false; e.stage = 'harvested'; e.cycles++;
    this.message = `Урожай собран: ${reward.food} еды, 2 семени, 1 биоотход.`; return true;
  }
  /** Move landing supplies to a warehouse explicitly; no hidden unlimited global auto-feed. */
  transferDepot(e: Entity) {
    if (e.kind !== 'warehouse') return false;
    let moved = 0;
    for (const k of resourceKeys) { const n = this.deposit(k, this.state.resources[k], [e]); this.state.resources[k] -= n; moved += n; }
    this.message = moved > EPS ? 'Принимаемые запасы перенесены из стартового контейнера.' : 'Нет свободного места или разрешённых ресурсов.'; return moved > EPS;
  }
  nearWater(e: Entity) {
    for (let y = e.y - 1; y <= e.y + e.height; y++) for (let x = e.x - 1; x <= e.x + e.width; x++) {
      const side = ((x === e.x - 1 || x === e.x + e.width) && y >= e.y && y < e.y + e.height) || ((y === e.y - 1 || y === e.y + e.height) && x >= e.x && x < e.x + e.width);
      if (side && this.tile(x, y, e.level)?.terrain === 'water') return true;
    }
    return false;
  }
  reason(e: Entity): string {
    if (e.kind === 'bed') {
      if (!e.planted) return stageNames[e.stage] + (e.autoHarvest ? ' · ждёт семян в сети' : ' · ручной посев');
      if (e.health <= 0) return 'Посев погиб · уберите и посейте заново';
      if (e.stage === 'ripe') return 'Урожай готов · соберите или освободите склад';
      if (!this.light(e)) return 'Рост остановлен · нет света';
      if (e.stock.water < .02) return 'Рост остановлен · сухая почва';
      if (!this.growthRate(e)) return 'Рост остановлен · неподходящая температура';
      return stageNames[e.stage];
    }
    if (e.kind === 'coop') {
      if (!e.chickens) return 'Нет кур';
      if (e.stock.food < .1 || e.stock.water < .1) return 'Производство остановлено · нужен корм и вода';
      if (e.capacity - volume(e.stock) < 4) return 'Производство остановлено · заполнены запасы';
      return `Производство яиц · здоровье ${Math.floor(e.health)}%`;
    }
    if (e.kind === 'composter') return e.stock.manure < 3 && e.stock.waste < 5 ? 'Нет сырья · нужно 3 навоза или 5 биоотходов' : e.capacity - volume(e.stock) < 2 ? 'Нет места для удобрения' : 'Переработка сырья';
    if (e.kind === 'generator') return e.stock.wood < .025 ? 'Нет топлива' : e.output > 0 ? 'Работает под нагрузкой' : 'Ожидание нагрузки';
    if (e.kind === 'pump') return !this.nearWater(e) ? 'Нет источника воды рядом' : !e.powered ? 'Нет мощности · нужно 2 кВт' : e.stock.water >= e.capacity - EPS ? 'Резерв заполнен' : 'Перекачка воды';
    if (e.kind === 'lamp') return e.powered ? 'Освещение включено · 1 кВт' : 'Нет мощности · нужен 1 кВт';
    if (e.kind === 'warehouse') return volume(e.stock) >= e.capacity - EPS ? 'Склад заполнен' : 'Принимает разрешённые ресурсы';
    if (e.kind === 'tank') return e.level === 1 ? 'Подземный резерв · снабжение из сети' : 'Сбор конденсата';
    return this.connected().has(e.id) ? 'В сети склада' : 'Нет связи со складом';
  }
  critical(e: Entity) {
    if (e.kind === 'bed') return e.planted && e.stage !== 'ripe' && (!this.growthRate(e) || e.health < 35);
    if (e.kind === 'coop') return e.stock.food < .1 || e.stock.water < .1 || e.health < 35;
    if (e.kind === 'lamp') return !e.powered;
    if (e.kind === 'pump') return !this.nearWater(e) || (!e.powered && e.stock.water < e.capacity - EPS);
    if (e.kind === 'generator') return e.stock.wood < .025;
    if (e.kind === 'warehouse') return volume(e.stock) >= e.capacity - EPS;
    if (e.kind === 'composter') return e.capacity - volume(e.stock) < 2;
    return false;
  }
  tick(dt: number) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    // Substeps preserve consumption/processing and speed consistency for large frame deltas.
    let left = Math.min(dt, 60);
    while (left > EPS) { const step = Math.min(.25, left); this.step(step); left -= step; }
  }
  private step(dt: number) {
    this.state.time += dt * 2;
    for (const group of this.groups()) {
      for (const e of group) {
        if (e.kind !== 'warehouse' && e.kind !== 'tank' && e.kind !== 'pump') this.collect(e, group, false);
        if (e.autoSupply) this.supply(e, group);
      }
      // Deterministic all-or-nothing allocation. No consumer ever receives more power than generated.
      const generators = group.filter(e => e.kind === 'generator');
      for (const e of group) { e.powered = false; e.output = 0; e.load = 0; }
      const active = generators.filter(e => e.stock.wood + EPS >= dt * .025);
      let available = active.length * 8;
      const consumers = group.filter(e => definitions[e.kind].demand > 0 && (e.kind !== 'pump' || (this.nearWater(e) && e.stock.water < e.capacity - EPS))).sort((a, b) => a.id - b.id);
      let used = 0;
      for (const e of consumers) { const need = definitions[e.kind].demand; if (available >= need) { available -= need; used += need; e.powered = true; } }
      for (const e of active) {
        const allocated = Math.min(8, used); e.output = allocated; e.load = allocated; e.powered = allocated > 0;
        if (allocated > 0) e.stock.wood = Math.max(0, e.stock.wood - dt * .025); used -= allocated;
      }
      for (const e of group) {
        if (e.kind === 'tank' && e.level === 0) e.stock.water += Math.min(e.capacity - volume(e.stock), dt * (this.nearWater(e) ? 1 : 1 / 3));
        if (e.kind === 'pump' && e.powered) {
          const amount = Math.min(e.capacity - volume(e.stock), dt * 2); e.stock.water += amount;
          // A reservoir is a legitimate sink even without a warehouse.
          for (const tank of group.filter(a => a.kind === 'tank')) {
            const n = Math.min(e.stock.water, tank.capacity - volume(tank.stock)); tank.stock.water += n; e.stock.water -= n;
          }
          const n = this.deposit('water', e.stock.water, group); e.stock.water -= n;
        }
        if (e.kind === 'bed') this.grow(e, group, dt);
        if (e.kind === 'coop') {
          for (const feeder of group.filter(a => a.kind === 'feeder' && adjacent(a, e))) for (const k of ['food', 'water'] as Resource[]) {
            const n = Math.max(0, Math.min(4 - e.stock[k], feeder.stock[k], e.capacity - volume(e.stock))); feeder.stock[k] -= n; e.stock[k] += n;
          }
          const consume = dt * e.chickens / 24;
          if (e.chickens && e.stock.food + EPS >= consume && e.stock.water + EPS >= consume) {
            e.stock.food = Math.max(0, e.stock.food - consume); e.stock.water = Math.max(0, e.stock.water - consume);
            e.health = Math.min(100, e.health + dt);
            if (e.capacity - volume(e.stock) >= e.chickens * 2) {
              e.progress += dt * Math.max(.1, e.health / 100);
              if (e.progress + EPS >= 24) { e.progress = Math.max(0, e.progress - 24); e.stock.eggs += e.chickens; e.stock.manure += e.chickens; e.cycles++; }
            }
          } else e.health = Math.max(0, e.health - dt * .5);
        }
        if (e.kind === 'composter') {
          const input = e.stock.manure >= 3 ? 'manure' : e.stock.waste >= 5 ? 'waste' : null;
          // Reserve output space conservatively so progress stops cleanly while blocked.
          if (input && e.capacity - volume(e.stock) >= 2) {
            e.progress += dt;
            if (e.progress + EPS >= 18) { e.progress = Math.max(0, e.progress - 18); e.stock[input] -= input === 'manure' ? 3 : 5; e.stock.fertilizer += 2; e.cycles++; }
          }
        }
      }
    }
  }
  private grow(e: Entity, group: Entity[], dt: number) {
    const wasHarvested = e.stage === 'harvested';
    if (e.autoHarvest && !e.planted) this.seed(e, group);
    if (wasHarvested && !e.planted) e.stage = 'empty';
    if (!e.planted) return;
    const c = crops[e.crop];
    if (e.stage !== 'ripe') {
      const rate = this.growthRate(e);
      if (rate > 0 && e.stock.water + EPS >= dt * c.water) {
        e.stock.water = Math.max(0, e.stock.water - dt * c.water);
        e.health = Math.min(100, e.health + dt * .2);
        e.progress = Math.min(c.duration, e.progress + dt * rate);
      } else if (e.stock.water < .02 || (e.level === 0 && (this.temperature() < c.min || this.temperature() > c.max))) e.health = Math.max(0, e.health - dt * .2);
      const f = e.progress / c.duration;
      e.stage = f >= 1 - EPS ? 'ripe' : f < .08 ? 'sown' : f < .25 ? 'sprout' : f < .55 ? 'young' : 'adult';
      if (e.health > 0 && e.progress > 0) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const tile = this.tile(e.x + dx, e.y + dy, e.level);
        if (tile?.terrain === 'grass') tile.restoration = Math.min(1, tile.restoration + dt / (dx || dy ? 540 : 180));
      }
    }
    if (e.stage === 'ripe' && e.autoHarvest) this.harvest(e, group);
  }
}

const KEY = 'avtonomiya-v1'; // Retain the original key so v0.1 players are migrated on first load.
export function save(sim: Simulation, storage: Pick<Storage, 'setItem'> & Partial<Pick<Storage, 'getItem'>> = localStorage) {
  const previous = storage.getItem?.(KEY);
  if (previous) {
    let legacy = false;
    try { legacy = JSON.parse(previous)?.version === 1; }
    catch { /* Invalid saves are handled by the UI. */ }
    if (legacy) storage.setItem('avtonomiya-v1-backup', previous);
  }
  storage.setItem(KEY, JSON.stringify(sim.state));
}
export function load(storage: Pick<Storage, 'getItem'> = localStorage): State | null {
  const raw = storage.getItem(KEY); if (!raw) return null;
  return parseState(JSON.parse(raw));
}
/** Validate untrusted localStorage before modifying the live game; migrate legacy footprints without collisions. */
export function parseState(input: unknown): State {
  const s = input as State;
  const old = (s as unknown as {version: number})?.version === 1;
  if (!s || (!old && s.version !== 2) || !Number.isFinite(s.time) || s.time < 0 || !Number.isInteger(s.nextId) || s.nextId < 1 || !Array.isArray(s.entities) || s.entities.length > SIZE * SIZE * 2 || !Array.isArray(s.tiles) || s.tiles.length !== 2) throw new Error('Некорректный формат сохранения');
  const stock = (value: Stock): Stock => {
    if (!value || typeof value !== 'object') throw new Error('Нет запасов');
    const result = emptyStock();
    for (const k of resourceKeys) { const n = old && k === 'waste' ? 0 : value[k]; if (!Number.isFinite(n) || n < 0) throw new Error('Некорректный запас'); result[k] = n; }
    return result;
  };
  const resources = stock(s.resources);
  const tiles = s.tiles.map(a => {
    if (!Array.isArray(a) || a.length !== SIZE * SIZE) throw new Error('Размер карты');
    return a.map(t => {
      if (!t || !['grass', 'tree', 'rock', 'water', 'wall', 'floor'].includes(t.terrain)) throw new Error('Тип клетки');
      const restoration = old ? 0 : t.restoration;
      if (!Number.isFinite(restoration) || restoration < 0 || restoration > 1) throw new Error('Состояние почвы');
      return { terrain: t.terrain, restoration };
    });
  });
  const ids = new Set<number>(), occupied = new Set<string>();
  const entities = s.entities.map(raw => {
    if (!raw || !Object.hasOwn(definitions, raw.kind) || !Number.isInteger(raw.id) || raw.id < 1 || ids.has(raw.id) || ![0, 1].includes(raw.level) || !Number.isInteger(raw.x) || !Number.isInteger(raw.y) || ![raw.progress, raw.health, raw.cycles].every(Number.isFinite) || raw.progress < 0 || raw.health < 0 || raw.health > 100 || !Number.isInteger(raw.cycles) || raw.cycles < 0 || typeof raw.planted !== 'boolean' || typeof raw.fertilized !== 'boolean') throw new Error('Некорректный объект');
    ids.add(raw.id);
    const inventory = stock(raw.stock);
    const e: Entity = old ? { ...makeEntity(raw.kind, raw.x, raw.y, raw.level, raw.id), ...raw,
      stock: inventory, width: 1, height: 1, rotation: 0, legacy: true,
      capacity: Math.max(definitions[raw.kind].capacity, volume(inventory)),
      crop: 'potato', stage: raw.kind === 'bed' && raw.planted ? raw.progress >= 60 ? 'ripe' : 'young' : 'empty',
      autoHarvest: true, autoSupply: true, chickens: raw.kind === 'coop' ? 2 : 0, allowed: [...resourceKeys], powered: false, output: 0, load: 0,
    } : { ...raw, stock: inventory, allowed: [...(raw.allowed ?? [])] };
    const d = definitions[e.kind];
    if (![0, 1].includes(e.rotation) || typeof e.legacy !== 'boolean' || e.width !== (e.legacy ? 1 : e.rotation ? d.height : d.width) || e.height !== (e.legacy ? 1 : e.rotation ? d.width : d.height) || e.x < 0 || e.y < 0 || e.x + e.width > SIZE || e.y + e.height > SIZE || !Object.hasOwn(crops, e.crop) || !Object.hasOwn(stageNames, e.stage) || !Number.isFinite(e.capacity) || e.capacity < d.capacity || (!e.legacy && e.capacity !== d.capacity) || volume(e.stock) > e.capacity + EPS || typeof e.autoSupply !== 'boolean' || typeof e.autoHarvest !== 'boolean' || !Number.isInteger(e.chickens) || e.chickens < 0 || e.chickens > chickenCapacity || !Array.isArray(e.allowed) || e.allowed.some(k => !resourceKeys.includes(k)) || new Set(e.allowed).size !== e.allowed.length || ![e.output, e.load].every(Number.isFinite) || typeof e.powered !== 'boolean') throw new Error('Некорректное состояние объекта');
    if (e.kind === 'bed' && (e.progress > crops[e.crop].duration || (e.planted !== !['empty', 'harvested'].includes(e.stage)) || (e.stage === 'ripe' && e.progress < crops[e.crop].duration - EPS))) throw new Error('Некорректный рост');
    for (let y = e.y; y < e.y + e.height; y++) for (let x = e.x; x < e.x + e.width; x++) {
      const key = `${e.level}:${x}:${y}`;
      if (occupied.has(key) || !['grass', 'floor'].includes(tiles[e.level][y * SIZE + x].terrain)) throw new Error('Пересечение или недоступная клетка');
      occupied.add(key);
    }
    return e;
  });
  const baseCapacity = old ? Math.max(600, volume(resources)) : s.baseCapacity;
  if (!Number.isFinite(baseCapacity) || baseCapacity < 600 || volume(resources) > baseCapacity + EPS || entities.some(e => e.id >= s.nextId)) throw new Error('Некорректная вместимость или ID');
  return { version: 2, time: s.time, nextId: s.nextId, resources, baseCapacity, tiles, entities };
}
