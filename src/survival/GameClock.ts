import { BALANCE } from './balance';
export interface ClockState { day: number; minuteOfDay: number }
export function advanceClock(clock: ClockState, minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return;
  const total = clock.minuteOfDay + minutes;
  clock.day += Math.floor(total / 1440); clock.minuteOfDay = total % 1440;
}
export function clockLabel(clock: ClockState) {
  const m = Math.floor(clock.minuteOfDay + 1e-8) % 1440;
  return `ДЕНЬ ${String(clock.day).padStart(2, '0')} — ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
/** One active-time gate for the entire game. Long return frames are discarded, not replayed. */
export class ActiveTime {
  private skipNext = true;
  sample(deltaMs: number, active: boolean) {
    if (!active) { this.skipNext = true; return 0; }
    if (this.skipNext) { this.skipNext = false; return 0; }
    const seconds = deltaMs / 1000;
    return Number.isFinite(seconds) && seconds > 0 && seconds <= BALANCE.maxFrameSeconds ? seconds : 0;
  }
  reset() { this.skipNext = true; }
}
export function lighting(minute: number) {
  if (minute >= 480 && minute < 1080) return { alpha: 0, phase: 'День' };
  if (minute >= 360 && minute < 480) return { alpha: .48 * (1 - (minute - 360) / 120), phase: 'Рассвет' };
  if (minute >= 1080 && minute < 1200) return { alpha: .48 * (minute - 1080) / 120, phase: 'Закат' };
  return { alpha: .48, phase: 'Ночь' };
}
