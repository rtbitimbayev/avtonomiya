/** Survivor data and deterministic rules. No Phaser, DOM or farm-state dependencies. */
export const WORLD = { tiles: 64, tileSize: 32, pixels: 2048, seed: 8026 } as const;
export const SPAWN = { x: 1040, y: 1136 };
export const INTERACTION_RADIUS = 48;
export const PLAYER_SPEED = 150;
export type ResourceKind = 'wood' | 'metal' | 'water';
export type Resources = Record<ResourceKind, number>;
export type ObjectKind = ResourceKind | 'rock' | 'shelter';
export interface Point { x: number; y: number }
export interface WorldObject extends Point { id: string; kind: ObjectKind; width: number; height: number }
export interface SurvivorState {
  version: 1; seed: number; player: Point; resources: Resources; collected: string[]; returned: boolean;
}
export const RESOURCE_DATA: Record<ResourceKind, { label: string; amount: number; color: string }> = {
  wood: { label: 'Дерево', amount: 3, color: '#bca47c' },
  metal: { label: 'Металл', amount: 2, color: '#aeb8b8' },
  water: { label: 'Вода', amount: 1, color: '#7db8be' },
};
export function createSurvivor(): SurvivorState {
  return { version: 1, seed: WORLD.seed, player: { ...SPAWN }, resources: { wood: 0, metal: 0, water: 0 }, collected: [], returned: false };
}
export function movement(x: number, y: number) {
  const length = Math.hypot(x, y);
  return length ? { x: x / length * PLAYER_SPEED, y: y / length * PLAYER_SPEED } : { x: 0, y: 0 };
}
export function hasSupplies(s: SurvivorState) { return s.resources.wood >= 3 && s.resources.metal >= 2 && s.resources.water >= 1; }
export function makeObjects(seed: number = WORLD.seed): WorldObject[] {
  const objects: WorldObject[] = [
    { id: 'shelter', kind: 'shelter', x: 1040, y: 1008, width: 96, height: 64 },
    { id: 'first-wood', kind: 'wood', x: 944, y: 1136, width: 24, height: 26 },
    { id: 'first-metal', kind: 'metal', x: 1136, y: 1104, width: 26, height: 22 },
    { id: 'first-water', kind: 'water', x: 1072, y: 1232, width: 20, height: 22 },
  ];
  let value: number = seed;
  const random = () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
  for (let y = 2; y < WORLD.tiles - 2; y++) for (let x = 2; x < WORLD.tiles - 2; x++) {
    const r = random();
    // A connected grid of clear corridors, plus a generous clear starting area.
    if (x % 4 === 0 || y % 4 === 0 || (x >= 26 && x <= 39 && y >= 28 && y <= 40) || r > .105) continue;
    const kind: ObjectKind = r < .035 ? 'wood' : r < .065 ? 'rock' : r < .09 ? 'metal' : 'water';
    objects.push({ id: `node-${x}-${y}`, kind, x: x * 32 + 16, y: y * 32 + 16, width: kind === 'rock' ? 28 : 24, height: kind === 'wood' ? 26 : 24 });
  }
  return objects;
}
export function blocked(point: Point, objects: WorldObject[], radius = 8) {
  return point.x < radius || point.y < radius || point.x > WORLD.pixels - radius || point.y > WORLD.pixels - radius || objects.some(o => Math.abs(point.x - o.x) < o.width / 2 + radius && Math.abs(point.y - o.y) < o.height / 2 + radius);
}
const SAVE_KEY = 'avtonomiya-survivor-v1';
export function saveSurvivor(state: SurvivorState, storage: Pick<Storage, 'setItem'> = localStorage) {
  storage.setItem(SAVE_KEY, JSON.stringify(state));
}
export function loadSurvivor(storage: Pick<Storage, 'getItem'> = localStorage): SurvivorState | null {
  const raw = storage.getItem(SAVE_KEY); if (raw === null) return null;
  const s = JSON.parse(raw) as SurvivorState;
  const objects = makeObjects();
  const ids = new Set(objects.filter(o => o.kind !== 'shelter' && o.kind !== 'rock').map(o => o.id));
  if (!s || s.version !== 1 || s.seed !== WORLD.seed || !s.player || !Number.isFinite(s.player.x) || !Number.isFinite(s.player.y) || !s.resources || Object.keys(RESOURCE_DATA).some(k => !Number.isSafeInteger(s.resources[k as ResourceKind]) || s.resources[k as ResourceKind] < 0) || !Array.isArray(s.collected) || s.collected.some(id => !ids.has(id)) || new Set(s.collected).size !== s.collected.length || typeof s.returned !== 'boolean') throw new Error('Некорректное сохранение выжившего');
  const expected: Resources = { wood: 0, metal: 0, water: 0 };
  for (const o of objects) if (s.collected.includes(o.id)) expected[o.kind as ResourceKind] += RESOURCE_DATA[o.kind as ResourceKind].amount;
  if (Object.keys(expected).some(k => expected[k as ResourceKind] !== s.resources[k as ResourceKind]) || (s.returned && !hasSupplies(s)) || blocked(s.player, objects.filter(o => !s.collected.includes(o.id)))) throw new Error('Неверные ресурсы или положение');
  return s;
}
