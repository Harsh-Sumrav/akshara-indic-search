import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const json=async path=>JSON.parse(await read(path));
const docs=[...await json('data/guides.json'),...await json('data/corpus.json')];
const report=await json('data/report.json');
if(report.documents!==docs.length)throw Error('Regenerate benchmark for the current corpus.');
const assets={};
for(const [path,file,type] of [['/','index.html','text/html'],['/style.css','style.css','text/css'],['/app.js','app.js','text/javascript'],['/mark.svg','mark.svg','image/svg+xml']]){
  assets[path]={body:await read('public/'+file),type};
}
// Inline the four application modules into the single-file Worker deployment format.
// These modules only have named static imports, declarations and named re-exports.
const modules=[];
for(const file of ['language','evaluation','engine','api']){
  const code=(await read('lib/'+file+'.mjs')).replace(/^import .+ from .+;\r?$/gm,'').replace(/^export \{.+\} from .+;\r?$/gm,'').replace(/^export (?=(class|const|function) )/gm,'');
  const exportsByModule={language:['tokens','stem','soundKey','romanize','conceptFor','stops'],evaluation:['evaluate'],engine:['SearchEngine'],api:['makeApi']};
  const names=exportsByModule[file].join(',');
  modules.push('const {'+names+'}=(()=>{\n'+code+'\nreturn {'+names+'};\n})();');
}
const packed=gzipSync(Buffer.from(JSON.stringify(docs)),{level:9}).toString('base64');
const bundle=modules.join('\n')+'\nconst assets='+JSON.stringify(assets)+';\nconst data='+JSON.stringify(packed)+';\nconst sources='+JSON.stringify(await json('data/sources.json'))+';\nconst report='+JSON.stringify(report)+';\n'+`
let apiPromise;
async function loadApi(){
  const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));
  const stream=new Response(bytes).body.pipeThrough(new DecompressionStream('gzip'));
  return makeApi(await new Response(stream).json(),sources,report);
}
export default {async fetch(request){
  const path=new URL(request.url).pathname;
  if(path.startsWith('/api/')){
    apiPromise??=loadApi().catch(error=>{apiPromise=undefined;throw error;});
    return (await apiPromise)(request);
  }
  const asset=Object.hasOwn(assets,path)&&assets[path];
  return asset&&request.method==='GET'?new Response(asset.body,{headers:{'Content-Type':asset.type+'; charset=utf-8','X-Content-Type-Options':'nosniff'}}):new Response('Not found',{status:404});
}};
`;
await Promise.all(['dist/server/','dist/.openai/'].map(dir=>mkdir(new URL(dir,root),{recursive:true})));
await writeFile(new URL('dist/server/index.js',root),bundle);
try {
  await copyFile(new URL('.openai/hosting.json',root),new URL('dist/.openai/hosting.json',root));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
console.log('Built Worker with '+docs.length+' records.');

