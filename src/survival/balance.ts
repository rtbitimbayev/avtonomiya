export const BALANCE = {
  maxStat: 100, hungerMinutes: 16 * 60, thirstMinutes: 8 * 60,
  hungerDamagePerHour: 4, thirstDamagePerHour: 8,
  foodRestore: 35, waterRestore: 45, initialFood: 3, initialWater: 2,
  sleepMinutes: 6 * 60, startMinute: 8 * 60, gameMinutesPerSecond: 1,
  maxFrameSeconds: .25, autosaveSeconds: 30, lowWarning: 20,
} as const;
