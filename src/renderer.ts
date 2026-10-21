import Phaser from 'phaser';
import { crops, volume, SIZE, definitions, type Entity } from './data';
import { Simulation } from './simulation';
import { meters } from './indicators';
const CELL = 24;
const palette = { good: 0x97c582, warn: 0xe0b969, bad: 0xe37f61 };
function mix(a: number, b: number, f: number) {
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(a), Phaser.Display.Color.ValueToColor(b), 100, f * 100);
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
}
export function drawWorld(g: Phaser.GameObjects.Graphics, sim: Simulation, level: number) {
  g.clear();
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const t = sim.tile(x, y, level)!, px = x * CELL, py = y * CELL;
    const dry = (x * 17 + y * 13) % 7 < 3 ? 0x877c66 : 0x81755f;
    const color = level ? t.terrain === 'wall' ? 0x303936 : 0x65675c : mix(dry, 0x72935b, t.restoration);
    g.fillStyle(color); g.fillRect(px, py, CELL, CELL);
    g.lineStyle(1, 0x202b26, .13); g.strokeRect(px, py, CELL, CELL);
    // Deterministic cracks / concrete fragments are terrain details, not interactable fake buildings.
    if (t.terrain === 'grass' && t.restoration < .3 && (x * 7 + y * 11) % 13 === 0) {
      g.lineStyle(1, 0x4d4d41, .4); g.lineBetween(px + 2, py + 6, px + 9, py + 11); g.lineBetween(px + 9, py + 11, px + 6, py + 18);
      g.fillStyle(0xa09b83, .6); g.fillRect(px + 15, py + 16, 5, 3);
    }
    if (t.terrain === 'water') {
      g.fillStyle(0x4d7979); g.fillRect(px, py, 24, 24); g.lineStyle(1, 0x9fb3a3, .4); g.lineBetween(px + 5, py + 12, px + 17, py + 12);
    }
    if (t.terrain === 'tree') {
      // A dead crown seen from directly above; wood can still be salvaged.
      g.lineStyle(3, 0x574b39); g.lineBetween(px + 6, py + 5, px + 18, py + 19); g.lineBetween(px + 19, py + 6, px + 5, py + 16);
      g.fillStyle(0x625f40); g.fillCircle(px + 12, py + 12, 5); g.fillStyle(0x9b8d65); g.fillCircle(px + 12, py + 12, 2);
    }
    if (t.terrain === 'rock') {
      g.fillStyle(0x5d655f); g.fillRoundedRect(px + 4, py + 5, 17, 15, 3); g.fillStyle(0x969789); g.fillRect(px + 6, py + 6, 9, 7);
      g.lineStyle(2, 0x955b3f); g.lineBetween(px + 15, py + 8, px + 18, py + 17);
    }
    if (t.terrain === 'wall') { g.lineStyle(1, 0x59625a, .6); g.lineBetween(px + 3, py + 5, px + 16, py + 3); }
  }
  const net = sim.connected();
  for (const e of sim.state.entities.filter(a => a.level === level)) drawBuilding(g, e, sim, net.has(e.id));
  if (level === 0 && (sim.state.time % 1440 < 360 || sim.state.time % 1440 >= 1200)) {
    g.fillStyle(0x15253e, .34); g.fillRect(0, 0, SIZE * CELL, SIZE * CELL);
    for (const e of sim.state.entities.filter(a => a.level === level && a.kind === 'lamp' && a.powered)) {
      g.fillStyle(0xffdf87, .12); g.fillCircle(e.x * CELL + 12, e.y * CELL + 12, 96);
    }
  }
}
function drawBuilding(g: Phaser.GameObjects.Graphics, e: Entity, sim: Simulation, linked: boolean) {
  const x = e.x * CELL, y = e.y * CELL, w = e.width * CELL, h = e.height * CELL;
  g.fillStyle(0x293b34, .4); g.fillRect(x + 2, y + 2, w - 3, h - 3);
  g.fillStyle(e.kind === 'bed' ? 0x6e5138 : 0x7d8172); g.fillRoundedRect(x + 2, y + 2, w - 4, h - 4, 2);
  g.lineStyle(1, 0xb8b79c, .6); g.strokeRect(x + 3, y + 3, w - 6, h - 6);
  if (e.kind === 'bed') {
    g.lineStyle(2, 0x423c2e); for (let i = 6; i < h - 2; i += 5) g.lineBetween(x + 3, y + i, x + w - 3, y + i);
    if (e.planted) {
      const f = e.progress / crops[e.crop].duration;
      g.fillStyle(e.health <= 0 ? 0x8e7851 : e.stage === 'ripe' ? 0xe4c16d : crops[e.crop].color);
      for (let a = 7; a < 22; a += 7) for (let b = 7; b < 22; b += 7) {
        if (e.stage === 'sown') g.fillRect(x + a, y + b, 2, 2);
        else if (e.crop === 'wheat') { g.fillRect(x + a, y + b - f * 3, 2, 3 + f * 5); }
        else g.fillEllipse(x + a, y + b, 2 + f * 7, 2 + f * 5);
      }
    }
    if (e.fertilized) { g.fillStyle(0xaac574); g.fillCircle(x + 4, y + 4, 1.5); }
  }
  if (e.kind === 'warehouse') {
    g.fillStyle(0x4f6057); g.fillRect(x + 6, y + 6, w - 12, h - 12);
    g.lineStyle(2, 0x9a7450); for (let i = 9; i < h - 6; i += 14) g.lineBetween(x + 6, y + i, x + w - 6, y + i);
    const boxes = Math.ceil(volume(e.stock) / e.capacity * 12);
    for (let i = 0; i < boxes; i++) {
      const bx = x + 9 + i % 3 * (w - 18) / 3, by = y + 9 + Math.floor(i / 3) * (h - 18) / 4;
      const bw = Math.max(3, (w - 23) / 3), bh = Math.max(3, (h - 24) / 4);
      g.fillStyle(i % 2 ? 0xb19460 : 0x9f7750); g.fillRect(bx, by, bw, bh); g.lineStyle(1, 0x574d38); g.strokeRect(bx, by, bw, bh);
    }
  }
  if (e.kind === 'coop') {
    g.fillStyle(0x6b725b); g.fillRect(x + 5, y + 5, w - 10, h - 10);
    // Fence and nests are visible from above, with no perspective roof obscuring the flock.
    g.lineStyle(2, 0xb69b6b); g.strokeRect(x + 5, y + 5, w - 10, h - 10);
    g.fillStyle(0x9f895a); g.fillRect(x + 7, y + 7, Math.max(5, w / 3), 7);
    for (let i = 0; i < e.chickens; i++) {
      const t = sim.state.time / 2, cx = x + w / 2 + Math.sin(t * .8 + i * 3) * Math.max(1, w / 2 - 12), cy = y + h / 2 + Math.cos(t * .6 + i * 2) * Math.max(1, h / 2 - 13);
      g.fillStyle(e.health < 35 ? 0xbfb09a : 0xf4e6bf); g.fillEllipse(cx, cy, 7, 9); g.fillStyle(0xb86544); g.fillCircle(cx + 2, cy - 4, 2);
      if (e.stock.eggs > i) { g.fillStyle(0xf9e8d0); g.fillEllipse(x + 9 + i * 5, y + 11, 3, 4); }
    }
  }
  if (e.kind === 'tank') {
    g.fillStyle(0x394f50); g.fillCircle(x + w / 2, y + h / 2, Math.min(w, h) / 2 - 5);
    g.fillStyle(0x72acb3); g.fillCircle(x + w / 2, y + h / 2, Math.max(0, Math.min(w, h) / 2 - 8) * Math.sqrt(e.stock.water / e.capacity));
    g.lineStyle(2, 0xb0b3a0); g.strokeCircle(x + w / 2, y + h / 2, Math.min(w, h) / 2 - 5);
    g.fillStyle(0x975e40); g.fillRect(x + w / 2 - 2, y + 2, 4, 7);
  }
  if (e.kind === 'pump') {
    g.lineStyle(5, 0x466264); g.lineBetween(x + w / 2, y + 2, x + w / 2, y + h - 2);
    g.fillStyle(0xb88451); g.fillCircle(x + w / 2, y + h / 2, 7);
    g.lineStyle(2, e.powered ? 0xa9d3c3 : 0x675b4a); g.lineBetween(x + w / 2 - 5, y + h / 2, x + w / 2 + 5, y + h / 2);
  }
  if (e.kind === 'generator') {
    g.fillStyle(0x44544d); g.fillRect(x + 7, y + 7, w - 14, h - 14);
    g.fillStyle(0xad7447); g.fillRect(x + 9, y + 9, w - 18, Math.max(4, h / 3));
    g.lineStyle(2, 0x252e2a); for (let i = 11; i < w - 9; i += 5) g.lineBetween(x + i, y + 10, x + i, y + h / 3 + 5);
    g.fillStyle(e.output ? 0xa3d279 : 0xb26d48); g.fillRect(x + w - 13, y + h - 13, 5, 5);
  }
  if (e.kind === 'pipe') {
    g.lineStyle(6, 0x414d45); g.lineBetween(x, y + 12, x + 24, y + 12); g.lineBetween(x + 12, y, x + 12, y + 24);
    g.lineStyle(2, 0xa58b61); g.lineBetween(x, y + 12, x + 24, y + 12); g.lineBetween(x + 12, y, x + 12, y + 24);
  }
  if (e.kind === 'feeder') {
    g.fillStyle(0x4c4936); g.fillRect(x + 5, y + 5, 14, 14); g.fillStyle(0xd5b464); g.fillRect(x + 6, y + 6, 12, 5 * Math.min(1, e.stock.food / 10));
    g.fillStyle(0x79afb3); g.fillRect(x + 6, y + 13, 12, 5 * Math.min(1, e.stock.water / 10));
  }
  if (e.kind === 'composter') {
    g.fillStyle(0x4c5035); g.fillRect(x + 6, y + 6, w - 12, h - 12);
    g.fillStyle(0x8a6a41); g.fillRect(x + 7, y + 7, (w - 14) * Math.min(1, (e.stock.manure + e.stock.waste) / e.capacity), h - 14);
    g.lineStyle(2, 0xb8aa7b); for (let i = 8; i < h - 5; i += 8) g.lineBetween(x + 4, y + i, x + w - 4, y + i);
    if (e.stock.fertilizer) { g.fillStyle(0xadc979); g.fillRect(x + w - 13, y + h - 13, 7, 7); }
  }
  if (e.kind === 'lamp') {
    g.fillStyle(0x454b41); g.fillCircle(x + 12, y + 12, 7); g.fillStyle(e.powered ? 0xffe4a0 : 0x8d8872); g.fillCircle(x + 12, y + 12, 4);
  }
  if (linked) { g.fillStyle(0xb3c795); g.fillCircle(x + w - 4, y + 4, 2); }
  if (sim.critical(e)) {
    g.fillStyle(0xc56e4c); g.fillCircle(x + 6, y + 6, 4); g.lineStyle(1, 0xffe2b4); g.lineBetween(x + 6, y + 3, x + 6, y + 6);
    g.fillStyle(0xffe2b4); g.fillCircle(x + 6, y + 8, .7);
  }
}
export function drawSelection(g: Phaser.GameObjects.Graphics, sim: Simulation, selected: Entity | undefined, hovered: Entity | undefined, level: number) {
  for (const e of new Set([hovered, selected])) {
    if (!e || e.level !== level) continue;
    const x = e.x * CELL, y = e.y * CELL, w = e.width * CELL, h = e.height * CELL;
    g.lineStyle(2, e === selected ? 0xf3d58c : 0xc3d9aa); g.strokeRect(x + 1, y + 1, w - 2, h - 2);
    const list = meters(e, sim).filter(m => !m.label.includes('Внутренний')).slice(0, 4);
    for (let i = 0; i < list.length; i++) {
      const m = list[i]; g.fillStyle(0x202d27, .9); g.fillRect(x, y + h + 2 + i * 4, w, 3);
      g.fillStyle(palette[m.tone]); g.fillRect(x, y + h + 2 + i * 4, w * Phaser.Math.Clamp(m.value / m.max, 0, 1), 3);
    }
  }
}
export function footprint(g: Phaser.GameObjects.Graphics, sim: Simulation, kind: keyof typeof definitions, x: number, y: number, level: number, rotation: 0 | 1) {
  const d = definitions[kind], w = (rotation ? d.height : d.width) * CELL, h = (rotation ? d.width : d.height) * CELL;
  const allowed = !sim.placement(kind, x, y, level, rotation), color = allowed ? 0xa3d586 : 0xe17f68;
  g.fillStyle(color, .23); g.fillRect(x * CELL, y * CELL, w, h); g.lineStyle(2, color); g.strokeRect(x * CELL, y * CELL, w, h);
}
