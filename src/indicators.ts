import { crops, volume, chickenCapacity, type Entity } from './data';
import type { Simulation } from './simulation';
export interface Meter { label: string; value: number; max: number; unit: string; tone: 'good' | 'warn' | 'bad'; hint: string }
export function meters(e: Entity, sim: Simulation): Meter[] {
  const result: Meter[] = [];
  const add = (label: string, value: number, max: number, unit: string, hint: string, low = false) => {
    const f = value / max;
    result.push({ label, value, max, unit, hint, tone: low ? f < .15 ? 'bad' : f < .35 ? 'warn' : 'good' : 'good' });
  };
  if (e.kind === 'bed') {
    add('◉ Влажность', e.stock.water, 8, 'л', 'Вода расходуется при росте; без неё почва высыхает.', true);
    add('✿ Рост', e.progress, crops[e.crop].duration, 'с', 'Фактический накопленный рост. Время до урожая зависит от условий.');
    add('♥ Растение', e.health, 100, '%', 'Засуха и неподходящая температура ухудшают здоровье.', true);
  }
  if (e.kind === 'coop' || e.kind === 'feeder') {
    add('▤ Корм', e.stock.food, 10, 'ед.', 'Пополняется вручную или из локального склада.', true);
    add('◉ Вода', e.stock.water, 10, 'л', 'Курам нужны и корм, и вода.', true);
    if (e.kind === 'coop') {
      add('◷ Яйца', e.progress, 24, 'с', '24 секунды производства при полном здоровье.');
      add('♧ Куры', e.chickens, chickenCapacity, 'особи', 'Начальное стадо — 2 курицы, вместимость — 4. Разведение пока недоступно.');
      add('♥ Здоровье', e.health, 100, '%', 'Влияет на скорость производства. Восстанавливается при снабжении.', true);
    }
  }
  if (e.kind === 'warehouse') {
    const used = volume(e.stock);
    add('▥ Объём', used, e.capacity, 'ед.', 'Суммарная вместимость по всем видам ресурсов.');
    result[0].tone = used >= e.capacity - .01 ? 'bad' : used > e.capacity * .85 ? 'warn' : 'good';
  }
  if (e.kind === 'tank' || e.kind === 'pump') add('◉ Вода', e.stock.water, e.capacity, 'л', 'Ограниченный резерв воды. Передаётся потребителям внутри сети.', true);
  if (e.kind === 'generator') {
    add('▤ Топливо', e.stock.wood, 5, 'дерева', '1 дерево за 40 секунд под нагрузкой. В простое топливо не расходуется.', true);
    add('ϟ Мощность', e.output, 8, 'кВт', 'Текущая фактическая нагрузка; приоритет — по порядку строительства.');
  }
  if (e.kind === 'composter') {
    add('♻ Сырьё', e.stock.manure + e.stock.waste, e.capacity, 'ед.', 'Рецепт: 3 навоза или 5 биоотходов. Приоритет — навоз.', true);
    add('◷ Компост', e.progress, 18, 'с', '18 секунд на 2 удобрения.');
    add('✿ Удобрение', e.stock.fertilizer, e.capacity, 'ед.', 'Готовая продукция занимает общую ёмкость компостера.');
  }
  if (e.kind !== 'warehouse' && e.capacity > 0) {
    add('▥ Внутренний запас', volume(e.stock), e.capacity, 'ед.', 'Все входы и выходы используют общую ёмкость.');
    const m = result[result.length - 1]; m.tone = m.value >= m.max - .01 ? 'bad' : m.value > m.max * .85 ? 'warn' : 'good';
  }
  // Keep values real, including blocked growth; never invent a decorative progress percentage.
  void sim;
  return result;
}
