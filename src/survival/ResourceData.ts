import { BALANCE } from './balance';
import type { ClockState } from './GameClock';
import type { Vitals, DeathCause } from './SurvivalSystem';
/** Survivor data and deterministic rules. No Phaser, DOM or farm-state dependencies. */
export const WORLD = { tiles: 64, tileSize: 32, pixels: 2048, seed: 8026 } as const;
export const SPAWN = { x: 1040, y: 1136 };
export const INTERACTION_RADIUS = 48;
export const PLAYER_SPEED = 150;
export type ResourceKind = 'wood' | 'metal' | 'water' | 'food';
export type Resources = Record<ResourceKind, number>;
export type ObjectKind = ResourceKind | 'rock' | 'shelter';
export interface Point { x: number; y: number }
export interface WorldObject extends Point { id: string; kind: ObjectKind; width: number; height: number }
export interface SurvivorState {
  waterOrigin?: 0; schemaVersion: 2; vitals: Vitals; clock: ClockState; consumed: {food: number; water: number}; deathCause: DeathCause | null; seed: number; player: Point; resources: Resources; collected: string[]; returned: boolean;
}
export const RESOURCE_DATA: Record<ResourceKind, { label: string; amount: number; color: string }> = {
  food: { label: 'Еда', amount: 1, color: '#c8b67d' },
  wood: { label: 'Дерево', amount: 3, color: '#bca47c' },
  metal: { label: 'Металл', amount: 2, color: '#aeb8b8' },
  water: { label: 'Вода', amount: 1, color: '#7db8be' },
};
export function createSurvivor(): SurvivorState {
  return { schemaVersion: 2, seed: WORLD.seed, player: { ...SPAWN }, resources: { wood: 0, metal: 0, water: BALANCE.initialWater, food: BALANCE.initialFood }, collected: [], returned: false, vitals: { health: 100, hunger: 100, thirst: 100 }, clock: { day: 1, minuteOfDay: BALANCE.startMinute }, consumed: {food: 0, water: 0}, deathCause: null };
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
  for (const [i, [x, y]] of [[30,37],[36,36],[29,32],[34,30],[36,39]].entries()) objects.push({id: `food-${i}`, kind: 'food', x: x * 32 + 16, y: y * 32 + 16, width: 22, height: 22});
  return objects;
}
export function blocked(point: Point, objects: WorldObject[], radius = 8) {
  return point.x < radius || point.y < radius || point.x > WORLD.pixels - radius || point.y > WORLD.pixels - radius || objects.some(o => Math.abs(point.x - o.x) < o.width / 2 + radius && Math.abs(point.y - o.y) < o.height / 2 + radius);
}
export { saveSurvivor, loadSurvivor } from './SaveSystem';
