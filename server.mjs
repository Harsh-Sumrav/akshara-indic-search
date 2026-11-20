import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {makeApi} from './lib/api.mjs';

const read=(path)=>readFile(new URL(path,import.meta.url));
const parse=async path=>JSON.parse(await read(path));
const [guides,corpus,sources,benchmark]=await Promise.all([parse('data/guides.json'),parse('data/corpus.json'),parse('data/sources.json'),parse('data/report.json').catch(()=>null)]);
const api=makeApi([...guides,...corpus],sources,benchmark);
const assets={'/':['index.html','text/html'],'/style.css':['style.css','text/css'],'/app.js':['app.js','text/javascript'],'/mark.svg':['mark.svg','image/svg+xml']};
const port=Number(process.env.PORT||4173);
http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    if(url.pathname.startsWith('/api/')){
      const out=api(new Request(url,{method:req.method}));
      res.writeHead(out.status,Object.fromEntries(out.headers));
      res.end(Buffer.from(await out.arrayBuffer()));
    }else if(assets[url.pathname] && req.method==='GET'){
      const [file,type]=assets[url.pathname];const body=await read('public/'+file);
      res.writeHead(200,{'Content-Type':type+'; charset=utf-8','X-Content-Type-Options':'nosniff'});res.end(body);
    }else{res.writeHead(404);res.end('Not found');}
  }catch(error){console.error(error);res.writeHead(500);res.end('Server error');}
}).listen(port,'127.0.0.1',()=>console.log('Akshara ready at http://127.0.0.1:'+port));
