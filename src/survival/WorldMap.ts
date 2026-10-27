import Phaser from 'phaser';
import { WORLD, makeObjects, type SurvivorState } from './ResourceData';
export class WorldMap {
  readonly objects = makeObjects();
  readonly obstacles: Phaser.Physics.Arcade.StaticGroup;
  private ground: Phaser.GameObjects.Graphics;
  private sprites = new Map<string, Phaser.Physics.Arcade.Image>();
  constructor(scene: Phaser.Scene, state: SurvivorState) {
    const g = scene.add.graphics(); this.ground = g;
    for (let y = 0; y < WORLD.tiles; y++) for (let x = 0; x < WORLD.tiles; x++) {
      const path = x === 32 || (y === 35 && x >= 26 && x <= 39) || (x === 33 && y >= 35 && y <= 39);
      const colors = path ? [0x565544, 0x595745, 0x535342] : [0x39433a, 0x3c463c, 0x3b4439];
      const v = (x * 37 + y * 73) % 3;
      g.fillStyle(colors[v]); g.fillRect(x * 32, y * 32, 32, 32);
      g.fillStyle(path ? 0x74705a : 0x5a6247, .7);
      g.fillRect(x * 32 + (x * 7 + y * 3) % 12 * 2, y * 32 + (x * 5 + y * 11) % 13 * 2, 2, path ? 2 : 4);
      if ((x + y) % 5 === 0) { g.fillStyle(0x252f29, .5); g.fillRect(x * 32 + 18, y * 32 + 12, 6, 2); }
    }
    g.lineStyle(4, 0x1c2924); g.strokeRect(2, 2, WORLD.pixels - 4, WORLD.pixels - 4);
    // Shelter foundation and a little marked path are ground, not additional interactable objects.
    g.fillStyle(0x4d554a); g.fillRect(980, 966, 120, 92);
    g.fillStyle(0x919178); for (let i = 0; i < 4; i++) g.fillRect(1026, 1058 + i * 14, 28, 6);
    this.obstacles = scene.physics.add.staticGroup();
    for (const object of this.objects) {
      if (state.collected.includes(object.id)) continue;
      const sprite = this.obstacles.create(object.x, object.y, `survivor-${object.kind}`) as Phaser.Physics.Arcade.Image;
      sprite.setScale(2).refreshBody();
      const body = sprite.body as Phaser.Physics.Arcade.StaticBody;
      body.setSize(object.width, object.height);
      sprite.setDepth(5); this.sprites.set(object.id, sprite);
    }
  }
  destroy() { this.obstacles.clear(true, true); this.obstacles.destroy(); this.ground.destroy(); this.sprites.clear(); }
  remove(id: string) { this.sprites.get(id)?.destroy(); this.sprites.delete(id); }
}
