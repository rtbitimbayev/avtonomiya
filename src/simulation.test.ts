import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, createState, save, load, parseState, definitions, crops, volume, resourceKeys, adjacent, makeEntity, type Entity, type Kind } from './simulation';
function step(s: Simulation, seconds: number) { for (let i = 0; i < seconds; i++) s.tick(1); }
function build(s: Simulation, kind: Kind, x: number, y: number, level = 0, rotation: 0 | 1 = 0) {
  assert.equal(s.build(kind, x, y, level, rotation), true, s.message); return s.state.entities.at(-1)!;
}
function readyBed(s: Simulation, x = 31, y = 31) {
  const bed = build(s, 'bed', x, y); bed.autoSupply = false; s.interact(bed); return bed;
}
function total(s: Simulation) { return volume(s.state.resources) + s.state.entities.reduce((n, e) => n + volume(e.stock), 0); }
function assertLimits(s: Simulation) {
  assert.ok(volume(s.state.resources) <= s.state.baseCapacity + 1e-6);
  for (const e of s.state.entities) { assert.ok(volume(e.stock) <= e.capacity + 1e-6, e.kind); for (const k of resourceKeys) assert.ok(e.stock[k] >= -1e-9, e.kind + ':' + k); }
}
test('initial stock, map bounds and atomic multi-cell placement', () => {
  const s = new Simulation(), initial = { ...s.state.resources };
  assert.equal(initial.wood, 100); assert.equal(s.state.tiles[0].length, 4096);
  assert.equal(s.build('warehouse', 63, 63, 0), false); assert.deepEqual(s.state.resources, initial);
  const w = build(s, 'warehouse', 29, 29); assert.equal(w.width, 3); assert.equal(w.height, 3);
  assert.equal(s.at(31, 31, 0), w); assert.equal(s.build('bed', 31, 31, 0), false);
  assert.equal(s.state.resources.wood, 85); assert.equal(s.state.entities.length, 1);
  s.state.resources.wood = 0; assert.equal(s.build('coop', 32, 29, 0), false);
  assert.equal(s.tile(64, 0, 0), undefined);
});
test('rotation swaps rectangular footprint, obstacle and underground checks', () => {
  const s = new Simulation(); const p = build(s, 'pump', 31, 31, 0, 1);
  assert.equal(p.width, 2); assert.equal(p.height, 1); assert.equal(p.rotation, 1);
  assert.equal(s.at(32, 31, 0), p); assert.equal(s.at(31, 32, 0), undefined);
  s.tile(33, 31, 0)!.terrain = 'rock'; assert.equal(s.build('tank', 33, 31, 0), false);
  assert.equal(s.build('warehouse', 34, 34, 1), false);
  const w = build(s, 'warehouse', 28, 28, 1); assert.equal(w.width, 3);
  assert.equal(s.gather(36, 31, 1), true); assert.equal(s.gather(0, 0, 1), false);
});
test('demolition via any occupied cell frees whole footprint and preserves resources', () => {
  const s = new Simulation(), initial = { ...s.state.resources };
  build(s, 'warehouse', 29, 29); assert.equal(s.remove(31, 31, 0), true);
  assert.deepEqual(s.state.resources, initial); assert.equal(s.state.entities.length, 0); assert.equal(s.at(29, 30, 0), undefined);
});
test('network connects footprint edges, never corners or levels', () => {
  const s = new Simulation(); const w = build(s, 'warehouse', 28, 28);
  const p = build(s, 'pipe', 31, 30), b = build(s, 'bed', 32, 30), diagonal = build(s, 'bed', 33, 31);
  const under = build(s, 'bed', 31, 30, 1);
  assert.equal(adjacent(w, p), true); assert.equal(s.connected().has(b.id), true);
  assert.equal(s.connected().has(diagonal.id), false); assert.equal(s.connected().has(under.id), false);
  s.remove(p.x, p.y, 0); assert.equal(s.connected().has(b.id), false);
});
test('manual planting costs seeds and crop selection is locked until cleanup', () => {
  const s = new Simulation(); const b = build(s, 'bed', 31, 31);
  assert.equal(b.stage, 'empty'); assert.equal(b.planted, false); assert.equal(s.state.resources.seeds, 20);
  assert.equal(s.setCrop(b, 'carrot'), true); s.interact(b); assert.equal(s.state.resources.seeds, 19);
  assert.equal(b.stage, 'sown'); assert.equal(s.setCrop(b, 'wheat'), false);
  s.clearCrop(b); assert.equal(s.setCrop(b, 'wheat'), true); assert.equal(b.stock.waste, 1);
});
test('crop stages, growth, water consumption, harvest and replanting', () => {
  const s = new Simulation(); const b = readyBed(s);
  step(s, 6); assert.equal(b.stage, 'sprout'); step(s, 14); assert.equal(b.stage, 'young');
  step(s, 18); assert.equal(b.stage, 'adult'); step(s, 23); assert.equal(b.stage, 'ripe');
  assert.ok(b.stock.water < 8); assert.ok(s.tile(31, 31, 0)!.restoration > 0);
  const before = s.totals(); s.interact(b);
  assert.equal(b.stage, 'harvested'); assert.equal(s.totals().food, before.food + 8);
  assert.equal(s.totals().seeds, before.seeds + 2); assert.equal(s.totals().waste, before.waste + 1);
  s.interact(b); assert.equal(b.stage, 'sown');
});
test('three crops have configured durations and yields', () => {
  for (const crop of ['potato', 'carrot', 'wheat'] as const) {
    const s = new Simulation(); s.temperature = () => 20; const b = build(s, 'bed', 31, 31); b.autoSupply = false;
    s.setCrop(b, crop); s.interact(b); step(s, crops[crop].duration + 1);
    assert.equal(b.stage, 'ripe', crop); const food = s.totals().food; s.interact(b);
    assert.equal(s.totals().food - food, crops[crop].food);
  }
});
test('drought harms plants; darkness and temperature block growth; fertilizer accelerates', () => {
  const s = new Simulation(); const b = readyBed(s); b.stock.water = 0;
  step(s, 10); assert.equal(b.progress, 0); assert.ok(b.health < 100);
  s.interact(b); s.state.time = 0; step(s, 10); assert.equal(b.progress, 0);
  s.state.time = 300; b.crop = 'carrot'; assert.equal(s.growthRate(b), 0); // ~7°C, below carrot minimum.
  s.state.time = 480; b.crop = 'potato'; b.health = 100; b.fertilized = true;
  step(s, 10); assert.ok(b.progress > 16.9);
});
test('local logistics automate crop loop only after depot is transferred', () => {
  const s = new Simulation(); const w = build(s, 'warehouse', 28, 28), b = build(s, 'bed', 31, 29);
  b.autoHarvest = true; step(s, 2); assert.equal(b.planted, false);
  const before = total(s); assert.equal(s.transferDepot(w), true); assert.equal(total(s), before);
  step(s, 65); assert.equal(b.cycles, 1); assert.equal(b.planted, true); assertLimits(s);
  b.autoHarvest = false; step(s, 80); assert.equal(b.stage, 'ripe'); assert.equal(b.cycles, 1);
});
test('warehouse type filters and capacity prevent overflow without losing harvest', () => {
  const s = new Simulation(); const w = build(s, 'warehouse', 28, 28), b = readyBed(s, 31, 29);
  b.autoHarvest = true; w.allowed = ['food']; w.stock.stone = w.capacity;
  b.progress = 60; b.stage = 'ripe'; const before = total(s); s.tick(1);
  assert.equal(b.stage, 'ripe'); assert.equal(b.cycles, 0); assert.equal(total(s), before);
  w.stock.stone = 0; // Test fixture opens capacity but still rejects seeds/waste.
  s.tick(1); assert.equal(b.stage, 'ripe'); assert.equal(w.stock.food, 0); // Atomic rollback.
  w.allowed = [...resourceKeys]; s.tick(1); assert.equal(b.cycles, 1); assertLimits(s);
});
test('manual transfers conserve inventory and respect shared storage volume', () => {
  const s = new Simulation(); const t = build(s, 'tank', 31, 31);
  t.stock.water = 50; s.state.resources.stone += s.state.baseCapacity - volume(s.state.resources) - 3;
  const before = total(s); s.collect(t); assert.ok(Math.abs(total(s) - before) < 1e-6);
  assert.equal(t.stock.water, 47); assertLimits(s);
  const stock = { ...s.state.resources }; assert.equal(s.gather(43, 24, 0), false); assert.deepEqual(s.state.resources, stock);
});
test('chickens consume resources once per entity, produce eggs/manure, and stop when hungry', () => {
  const s = new Simulation(); const c = build(s, 'coop', 31, 31); c.autoSupply = false; s.interact(c);
  const food = c.stock.food; step(s, 24);
  assert.equal(c.stock.eggs, 2); assert.equal(c.stock.manure, 2); assert.ok(Math.abs(food - c.stock.food - 2) < 1e-6);
  c.stock.food = 0; const progress = c.progress; step(s, 10); assert.equal(c.progress, progress); assert.ok(c.health < 100);
  assert.match(s.reason(c), /корм/); s.interact(c); step(s, 1); assert.ok(c.health > 95);
  assert.equal(s.at(32, 32, 0), c); assertLimits(s);
});
test('adjacent feeder supplies coop and auto-supply toggle disables warehouse withdrawal', () => {
  const s = new Simulation(); const w = build(s, 'warehouse', 28, 28), f = build(s, 'feeder', 31, 29), c = build(s, 'coop', 32, 29);
  c.autoSupply = false; f.autoSupply = false; w.stock.food = 20; w.stock.water = 20;
  s.tick(1); assert.equal(c.progress, 0); f.autoSupply = true; step(s, 25); assert.equal(c.cycles, 1); assert.ok(w.stock.food < 20); assertLimits(s);
});
test('full coop output blocks production without duplicating output', () => {
  const s = new Simulation(); const c = build(s, 'coop', 31, 31); c.autoSupply = false;
  c.stock.food = 10; c.stock.water = 10; c.stock.eggs = 20; c.progress = 23;
  s.state.resources.stone += s.state.baseCapacity - volume(s.state.resources);
  s.tick(1); assert.equal(c.cycles, 0); assert.equal(c.stock.eggs, 20); assertLimits(s);
});
test('composter accepts either manure or plant waste and preserves recipe costs', () => {
  for (const input of ['manure', 'waste'] as const) {
    const s = new Simulation(); const c = build(s, 'composter', 31, 31); c.autoSupply = false;
    c.stock[input] = input === 'manure' ? 3 : 5; step(s, 18);
    assert.equal(c.stock.fertilizer, 2); assert.equal(c.stock[input], 0); assert.equal(c.cycles, 1);
  }
});
test('tank fills slowly with finite capacity; underground tank has no spontaneous water', () => {
  const s = new Simulation(); const t = build(s, 'tank', 31, 31), under = build(s, 'tank', 31, 31, 1);
  step(s, 30); assert.ok(Math.abs(t.stock.water - 10) < 1e-6); assert.equal(under.stock.water, 0);
  step(s, 310); assert.ok(t.stock.water <= 100); assertLimits(s);
});
test('power allocation is bounded, consumes fuel, and illuminates underground beds', () => {
  const s = new Simulation(); const gen = build(s, 'generator', 28, 28, 1), lamp = build(s, 'lamp', 30, 29, 1), b = build(s, 'bed', 31, 29, 1);
  s.interact(b); b.autoSupply = false; s.tick(1); assert.equal(b.progress, 0); assert.equal(lamp.powered, false);
  s.interact(gen); const fuel = gen.stock.wood; s.tick(1);
  assert.equal(gen.output, 1); assert.equal(lamp.powered, true); assert.ok(b.progress > 0); assert.ok(Math.abs(fuel - gen.stock.wood - .025) < 1e-6);
  gen.stock.wood = 0; s.tick(1); assert.equal(lamp.powered, false);
});
test('pump requires water and power; transfers to finite tank without duplication', () => {
  const s = new Simulation(); s.tile(31, 30, 0)!.terrain = 'water';
  const p = build(s, 'pump', 31, 31), gen = build(s, 'generator', 29, 31), tank = build(s, 'tank', 32, 31);
  s.interact(gen); const before = total(s); step(s, 10);
  assert.ok(tank.stock.water > 20); assert.equal(gen.output, 2); assert.equal(p.powered, true);
  // +20 pumped +10/3 condensate, minus .25 fuel.
  assert.ok(Math.abs(total(s) - before - (20 + 10 / 3 - .25)) < 1e-5); assertLimits(s);
  s.tile(31, 30, 0)!.terrain = 'grass'; s.tick(1); assert.equal(p.powered, false);
});
test('insufficient generator power leaves excess consumers stopped', () => {
  const s = new Simulation(); const gen = makeEntity('generator', 10, 10, 0, s.state.nextId++); gen.stock.wood = 5;
  s.state.entities.push(gen);
  for (let i = 0; i < 10; i++) { const lamp = makeEntity('lamp', 12 + i, 10, 0, s.state.nextId++); s.state.entities.push(lamp); }
  s.tick(1); assert.equal(s.state.entities.filter(e => e.kind === 'lamp' && e.powered).length, 8); assert.equal(gen.output, 8);
});
test('pause and equivalent dt schedules give equal production and consumption', () => {
  const a = new Simulation(), b = new Simulation(); const ac = build(a, 'coop', 31, 31), bc = build(b, 'coop', 31, 31);
  a.interact(ac); b.interact(bc); const time = a.state.time; a.tick(0); assert.equal(a.state.time, time);
  for (let i = 0; i < 100; i++) a.tick(.1);
  for (let i = 0; i < 25; i++) b.tick(.4);
  assert.ok(Math.abs(ac.progress - bc.progress) < 1e-6); assert.ok(Math.abs(ac.stock.food - bc.stock.food) < 1e-6);
});
test('v2 save roundtrip retains rotation, crop, filters, toggles and plant condition', () => {
  const s = new Simulation(); const p = build(s, 'pump', 31, 31, 0, 1); p.autoSupply = false;
  const b = readyBed(s, 33, 31); b.crop = 'carrot'; step(s, 5);
  let raw = ''; const storage = { setItem: (_k: string, value: string) => { raw = value; }, getItem: () => raw };
  save(s, storage); assert.deepEqual(load(storage), s.state);
  const broken = JSON.parse(raw); broken.entities[1].id = broken.entities[0].id; assert.throws(() => parseState(broken));
  const overlap = JSON.parse(raw); overlap.entities[1].x = p.x; assert.throws(() => parseState(overlap));
  const overflow = JSON.parse(raw); overflow.entities[0].stock.water = 999; assert.throws(() => parseState(overflow));
  assert.throws(() => parseState({ version: 2 }));
});
test('legacy migration keeps 1x1 objects, stocks and crop progress without overlap or resource loss', () => {
  const modern = createState();
  const oldStock = { ...modern.resources } as Record<string, number>; delete oldStock.waste;
  const legacy = { version: 1, time: 480, nextId: 3, resources: oldStock,
    tiles: modern.tiles.map(a => a.map(t => ({ terrain: t.terrain }))), entities: [
      { id: 1, kind: 'warehouse', x: 30, y: 31, level: 0, stock: { ...oldStock, wood: 0 }, progress: 0, planted: false, fertilized: false, health: 100, cycles: 0 },
      { id: 2, kind: 'bed', x: 31, y: 31, level: 0, stock: Object.fromEntries(Object.keys(oldStock).map(k => [k, k === 'water' ? 4 : 0])), progress: 42, planted: true, fertilized: true, health: 88, cycles: 2 },
    ] };
  const s = parseState(legacy); assert.equal(s.version, 2); assert.equal(s.entities[0].width, 1); assert.equal(s.entities[0].legacy, true);
  assert.equal(s.entities[1].progress, 42); assert.equal(s.entities[1].stock.water, 4); assert.equal(s.resources.food, 40);
  assert.deepEqual(parseState(s), s);
});
test('full vertical production loop stays finite over multiple cycles', () => {
  const s = new Simulation();
  const w = build(s, 'warehouse', 28, 28), bed = build(s, 'bed', 31, 28), tank = build(s, 'tank', 31, 29);
  const coop = build(s, 'coop', 28, 31), compost = build(s, 'composter', 30, 31);
  bed.autoHarvest = true; s.transferDepot(w);
  step(s, 180); assert.ok(bed.cycles >= 2); assert.ok(coop.cycles >= 5); assert.ok(compost.cycles >= 1);
  assert.ok(w.stock.eggs > 0); assert.ok(bed.fertilized || w.stock.fertilizer > 0); assert.ok(tank.stock.water >= 0); assertLimits(s);
  assert.deepEqual(parseState(s.state), s.state);
});
test('demolition of loaded warehouse fails atomically when refund has no destination', () => {
  const s = new Simulation(); const w = build(s, 'warehouse', 28, 28);
  w.stock.food = 100; s.state.resources.stone += s.state.baseCapacity - volume(s.state.resources);
  const before = JSON.stringify(s.state); assert.equal(s.remove(29, 29, 0), false); assert.equal(JSON.stringify(s.state), before);
});
test('blocked composter preserves ingredients and resumes only when output space is available', () => {
  const s = new Simulation(); const c = build(s, 'composter', 31, 31); c.autoSupply = false;
  c.stock.manure = 3; c.stock.fertilizer = 37;
  s.state.resources.stone += s.state.baseCapacity - volume(s.state.resources);
  const before = total(s); step(s, 20); assert.equal(c.cycles, 0); assert.equal(c.stock.manure, 3); assert.equal(total(s), before);
  s.state.resources.stone -= 10; s.collect(c); step(s, 18); assert.equal(c.cycles, 1); assertLimits(s);
});
test('legacy snapshot backup is saved before replacing the old key, and backup failure aborts overwrite', () => {
  const raw = JSON.stringify({ version: 1, marker: 'original' });
  const values = new Map([['avtonomiya-v1', raw]]);
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  save(new Simulation(), storage); assert.equal(values.get('avtonomiya-v1-backup'), raw);
  assert.equal(JSON.parse(values.get('avtonomiya-v1')!).version, 2);
  let original = raw;
  assert.throws(() => save(new Simulation(), { getItem: () => original, setItem: (key, value) => { if (key.endsWith('backup')) throw new Error('quota'); original = value; } }));
  assert.equal(original, raw);
});
