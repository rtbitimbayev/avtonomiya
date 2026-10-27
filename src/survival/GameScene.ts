import Phaser from 'phaser';
import { Player } from './Player';
import { WorldMap } from './WorldMap';
import { HUD } from './HUD';
import { InteractionSystem } from './InteractionSystem';
import { WORLD, createSurvivor, loadSurvivor, saveSurvivor, type SurvivorState } from './ResourceData';
import { createTextures } from './textures';
import './survival.css';

export class GameScene extends Phaser.Scene {
  private state: SurvivorState = createSurvivor();
  private player!: Player;
  private map!: WorldMap;
  private interactions!: InteractionSystem;
  private hud!: HUD;
  private outline!: Phaser.GameObjects.Graphics;
  private collider?: Phaser.Physics.Arcade.Collider;
  private blurHandler = () => this.player?.stop();
  create() {
    createTextures(this);
    const container = document.querySelector('#app')!;
    container.classList.add('survival');
    this.physics.world.setBounds(0, 0, WORLD.pixels, WORLD.pixels);
    this.cameras.main.setBounds(0, 0, WORLD.pixels, WORLD.pixels).setZoom(2).setRoundPixels(true);
    this.map = new WorldMap(this, this.state);
    this.player = new Player(this, this.state.player);
    this.collider = this.physics.add.collider(this.player.sprite, this.map.obstacles);
    this.interactions = new InteractionSystem(this.state, this.map.objects);
    this.outline = this.add.graphics().setDepth(20);
    this.cameras.main.startFollow(this.player.sprite, true, 1, 1);
    this.hud = new HUD(() => this.save(), () => this.restoreRun());
    this.input.keyboard!.addKey('E');
    this.input.keyboard!.on('keydown-E', (event: KeyboardEvent) => {
      if (event.repeat) return;
      const result = this.interactions.interact(this.player.sprite);
      if (result) {
        if (result.object.kind !== 'shelter') this.map.remove(result.object.id);
        this.hud.message(result.message); this.updateHUD();
      }
    });
    this.game.events.on(Phaser.Core.Events.BLUR, this.blurHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.BLUR, this.blurHandler); this.hud.destroy();
    });
    this.updateHUD();
    // Loading is explicit: opening the game neither changes nor overwrites either mode's save.
  }
  private snapshot() { this.state.player = { x: this.player.sprite.x, y: this.player.sprite.y }; }
  private save() {
    try { this.snapshot(); saveSurvivor(this.state); this.hud.message('Поход сохранён. Сохранение хозяйства не изменено.'); }
    catch { this.hud.message('Хранилище браузера недоступно: сохранить не удалось.'); }
  }
  private restoreRun() {
    try {
      const state = loadSurvivor();
      if (!state) { this.hud.message('Сохранённого похода нет. Хозяйство доступно отдельной кнопкой.'); return; }
      // Recreate only the survivor world; old farm saves are never read or written here.
      this.player.stop(); this.collider?.destroy();
      this.map.destroy();
      this.state = state;
      this.map = new WorldMap(this, state);
      this.player.sprite.setPosition(state.player.x, state.player.y);
      (this.player.sprite.body as Phaser.Physics.Arcade.Body).reset(state.player.x, state.player.y);
      this.collider = this.physics.add.collider(this.player.sprite, this.map.obstacles);
      this.interactions = new InteractionSystem(state, this.map.objects);
      this.updateHUD(); this.hud.message('Поход загружен.');
    } catch { this.hud.message('Сохранение несовместимо или повреждено. Игра и исходные данные не изменены.'); }
  }
  private updateHUD() {
    const target = this.interactions.nearest(this.player.sprite);
    this.hud.update(this.state, target, this.player.sprite);
    this.outline.clear();
    if (target) {
      this.outline.lineStyle(1, target.kind === 'shelter' ? 0xd5bd83 : 0xa5c7ac, .9);
      this.outline.strokeRect(target.x - target.width / 2 - 3, target.y - target.height / 2 - 3, target.width + 6, target.height + 6);
    }
  }
  update(_time: number, delta: number) { this.player.update(delta); this.updateHUD(); }
}
const app = document.querySelector('#app')!;
app.innerHTML = '<div id="survivor-game"></div>';
export const game = new Phaser.Game({
  type: Phaser.AUTO, parent: 'survivor-game', backgroundColor: '#29372f', scene: GameScene,
  pixelArt: true, roundPixels: true,
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, fixedStep: true, fps: 60 } },
  render: { antialias: false, pixelArt: true, roundPixels: true },
});
