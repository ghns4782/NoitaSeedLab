import { readFile } from 'node:fs/promises';
import UPNG from 'upng-js';
export async function loadPNG(url){
 const bytes=await readFile(new URL('../vendor/noita-telescope-main/js/'+url,import.meta.url));
 const decoded=UPNG.decode(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 return {data:new Uint8Array(UPNG.toRGBA8(decoded)[0]),width:decoded.width,height:decoded.height,bitmap:null};
}
