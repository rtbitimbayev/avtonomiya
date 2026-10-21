import Phaser from 'phaser';
import { Simulation, definitions, labels, SIZE, save, load, crops, resourceKeys, volume,
  type Kind, type Resource, type Entity, type Crop } from './simulation';
import { meters } from './indicators';
import { drawWorld, drawSelection, footprint } from './renderer';
import './style.css';
const sim = new Simulation();
let autosaveEnabled = true;
try { const state = load(); if (state) sim.state = state; }
catch { autosaveEnabled = false; sim.message = 'Сохранение повреждено. Автосохранение отключено: исходные данные сохранены. Ручное сохранение создаст резервную копию.'; }
let level = 0, speed = 1, tool = 'select', rotation: 0 | 1 = 0;
let selected: Entity | undefined, scene: World;
const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`<header><div class="brand"><span class="brandmark">а</span><div>АВТОНОМИЯ<small>v0.2 · ВОЗРОЖДЕНИЕ</small></div></div><div id="resources"></div><button id="save">Сохранить <span>↗</span></button><button id="load">Загрузить</button></header><div class="workspace"><aside class="build"><div class="eyebrow">АВТОНОМНЫЙ КОМПЛЕКС</div><h1>Жизнь после<br>тишины.</h1><p class="muted">Восстановите почву.<br>Замкните круг ресурсов.</p><div class="tabs"><button data-tool="select" class="active">↖ Выбор</button><button data-tool="gather">⚒ Добыча</button><button data-tool="remove">⌫ Снос</button></div><h3>ПОСТРОЙКИ <span>10</span></h3><div id="build-mode"></div><div id="catalog"></div><div class="hint"><b>Первая цепочка</b><p>Склад → «Перенести стартовые запасы» → грядки и резервуар.<br>Соединяйте сторонами или конвейерами. Насосам и лампам нужен генератор.</p></div></aside><main><div class="mapbar"><div><span class="live"></span> СЕКТОР ВОЗРОЖДЕНИЯ <span class="muted">/ 64 × 64</span></div><div class="levels"><button id="surface" class="active">0 · Поверхность</button><button id="underground">−1 · Подземелье</button></div></div><div id="game"></div><div class="mapfooter"><span>WASD / стрелки — камера · колесо — масштаб · R — поворот · Esc — отмена</span><button id="center">⌖ К центру</button><span id="coords">32 : 32</span></div><div class="timebar"><div><span class="sun">☀</span><b id="clock"></b><span id="daylight" class="muted"></span></div><div class="speeds"><button data-speed="0">Ⅱ</button><button data-speed="1" class="active">×1</button><button data-speed="2">×2</button><button data-speed="4">×4</button></div></div></main><aside class="details"><div class="eyebrow">ОБЗОР ХОЗЯЙСТВА</div><h2>Контур жизни</h2><div class="stat"><span>Построек</span><b id="count">0</b></div><div class="stat"><span>В сети склада</span><b id="linked">0</b></div><div id="depot" class="muted"></div><div class="separator"></div><div id="selection"></div><div class="guide"><div class="eyebrow">ПОЛЕВЫЕ ЗАМЕТКИ</div><p>01 <b>Свет даёт жизнь</b><br>Растения растут днём. Под землёй нужны светильник и генератор.</p><p>02 <b>Ничего лишнего</b><br>Корм → куры → навоз → компост → новый урожай.</p><p>03 <b>Расширяйте границы</b><br>В режиме добычи раскапывайте стены подземелья за 2 дерева. Снос возвращает материалы.</p></div></aside></div><div id="toast"></div>`;
const catalog = document.querySelector('#catalog')!;
for (const category of [...new Set(Object.values(definitions).map(d => d.category))]) {
  const heading = document.createElement('div'); heading.className = 'category'; heading.textContent = category; catalog.append(heading);
  for (const [kind, d] of Object.entries(definitions).filter(([, d]) => d.category === category)) {
    const b = document.createElement('button'); b.className = 'building'; b.dataset.tool = kind;
    b.innerHTML = `<span class="building-icon">${d.icon}</span><span><b>${d.name} <em>${d.width}×${d.height}</em></b><small>${Object.entries(d.cost).map(([k, n]) => `${n} ${labels[k as Resource].toLowerCase()}`).join(' · ')}</small></span><span class="plus">+</span>`;
    b.title = `${d.width}×${d.height} клеток. ${d.description}`; catalog.append(b);
  }
}
function setTool(t: string) {
  tool = t; rotation = 0;
  document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('active', (b as HTMLElement).dataset.tool === t));
  updateBuildMode();
}
function updateBuildMode() {
  const box = document.querySelector('#build-mode')!;
  if (Object.hasOwn(definitions, tool)) {
    const d = definitions[tool as Kind];
    box.innerHTML = `<div class="build-summary">${d.name} · ${rotation ? d.height : d.width}×${rotation ? d.width : d.height}<br><small>R — поворот · зелёный контур — можно</small><button id="cancel">Отменить · Esc</button></div>`;
    (document.querySelector('#cancel') as HTMLElement).onclick = () => setTool('select');
  } else box.innerHTML = '';
}
document.querySelectorAll<HTMLElement>('[data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool!));
document.querySelectorAll<HTMLElement>('[data-speed]').forEach(b => b.onclick = () => {
  speed = Number(b.dataset.speed); document.querySelectorAll('[data-speed]').forEach(a => a.classList.toggle('active', a === b));
});
function changeLevel(l: number) {
  level = l; selected = undefined;
  document.querySelector('#surface')!.classList.toggle('active', l === 0);
  document.querySelector('#underground')!.classList.toggle('active', l === 1);
  scene?.draw(); refresh();
}
(document.querySelector('#surface') as HTMLElement).onclick = () => changeLevel(0);
(document.querySelector('#underground') as HTMLElement).onclick = () => changeLevel(1);
(document.querySelector('#save') as HTMLElement).onclick = () => {
  try {
    if (!autosaveEnabled) { const previous = localStorage.getItem('avtonomiya-v1'); if (previous) localStorage.setItem('avtonomiya-corrupt-backup', previous); }
    save(sim); autosaveEnabled = true; sim.message = 'Комплекс сохранён в этом браузере.';
  }
  catch { sim.message = 'Не удалось сохранить: хранилище браузера недоступно.'; } notify();
};
(document.querySelector('#load') as HTMLElement).onclick = () => {
  try {
    const state = load();
    if (!state) sim.message = 'Сохранений пока нет.';
    else { sim.state = state; autosaveEnabled = true; selected = undefined; sim.message = 'Комплекс загружен. Старые здания сохраняют размер 1×1.'; scene.draw(); refresh(); }
  } catch { autosaveEnabled = false; sim.message = 'Сохранение не прошло проверку. Текущая игра не изменена, автосохранение отключено.'; } notify();
};
(document.querySelector('#center') as HTMLElement).onclick = () => scene.cameras.main.centerOn(32 * 24, 32 * 24);
let toastTimer: number | undefined;
function notify() {
  const t = document.querySelector('#toast')!; t.textContent = sim.message; t.classList.add('visible');
  window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => t.classList.remove('visible'), 4000);
}
function act(id: string, fn: () => void) {
  const b = document.getElementById(id); if (b) b.onclick = () => { fn(); notify(); scene.draw(); refresh(true); };
}
function selectionPanel(e: Entity) {
  const d = definitions[e.kind], box = document.querySelector('#selection')!;
  const rate = e.kind === 'bed' ? sim.growthRate(e) : 0;
  const eta = e.stage === 'ripe' ? 'Готово к уборке' : rate > 0 ? `≈ ${Math.ceil((crops[e.crop].duration - e.progress) / rate)} с до урожая на ×1` : 'Ожидает подходящих условий';
  box.innerHTML = `<div class="eyebrow">ОБЪЕКТ #${e.id} · ${e.x}, ${e.y} · ${e.width}×${e.height}${e.legacy ? ' · v0.1' : ''}</div>
    <div class="object-heading"><span>${d.icon}</span><h2>${d.name}</h2></div>
    <div class="status ${sim.critical(e) ? 'critical' : ''}">${sim.reason(e)}</div>
    <p class="muted">${d.description}</p>
    ${meters(e, sim).map(m => `<div class="meter ${m.tone}" title="${m.hint}"><div><span>${m.label}</span><b>${m.value.toFixed(m.unit === 'кВт' ? 0 : 1)} / ${m.max} ${m.unit}</b></div><div class="track"><i style="width:${Math.max(0, Math.min(100, m.value / m.max * 100))}%"></i></div></div>`).join('')}
    ${e.kind === 'bed' ? `<label class="field">Культура <select id="crop" ${e.planted ? 'disabled' : ''}>${Object.entries(crops).map(([k, c]) => `<option value="${k}" ${e.crop === k ? 'selected' : ''}>${c.name} · ${c.duration} с</option>`).join('')}</select></label><p class="muted">${eta}<br>Температура: ${(e.level ? 16 : sim.temperature()).toFixed(1)} °C · ${sim.light(e) ? 'есть свет' : 'нет света'}<br>Удобрение: ${e.fertilized ? 'внесено · ×1,7' : 'не внесено'}</p><label class="toggle"><input id="auto-harvest" type="checkbox" ${e.autoHarvest ? 'checked' : ''}> Автосбор и повторный посев</label>` : ''}
    ${['bed', 'coop', 'feeder', 'composter', 'generator', 'tank'].includes(e.kind) ? `<label class="toggle"><input id="auto-supply" type="checkbox" ${e.autoSupply ? 'checked' : ''}> Автоснабжение из своей сети</label>` : ''}
    ${e.kind === 'warehouse' ? `<div class="eyebrow">ПРИНИМАТЬ РЕСУРСЫ</div><div class="filters">${resourceKeys.map(k => `<label title="Запрет не удаляет уже хранящиеся ресурсы"><input data-filter="${k}" type="checkbox" ${e.allowed.includes(k) ? 'checked' : ''}>${labels[k]}</label>`).join('')}</div><button class="primary" id="transfer">Перенести стартовые запасы</button>` : ''}
    ${['bed', 'coop', 'feeder', 'composter', 'generator', 'tank'].includes(e.kind) ? `<button class="primary" id="action">${e.kind === 'bed' ? e.stage === 'ripe' ? 'Собрать урожай' : e.planted ? 'Полить / удобрить вручную' : 'Посеять и полить · 1 семя' : 'Пополнить вручную'}</button>` : ''}
    ${e.kind === 'bed' && e.planted ? '<button id="clear-crop">Убрать посев без урожая</button>' : ''}
    ${['bed', 'coop', 'composter', 'tank', 'pump'].includes(e.kind) ? '<button id="collect">Забрать готовую продукцию</button>' : ''}
    <div class="inventory"><div class="eyebrow">ЗАПАСЫ ПО ВИДАМ</div>${Object.entries(e.stock).filter(([, n]) => n > .01).map(([k, n]) => `<div class="stat"><span>${labels[k as Resource]}</span><b>${n.toFixed(1)} ед.</b></div>`).join('') || '<p class="muted">Пока пусто</p>'}</div>
    <small class="muted">Завершённых циклов: ${e.cycles}</small>`;
  act('action', () => { sim.interact(e); }); act('collect', () => { sim.collect(e); });
  act('transfer', () => { sim.transferDepot(e); }); act('clear-crop', () => { sim.clearCrop(e); });
  const crop = document.querySelector<HTMLSelectElement>('#crop');
  if (crop) crop.onchange = () => { sim.setCrop(e, crop.value as Crop); refresh(true); };
  const harvest = document.querySelector<HTMLInputElement>('#auto-harvest'); if (harvest) harvest.onchange = () => { e.autoHarvest = harvest.checked; harvest.blur(); };
  const supply = document.querySelector<HTMLInputElement>('#auto-supply'); if (supply) supply.onchange = () => { e.autoSupply = supply.checked; supply.blur(); };
  document.querySelectorAll<HTMLInputElement>('[data-filter]').forEach(input => input.onchange = () => {
    const k = input.dataset.filter as Resource; e.allowed = e.allowed.filter(a => a !== k); if (input.checked) e.allowed.push(k); input.blur();
  });
}
function refresh(force = false) {
  const total = sim.totals();
  document.querySelector('#resources')!.innerHTML = resourceKeys.map(k => `<div class="resource" title="${labels[k]}: стартовый контейнер и склады; внутренние запасы машин учитываются в их панелях"><small>${labels[k]}</small><b>${Math.floor(total[k])}</b></div>`).join('');
  const min = Math.floor(sim.state.time % 1440);
  document.querySelector('#clock')!.textContent = `День ${Math.floor(sim.state.time / 1440) + 1} · ${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
  document.querySelector('#daylight')!.textContent = `${min >= 360 && min < 1200 ? 'День' : 'Ночь'} · ${sim.temperature().toFixed(0)} °C`;
  document.querySelector('#count')!.textContent = String(sim.state.entities.length);
  document.querySelector('#linked')!.textContent = String(sim.connected().size);
  document.querySelector('#depot')!.textContent = `Стартовый контейнер: ${volume(sim.state.resources).toFixed(0)} / ${sim.state.baseCapacity} ед. · Перенесите запасы на склад для автоматики.`;
  if (selected && !sim.state.entities.includes(selected)) selected = undefined;
  const box = document.querySelector('#selection')!;
  // Preserve an open culture dropdown or a keyboard-focused control during simulation updates.
  if (force || !box.contains(document.activeElement)) {
    if (selected) selectionPanel(selected);
    else box.innerHTML = '<div class="empty-icon">⌖</div><h2>Вернуть жизнь</h2><p class="muted">Выберите объект, чтобы увидеть его запасы и причины остановки. Начните со склада 3×3 и перенесите в него стартовые ресурсы.</p><div class="status">Сухая земля может стать зелёной</div>';
  }
  document.querySelectorAll<HTMLElement>('.building').forEach(b => b.classList.toggle('unaffordable', !sim.afford(definitions[b.dataset.tool as Kind].cost)));
}
class World extends Phaser.Scene {
  g!: Phaser.GameObjects.Graphics; overlay!: Phaser.GameObjects.Graphics;
  keys!: Record<string, Phaser.Input.Keyboard.Key>; elapsed = 0; auto = 0;
  create() {
    scene = this; this.g = this.add.graphics(); this.overlay = this.add.graphics();
    this.cameras.main.setBounds(0, 0, SIZE * 24, SIZE * 24); this.cameras.main.setZoom(1.4); this.cameras.main.centerOn(32 * 24, 32 * 24);
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,ESC,R') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on('keydown-R', (event: KeyboardEvent) => {
      if (!event.repeat && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName ?? '') && Object.hasOwn(definitions, tool)) { rotation = rotation ? 0 : 1; updateBuildMode(); }
    });
    this.input.keyboard!.on('keydown-ESC', () => setTool('select'));
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => { const c = this.cameras.main; c.setZoom(Phaser.Math.Clamp(c.zoom - dy * .001, .5, 3)); });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.button !== 0) return;
      const pt = this.cameras.main.getWorldPoint(p.x, p.y), x = Math.floor(pt.x / 24), y = Math.floor(pt.y / 24);
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
      if (tool === 'select') selected = sim.at(x, y, level);
      else if (tool === 'gather') { sim.gather(x, y, level); notify(); }
      else if (tool === 'remove') { if (sim.remove(x, y, level)) selected = undefined; notify(); }
      else { sim.build(tool as Kind, x, y, level, rotation); notify(); }
      this.draw(); refresh(true);
    }); this.draw(); refresh(); if (!autosaveEnabled) notify();
  }
  draw() { drawWorld(this.g, sim, level); }
  update(_time: number, delta: number) {
    const dt = Math.min(delta / 1000, .25), c = this.cameras.main, k = this.keys; if (!k) return;
    const focus = document.activeElement?.tagName;
    if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(focus ?? '')) {
      const v = 420 * dt / c.zoom;
      c.scrollX += ((k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0)) * v;
      c.scrollY += ((k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0)) * v;
    }
    sim.tick(dt * speed); this.elapsed += dt; this.auto += dt;
    if (this.elapsed > .3) { this.draw(); refresh(); this.elapsed = 0; }
    if (this.auto > 30) { try { if (autosaveEnabled) save(sim); } catch { /* Manual save reports errors. */ } this.auto = 0; }
    const p = this.input.activePointer, pt = c.getWorldPoint(p.x, p.y), x = Math.floor(pt.x / 24), y = Math.floor(pt.y / 24);
    this.overlay.clear(); const inside = p.x >= 0 && p.y >= 0 && p.x < c.width && p.y < c.height && x >= 0 && y >= 0 && x < SIZE && y < SIZE;
    const hovered = inside ? sim.at(x, y, level) : undefined;
    drawSelection(this.overlay, sim, selected, hovered, level);
    if (inside) {
      if (Object.hasOwn(definitions, tool)) footprint(this.overlay, sim, tool as Kind, x, y, level, rotation);
      else if (tool !== 'select') { this.overlay.lineStyle(2, tool === 'remove' ? 0xe08f6e : 0xe7d5a1); this.overlay.strokeRect(x * 24, y * 24, 24, 24); }
      document.querySelector('#coords')!.textContent = `${x} : ${y}${hovered ? ' · ' + sim.reason(hovered) : ''}`;
    }
  }
}
new Phaser.Game({ type: Phaser.AUTO, parent: 'game', backgroundColor: '#81755f', scene: World,
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' }, render: { antialias: true }, input: { mouse: { preventDefaultWheel: true } } });
