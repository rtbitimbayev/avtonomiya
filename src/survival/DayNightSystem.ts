import Phaser from 'phaser';
import { lighting } from './GameClock';
export class DayNightSystem {
  private overlay: Phaser.GameObjects.Rectangle;
  constructor(private scene: Phaser.Scene) {
    this.overlay = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0x101b39).setOrigin(0).setScrollFactor(0).setDepth(100);
    scene.scale.on('resize', this.resize, this);
    scene.events.once('shutdown', () => scene.scale.off('resize', this.resize, this));
  }
  private resize(size: Phaser.Structs.Size) { this.overlay.setSize(size.width, size.height); }
  update(minute: number) {
    // Counteract camera zoom so this non-interactive overlay always covers the viewport.
    this.overlay.setScale(1 / this.scene.cameras.main.zoom);
    this.overlay.setPosition(this.scene.cameras.main.width * (1 - 1 / this.scene.cameras.main.zoom) / 2, this.scene.cameras.main.height * (1 - 1 / this.scene.cameras.main.zoom) / 2);
    this.overlay.setAlpha(lighting(minute).alpha);
  }
}
