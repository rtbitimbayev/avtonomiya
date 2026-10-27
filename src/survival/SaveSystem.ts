import { BALANCE } from './balance';
import { WORLD, RESOURCE_DATA, makeObjects, blocked, createSurvivor, type SurvivorState, type ResourceKind, type Resources } from './ResourceData';
export const SAVE_KEY = 'avtonomiya-survivor-v2';
export const LEGACY_KEY = 'avtonomiya-survivor-v1';
export function validateSnapshot(input: unknown, legacy = false): SurvivorState {
  const raw = input as SurvivorState & {version?: number};
  const objects = makeObjects();
  if (!raw || (legacy ? raw.version !== 1 : raw.schemaVersion !== 2) || raw.seed !== WORLD.seed || !raw.player || !Number.isFinite(raw.player.x) || !Number.isFinite(raw.player.y) || !raw.resources || !Array.isArray(raw.collected) || new Set(raw.collected).size !== raw.collected.length || typeof raw.returned !== 'boolean') throw new Error('Несовместимое сохранение');
  const validIds = new Set(objects.filter(o => o.kind !== 'rock' && o.kind !== 'shelter' && (!legacy || o.kind !== 'food')).map(o => o.id));
  if (raw.collected.some(id => !validIds.has(id))) throw new Error('Неизвестный объект');
  const state: SurvivorState = legacy ? { ...createSurvivor(), player: {...raw.player}, collected: [...raw.collected], returned: raw.returned, resources: {...raw.resources, food: BALANCE.initialFood} } : structuredClone(raw);
  for (const k of Object.keys(RESOURCE_DATA) as ResourceKind[]) if (!Number.isSafeInteger(state.resources[k]) || state.resources[k] < 0) throw new Error('Некорректные ресурсы');
  if (!state.vitals || Object.values(state.vitals).length !== 3 || !['health','hunger','thirst'].every(k => Number.isFinite(state.vitals[k as keyof typeof state.vitals]) && state.vitals[k as keyof typeof state.vitals] >= 0 && state.vitals[k as keyof typeof state.vitals] <= 100) || state.vitals.health <= 0 || state.deathCause !== null || !state.clock || !Number.isSafeInteger(state.clock.day) || state.clock.day < 1 || !Number.isFinite(state.clock.minuteOfDay) || state.clock.minuteOfDay < 0 || state.clock.minuteOfDay >= 1440 || !state.consumed || !Number.isSafeInteger(state.consumed.food) || !Number.isSafeInteger(state.consumed.water) || state.consumed.food < 0 || state.consumed.water < 0) throw new Error('Некорректные жизненные показатели или время');
  if (state.waterOrigin !== undefined && state.waterOrigin !== 0) throw new Error('Неверный стартовый баланс');
  const expected: Resources = { wood: 0, metal: 0, water: legacy ? 0 : BALANCE.initialWater, food: BALANCE.initialFood };
  // Migrated runs retain original water; account for that starting balance explicitly.
  if (!legacy && state.waterOrigin === 0) expected.water = 0;
  for (const o of objects) if (state.collected.includes(o.id)) expected[o.kind as ResourceKind] += RESOURCE_DATA[o.kind as ResourceKind].amount;
  if (legacy) state.waterOrigin = 0;
  expected.food -= state.consumed.food; expected.water -= state.consumed.water;
  if ((Object.keys(expected) as ResourceKind[]).some(k => expected[k] !== state.resources[k]) || blocked(state.player, objects.filter(o => !state.collected.includes(o.id)))) throw new Error('Неверный баланс ресурсов или позиция');
  return state;
}
export function saveSurvivor(state: SurvivorState, storage: Pick<Storage, 'setItem'> = localStorage) {
  if (state.vitals.health <= 0) return false;
  const snapshot = validateSnapshot(state);
  storage.setItem(SAVE_KEY, JSON.stringify(snapshot)); return true;
}
export function loadSurvivor(storage: Pick<Storage, 'getItem'> = localStorage): SurvivorState | null {
  const current = storage.getItem(SAVE_KEY);
  if (current !== null) return validateSnapshot(JSON.parse(current));
  const old = storage.getItem(LEGACY_KEY);
  return old === null ? null : validateSnapshot(JSON.parse(old), true);
}
/** Autosaves are opt-in only after inspecting storage. Incompatible data is protected until explicit New Game. */
export class SaveSystem {
  protectedData = false;
  private activeSeconds = 0;
  private dirty = false;
  private warned = false;
  constructor(private storage: Pick<Storage, 'getItem' | 'setItem'>, private warn: (message: string) => void) {}
  load() {
    try { const state = loadSurvivor(this.storage); this.protectedData = false; this.activeSeconds = 0; this.dirty = false; return state; }
    catch { this.protectedData = true; this.warn('Сохранение несовместимо или повреждено. Данные сохранены. Можно начать безопасную новую игру.'); return null; }
  }
  mark() { this.dirty = true; }
  tick(seconds: number, state: SurvivorState) {
    this.activeSeconds += seconds;
    if (this.activeSeconds >= BALANCE.autosaveSeconds) { this.activeSeconds = 0; if (this.dirty) this.save(state); }
  }
  save(state: SurvivorState) {
    if (this.protectedData || state.vitals.health <= 0) return false;
    try { const ok = saveSurvivor(state, this.storage); this.dirty = false; this.warned = false; return ok; }
    catch { if (!this.warned) this.warn('Не удалось сохранить: localStorage недоступен или данные не прошли проверку. Игра продолжается.'); this.warned = true; return false; }
  }
  allowNewGame() {
    // Preserve existing data even when explicitly starting over (including valid last-live snapshots).
    try {
      for (const key of [SAVE_KEY, LEGACY_KEY]) { const raw = this.storage.getItem(key); if (raw !== null) this.storage.setItem(`${key}-backup-${Date.now()}`, raw); }
      this.protectedData = false; this.dirty = false; this.activeSeconds = 0; return true;
    } catch { this.protectedData = true; this.warn('Не удалось создать резервную копию. Новая игра доступна без записи поверх старых данных.'); return false; }
  }
}
