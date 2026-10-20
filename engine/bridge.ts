import readline from 'node:readline';
import loadRandom from '../vendor/noita-tools-master/src/services/SeedInfo/random';
import Alchemy from '../vendor/noita-tools-master/src/services/SeedInfo/infoHandler/InfoProviders/Alchemy';
import Perk from '../vendor/noita-tools-master/src/services/SeedInfo/infoHandler/InfoProviders/Perk';
import Fungal from '../vendor/noita-tools-master/src/services/SeedInfo/infoHandler/InfoProviders/FungalShift';
import StartingFlask from '../vendor/noita-tools-master/src/services/SeedInfo/infoHandler/InfoProviders/StartingFlask';
import StartingSpell from '../vendor/noita-tools-master/src/services/SeedInfo/infoHandler/InfoProviders/StartingSpell';
import StartingBomb from '../vendor/noita-tools-master/src/services/SeedInfo/infoHandler/InfoProviders/StartingBomb';
import WaterCave from '../vendor/noita-tools-master/src/services/SeedInfo/infoHandler/InfoProviders/WaterCave';
import Weather from '../vendor/noita-tools-master/src/services/SeedInfo/infoHandler/InfoProviders/Weather';
import BiomeModifier from '../vendor/noita-tools-master/src/services/SeedInfo/infoHandler/InfoProviders/BiomeModifier';
import Wand from '../vendor/noita-tools-master/src/services/SeedInfo/infoHandler/InfoProviders/Wand';
import Spell from '../vendor/noita-tools-master/src/services/SeedInfo/infoHandler/InfoProviders/Spell';
import Shop from '../vendor/noita-tools-master/src/services/SeedInfo/infoHandler/InfoProviders/Shop';
import Chest from '../vendor/noita-tools-master/src/services/SeedInfo/infoHandler/InfoProviders/ChestRandom';
import Pacifist from '../vendor/noita-tools-master/src/services/SeedInfo/infoHandler/InfoProviders/PacifistChest';
import Potion from '../vendor/noita-tools-master/src/services/SeedInfo/infoHandler/InfoProviders/Potion';
import Powder from '../vendor/noita-tools-master/src/services/SeedInfo/infoHandler/InfoProviders/PowderStash';
import PotionSecret from '../vendor/noita-tools-master/src/services/SeedInfo/infoHandler/InfoProviders/PotionSecret';
import PotionRandom from '../vendor/noita-tools-master/src/services/SeedInfo/infoHandler/InfoProviders/PotionRandomMaterial';
import AlwaysCast from '../vendor/noita-tools-master/src/services/SeedInfo/infoHandler/InfoProviders/AlwaysCast';
import Biome from '../vendor/noita-tools-master/src/services/SeedInfo/infoHandler/InfoProviders/Biome';
import Lottery from '../vendor/noita-tools-master/src/services/SeedInfo/infoHandler/InfoProviders/Lottery';
import spellData from '../vendor/noita-tools-master/src/services/SeedInfo/data/spells.json';

console.log=(...args)=>console.error(...args);
const rng=await loadRandom();
rng.SetUnlockedSpells(Array(spellData.length).fill(true));
const spells=new Spell(rng),wand=new Wand(rng);
const chest=new Chest(rng,[],spells);
const providers:any={alchemy:new Alchemy(rng),perk:new Perk(rng),fungalShift:new Fungal(rng),startingFlask:new StartingFlask(rng),startingSpell:new StartingSpell(rng),startingBombSpell:new StartingBomb(rng),waterCave:new WaterCave(rng),weather:new Weather(rng),biomeModifier:new BiomeModifier(rng),wand,spells,shop:new Shop(rng,wand,spells),chestRandom:chest,pacifistChest:new Pacifist(rng,chest),potion:new Potion(rng),powderStash:new Powder(rng),potionSecret:new PotionSecret(rng),potionRandomMaterial:new PotionRandom(rng),alwaysCast:new AlwaysCast(rng),biome:new Biome(rng),lottery:new Lottery(rng)};
await Promise.all(Object.values(providers).map((p:any)=>p.ready()));
const searchTypes=new Set(['alchemy','perk','perkSet','layerSpells','fungalShift','startingFlask','startingSpell','startingBombSpell','weather','biomeModifier','shop','pacifistChest','wand','waterCave']);
function validate(r:any){
 if(r.type==='advanced'){validate(r.val);return;}
 if(['and','or','not'].includes(r.type)){
  if(!Array.isArray(r.rules)||!r.rules.length||(r.type==='not'&&r.rules.length!==1))throw Error('Invalid logical group');
  r.rules.forEach(validate);
 }else if(!searchTypes.has(r.type))throw Error('Unsupported rule: '+r.type);
}
let layerModule:any;
async function getLayer(seed:number,layer:number,scope='main',pw=0){const modulePath='./layer.mjs';layerModule??=await import(modulePath);return layerModule.layerSpells(seed,layer,scope,pw);}
async function getArea(seed:number,area:any,pw=0){const modulePath='./layer.mjs';layerModule??=await import(modulePath);return layerModule.areaResources(seed,area,pw);}
async function check(r:any):Promise<boolean>{
 if(r.type==='advanced')return check(r.val);
 if(r.type==='and'){for(const child of r.rules)if(!await check(child))return false;return true;}
 if(r.type==='or'){for(const child of r.rules)if(await check(child))return true;return false;}
 if(r.type==='not')return !await check(r.rules[0]);
 if(r.type==='perkSet'){
  const v=r.val,lottery=new Set<string>(v.lottery??[]);
  const match=(ids:string[],level?:number)=>{
   const has=(s:string)=>ids.some((id,i)=>id===s&&(!lottery.has(s)||(level!==undefined&&providers.lottery.provide(level,i,ids.length,0,1))));
   return v.mode==='all'?v.ids.every(has):v.ids.some(has);
  };
  if(v.where==='deck')return match(providers.perk.getPerkDeck());
  const rows=providers.perk.provide();return v.where==='any'?rows.some((row:string[],level:number)=>match(row,level)):match(rows[v.where],v.where);
 }
 if(r.type==='layerSpells'){
  const layers=['overgrown','region'].includes(r.val.scope)?[0]:r.val.layers??[r.val.layer];
  const ranges=r.val.ranges??(r.val.scope==='region'?[r.val.area]:layers?.map((layer:number)=>({kind:'layer',layer,scope:r.val.scope??'main'})));
  if(!Array.isArray(ranges)||!ranges.length||ranges.length>64)throw Error('Invalid selected areas');
  for(const area of ranges)if(area.kind==='layer'&&(!Number.isInteger(area.layer)||area.layer<0||area.layer>6))throw Error('Invalid selected layer');
  const remaining=new Set<string>([...(r.val.ids??[]).map((s:string)=>'spell:'+s),...(r.val.materials??[]).map((s:string)=>'potion:'+s)]);
  const worlds=r.val.worldRange??[0,0];
  if(!Array.isArray(worlds)||worlds.length!==2||worlds.some((w:any)=>!Number.isInteger(w)||Math.abs(w)>100)||worlds[0]>worlds[1])throw Error('Invalid parallel world range');
  for(let pw=worlds[0];pw<=worlds[1];pw++)for(const area of ranges){
   const result=area.kind==='layer'?await getLayer(rng.GetWorldSeed(),area.layer,area.scope??'main',pw):await getArea(rng.GetWorldSeed(),area,pw);
   const targets=[...result.ids.map((id:string)=>'spell:'+id),...result.items.filter((p:any)=>p.type==='potion'&&!['pouch','powder_stash','powder_pouch'].includes(p.item)&&p.material).map((p:any)=>'potion:'+p.material)];
   for(const id of targets)if(remaining.delete(id)&&r.val.mode==='any')return true;
   if(!remaining.size)return true;
  }
  return false;
 }
 if(r.type==='waterCave')return providers.waterCave.provide()===r.val;
 if(r.type==='wand'){
  const p=r.params;
  return providers.wand.testGun(r.val,providers.wand.provide(p.x,p.y,p.cost,p.level,p.force_unshuffle,p.unshufflePerk));
 }
 if(r.type==='shop')return r.val.every((v:any,i:number)=>{
  if(!v)return true;
  const shop=providers.shop.provideLevel(i);
  if(v.type!==0&&v.type!==shop.type)return false;
  if(!v.items.length)return true;
  if(v.type===0){
   const actual=shop.type===2?shop.items.map((item:any)=>item.spell.id):shop.items.flatMap((wand:any)=>[...(wand.cards?.cards??[]),...[wand.cards?.permanentCard??[]].flat()]);
   const desired=v.items.map((item:any)=>item.spell);
   return (v.strict??true)?desired.every((key:string)=>actual.includes(key)):desired.some((key:string)=>actual.includes(key));
  }
  if(shop.type===1){
   const matches=v.items.map((target:any)=>shop.items.some((wand:any)=>providers.wand.testGun(target.wand,wand)));
   return v.wandMode==='any'?matches.some(Boolean):matches.every(Boolean);
  }
  const actual=shop.items.map((item:any)=>item.spell.id);
  const desired=v.items.map((item:any)=>item.spell);
  return v.strict?desired.every((key:string)=>actual.includes(key)):desired.some((key:string)=>actual.includes(key));
 });
 return providers[r.type].test(r);
}
const output=(v:any)=>process.stdout.write(JSON.stringify(v,(_k,v)=>v instanceof Map?Object.fromEntries(v):v)+'\n');
for await(const line of readline.createInterface({input:process.stdin})){
 try{
  const req=JSON.parse(line);
  if(req.op==='memory'){
   output({result:process.memoryUsage()});
  }else if(req.op==='layer'||req.op==='area'){
   const pw=req.worldOffset??0,result=req.op==='area'?await getArea(req.seed,req.area,pw):await getLayer(req.seed,req.layer??0,req.scope??'main',pw);
   const items=result.items.filter((item:any)=>!['holy_mountain_shop','holy_mountain'].includes(item.source));
   if((req.scope??'main')!=='overgrown'){
    rng.SetWorldSeed(req.seed);
    providers.shop.provide(new Map(),pw).slice(0,pw===0?7:6).forEach((shop:any,level:number)=>{
     const temple=providers.shop.temples[level];
     shop.items.forEach((item:any,i:number)=>{
      const x=temple.x-299+pw*35840+(i%5)*132/5,y=temple.y-15-(shop.type===2&&i<5?30:0);
      if(y>=result.bounds[0]&&y<result.bounds[1]&&(req.op!=='area'||layerModule.areaContains(req.seed,pw,req.area,x,y)))items.push({type:shop.type===1?'wand':'spell',wand:shop.type===1?item:undefined,spell:shop.type===2?item.spell.id:undefined,x,y,price:shop.type===1?item.gun.cost:item.price,source:'holy_mountain',worldOffset:pw});
     });
    });
   }
   output({result:{...result,items}});
  }else if(req.op==='map'){
   const modulePath='./layer.mjs';layerModule??=await import(modulePath);
   const result=await layerModule.worldMap(req.seed,req.worldOffset??0,req.verticalIndex??0,(value:number,phase:string)=>{if(req.progress)output({progress:{value,phase}});});
   rng.SetWorldSeed(req.seed);
   for(const poi of result.pois)if(poi.type==='spell'&&poi.paid){
    const spell=providers.spells.provide(poi.spell),level=poi.tier??providers.shop.getLevel(poi.y);
    poi.price=Number.isFinite(spell.price)?Math.max(Math.floor((spell.price*.3+70*level*level)/10)*10,10)*(level*level>=10?5:1):null;
   }
   const world=req.worldOffset??0,shops=providers.shop.provide(new Map(),world);
   result.pois=result.pois.filter((p:any)=>p.source!=='holy_mountain');
   if(!(req.verticalIndex??0))shops.slice(0,world===0?7:6).forEach((shop:any,level:number)=>{
    const temple=providers.shop.temples[level];
    const starts=[-3,-4,-5,-4,-5,-6,-6],depths=[2,5,9,12,16,20,25],widths=[7,8,10,7,9,11,9];
    const shopBounds=[world*35840+starts[level]*512,depths[level]*512,widths[level]*512,512];
    shop.items.forEach((item:any,i:number)=>result.pois.push({type:shop.type===1?'wand':'spell',wand:shop.type===1?item:undefined,spell:shop.type===2?item.spell.id:undefined,x:temple.x-299+world*35840+(i%5)*132/5,y:temple.y-15-(shop.type===2&&i<5?30:0),price:shop.type===1?item.gun.cost:item.price,source:'holy_mountain',shopLevel:level,shopBounds,paid:true}));
   });
   if(req.progress)output({progress:{value:100,phase:'地图生成完成'}});
   output({result});
  }else if(req.op==='probe'){
   const result=[];
   for(const seed of req.seeds){rng.SetWorldSeed(seed);result.push(req.perks?providers.perk.getPerkDeck():{alchemy:providers.alchemy.provide(),startingFlask:providers.startingFlask.provide(),startingSpell:providers.startingSpell.provide(),startingBombSpell:providers.startingBombSpell.provide()});}
   output({result});
  }else if(req.op==='info'){
   rng.SetWorldSeed(req.seed);
   const info:any={};
   for(const key of ['alchemy','fungalShift','startingFlask','startingSpell','startingBombSpell','waterCave','weather','biomeModifier'])info[key]=providers[key].provide();
   const rerolls=new Map([[req.worldOffset??0,Array.from({length:7},(_,i)=>Number(req.rerolls?.[String(i)]??0))]]);
   info.perk=providers.perk.provide(new Map(),undefined,true,req.worldOffset??0,rerolls);
   info.shop=providers.shop.provide(new Map(),req.worldOffset??0);
   info.pacifistChest=Array.from({length:7},(_,i)=>providers.pacifistChest.provide(i,req.worldOffset??0));
   info.perkLottery=info.perk.map((row:any[],level:number)=>row.map((_:any,i:number)=>providers.lottery.provide(level,i,row.length,req.worldOffset??0,1)));
   for(const row of info.pacifistChest)for(const item of row){
    if(item.entity.startsWith('data/entities/items/wand_')){
     const e=item.extra;item.wand=providers.wand.provide(item.x,item.y,e.cost,e.level,!!e.force_unshuffle,false);
    }
    const key=item.entity.split('/').pop().replace('.xml','');
    const provider=({potion:'potion',potion_secret:'potionSecret',potion_random_material:'potionRandomMaterial',powder_stash:'powderStash'} as any)[key];
    if(provider)item.material=providers[provider].provide(item.x,item.y);
   }
   info.perkDeck=providers.perk.getPerkDeck(true);
   output({result:info});
  }else if(req.op==='search'){
   validate(req.rule);
   const found=[];
   const seeds=req.seeds??Array.from({length:req.end-req.start},(_,i)=>req.start+i);
   for(const seed of seeds){rng.SetWorldSeed(seed);if(await check(req.rule))found.push(seed);}
   output({result:found});
  }else throw Error('Unknown operation');
 }catch(e:any){output({error:e.message,stack:e.stack});}
}
