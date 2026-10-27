import { BALANCE } from './balance';
import { clampStat } from './SurvivalSystem';
import type { SurvivorState } from './ResourceData';
export function consume(state: SurvivorState, kind: 'food' | 'water') {
  if (state.vitals.health <= 0) return 'Вы погибли';
  const stat = kind === 'food' ? 'hunger' : 'thirst';
  if (state.vitals[stat] >= 100) return 'Пока не требуется';
  if (state.resources[kind] < 1) return 'Нет припасов';
  state.resources[kind]--; state.consumed[kind]++;
  state.vitals[stat] = clampStat(state.vitals[stat] + (kind === 'food' ? BALANCE.foodRestore : BALANCE.waterRestore));
  return kind === 'food' ? 'Вы поели · +35 сытости' : 'Вы попили · +45 жажды';
}
