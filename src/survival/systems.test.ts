import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSurvivor, makeObjects } from './ResourceData';
import { BALANCE } from './balance';
import { advanceSurvival } from './SurvivalSystem';
import { advanceClock, ActiveTime, clockLabel, lighting } from './GameClock';
import { consume } from './ConsumableSystem';
import { SaveSystem, saveSurvivor, loadSurvivor, SAVE_KEY, LEGACY_KEY } from './SaveSystem';
import { InteractionSystem } from './InteractionSystem';
const close = (a:number,b:number) => assert.ok(Math.abs(a-b)<1e-7, `${a} ≠ ${b}`);
function storage() { const values=new Map<string,string>();return { values,getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);} }; }
test('new game starts day 1 at 08:00, full vitals, food3 and water2',()=>{
 const s=createSurvivor();assert.deepEqual(s.vitals,{health:100,hunger:100,thirst:100});assert.equal(s.resources.food,3);assert.equal(s.resources.water,2);assert.equal(clockLabel(s.clock),'ДЕНЬ 01 — 08:00');
});
test('60 and 144 FPS produce the same elapsed time, consumption and damage',()=>{
 const a=createSurvivor(),b=createSurvivor();a.vitals.thirst=1;b.vitals.thirst=1;
 for(let i=0;i<60*120;i++)advanceSurvival(a,1/60);
 for(let i=0;i<144*120;i++)advanceSurvival(b,1/144);
 for(const k of ['health','hunger','thirst'] as const)close(a.vitals[k],b.vitals[k]);close(a.clock.minuteOfDay,b.clock.minuteOfDay);close(a.clock.minuteOfDay,600);
});
test('hunger lasts 16 hours, water 8; additive damage starts after depletion',()=>{
 const s=createSurvivor();advanceSurvival(s,480);close(s.vitals.hunger,50);close(s.vitals.thirst,0);close(s.vitals.health,100);
 advanceSurvival(s,60);close(s.vitals.health,92);
 const both=createSurvivor();both.vitals.hunger=0;both.vitals.thirst=0;advanceSurvival(both,60);close(both.vitals.health,88);
});
test('six hour sleep uses partial starvation times, no healing, and crosses midnight once',()=>{
 const s=createSurvivor();s.clock.minuteOfDay=1380;s.vitals.hunger=25;s.vitals.thirst=25;
 advanceSurvival(s,BALANCE.sleepMinutes);assert.equal(s.clock.day,2);close(s.clock.minuteOfDay,300);close(s.vitals.health,60);close(s.vitals.hunger,0);close(s.vitals.thirst,0);
 const healthy=createSurvivor();healthy.vitals.health=55;advanceSurvival(healthy,360);close(healthy.vitals.health,55);close(healthy.vitals.hunger,62.5);close(healthy.vitals.thirst,25);
});
test('death resolves its exact time and freezes future changes',()=>{
 const s=createSurvivor();s.vitals={health:12,hunger:0,thirst:0};advanceSurvival(s,360);
 close(s.clock.minuteOfDay,540);assert.equal(s.vitals.health,0);assert.equal(s.deathCause,'Голод и обезвоживание');const json=JSON.stringify(s);advanceSurvival(s,360);consume(s,'food');assert.equal(JSON.stringify(s),json);
});
test('pause/hidden/resume gates and long frames never advance elapsed time',()=>{
 const gate=new ActiveTime();assert.equal(gate.sample(16,true),0);close(gate.sample(100,true),.1);
 for(let i=0;i<100;i++)assert.equal(gate.sample(16,false),0);
 assert.equal(gate.sample(80000,true),0);assert.equal(gate.sample(5000,true),0);close(gate.sample(100,true),.1);
});
test('clock normalizes days and lighting transitions continuously across dawn and dusk',()=>{
 const c={day:1,minuteOfDay:1430};advanceClock(c,40);assert.deepEqual(c,{day:2,minuteOfDay:30});
 assert.equal(lighting(480).alpha,0);assert.equal(lighting(1080).alpha,0);assert.equal(lighting(1200).alpha,.48);assert.equal(lighting(360).alpha,.48);close(lighting(420).alpha,.24);close(lighting(1140).alpha,.24);
});
test('food/water restore bounded stats, never spend at full or without stock',()=>{
 const s=createSurvivor();assert.equal(consume(s,'food'),'Пока не требуется');assert.equal(s.resources.food,3);assert.equal(consume(s,'water'),'Пока не требуется');
 s.vitals.hunger=80;s.vitals.thirst=10;consume(s,'food');consume(s,'water');close(s.vitals.hunger,100);close(s.vitals.thirst,55);assert.equal(s.resources.food,2);assert.equal(s.resources.water,1);
 s.resources.food=0;s.vitals.hunger=0;assert.equal(consume(s,'food'),'Нет припасов');assert.equal(s.vitals.hunger,0);
});
test('map preserves original nodes and has at least five collectible food objects',()=>{
 const nodes=makeObjects();assert.ok(nodes.filter(o=>o.kind==='food').length>=5);const s=createSurvivor();const system=new InteractionSystem(s,nodes);system.interact(nodes.find(o=>o.kind==='food')!);assert.equal(s.resources.food,4);
});
test('invalid time deltas cannot corrupt numbers or consume anything',()=>{
 const s=createSurvivor();const before=JSON.stringify(s);for(const dt of [NaN,Infinity,-1,0])advanceSurvival(s,dt);assert.equal(JSON.stringify(s),before);
});
test('snapshot restores consumed supplies, stats, clock, position and depleted objects together',()=>{
 const s=createSurvivor(),mem=storage();const interactions=new InteractionSystem(s,makeObjects());interactions.interact(makeObjects()[1]);advanceSurvival(s,50);consume(s,'water');saveSurvivor(s,mem);
 const restored=loadSurvivor(mem)!;assert.deepEqual(restored,s);assert.equal(new InteractionSystem(restored,makeObjects()).nearest(makeObjects()[1]),undefined);
 for(const bad of [{...s,clock:{day:0,minuteOfDay:0}},{...s,vitals:{...s.vitals,health:NaN}},{...s,consumed:{food:-1,water:0}},{...s,schemaVersion:999}]){mem.setItem(SAVE_KEY,JSON.stringify(bad));assert.throws(()=>loadSurvivor(mem));}
});
test('legacy migration retains original resources and old data without overwriting either key',()=>{
 const mem=storage();const legacy={version:1,seed:8026,player:{x:1040,y:1136},resources:{wood:0,metal:0,water:0},collected:[],returned:false};const raw=JSON.stringify(legacy);mem.setItem(LEGACY_KEY,raw);
 const migrated=loadSurvivor(mem)!;assert.equal(migrated.schemaVersion,2);assert.equal(migrated.resources.water,0);assert.equal(migrated.resources.food,3);assert.equal(mem.getItem(SAVE_KEY),null);saveSurvivor(migrated,mem);assert.deepEqual(loadSurvivor(mem),migrated);assert.equal(mem.getItem(LEGACY_KEY),raw);
});
test('periodic save is at most every 30 active seconds; dead states cannot replace living snapshot',()=>{
 const mem=storage();let writes=0;const adapter={...mem,setItem:(k:string,v:string)=>{writes++;mem.setItem(k,v);}};const service=new SaveSystem(adapter,()=>{}),s=createSurvivor();
 for(let i=0;i<299;i++){service.mark();service.tick(.1,s);}assert.equal(writes,0);service.tick(.2,s);assert.equal(writes,1);
 const living=mem.getItem(SAVE_KEY);s.vitals.health=0;service.save(s);saveSurvivor(s,mem);assert.equal(mem.getItem(SAVE_KEY),living);
});
test('incompatible snapshots remain protected; explicit new game backs them up first',()=>{
 const mem=storage();mem.setItem(SAVE_KEY,'broken');const warnings:string[]=[];const service=new SaveSystem(mem,m=>warnings.push(m));assert.equal(service.load(),null);assert.equal(service.protectedData,true);service.save(createSurvivor());assert.equal(mem.getItem(SAVE_KEY),'broken');assert.ok(warnings.length);
 assert.equal(service.allowNewGame(),true);service.save(createSurvivor());assert.ok([...mem.values.values()].includes('broken'));assert.notEqual(mem.getItem(SAVE_KEY),'broken');
});
test('storage failures are bounded warnings and do not break the game',()=>{
 let warnings=0;const broken={getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('quota');}};const service=new SaveSystem(broken,()=>warnings++);assert.equal(service.load(),null);assert.equal(service.allowNewGame(),false);assert.ok(warnings<=2);
 const writing=new SaveSystem({...broken,getItem:()=>null},()=>warnings++);for(let i=0;i<10;i++)writing.save(createSurvivor());assert.equal(warnings,3);
});
