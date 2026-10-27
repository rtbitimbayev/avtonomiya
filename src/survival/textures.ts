import Phaser from 'phaser';
/** Textures are painted at low resolution and enlarged with nearest-neighbour filtering. */
export function createTextures(scene: Phaser.Scene) {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const rect = (color: number, x: number, y: number, w: number, h: number) => { g.fillStyle(color); g.fillRect(x, y, w, h); };
  const texture = (key: string, size: number, paint: () => void, height = size) => {
    g.clear(); paint(); g.generateTexture(key, size, height); scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  };
  texture('survivor-wood', 16, () => {
    rect(0x242a24, 2, 4, 13, 11); rect(0x655442, 4, 1, 8, 13); rect(0x9a7b51, 6, 2, 2, 11);
    rect(0x4e563a, 1, 3, 5, 5); rect(0x66734c, 2, 2, 4, 4); rect(0x464d32, 9, 4, 6, 5);
    rect(0xa59769, 7, 1, 3, 2); rect(0x363d2c, 4, 11, 9, 3);
  });
  texture('survivor-metal', 16, () => {
    rect(0x252c2b, 1, 5, 14, 9); rect(0x986747, 2, 4, 10, 8); rect(0x7d8b86, 4, 2, 9, 6);
    rect(0xb3b6a0, 5, 2, 6, 2); rect(0x4a5554, 9, 5, 5, 7); rect(0xb37e53, 3, 9, 4, 4); rect(0x353f3e, 5, 4, 2, 6);
  });
  texture('survivor-water', 16, () => {
    rect(0x252e2c, 3, 3, 11, 12); rect(0x4e787b, 4, 2, 8, 11); rect(0x80b2ac, 5, 2, 6, 2);
    rect(0x354f50, 4, 6, 8, 2); rect(0x354f50, 4, 11, 8, 2); rect(0xadc2a5, 6, 4, 2, 2); rect(0x2c4446, 9, 3, 2, 1);
  });
  texture('survivor-food', 16, () => {
    rect(0x292e24, 2, 3, 12, 12); rect(0x9f8e59, 3, 2, 10, 11); rect(0xc7b780, 4, 3, 8, 2);
    rect(0x57684e, 4, 6, 8, 5); rect(0xc3c99b, 7, 6, 2, 5); rect(0xc3c99b, 5, 8, 6, 1);
  });
  texture('survivor-rock', 16, () => {
    rect(0x272e2c, 1, 6, 14, 9); rect(0x666e64, 2, 4, 12, 9); rect(0x8a9180, 4, 2, 7, 4);
    rect(0x454f4b, 10, 6, 4, 6); rect(0xa0a391, 5, 3, 4, 2); rect(0x48534a, 3, 11, 7, 2);
  });
  texture('survivor-shelter', 48, () => {
    rect(0x202928, 0, 0, 48, 32); rect(0x6e7469, 1, 1, 46, 30); rect(0xa4a18a, 2, 2, 44, 2);
    rect(0x414d47, 3, 5, 42, 24); rect(0x646e62, 5, 6, 38, 21);
    for (let x = 8; x < 43; x += 6) { rect(0x424e47, x, 6, 2, 21); rect(0x84836b, x + 2, 6, 1, 21); }
    rect(0x916a48, 34, 7, 7, 13); rect(0x536c5f, 4, 11, 9, 9); rect(0x9aab8a, 5, 12, 7, 1);
    rect(0x283936, 18, 23, 12, 9); rect(0x97b29b, 19, 24, 10, 2); rect(0x887653, 20, 27, 8, 5);
    rect(0xc2b17d, 22, 17, 4, 4); rect(0x2c3933, 23, 18, 2, 2);
  }, 32);
  for (const facing of ['down', 'up', 'left', 'right']) for (let frame = 0; frame < 3; frame++) {
    texture(`survivor-player-${facing}-${frame}`, 16, () => {
      const walk = frame === 1 ? -1 : frame === 2 ? 1 : 0;
      rect(0x202827, 3, 4, 10, 11); rect(0x374e4c, 4, 7, 8, 6); rect(0x789384, 5, 6, 6, 5);
      rect(0xa59873, 5, 1, 6, 5); rect(0x4d665e, 4, 1, 8, 2); rect(0x394d47, 5, 0, 6, 2);
      rect(0x263733, 4, 12, 3, 3 + walk); rect(0x263733, 9, 12, 3, 3 - walk);
      if (facing === 'up') rect(0x66694b, 5, 7, 6, 5);
      else if (facing === 'down') { rect(0x323f37, 6, 4, 1, 1); rect(0x323f37, 9, 4, 1, 1); }
      else { rect(0xc2b184, facing === 'left' ? 4 : 11, 4, 1, 2); rect(0x66694b, facing === 'left' ? 10 : 3, 7, 3, 5); }
      rect(0xa99b77, 3, 9 + walk, 2, 3); rect(0xa99b77, 11, 9 - walk, 2, 3);
    });
  }
  g.destroy();
}
