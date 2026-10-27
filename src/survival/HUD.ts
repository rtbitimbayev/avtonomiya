import { clockLabel, lighting } from './GameClock';
import { BALANCE } from './balance';
import { RESOURCE_DATA, hasSupplies, type SurvivorState, type WorldObject, type ResourceKind, type Point } from './ResourceData';
export class HUD {
  private root: HTMLElement;
  private toastDeadline = 0;
  constructor(onSave: () => void, onLoad: () => void, onPause: () => void) {
    this.root = document.createElement('div'); this.root.className = 'survivor-hud';
    this.root.innerHTML = `<header class="survivor-header"><div class="survivor-brand"><span class="survivor-mark">A</span><div>АВТОНОМИЯ<small>ПОСЛЕДНИЙ РУБЕЖ · ЦЕНА ВЫЖИВАНИЯ</small></div></div><div class="survivor-stock">${Object.entries(RESOURCE_DATA).map(([key, r]) => `<div class="survivor-resource" style="--resource:${r.color}"><i class="res-${key}"></i><div><small>${r.label}</small><strong id="survivor-${key}">0</strong></div></div>`).join('')}</div><nav><button id="survivor-pause">Пауза · P</button><button id="survivor-save">Сохранить</button><button id="survivor-load">Загрузить</button><button id="survivor-farm" title="Прежний режим строительства и хозяйства. Сохраните текущий поход перед переходом.">Хозяйство ↗</button></nav></header>
      <section class="survivor-vitals"><div id="survivor-clock"></div><div id="survivor-phase"></div><div class="vital vital-health"><div><span>Здоровье</span><b id="stat-health">100</b></div><div class="vital-track"><i id="bar-health"></i></div></div><div class="vital vital-hunger"><div><span>Сытость</span><b id="stat-hunger">100</b></div><div class="vital-track"><i id="bar-hunger"></i></div></div><div class="vital vital-thirst"><div><span>Жажда</span><b id="stat-thirst">100</b></div><div class="vital-track"><i id="bar-thirst"></i></div></div><div id="survivor-warning" role="status"></div></section><section class="survivor-mission"><div class="survivor-eyebrow">ПОЛЕВОЙ ЖУРНАЛ / 01</div><h1>Вернуться до темноты</h1><p>Мир замолчал. Но это ещё не конец.</p><div id="survivor-objectives"></div><div id="survivor-result"></div></section>
      <div class="survivor-location"><span>● СЕКТОР ВОЗРОЖДЕНИЯ</span><small id="survivor-position"></small></div>
      <div id="survivor-prompt" aria-live="polite"></div><div id="survivor-message" role="status"></div>
      <footer class="survivor-controls"><div><kbd>W A S D</kbd><span>или стрелки — движение</span><kbd>E</kbd><span>убежище / сбор</span><kbd>1</kbd><span>есть</span><kbd>2</kbd><span>пить</span></div><span>64 × 64 · ОДИН ВЫЖИВШИЙ</span></footer>`;
    document.querySelector('#app')!.append(this.root);
    this.root.querySelector<HTMLButtonElement>('#survivor-pause')!.onclick = () => { onPause(); this.blur(); };
    this.root.querySelector<HTMLButtonElement>('#survivor-save')!.onclick = () => { onSave(); this.blur(); };
    this.root.querySelector<HTMLButtonElement>('#survivor-load')!.onclick = () => { onLoad(); this.blur(); };
    this.root.querySelector<HTMLButtonElement>('#survivor-farm')!.onclick = () => { window.location.hash = 'farm'; window.location.reload(); };
  }
  private blur() { (document.activeElement as HTMLElement | null)?.blur(); }
  update(state: SurvivorState, target: WorldObject | undefined, position: Point) {
    this.root.querySelector('#survivor-clock')!.textContent = clockLabel(state.clock);
    this.root.querySelector('#survivor-phase')!.textContent = lighting(state.clock.minuteOfDay).phase;
    for (const k of ['health','hunger','thirst'] as const) {
      this.root.querySelector(`#stat-${k}`)!.textContent = `${state.vitals[k].toFixed(1)} / 100`;
      (this.root.querySelector(`#bar-${k}`) as HTMLElement).style.width = `${state.vitals[k]}%`;
    }
    this.root.querySelector('#survivor-warning')!.textContent = [state.vitals.hunger <= BALANCE.lowWarning ? 'Низкая сытость · 1 — поесть' : '', state.vitals.thirst <= BALANCE.lowWarning ? 'Низкая жажда · 2 — попить' : ''].filter(Boolean).join(' · ');
    for (const k of Object.keys(RESOURCE_DATA) as ResourceKind[]) this.root.querySelector(`#survivor-${k}`)!.textContent = String(state.resources[k]);
    const objectives = this.root.querySelector('#survivor-objectives')!;
    const markup = (['wood', 'metal', 'water'] as ResourceKind[]).map(k => {
      const r = RESOURCE_DATA[k], done = state.resources[k] >= r.amount;
      return `<div class="survivor-objective ${done ? 'done' : ''}"><span>${done ? '✓' : '□'}</span>${r.label}<b>${Math.min(state.resources[k], r.amount)} / ${r.amount}</b></div>`;
    }).join('') + `<div class="survivor-objective ${state.returned ? 'done' : ''}"><span>${state.returned ? '✓' : '□'}</span>Вернуться к убежищу<b>Е</b></div>`;
    if (objectives.innerHTML !== markup) objectives.innerHTML = markup;
    const result = this.root.querySelector('#survivor-result')!;
    result.textContent = state.returned ? 'ДЕНЬ ЗАВЕРШЁН · Вы вернулись с припасами. Можно продолжить исследование.' : hasSupplies(state) ? 'Припасы собраны. Вернитесь к убежищу и нажмите E.' : 'Дерево — к западу, металл — к востоку, вода — к югу от старта.';
    result.classList.toggle('success', state.returned);
    const prompt = this.root.querySelector('#survivor-prompt')!;
    prompt.textContent = target ? target.kind === 'shelter' ? 'E — Осмотреть · Убежище' : `E — Собрать · ${RESOURCE_DATA[target.kind as ResourceKind].label}` : '';
    prompt.classList.toggle('shown', !!target);
    this.root.querySelector('#survivor-position')!.textContent = `${Math.floor(position.x / 32)} : ${Math.floor(position.y / 32)} · УБЕЖИЩЕ 32 : 31`;
    if (performance.now() > this.toastDeadline) this.root.querySelector('#survivor-message')!.classList.remove('shown');
  }
  message(text: string) { const el = this.root.querySelector('#survivor-message')!; el.textContent = text; el.classList.add('shown'); this.toastDeadline = performance.now() + 4500; }
  pause(paused: boolean) { this.root.querySelector('#survivor-pause')!.textContent = paused ? 'Продолжить · P' : 'Пауза · P'; }
  modal(title: string, message: string, actions: {label: string; id: string; run: () => void}[]) {
    this.closeModal();
    const box = document.createElement('section'); box.id = 'survivor-modal'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    const panel = document.createElement('div'); panel.className = 'modal-panel';
    const heading = document.createElement('h2'); heading.textContent = title;
    const text = document.createElement('p'); text.textContent = message;
    panel.append(heading, text);
    for (const action of actions) { const button = document.createElement('button'); button.id = action.id; button.textContent = action.label; button.onclick = action.run; panel.append(button); }
    box.append(panel); this.root.append(box); (panel.querySelector('button') as HTMLElement)?.focus();
  }
  closeModal() { this.root.querySelector('#survivor-modal')?.remove(); this.blur(); }
  destroy() { this.root.remove(); }
}
