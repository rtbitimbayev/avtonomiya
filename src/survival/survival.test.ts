import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, SPAWN, movement, makeObjects, blocked, createSurvivor, saveSurvivor, loadSurvivor } from './ResourceData';
import { InteractionSystem } from './InteractionSystem';
test('map is deterministic, bounded and spawn has no obstacles', () => {
  const objects = makeObjects(); assert.deepEqual(objects, makeObjects()); assert.notDeepEqual(objects, makeObjects(12));
  assert.equal(WORLD.tiles * WORLD.tileSize, 2048); assert.equal(blocked(SPAWN, objects), false);
  for (const o of objects) assert.ok(o.x > 0 && o.x < 2048 && o.y > 0 && o.y < 2048);
  // Every fourth row/column outside the sheltered starting region is a guaranteed corridor.
  for (const o of objects.filter(o => o.id.startsWith('node'))) { assert.notEqual(Math.floor(o.x / 32) % 4, 0); assert.notEqual(Math.floor(o.y / 32) % 4, 0); }
});
test('all eight directions have speed 150; opposite / absent input yields zero', () => {
  for (const [x,y] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]) assert.ok(Math.abs(Math.hypot(...Object.values(movement(x,y))) - 150) < 1e-9);
  assert.deepEqual(movement(0,0), { x: 0, y: 0 });
});
test('interaction radius is inclusive 48 pixels, selects nearest, ignores rocks', () => {
  const s = createSurvivor(), objects = makeObjects(), system = new InteractionSystem(s,objects);
  assert.equal(system.nearest(SPAWN), undefined); assert.equal(system.interact(SPAWN), null);
  const wood = objects[1]; assert.equal(system.nearest({x: wood.x + 48,y:wood.y}), wood);
  assert.equal(system.nearest({x: wood.x + 48.01,y:wood.y}), undefined);
  const custom = new InteractionSystem(s,[{id:'far',kind:'water',x:40,y:0,width:20,height:20},{id:'near',kind:'metal',x:20,y:0,width:20,height:20},{id:'stone',kind:'rock',x:0,y:0,width:20,height:20}]);
  assert.equal(custom.nearest({x:0,y:0})?.id,'near');
});
test('resources grant correct amounts once, shelter completes only after supplies are gathered', () => {
  const s = createSurvivor(), objects = makeObjects(), system = new InteractionSystem(s,objects);
  assert.equal(system.interact(objects[0])?.message,'Убежище. Здесь можно отдохнуть'); assert.equal(s.returned,false);
  for (const o of objects.slice(1,4)) { system.interact(o); assert.equal(system.interact(o),null); }
  assert.deepEqual(s.resources,{wood:3,metal:2,water:1}); assert.equal(s.collected.length,3);
  system.interact(objects[0]); assert.equal(s.returned,true);
});
test('save is isolated from farm keys, roundtrips, rejects corrupt / incompatible / colliding state', () => {
  const s = createSurvivor(), values = new Map([['avtonomiya-v1','untouched farm']]);
  const storage = {setItem:(k:string,v:string)=>{values.set(k,v);},getItem:(k:string)=>values.get(k)??null};
  const interactions = new InteractionSystem(s,makeObjects()); interactions.interact(makeObjects()[1]);
  saveSurvivor(s,storage); assert.deepEqual(loadSurvivor(storage),s); assert.equal(values.get('avtonomiya-v1'),'untouched farm');
  const before = values.get('avtonomiya-survivor-v1');
  for (const bad of [{...s,version:2},{...s,resources:{...s.resources,wood:-1}},{...s,collected:['unknown']},{...s,player:makeObjects()[0]},{...s,resources:{...s.resources,wood:999}}]) {
    values.set('avtonomiya-survivor-v1',JSON.stringify(bad)); assert.throws(()=>loadSurvivor(storage));
  }
  values.set('avtonomiya-survivor-v1',before!); assert.deepEqual(loadSurvivor(storage),s);
});
