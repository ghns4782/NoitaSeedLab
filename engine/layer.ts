import { createCanvas } from '@napi-rs/canvas';
import { loadPNG } from './telescope-png.mjs';
import { generateBiomeData } from '../vendor/noita-telescope-main/js/biome_generator.js';
import { generateBiomeTiles } from '../vendor/noita-telescope-main/js/tile_generator.js';
import { loadPixelSceneData,getPixelSceneCanvas } from '../vendor/noita-telescope-main/js/pixel_scene_generation.js';
import specialSites from './special-sites.json';
import { prescanSpawnFunctions,scanSpawnFunctions,getSpecialPoIs } from '../vendor/noita-telescope-main/js/poi_scanner.js';
import { addStaticPixelScenes } from '../vendor/noita-telescope-main/js/static_spawns.js';
import { initBiomeColors,createTileOverlaysCheap,BIOME_COLOR_LOOKUP } from '../vendor/noita-telescope-main/js/image_processing.js';
import { GENERATOR_CONFIG,BIOME_COLORS_WITH_TILES } from '../vendor/noita-telescope-main/js/generator_config.js';
import { updateSettings } from '../vendor/noita-telescope-main/js/settings.js';
import { getResolvedBiome,tileToWorldCoordinates } from '../vendor/noita-telescope-main/js/utils.js';

(globalThis as any).document={createElement:(type:string)=>{if(type!=='canvas')throw Error('Unsupported DOM element');return createCanvas(1,1);}};
(globalThis as any).OffscreenCanvas=function(width:number,height:number){return createCanvas(width,height);};
const bounds=[0,1536,3072,5120,6656,8704,10752,13312];
let initPromise:any,base:any,lastSeed:any,cache=new Map();
let mapContext='';const mapCache=new Map<number,any>();
async function init(){
 updateSettings({enableStaticPixelScenes:'all',skipCosmeticScenes:true,showEnemies:false});
 base=await loadPNG('../data/biome_maps/biome_map.png');
 await initBiomeColors();
 await loadPixelSceneData();
}
const mainBiomes=[['coalmine','coalmine_alt'],['excavationsite'],['snowcave'],['snowcastle'],['rainforest','rainforest_open'],['vault'],['crypt']];
export function validateArea(area:any){
 if(!area||!['rect','biome'].includes(area.kind)||!Array.isArray(area.bounds)||area.bounds.length!==4||area.bounds.some((n:any)=>!Number.isFinite(n)))throw Error('Invalid resource area');
 const [x1,y1,x2,y2]=area.bounds;
 if(x1< -17920||x2>17920||x1>=x2||y1>=y2)throw Error('Invalid resource area bounds');
 if(area.kind==='biome'&&(!Array.isArray(area.biomes)||!area.biomes.length||area.biomes.some((k:string)=>!Object.hasOwn(GENERATOR_CONFIG,k))))throw Error('Invalid resource biome');
 if(area.cells&&(!Array.isArray(area.cells)||area.cells.length>3360||!area.cells.length||area.cells.some((c:any)=>!Array.isArray(c)||c.length!==2||!Number.isInteger(c[0])||!Number.isInteger(c[1])||c[0]<0||c[0]>=70||c[1]<0||c[1]>=48)))throw Error('Invalid biome cells');
}
function pointInArea(obj:any,x:number,y:number,area:any,pw:number,biome:any){
 const [x1,y1,x2,y2]=area.bounds,lx=x-pw*35840;
 if(lx<x1||lx>=x2||y<y1||y>=y2)return false;
 if(area.kind==='rect')return true;
 const plane=area.verticalIndex??0,pixels=plane<0?biome.heavenPixels:plane>0?biome.hellPixels:biome.pixels;
 const domain=plane?{...biome,pixels,heavenPixels:pixels,hellPixels:pixels}:biome;
 const resolved=getResolvedBiome(domain,x,y-plane*24570,false,'normal');
 return area.biomes.includes(resolved.biome)&&(!area.cells||area.cells.some((c:number[])=>c[0]===resolved.pos.x&&c[1]===resolved.pos.y));
}
export function areaContains(seed:number,pw:number,area:any,x:number,y:number){return pointInArea({},x,y,area,pw,generateBiomeData(seed,0,'normal',base.data,base.width,base.height));}
export async function areaResources(seed:number,area:any,pw=0){
 validateArea(area);
 await (initPromise??=init());
 const cached=mapContext===`${seed}:${pw}`?[...mapCache.values()].find(m=>area.bounds[1]>=m.origin[1]&&area.bounds[3]<=m.origin[1]+m.height):null;
 if(cached||area.verticalIndex||area.bounds[1]< -7168||area.bounds[3]>17408){
  const map=cached??await worldMap(seed,pw,area.verticalIndex??0);
  const biome=generateBiomeData(seed,0,'normal',base.data,base.width,base.height);
  const items=map.pois.filter((p:any)=>['wand','spell','potion','pickup','chest'].includes(p.type)&&pointInArea(p,p.x,p.y,area,pw,biome));
  const evidence:any[]=[];
  for(const p of items){
   if(p.spell)evidence.push({id:p.spell,x:p.x,y:p.y,source:p.source});
   const cards=p.wand?.cards?.cards??p.cards??[],always=p.wand?.cards?.permanentCard??p.always_casts??[];
   for(const id of [...cards,...(Array.isArray(always)?always:always?[always]:[])])evidence.push({id,x:p.x,y:p.y,source:'wand'});
  }
  return {items,evidence,ids:[...new Set(evidence.map(p=>p.id))],bounds:[area.bounds[1],area.bounds[3]],scope:'region',layer:0,worldOffset:pw,area,fromMapCache:!!cached};
 }
 return layerSpells(seed,0,'region',pw,area);
}
export async function layerSpells(seed:number,layer:number,scope='main',pw=0,area:any=null){
 if(!Number.isInteger(layer)||layer<0||layer>6)throw Error('Invalid layer');
 if(!['main','depth','overgrown','region'].includes(scope))throw Error('Invalid layer scope');
 if(!Number.isInteger(pw)||Math.abs(pw)>100)throw Error('Invalid parallel world');
 await (initPromise??=init());
 if(scope==='region')validateArea(area);
 if(seed!==lastSeed){cache.clear();lastSeed=seed;}
 const cacheKey=(scope==='overgrown'?'region':layer)+':'+scope+':'+pw+(scope==='region'?':'+JSON.stringify(area):'');
 if(cache.has(cacheKey))return cache.get(cacheKey);
 if(scope!=='region'&&mapContext===`${seed}:${pw}`&&mapCache.has(0)){
  const selected=scope==='overgrown'?{kind:'biome',biomes:['fungiforest'],bounds:[-17920,0,17920,8704]}:scope==='depth'?{kind:'rect',bounds:[-17920,bounds[layer],17920,bounds[layer+1]]}:{kind:'biome',biomes:[...mainBiomes[layer],...Object.keys(GENERATOR_CONFIG).filter(k=>k.startsWith('temple_'))],bounds:[-17920,bounds[layer],17920,bounds[layer+1]]};
  const result={...await areaResources(seed,selected,pw),layer,scope,area:null};
  if(cache.size>=16)cache.delete(cache.keys().next().value);cache.set(cacheKey,result);return result;
 }
 const biome=generateBiomeData(seed,0,'normal',base.data,base.width,base.height);
 // Upper Overgrown Cavern below the watchtower; exclude the separate lower cavern.
 const low=scope==='region'?area.bounds[1]:scope==='overgrown'?0:bounds[layer],high=scope==='region'?area.bounds[3]:scope==='overgrown'?8704:bounds[layer+1];
 const offset=pw*35840;
 const colors=new Set<number>();
 // Include edge chunks; final results are clipped to the selected depth band.
 const minX=scope==='region'?Math.max(0,Math.floor((area.bounds[0]+17920)/512)-1):0,maxX=scope==='region'?Math.min(base.width,Math.ceil((area.bounds[2]+17920)/512)+1):base.width;
 for(let y=Math.max(0,14+Math.floor(low/512)-1);y<Math.min(base.height,14+Math.ceil(high/512)+1);y++)for(let x=minX;x<maxX;x++)colors.add(biome.pixels[y*base.width+x]>>>0);
 const allowed=new Set(mainBiomes[layer]);
 for(const [key,conf] of Object.entries(GENERATOR_CONFIG) as any[]){
  conf.enabled=scope==='region'?(area.kind==='biome'?area.biomes.includes(key):colors.has(conf.color>>>0)):scope==='overgrown'?key==='fungiforest':scope==='depth'?colors.has(conf.color>>>0):allowed.has(key)||key.startsWith('temple_');
  if(conf.enabled&&conf.wangFile&&!conf.wangData)conf.wangData=await loadPNG(conf.wangFile);
 }
 const tiles=await generateBiomeTiles(biome.pixels,base.width,base.height,GENERATOR_CONFIG,seed,0);
 const spawns=prescanSpawnFunctions(tiles,false);
 const scan=scanSpawnFunctions(biome,spawns,seed,0,pw,0,true,{});
 const specials=getSpecialPoIs(biome,seed,0,pw,0,{});
 const statics=addStaticPixelScenes(seed,0,pw,0,biome,true,{},false,'normal');
 const all=[...scan.generatedSpawns,...specials,...statics.pois];
 const evidence:any[]=[],items:any[]=[],seen=new Set<string>();
 function collect(obj:any,x:number,y:number,source:string){
  if(!obj||typeof obj!=='object')return;
  x=Number.isFinite(obj.x)?obj.x:x;y=Number.isFinite(obj.y)?obj.y:y;
  if(!Number.isFinite(y)||!Number.isFinite(x))return;
  if(y<low||y>=high||x<offset-17920||x>=offset+17920){if(Array.isArray(obj.items))for(const item of obj.items)collect(item,x,y,obj.type??source);return;}
  const resolved=getResolvedBiome(biome,x,y,false,'normal').biome;
  if(scope==='overgrown'&&resolved!=='fungiforest')return;
  const inside=scope==='region'?pointInArea(obj,x,y,area,pw,biome):scope!=='main'||allowed.has(resolved)||resolved?.startsWith('temple_');
  if(!inside){if(Array.isArray(obj.items))for(const item of obj.items)collect(item,x,y,obj.type??source);return;}
  if(obj.type==='wand'||typeof obj.spell==='string'||obj.type==='item'||['chest','great_chest'].includes(obj.type)){
   const key=[obj.type,x,y,obj.spell??obj.item??obj.cards?.join(',')].join(':');
   const type=obj.type==='wand'?'wand':obj.spell?'spell':['chest','great_chest'].includes(obj.type)?'chest':['potion','potion_empty','powder_stash','powder_pouch','pouch'].includes(obj.item)?'potion':'pickup';
   if(!seen.has(key)){seen.add(key);items.push({...obj,type,x,y,biome:resolved,worldOffset:pw,source,price:source.includes('shop')?null:0});}
  }
  if(obj.spell&&typeof obj.spell==='string')evidence.push({id:obj.spell,x,y,source});
  for(const key of ['cards','always_casts'])if(Array.isArray(obj[key]))for(const id of obj[key])if(typeof id==='string')evidence.push({id,x,y,source:obj.type??source});
  if(Array.isArray(obj.items))for(const item of obj.items)collect(item,x,y,obj.type??source);
 }
 for(const obj of all){
  collect(obj,obj.x,obj.y,obj.type??'world');
 }
 const result={ids:[...new Set(evidence.map(e=>e.id))],evidence,items,bounds:[low,high],layer,scope,worldOffset:pw,area};
 if(cache.size>=16)cache.delete(cache.keys().next().value);
 cache.set(cacheKey,result);
 return result;
}

function mapRegions(pixels:Uint32Array,pw:number,plane:number){
 const result:any[]=[],visited=new Set<number>(),names=new Map<number,string>(Object.entries(GENERATOR_CONFIG).map(([key,conf]:any)=>[conf.color>>>0,key]));
 const part=(key:string,y:number)=>key==='winter'?Math.floor(y/14):key==='winter_caves'?(y<24?0:y<31?1:y<39?2:3):0;
 for(let index=0;index<pixels.length;index++){
  if(visited.has(index))continue;
  const color=pixels[index]>>>0,key=names.get(color);if(!key)continue;
  const cells:number[][]=[],keys=new Set<string>(),queue=[index];visited.add(index);
  for(let i=0;i<queue.length;i++){
   const n=queue[i],x=n%base.width,y=Math.floor(n/base.width);cells.push([x,y]);keys.add(names.get(pixels[n]>>>0)!);
   for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
    const ni=ny*base.width+nx;
    const neighbor=names.get(pixels[ni]>>>0);
    const same=(pixels[ni]>>>0)===color||(key.startsWith('temple_')&&neighbor?.startsWith('temple_'));
    if(nx>=0&&nx<base.width&&ny>=0&&ny<base.height&&!visited.has(ni)&&same&&part(key,ny)===part(key,y)){visited.add(ni);queue.push(ni);}
   }
  }
  const xs=cells.map(c=>c[0]),ys=cells.map(c=>c[1]);
  const bounds=[Math.max(-17920,Math.min(...xs)*512-17920-64),Math.min(...ys)*512-7168+plane*24570-64,Math.min(17920,(Math.max(...xs)+1)*512-17920+64),(Math.max(...ys)+1)*512-7168+plane*24570+64];
  result.push({kind:'biome',biomes:[...keys],label:key.startsWith('temple_')?'圣山':(GENERATOR_CONFIG as any)[key].name??key,bounds,cells,verticalIndex:plane});
 }
 return result;
}
export async function worldMap(seed:number,pw=0,vertical=0,progress=(value:number,phase:string)=>{}){
 const context=`${seed}:${pw}`;
 if(context!==mapContext){mapCache.clear();mapContext=context;}
 if(mapCache.has(vertical))return mapCache.get(vertical);
 const result=await generateWorldMap(seed,pw,vertical,progress);
 if(mapCache.size>=3)mapCache.delete(mapCache.keys().next().value);
 mapCache.set(vertical,result);return result;
}
async function generateWorldMap(seed:number,pw=0,vertical=0,progress=(value:number,phase:string)=>{}){
 progress(0,'初始化地图生成器');
 if(!Number.isInteger(pw)||Math.abs(pw)>100)throw Error('Invalid parallel world');
 if(!Number.isInteger(vertical)||Math.abs(vertical)>1000000)throw Error('Invalid vertical section');
 await (initPromise??=init());
 updateSettings({enableStaticPixelScenes:'all',skipCosmeticScenes:false,showEnemies:true,clearSpawnPixels:true,recolorMaterials:true});
 try{
  const biome=generateBiomeData(seed,0,'normal',base.data,base.width,base.height);
  for(const conf of Object.values(GENERATOR_CONFIG) as any[]){
   conf.enabled=true;
   if(conf.wangFile&&!conf.wangData)conf.wangData=await loadPNG(conf.wangFile);
  }
  const offset=pw*35840,left=offset-17920,top=vertical===0?-31744:-7168+vertical*24570,scale=10;
  const height=vertical===0?73728:24576;
  const canvas=createCanvas(3584,Math.ceil(height/scale)),ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
  const overlay=vertical===0?createCanvas(3584,2458):null,oc=overlay?.getContext('2d');
  if(oc)oc.imageSmoothingEnabled=false;
  ctx.fillStyle='#000000';ctx.fillRect(0,0,canvas.width,canvas.height);
  const all:any[]=[],regions:any[]=[];let waterCave:any=null;
  let completed=0;const planeCount=vertical===0?3:1;
  for(const plane of vertical===0?[-1,0,1]:[vertical]){
   const label=plane<0?'天界':plane>0?'地狱':'地表与地下';
   progress(5+Math.floor(completed/planeCount*85),'生成'+label+'地形');
   const pixels=plane<0?biome.heavenPixels:plane>0?biome.hellPixels:biome.pixels;
   regions.push(...mapRegions(pixels,pw,plane));
   const tiles=await generateBiomeTiles(pixels,base.width,base.height,GENERATOR_CONFIG,seed,0);
   for(let y=0;y<base.height;y++)for(let x=0;x<base.width;x++){
    const color=(BIOME_COLOR_LOOKUP as any)[pixels[y*base.width+x]&0xffffff]??0x171b24;
    ctx.fillStyle='#'+Number(color).toString(16).padStart(6,'0');ctx.fillRect(x*51.2,(y*512-7168+plane*24570-top)/scale,52,52);
    if(plane===0&&oc&&BIOME_COLORS_WITH_TILES.has(pixels[y*base.width+x]&0xffffff)){
     oc.fillStyle='#'+Number(color).toString(16).padStart(6,'0');oc.fillRect(x*51.2,y*51.2,51.2,51.2);
    }
   }
   const images=createTileOverlaysCheap(biome,tiles,pw,plane,false);
   tiles.forEach((tile:any,i:number)=>{
    const pos=tileToWorldCoordinates(tile.minX,tile.minY,0,0,pw,plane,false);
    if(images[i])ctx.drawImage(images[i],(pos.x-left)/scale,(pos.y-top)/scale);
    if(images[i]&&plane===0&&oc)oc.drawImage(images[i],(pos.x-left)/scale,(pos.y+7168)/scale);
   });
   const prescan=prescanSpawnFunctions(tiles,false);
   progress(5+Math.floor((completed+.5)/planeCount*85),'计算'+label+'资源与固定场景');
   const scanned=scanSpawnFunctions(biome,prescan,seed,0,pw,plane,false,{});
   const fixed=addStaticPixelScenes(seed,0,pw,plane,biome,false,{},false,'normal');
   all.push(...[...scanned.generatedSpawns,...getSpecialPoIs(biome,seed,0,pw,plane,{}),...fixed.pois].map((p:any)=>({...p,verticalIndex:plane})));
   const scenes=[...scanned.finalPixelScenes,...fixed.pixelScenes];
   // The watercave frame is drawn before its interior layout so it cannot hide it.
   scenes.sort((a:any,b:any)=>Number(!!a.name?.startsWith('watercave_layout_'))-Number(!!b.name?.startsWith('watercave_layout_')));
   for(const scene of scenes){
    const image=getPixelSceneCanvas(scene);
    if(image)ctx.drawImage(image,(scene.x-left)/scale,(scene.y-top)/scale,scene.width/scale,scene.height/scale);
    if(image&&plane===0&&oc)oc.drawImage(image,(scene.x-left)/scale,(scene.y+7168)/scale,scene.width/scale,scene.height/scale);
    if(plane===0&&pw===0&&scene.name?.startsWith('watercave_layout_')){
     const png=await loadPNG('../data/pixel_scenes/general/'+scene.name+'.png');
     const layout=createCanvas(png.width,png.height),lc=layout.getContext('2d'),data=lc.createImageData(png.width,png.height);data.data.set(png.data);lc.putImageData(data,0,0);
     ctx.drawImage(layout,(scene.x-left)/scale,(scene.y-top)/scale,scene.width/scale,scene.height/scale);
     if(oc)oc.drawImage(layout,(scene.x-left)/scale,(scene.y+7168)/scale,scene.width/scale,scene.height/scale);
     waterCave={layout:Number(scene.name.split('_').pop()),bounds:[scene.x,scene.y,scene.width,scene.height]};
    }
   }
   completed++;
  }
  progress(92,'整理物品、石板与 Boss 位置');
  const pois:any[]=[],seen=new Set();
  const tiers:any={coalmine:1,coalmine_alt:1,excavationsite:2,snowcave:3,meat:3,rainforest:4,vault:4,crypt:5,the_end:10,the_sky:10};
  function collect(obj:any,parent:any={}){
   if(!obj||typeof obj!=='object'||obj.type==='holy_mountain_shop'||obj.ignore)return;
   const x=Number.isFinite(obj.x)?obj.x:parent.x,y=Number.isFinite(obj.y)?obj.y:parent.y;
   const source=obj.biome??parent.biome??'',paid=!!parent.paid||parent.type==='shop'||obj.type==='shop';
   const plane=obj.verticalIndex??parent.verticalIndex??0;
   let type=obj.type==='wand'?'wand':typeof obj.spell==='string'?'spell':null;
   if(['chest','great_chest'].includes(obj.type))type='chest';
   else if(obj.type==='item'&&!obj.spell)type=['potion','potion_empty','powder_stash','powder_pouch','pouch'].includes(obj.item)?'potion':'pickup';
   if(type){
    const key=[type,x,y,obj.spell??obj.item??obj.cards?.join(',')].join(':');
    if(!seen.has(key)&&Number.isFinite(x)&&Number.isFinite(y)){
     seen.add(key);pois.push({...obj,type,x,y,source,paid,verticalIndex:plane,tier:paid?(tiers[source]??null):null,container:parent.type??null,price:paid?null:0});
    }
   }
   if(obj.entity&&/boss_|alchemist_boss/.test(obj.entity))pois.push({type:'boss',entity:obj.entity,x,y,source,verticalIndex:plane,accuracy:'spawn',price:0});
   if(Array.isArray(obj.items))for(const item of obj.items)collect(item,{...obj,x,y,biome:source,paid,verticalIndex:plane});
  }
  all.forEach(obj=>collect(obj));
  if(vertical===0){
  // Normal NG geography: data comes from fixed map landmarks, rather than all
  // orb-coloured template cells (some template rooms never contain a real orb).
  for(const site of specialSites){
   if(pw!==0&&site.mainOnly)continue;
   const x=site.x+offset,y=site.y;
   pois.push({type:'pickup',item:pw===0?'orb':'orb_cursed',x,y,label:(pw===0?'真知魔球':'诅咒魔球')+' · '+site.title,source:'fixed_orb_site',relatedSpell:site.spell,verticalIndex:0,worldOffset:pw,price:0});
   if(site.spell!=='NUKE')pois.push({type:'pickup',item:'emerald_tablet',x:x+40,y:y+50,label:'翡翠石板（翠玉录）· '+site.title,source:'fixed_tablet_room',relatedSpell:site.spell,accuracy:'region',verticalIndex:0,worldOffset:pw,price:0});
  }
  if(pw===0){
   // Original PNG spawn pixels plus the original Lua entity offsets:
   // tree (720,1115)+(-2048,-1324), corpse (291,840)+(2048,0),
   // lava orb's tablet (1435,1891)+(2048,0)+(20,0).
   for(const [x,y,title,relatedSpell] of [[-1328,-209,'巨树根部',null],[2339,840,'矿坑熔岩湖旁',null],[3503,1891,'熔岩湖下方','NUKE']] as any[]){
    pois.push({type:'pickup',item:'emerald_tablet',x,y,label:'翡翠石板（翠玉录）· '+title,source:'fixed_tablet_spawn',relatedSpell,accuracy:'spawn',verticalIndex:0,worldOffset:0,price:0});
   }
  }
  const rooms:any={secret_lab:['boss_alchemist','高阶炼金术士'],wizardcave_entrance:['boss_gate','Kolmisilmän koipi'],dragoncave:['boss_dragon','巨龙'],roboroom:['boss_robot','机械 Kolmi'],meatroom:['boss_meat','肉球 Boss'],mestari_secret:['boss_wizard','法师之师'],boss_arena:['boss_centipede','Kolmisilmä'],lavalake_pit:['boss_pit','Sauvojen tuntija']};
  for(const [key,[entity,label]] of Object.entries(rooms) as any[]){
   if(pw!==0&&['boss_arena','lavalake_pit'].includes(key))continue;
   const color=(GENERATOR_CONFIG as any)[key]?.color;if(!color)continue;
   const cells:any[]=[];
   for(let y=0;y<base.height;y++)for(let x=0;x<base.width;x++)if((biome.pixels[y*base.width+x]>>>0)===(color>>>0))cells.push([x,y]);
   if(cells.length){
    const x=offset-17920+(cells.reduce((s,p)=>s+p[0],0)/cells.length+.5)*512,y=-7168+(cells.reduce((s,p)=>s+p[1],0)/cells.length+.5)*512;
    pois.push({type:'boss',entity,label,x,y,source:key,accuracy:'region',price:0});
   }
  }
  if(pw===0)pois.push({type:'boss',entity:'boss_limbs',label:'金字塔 Boss',x:10112,y:-768,source:'pyramid',accuracy:'region',price:0});
  }
  progress(97,'编码地图图像');
  return {seed,worldOffset:pw,verticalIndex:vertical,origin:[left,top],scale,width:35840,height,image:canvas.toBuffer('image/png').toString('base64'),overlay:overlay?{image:overlay.toBuffer('image/png').toString('base64'),origin:[left,-7168],scale}:null,shopCoverage:'fixed-heaven-hell-only',regions,pois:pois.filter(p=>p.x>=left&&p.x<left+35840&&p.y>=top&&p.y<top+height),waterCave,terrain:'Wang tiles + pixel scenes (10 world pixels / raster pixel)'};
 }finally{updateSettings({skipCosmeticScenes:true,showEnemies:false});}
}
