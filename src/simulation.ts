export const SIZE = 64;
export type Resource = 'wood'|'stone'|'metal'|'seeds'|'water'|'food'|'eggs'|'manure'|'fertilizer';
export type Stock = Record<Resource, number>;
export type Kind = 'bed'|'tank'|'feeder'|'coop'|'composter'|'warehouse'|'pipe'|'lamp';
export type Terrain = 'grass'|'tree'|'rock'|'water'|'wall'|'floor';
export interface Tile { terrain: Terrain }
export interface Entity { id:number; kind:Kind; x:number; y:number; level:number; stock:Stock; progress:number; planted:boolean; fertilized:boolean; health:number; cycles:number }
export interface State { version:1; time:number; nextId:number; resources:Stock; tiles:Tile[][]; entities:Entity[] }
export const emptyStock = ():Stock => ({wood:0,stone:0,metal:0,seeds:0,water:0,food:0,eggs:0,manure:0,fertilizer:0});
export const labels:Record<Resource,string> = {wood:'Дерево',stone:'Камень',metal:'Металл',seeds:'Семена',water:'Вода',food:'Еда',eggs:'Яйца',manure:'Навоз',fertilizer:'Удобрение'};
export const definitions:Record<Kind,{name:string;icon:string;cost:Partial<Stock>;description:string}> = {
 bed:{name:'Грядка',icon:'✿',cost:{wood:5,seeds:1},description:'Автополив и сбор при связи со складом. Урожай: 8 еды и 2 семени.'},
 tank:{name:'Водосборник',icon:'◉',cost:{stone:8,metal:2},description:'Собирает 1 воду каждые 3 секунды. У воды — втрое быстрее.'},
 feeder:{name:'Кормушка',icon:'▤',cost:{wood:8},description:'Снабжает соседний курятник едой и водой. Свяжите со складом.'},
 coop:{name:'Курятник',icon:'♧',cost:{wood:20,stone:5},description:'Две курицы. Каждые 24 секунды: 2 яйца и 2 навоза за 2 еды и воды.'},
 composter:{name:'Компостер',icon:'♻',cost:{wood:10,stone:5},description:'За 18 секунд превращает 3 навоза в 2 удобрения.'},
 warehouse:{name:'Склад',icon:'▥',cost:{wood:15,stone:10},description:'Подключает цепь соседних объектов к общему запасу ресурсов.'},
 pipe:{name:'Конвейер',icon:'↔',cost:{wood:1,metal:1},description:'Передаёт ресурсы по цепи. Связь через стороны клеток.'},
 lamp:{name:'Светильник',icon:'✧',cost:{metal:5,stone:2},description:'Освещает грядки в радиусе 4 клеток, включая подземный уровень.'}
};
export function createState():State {
 let seed=9371; const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const tiles:Tile[][]=[[],[]];
 for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
 const r=rand(), lake=(x-43)**2/65+(y-24)**2/32<1 || (x-16)**2/20+(y-43)**2/30<1;
 tiles[0].push({terrain:lake?'water':Math.abs(x-31)<7&&Math.abs(y-31)<6?'grass':r<.11?'tree':r<.15?'rock':'grass'});
 tiles[1].push({terrain:Math.abs(x-31)<5&&Math.abs(y-31)<5?'floor':'wall'});
 }
 return {version:1,time:8*60,nextId:1,resources:{...emptyStock(),wood:100,stone:60,metal:30,seeds:20,water:50,food:40},tiles,entities:[]};
}
export class Simulation {
 state:State; message='Добро пожаловать. Начните со склада и грядок.';
 constructor(state=createState()){this.state=state;}
 tile(x:number,y:number,l:number){return x>=0&&y>=0&&x<SIZE&&y<SIZE?this.state.tiles[l]?.[y*SIZE+x]:undefined;}
 at(x:number,y:number,l:number){return this.state.entities.find(e=>e.x===x&&e.y===y&&e.level===l);}
 afford(cost:Partial<Stock>){return Object.entries(cost).every(([k,n])=>this.state.resources[k as Resource]>=n!);}
 pay(cost:Partial<Stock>){for(const [k,n] of Object.entries(cost))this.state.resources[k as Resource]-=n!;}
 build(kind:Kind,x:number,y:number,level:number){
 const t=this.tile(x,y,level); if(!t||!['grass','floor'].includes(t.terrain)||this.at(x,y,level))return this.fail('Здесь нельзя строить: нужна свободная клетка.');
 const d=definitions[kind];if(!this.afford(d.cost))return this.fail('Недостаточно ресурсов.');this.pay(d.cost);
 this.state.entities.push({id:this.state.nextId++,kind,x,y,level,stock:emptyStock(),progress:0,planted:kind==='bed',fertilized:false,health:100,cycles:0});this.message=d.name+': построено';return true;
 }
 fail(s:string){this.message=s;return false;}
 remove(x:number,y:number,l:number){const e=this.at(x,y,l);if(!e)return this.fail('Выберите постройку для сноса.');for(const[k,n]of Object.entries(definitions[e.kind].cost))this.state.resources[k as Resource]+=Math.floor(n!/2);for(const k of Object.keys(e.stock) as Resource[])this.state.resources[k]+=e.stock[k];this.state.entities=this.state.entities.filter(a=>a!==e);this.message='Постройка разобрана. Возвращено 50% материалов.';return true;}
 gather(x:number,y:number,l:number){const t=this.tile(x,y,l);if(!t)return false;if(t.terrain==='tree'){this.state.resources.wood+=12;t.terrain='grass';}else if(t.terrain==='rock'){this.state.resources.stone+=10;this.state.resources.metal+=2;t.terrain='grass';}else if(t.terrain==='water'){this.state.resources.water+=10;}else if(t.terrain==='wall'){
 if(![[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>this.tile(x+dx,y+dy,l)?.terrain==='floor'))return this.fail('Расширяйте подземелье от открытых клеток.');
 if(!this.afford({wood:2}))return this.fail('Для укрепления нужны 2 дерева.');this.pay({wood:2});t.terrain='floor';this.state.resources.stone+=6;
 }else return this.fail('Здесь нечего добывать.');this.message='Ресурсы добавлены на общий склад.';return true;}
 connected():Set<number>{const result=new Set<number>();const queue=this.state.entities.filter(e=>e.kind==='warehouse');for(const e of queue)result.add(e.id);for(let i=0;i<queue.length;i++){const a=queue[i];for(const b of this.state.entities)if(b.level===a.level&&Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===1&&!result.has(b.id)){result.add(b.id);queue.push(b);}}return result;}
 light(e:Entity){return (e.level===0&&this.state.time%1440>=360&&this.state.time%1440<1200)||this.state.entities.some(a=>a.kind==='lamp'&&a.level===e.level&&Math.hypot(a.x-e.x,a.y-e.y)<=4);}
 interact(e:Entity){
 if(e.kind==='bed'){
 if(e.progress>=60){this.harvest(e);this.message='Урожай собран: +8 еды, +2 семени.';return;}
 if(!e.planted){if(!this.afford({seeds:1})){this.fail('Нужны семена.');return;}this.pay({seeds:1});e.planted=true;}
 if(this.state.resources.water>0){const n=Math.min(10-e.stock.water,this.state.resources.water);e.stock.water+=n;this.state.resources.water-=n;}
 if(!e.fertilized&&this.state.resources.fertilizer>0){this.state.resources.fertilizer--;e.fertilized=true;}
 this.message='Грядка посажена и полита.';
 }else if(e.kind==='feeder'||e.kind==='coop'||e.kind==='composter'){
 for(const k of (e.kind==='composter'?['manure']:['food','water']) as Resource[]){const n=Math.max(0,Math.min(10-e.stock[k],this.state.resources[k]));e.stock[k]+=n;this.state.resources[k]-=n;}this.message='Запасы пополнены.';
 }else this.collect(e);
 }
 collect(e:Entity){for(const k of ['water','eggs','manure','fertilizer'] as Resource[]){this.state.resources[k]+=e.stock[k];e.stock[k]=0;}this.message='Продукция перемещена на склад.';}
 harvest(e:Entity){this.state.resources.food+=8;this.state.resources.seeds+=2;e.progress=0;e.planted=false;e.fertilized=false;e.cycles++;}
 tick(dt:number){if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,1);this.state.time+=dt*2;const net=this.connected();
 for(const e of this.state.entities){const linked=net.has(e.id);
 if(linked){for(const k of ['eggs','manure','fertilizer'] as Resource[]){this.state.resources[k]+=e.stock[k];e.stock[k]=0;}if(e.kind==='tank'){this.state.resources.water+=e.stock.water;e.stock.water=0;}
 const inputs:Resource[]=e.kind==='bed'?['water']:e.kind==='feeder'||e.kind==='coop'?['water','food']:e.kind==='composter'?['manure']:[];
 for(const k of inputs){const n=Math.max(0,Math.min(10-e.stock[k],this.state.resources[k]));e.stock[k]+=n;this.state.resources[k]-=n;}
 }
 if(e.kind==='tank'){const near=[[-1,0],[1,0],[0,-1],[0,1]].some(([dx,dy])=>this.tile(e.x+dx,e.y+dy,e.level)?.terrain==='water');e.stock.water=Math.min(50,e.stock.water+dt*(near?1:1/3));}
 if(e.kind==='bed'){
 if(linked&&!e.planted&&this.state.resources.seeds>=1){this.state.resources.seeds--;e.planted=true;}
 if(linked&&!e.fertilized&&this.state.resources.fertilizer>=1){this.state.resources.fertilizer--;e.fertilized=true;}
 if(e.planted&&e.progress<60&&e.stock.water>=dt*.08&&this.light(e)){e.stock.water-=dt*.08;e.progress=Math.min(60,e.progress+dt*(e.fertilized?1.7:1));}
 if(linked&&e.progress>=60)this.harvest(e);
 }
 if(e.kind==='coop'){
 const feeder=this.state.entities.find(a=>a.kind==='feeder'&&a.level===e.level&&Math.abs(e.x-a.x)+Math.abs(e.y-a.y)<=1);
 if(feeder)for(const k of ['food','water'] as Resource[]){const n=Math.max(0,Math.min(4-e.stock[k],feeder.stock[k]));e.stock[k]+=n;feeder.stock[k]-=n;}
 if(e.stock.food>=dt/12&&e.stock.water>=dt/12){e.stock.food-=dt/12;e.stock.water-=dt/12;e.health=Math.min(100,e.health+dt);e.progress+=dt;if(e.progress>=24){e.progress-=24;e.stock.eggs+=2;e.stock.manure+=2;e.cycles++;}}else e.health=Math.max(0,e.health-dt*.5);
 }
 if(e.kind==='composter'&&e.stock.manure>=3){e.progress+=dt;if(e.progress>=18){e.progress-=18;e.stock.manure-=3;e.stock.fertilizer+=2;e.cycles++;}}
 }
 }
}
export function save(sim:Simulation,storage:Pick<Storage,'setItem'>=localStorage){storage.setItem('avtonomiya-v1',JSON.stringify(sim.state));}
export function load(storage:Pick<Storage,'getItem'>=localStorage):State|null{const raw=storage.getItem('avtonomiya-v1');if(!raw)return null;const s=JSON.parse(raw) as State;
 if(s.version!==1||!Number.isFinite(s.time)||!Number.isInteger(s.nextId)||!Array.isArray(s.tiles)||s.tiles.length!==2||s.tiles.some(a=>a.length!==4096||a.some(t=>!['grass','tree','rock','water','wall','floor'].includes(t.terrain)))||!s.resources||Object.keys(emptyStock()).some(k=>!Number.isFinite(s.resources[k as Resource])||s.resources[k as Resource]<0)||!Array.isArray(s.entities)||s.entities.some(e=>!definitions[e.kind]||![0,1].includes(e.level)||!Number.isInteger(e.x)||!Number.isInteger(e.y)||e.x<0||e.x>=64||e.y<0||e.y>=64||!e.stock||Object.keys(emptyStock()).some(k=>!Number.isFinite(e.stock[k as Resource])||e.stock[k as Resource]<0)||![e.progress,e.health,e.cycles,e.id].every(Number.isFinite)))throw new Error('Некорректное сохранение');return s;}
