import { BALANCE } from './balance';
import { advanceClock } from './GameClock';
import type { SurvivorState } from './ResourceData';
export interface Vitals { health: number; hunger: number; thirst: number }
export type DeathCause = 'Голод' | 'Обезвоживание' | 'Голод и обезвоживание';
export const clampStat = (n: number) => Number.isFinite(n) ? Math.max(0, Math.min(BALANCE.maxStat, n)) : 0;
/** Analytic integration, shared by normal play and sleep: damage begins only AFTER depletion. */
export function advanceSurvival(state: SurvivorState, minutes: number): number {
  if (state.vitals.health <= 0 || !Number.isFinite(minutes) || minutes <= 0) return 0;
  const v = state.vitals;
  for (const k of ['health', 'hunger', 'thirst'] as const) v[k] = clampStat(v[k]);
  if (!v.health) return 0;
  const hungryAt = v.hunger / 100 * BALANCE.hungerMinutes;
  const thirstyAt = v.thirst / 100 * BALANCE.thirstMinutes;
  const damage = (t: number) => Math.max(0, t - hungryAt) * BALANCE.hungerDamagePerHour / 60 + Math.max(0, t - thirstyAt) * BALANCE.thirstDamagePerHour / 60;
  let elapsed = minutes;
  const fatal = damage(minutes) >= v.health;
  if (fatal) {
    // Resolve exact death time instead of advancing the rest of a fatal sleep.
    let low = 0, high = minutes;
    for (let i = 0; i < 60; i++) { const mid = (low + high) / 2; if (damage(mid) >= v.health) high = mid; else low = mid; }
    elapsed = high;
  }
  v.health = fatal ? 0 : clampStat(v.health - damage(elapsed));
  v.hunger = clampStat(v.hunger - elapsed * 100 / BALANCE.hungerMinutes);
  v.thirst = clampStat(v.thirst - elapsed * 100 / BALANCE.thirstMinutes);
  if (fatal) state.deathCause = elapsed > hungryAt && elapsed > thirstyAt ? 'Голод и обезвоживание' : elapsed > thirstyAt ? 'Обезвоживание' : 'Голод';
  advanceClock(state.clock, elapsed);
  return elapsed;
}
