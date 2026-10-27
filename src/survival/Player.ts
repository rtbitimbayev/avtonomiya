import Phaser from 'phaser';
import { movement, type Point } from './ResourceData';
export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  private readonly keys: Record<string, Phaser.Input.Keyboard.Key>;
  private facing = 'down';
  private walkingTime = 0;
  constructor(scene: Phaser.Scene, start: Point) {
    this.sprite = scene.physics.add.sprite(start.x, start.y, 'survivor-player-down-0').setScale(2);
    this.sprite.setCollideWorldBounds(true); this.sprite.setSize(8, 8).setOffset(4, 4);
    this.keys = scene.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
  }
  update(delta: number) {
    const k = this.keys;
    const axisX = Number(k.D.isDown || k.RIGHT.isDown) - Number(k.A.isDown || k.LEFT.isDown);
    const axisY = Number(k.S.isDown || k.DOWN.isDown) - Number(k.W.isDown || k.UP.isDown);
    const v = movement(axisX, axisY);
    // Arcade integrates this velocity in pixels / second, with its own delta time.
    this.sprite.setVelocity(v.x, v.y);
    if (axisX || axisY) { this.facing = axisY ? axisY > 0 ? 'down' : 'up' : axisX > 0 ? 'right' : 'left'; this.walkingTime += delta; }
    else this.walkingTime = 0;
    const frame = this.walkingTime ? 1 + Math.floor(this.walkingTime / 140) % 2 : 0;
    this.sprite.setTexture(`survivor-player-${this.facing}-${frame}`);
    this.sprite.setDepth(10);
  }
  stop() { this.sprite.setVelocity(0, 0); Object.values(this.keys).forEach(key => key.reset()); }
}
