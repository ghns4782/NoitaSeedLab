import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const audit=process.argv.includes('--audit');
const seedBuild=await esbuild.build({metafile:audit,entryPoints:['engine/bridge.ts'],outfile:'runtime/engine.mjs',bundle:true,platform:'node',format:'esm',target:'node22',external:['node:*'],plugins:[{
 name:'wasm-paths', setup(build) {build.onLoad({filter:/\.ts$/},async args=>{
  let contents=await fs.promises.readFile(args.path,'utf8');
  contents=contents.replace(/new URL\("([^"\n]+)", import\.meta\.url\)/g,(_,rel)=>{
   const target=path.relative(root,path.resolve(path.dirname(args.path),rel)).replaceAll('\\','/');
   return `new URL(${JSON.stringify('../'+target)}, import.meta.url)`;
  });
  return {contents,loader:'ts',resolveDir:path.dirname(args.path)};
 });}
}]});
const mapBuild=await esbuild.build({metafile:audit,entryPoints:['engine/layer.ts'],outfile:'runtime/layer.mjs',bundle:true,platform:'node',format:'esm',target:'node22',external:['node:*','@napi-rs/canvas','upng-js','https:*'],plugins:[{
 name:'telescope-adapter',setup(build){
  build.onResolve({filter:/png_sanitizer\.js$/},()=>({path:path.resolve('engine/telescope-png.mjs')}));
  build.onLoad({filter:/\.js$/},async args=>{
   if(!args.path.includes('noita-telescope-main'))return;
   let contents=await fs.promises.readFile(args.path,'utf8');
   const rel=path.relative(root,args.path).replaceAll('\\','/');
   contents=contents.replaceAll('import.meta.url',`new URL(${JSON.stringify('../'+rel)}, import.meta.url).href`);
   return {contents,loader:'js',resolveDir:path.dirname(args.path)};
  });
 }
}]});
if(audit){
 const runtimeAssetRoots=['vendor/noita-tools-master/src/services/SeedInfo/data',
  'vendor/noita-tools-master/src/services/SeedInfo/noita_random/noita_random.wasm',
  'vendor/noita-tools-master/src/services/SeedInfo/wasm/rng.wasm',
  'vendor/noita-tools-master/src/services/SeedInfo/infoHandler/InfoProviders/Alchemy/Alchemy.wasm',
  'vendor/noita-tools-master/src/services/SeedInfo/infoHandler/InfoProviders/FungalShift/FungalShift.wasm',
  'vendor/noita-telescope-main/data/biome_flags.json',
  'vendor/noita-telescope-main/data/material_data.json',
  ...['biome_maps','pixel_scenes','wang_tiles','rng','sprite_distributions','item_sprites','wand_sprites','enemy_sprites'].map(dir=>'vendor/noita-telescope-main/data/'+dir)];
 runtimeAssetRoots.forEach(file=>fs.accessSync(file));
 fs.mkdirSync('artifacts',{recursive:true});
 fs.writeFileSync('artifacts/engine-inputs.json',JSON.stringify({seed:seedBuild.metafile,map:mapBuild.metafile,runtimeAssetRoots},null,2));
}
