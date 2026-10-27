import Phaser from 'phaser';
import { Player } from './Player';
import { WorldMap } from './WorldMap';
import { HUD } from './HUD';
import { InteractionSystem } from './InteractionSystem';
import { WORLD, createSurvivor, type SurvivorState } from './ResourceData';
import { SaveSystem } from './SaveSystem';
import { ActiveTime } from './GameClock';
import { advanceSurvival } from './SurvivalSystem';
import { consume } from './ConsumableSystem';
import { DayNightSystem } from './DayNightSystem';
import { BALANCE } from './balance';
import { createTextures } from './textures';
import './survival.css';
export class GameScene extends Phaser.Scene {
  private state: SurvivorState = createSurvivor();
  private player!: Player; private map!: WorldMap; private interactions!: InteractionSystem;
  private hud!: HUD; private daylight!: DayNightSystem; private saves!: SaveSystem;
  private outline!: Phaser.GameObjects.Graphics; private collider?: Phaser.Physics.Arcade.Collider;
  private activeTime = new ActiveTime(); private paused = false; private menu = false; private focused = true; private deadShown = false;
  private blurHandler = () => { this.focused = false; this.freeze(); };
  private focusHandler = () => { this.focused = true; this.activeTime.reset(); };
  private visibilityHandler = () => { if (document.hidden) this.freeze(); this.activeTime.reset(); };
  create() {
    createTextures(this); document.querySelector('#app')!.classList.add('survival');
    this.physics.world.setBounds(0, 0, WORLD.pixels, WORLD.pixels);
    this.cameras.main.setBounds(0, 0, WORLD.pixels, WORLD.pixels).setZoom(2).setRoundPixels(true);
    this.map = new WorldMap(this, this.state); this.player = new Player(this, this.state.player);
    this.collider = this.physics.add.collider(this.player.sprite, this.map.obstacles);
    this.interactions = new InteractionSystem(this.state, this.map.objects);
    this.outline = this.add.graphics().setDepth(20); this.daylight = new DayNightSystem(this);
    this.cameras.main.startFollow(this.player.sprite, true, 1, 1);
    this.hud = new HUD(() => this.save(true), () => this.restoreRun(), () => this.togglePause());
    // Access to localStorage can itself throw; defer it to adapter calls inside SaveSystem guards.
    this.saves = new SaveSystem({ getItem: key => localStorage.getItem(key), setItem: (key,value) => localStorage.setItem(key,value) }, m => this.hud.message(m));
    const state = this.saves.load(); if (state) this.applyState(state);
    if (this.saves.protectedData) this.incompatibleMenu();
    this.input.keyboard!.addKeys('E,ONE,TWO,P,ESC');
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.code === 'KeyP' && !this.menu && this.state.vitals.health > 0) { this.togglePause(); return; }
      if (event.code === 'Escape' && this.menu && this.state.vitals.health > 0 && !this.saves.protectedData) { this.closeMenu(); return; }
      if (!this.canAct()) return;
      if (event.code === 'Digit1' || event.code === 'Digit2') { const before = this.state.resources.food + this.state.resources.water; this.hud.message(consume(this.state, event.code === 'Digit1' ? 'food' : 'water')); if (before !== this.state.resources.food + this.state.resources.water) this.significant(); this.updateHUD(); return; }
      if (event.code === 'KeyE') this.interact();
    });
    this.game.events.on(Phaser.Core.Events.BLUR, this.blurHandler); this.game.events.on(Phaser.Core.Events.FOCUS, this.focusHandler);
    document.addEventListener('visibilitychange', this.visibilityHandler);
    this.events.once('shutdown', () => { this.game.events.off(Phaser.Core.Events.BLUR, this.blurHandler); this.game.events.off(Phaser.Core.Events.FOCUS, this.focusHandler); document.removeEventListener('visibilitychange', this.visibilityHandler); this.hud.destroy(); });
    this.updateHUD();
  }
  private canAct() { return !this.paused && !this.menu && this.focused && !document.hidden && this.state.vitals.health > 0; }
  private freeze() { this.player?.stop(); this.physics.world.pause(); this.activeTime.reset(); }
  private togglePause() { if (this.menu || this.state.vitals.health <= 0) return; this.paused = !this.paused; this.freeze(); this.hud.pause(this.paused); }
  private snapshot() { this.state.player = { x: this.player.sprite.x, y: this.player.sprite.y }; }
  private save(manual = false) {
    this.snapshot(); const ok = this.saves.save(this.state);
    if (manual) this.hud.message(this.state.vitals.health <= 0 ? 'Последнее живое сохранение сохранено.' : this.saves.protectedData ? 'Старые данные защищены. Начните безопасную новую игру через меню загрузки.' : ok ? 'Поход сохранён.' : 'Сохранить не удалось. Игра продолжается.');
  }
  private significant() { this.saves.mark(); this.save(); }
  private restoreRun() {
    if (this.menu && this.state.vitals.health > 0) return;
    const state = this.saves.load();
    if (state) { this.applyState(state); this.hud.message('Поход загружен.'); }
    else if (this.saves.protectedData) this.incompatibleMenu();
    else this.hud.message('Сохранений пока нет.');
  }
  private applyState(state: SurvivorState) {
    this.freeze(); this.collider?.destroy(); this.map.destroy(); this.state = state;
    this.map = new WorldMap(this, state);
    (this.player.sprite.body as Phaser.Physics.Arcade.Body).reset(state.player.x, state.player.y);
    this.collider = this.physics.add.collider(this.player.sprite, this.map.obstacles);
    this.interactions = new InteractionSystem(state, this.map.objects);
    this.menu = false; this.paused = false; this.deadShown = false; this.hud?.closeModal(); this.hud?.pause(false); this.updateHUD();
  }
  private incompatibleMenu() {
    this.menu = true; this.freeze(); this.hud.modal('Сохранение защищено', 'Неподдерживаемые или повреждённые данные не изменены. Новая игра создаст резервную копию. Можно продолжить текущую игру без записи.', [
      {label:'Безопасная новая игра',id:'safe-new-game',run:()=>this.newGame()},
      {label:'Продолжить без записи',id:'continue-unsaved',run:()=>this.closeMenu()},
    ]);
  }
  private newGame() { this.saves.allowNewGame(); this.applyState(createSurvivor()); }
  private closeMenu() { this.menu = false; this.hud.closeModal(); this.freeze(); }
  private interact() {
    const target = this.interactions.nearest(this.player.sprite); if (!target) return;
    if (target.kind === 'shelter') { this.shelterMenu(); return; }
    const result = this.interactions.interact(this.player.sprite);
    if (result) { this.map.remove(result.object.id); this.hud.message(result.message); this.significant(); this.updateHUD(); }
  }
  private shelterMenu() {
    if (this.menu) return; this.menu = true; this.freeze();
    this.hud.modal('Заброшенное убежище', 'Здесь можно осмотреть убежище или отдохнуть. Во время сна расходуются припасы организма; здоровье не восстанавливается.', [
      {label:'Осмотреть',id:'shelter-inspect',run:()=>{ const result=this.interactions.interact(this.player.sprite); this.closeMenu(); if(result){this.hud.message(result.message);this.significant();this.updateHUD();} }},
      {label:'Отдохнуть 6 часов',id:'shelter-sleep',run:()=>this.sleep()},
      {label:'Отмена',id:'shelter-cancel',run:()=>this.closeMenu()},
    ]);
  }
  private sleep() {
    if (!this.menu || this.interactions.nearest(this.player.sprite)?.kind !== 'shelter' || this.state.vitals.health <= 0) return;
    // One synchronous shared advancement. No real-time update can run concurrently with this transaction.
    advanceSurvival(this.state, BALANCE.sleepMinutes); this.closeMenu();
    this.updateHUD();
    if (this.state.vitals.health <= 0) this.showDeath(); else { this.hud.message('Вы отдохнули'); this.significant(); }
  }
  private showDeath() {
    if (this.deadShown) return; this.deadShown = true; this.menu = true; this.freeze();
    this.hud.modal('ВЫ ПОГИБЛИ', this.state.deathCause ?? 'Жизненные показатели достигли нуля.', [
      {label:'Новая игра',id:'death-new-game',run:()=>this.newGame()},
      {label:'Загрузить живое сохранение',id:'death-load',run:()=>this.restoreRun()},
    ]);
  }
  private updateHUD() {
    if (!this.hud) return;
    const target = this.canAct() ? this.interactions.nearest(this.player.sprite) : undefined;
    this.hud.update(this.state, target, this.player.sprite); this.daylight.update(this.state.clock.minuteOfDay);
    this.outline.clear(); if (target) { this.outline.lineStyle(1, 0xa5c7ac); this.outline.strokeRect(target.x-target.width/2-3,target.y-target.height/2-3,target.width+6,target.height+6); }
  }
  update(_time: number, delta: number) {
    const seconds = this.activeTime.sample(delta, this.canAct());
    if (seconds > 0) {
      this.physics.world.resume(); this.player.update(delta);
      advanceSurvival(this.state, seconds * BALANCE.gameMinutesPerSecond);
      this.snapshot(); this.saves.mark(); this.saves.tick(seconds, this.state);
    } else { this.player.stop(); this.physics.world.pause(); }
    if (this.state.vitals.health <= 0) this.showDeath(); this.updateHUD();
  }
}
const app = document.querySelector('#app')!; app.innerHTML = '<div id="survivor-game"></div>';
export const game = new Phaser.Game({type: Phaser.AUTO,parent:'survivor-game',backgroundColor:'#29372f',scene:GameScene,pixelArt:true,roundPixels:true,
  scale:{mode:Phaser.Scale.RESIZE,width:'100%',height:'100%'},physics:{default:'arcade',arcade:{gravity:{x:0,y:0},fixedStep:true,fps:60}},render:{antialias:false,pixelArt:true,roundPixels:true}});
