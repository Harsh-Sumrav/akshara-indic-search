import {SearchEngine, evaluate} from './engine.mjs';

export function makeApi(documents, sources, benchmark) {
  const langs={}, counts={}, categories={};
  for(const doc of documents){
    langs[doc.lang]=(langs[doc.lang]||0)+1;
    counts[doc.source]=(counts[doc.source]||0)+1;
    categories[doc.category]=(categories[doc.category]||0)+1;
  }
  const registry=sources.map(s=>({...s,count:counts[s.name]||0}));
  for(const [name,count] of Object.entries(counts)){
    if(!registry.some(s=>s.name===name)){
      const doc=documents.find(d=>d.source===name);
      registry.push({name,count,url:doc.url,description:'Original bilingual finding guides to the linked public resource.',license:'Project-authored guide'});
    }
  }
  const meta={documents:documents.length,langs,sources:registry,categories};
  let engine;
  const byId = new Map(documents.map(doc => [doc.id, doc]));
  function attribution(query, mode) {
    const original = engine.search(query, {mode, limit:1});
    const terms = original.tokens, target = original.results[0];
    if (terms.length > 5 || !terms.length) return json({error:'Use one to five tokens for exact attribution.'},400);
    if (!target) return json({target:null, contributions:[], searches:1});
    const values = [0], n = terms.length, factorial = [1,1,2,6,24,120];
    const subsets = 2 ** n;
    for (let mask=1; mask<subsets; mask++) {
      if (mask===subsets-1) {values.push(1);continue;}
      const subset = terms.filter((_,i)=>mask & (1<<i)).join(' ');
      const hits = engine.search(subset,{mode,limit:10}).results;
      const rank = hits.findIndex(hit=>hit.id===target.id)+1;
      values.push(rank ? 1/rank : 0);
    }
    const contributions = terms.map((term,i)=>{
      let impact=0;
      for(let mask=0;mask<subsets;mask++) {
        if(mask & (1<<i)) continue;
        const size=terms.filter((_,j)=>mask & (1<<j)).length;
        impact+=factorial[size]*factorial[n-size-1]/factorial[n]*(values[mask | (1<<i)]-values[mask]);
      }
      return {term,impact};
    });
    return json({target,contributions,subsets,searches:subsets-1});
  }
  function passageRelay(query,targetLang) {
    const sourceLang=targetLang==='hi'?'en':'hi';
    const anchors=engine.search(query,{lang:sourceLang,source:'XQuAD',limit:10}).results;
    const direct=engine.search(query,{lang:targetLang,limit:20}).results;
    const merged=new Map(direct.map((doc,i)=>[doc.id,{doc,directRank:i+1,score:1/(60+i+1)}]));
    for(const [i,anchor] of anchors.entries()){
      const pair=byId.get(anchor.id.replace('xquad-'+sourceLang+'-','xquad-'+targetLang+'-'));
      if(!pair || pair.lang!==targetLang)continue;
      const row=merged.get(pair.id)||{doc:pair,score:0};
      row.anchor=anchor;row.anchorRank=i+1;row.score+=1/(61+i);merged.set(pair.id,row);
    }
    return json({sourceLang,targetLang,results:[...merged.values()].sort((a,b)=>b.score-a.score || a.doc.id.localeCompare(b.doc.id)).slice(0,10)});
  }
  function json(data,status=200){return Response.json(data,{status,headers:{'X-Content-Type-Options':'nosniff'}});}
  return function api(request){
    const {pathname,searchParams:p}=new URL(request.url);
    if(request.method!=='GET')return json({error:'Use GET.'},405);
    if(pathname==='/api/meta')return json(meta);
    if(['/api/attribution','/api/relay'].includes(pathname)){
      const query=(p.get('q')||'').trim();
      if(!query || query.length>350)return json({error:'Enter a query of 1–350 characters.'},400);
      engine??=new SearchEngine(documents);
      if(pathname==='/api/attribution')return attribution(query,'hybrid');
      const lang=p.get('lang')||'hi';
      return ['hi','en'].includes(lang)?passageRelay(query,lang):json({error:'Choose Hindi or English.'},400);
    }
    if(pathname==='/api/health')return json({status:'ok',documents:documents.length});
    if(pathname==='/api/evaluation' && benchmark)return json(benchmark);
    if(pathname==='/api/evaluation'){engine??=new SearchEngine(documents);return json({editorial:evaluate(engine)});}
    if(!['/api/search','/api/browse'].includes(pathname))return json({error:'Unknown endpoint.'},404);
    const q=(p.get('q')||'').trim(), mode=p.get('mode')||'hybrid';
    if(pathname==='/api/search' && (!q||q.length>350))return json({error:'Enter a query between 1 and 350 characters.'},400);
    if(!['hybrid','bm25','vector'].includes(mode))return json({error:'Unknown ranker.'},400);
    const limit=Number(p.get('limit')??10),offset=Number(p.get('offset')??0);
    if(!Number.isSafeInteger(limit)||limit<1||limit>50||!Number.isSafeInteger(offset)||offset<0)return json({error:'Invalid page.'},400);
    const lang=p.get('lang')||'all',source=p.get('source')||'all';
    if(pathname==='/api/browse'){
      const items=documents.filter(d=>(lang==='all'||d.lang===lang)&&(source==='all'||d.source===source));
      return json({total:items.length,results:items.slice(offset,offset+limit)});
    }
    engine??=new SearchEngine(documents);
    return json(engine.search(q,{lang,source,mode,limit,offset,stemming:p.get('stemming')!=='false',stopwords:p.get('stopwords')!=='false'}));
  }
}
