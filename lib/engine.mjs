import {tokens, stem, soundKey, romanize, conceptFor, stops} from './language.mjs';
export {evaluate, benchmarkCases} from './evaluation.mjs';

const frequency = (map,key,amount=1) => map.set(key,(map.get(key)||0)+amount);
function append(postings, term, index, count) {
  if (!postings.has(term)) postings.set(term,[]);
  postings.get(term).push(index,count);
}
const idf = (size, df) => Math.log((size+1)/(df+1))+1;
const bmIdf = (size,df) => Math.log1p((size-df+0.5)/(df+0.5));
function distance(a,b) {
  let row = Array.from({length:b.length+1},(_,i)=>i);
  for (let i=1;i<=a.length;i++) {
    const next = [i];
    for (let j=1;j<=b.length;j++) next.push(Math.min(row[j]+1,next[j-1]+1,row[j-1]+Number(a[i-1]!==b[j-1])));
    row=next;
  }
  return row[b.length];
}

function makeIndex(docs, stemming, stopwords) {
  const words = new Map(), concepts = new Map(), sounds = new Map();
  const norm = new Float64Array(docs.length), lengths = new Uint32Array(docs.length);
  let totalLength=0;
  docs.forEach((doc,index)=>{
    const terms = new Map(), meanings = new Map();
    const add = (text,weight) => {
      const context=tokens(text);
      for (const word of context) {
        if (stopwords && stops.has(word)) continue;
        const term=stemming?stem(word):word;
        frequency(terms,term,weight);
        const concept=conceptFor(word,term,context);
        if (concept) frequency(meanings,concept,weight);
        lengths[index]+=weight;
      }
    };
    add(doc.title,3);
    add(doc.text,1);
    totalLength+=lengths[index];
    for (const [term,count] of terms) append(words,term,index,count);
    for (const [concept,count] of meanings) append(concepts,concept,index,count);
  });
  for (const [term,posting] of words) {
    const weight = idf(docs.length,posting.length/2);
    for (let p=0;p<posting.length;p+=2) norm[posting[p]]+=((1+Math.log(posting[p+1]))*weight)**2;
    const key=soundKey(term);
    if (!key || key.length<2) continue;
    if (!sounds.has(key)) sounds.set(key,[]);
    sounds.get(key).push(term);
  }
  const conceptNorm=new Float64Array(docs.length);
  for (const posting of concepts.values()) {
    const wi=idf(docs.length,posting.length/2);
    for (let p=0;p<posting.length;p+=2) conceptNorm[posting[p]]+=((1+Math.log(posting[p+1]))*wi)**2;
  }
  return {words,concepts,sounds,norm,conceptNorm,lengths,avg:totalLength/Math.max(docs.length,1)||1};
}

// Rank by exact vocabulary, a query translation in a shared concept space, and
// conservative phonetic alternatives. Each posting is a packed [doc, tf] list.
export class SearchEngine {
  constructor(docs) {
    this.docs=docs;
    this.views=new Map();
    this.hindiDF=new Map();
    this.hindiDocuments=0;
    for (const doc of docs) {
      if (doc.lang!=='hi') continue;
      this.hindiDocuments++;
      for (const word of new Set(tokens(doc.title+' '+doc.text))) frequency(this.hindiDF,word);
    }
  }
  index(stemming,stopwords) {
    const key=Number(stemming)*2+Number(stopwords);
    if (!this.views.has(key)) {
      if (this.views.size>=2) this.views.delete(this.views.keys().next().value);
      this.views.set(key,makeIndex(this.docs,stemming,stopwords));
    }
    return this.views.get(key);
  }
  search(query, options={}) {
    const start=performance.now();
    const mode=['hybrid','bm25','vector'].includes(options.mode)?options.mode:'hybrid';
    const stemming=options.stemming!==false, stopwords=options.stopwords!==false;
    const ix=this.index(stemming,stopwords), n=this.docs.length;
    const input=tokens(query).slice(0,40);
    const analysis=[...new Set(input)].map(term=>{
      const root=stemming?stem(term):term;
      const concept=conceptFor(term,root,input);
      const df=(ix.words.get(root)?.length||0)/2;
      const hindiDf=this.hindiDF.get(term)||0;
      return {term,stem:root,roman:romanize(term),concepts:concept?[concept]:[],df,
        idf:idf(n,df),hindiDf,hindiDocuments:this.hindiDocuments,hindiIdf:idf(this.hindiDocuments,hindiDf),
        stopword:stops.has(term),removed:stopwords&&stops.has(term)};
    });
    const ranks=new Map(), qterms=new Map(), meanings=new Set();
    for (const term of input) if (!stopwords || !stops.has(term)) frequency(qterms,stemming?stem(term):term);
    for (const entry of analysis) if (!entry.removed) for (const concept of entry.concepts) meanings.add(concept);
    // For fully interpreted multi-concept queries, ranking entirely in the
    // shared space makes equivalent native, Roman and English queries stable.
    const canonical=mode==='hybrid' && meanings.size>=2 &&
      analysis.every(entry=>entry.removed || entry.concepts.length>0);
    const enabled=(value,actual)=>!value || value==='all' || value===actual;
    let qNorm=0, queryConceptNorm=0;
    const match=(posting, label, channel, qWeight=1, discount=1)=>{
      if (!posting) return;
      const df=posting.length/2, wi=idf(n,df);
      for (let p=0;p<posting.length;p+=2) {
        const index=posting[p], doc=this.docs[index];
        if (!enabled(options.lang,doc.lang)||!enabled(options.source,doc.source)||!enabled(options.category,doc.category)) continue;
        if (!ranks.has(index)) ranks.set(index,{index,lexical:0,bridge:0,phone:0,dot:0,conceptDot:0,evidence:new Set()});
        const r=ranks.get(index), tf=posting[p+1];
        const sat=tf*2.3/(tf+1.3*(0.25+0.75*ix.lengths[index]/ix.avg));
        r[channel]+=bmIdf(n,df)*sat*discount;
        if (channel==='lexical') r.dot+=(1+Math.log(tf))*wi*qWeight;
        if (channel==='bridge') r.conceptDot+=(1+Math.log(tf))*wi*qWeight;
        r.evidence.add(label);
      }
    };
    for (const [term,qtf] of qterms) {
      if (canonical) break;
      const posting=ix.words.get(term), wi=(1+Math.log(qtf))*idf(n,(posting?.length||0)/2);
      qNorm+=wi**2;
      match(posting,`Term · ${term}`,'lexical',wi);
      if (mode!=='hybrid') continue;
      const key=soundKey(term), candidates=ix.sounds.get(key);
      if (!candidates || candidates.length>50) continue;
      const spelling=romanize(term);
      const nearby=candidates.filter(t=>t!==term && !qterms.has(t))
        .map(t=>({t,d:distance(spelling,romanize(t))}))
        .filter(x=>x.d<=Math.max(1,Math.floor(spelling.length/3)))
        .sort((a,b)=>a.d-b.d || a.t.localeCompare(b.t)).slice(0,3);
      for (const {t,d} of nearby) match(ix.words.get(t),`Sound · ${term} ~ ${t}`,'phone',1,1/(1+d));
    }
    if (mode!=='bm25') {
      for (const concept of meanings) {
        const posting=ix.concepts.get(concept),wi=idf(n,(posting?.length||0)/2);
        queryConceptNorm+=wi**2;
        match(posting,`Concept · ${concept}`,'bridge',wi);
      }
    }
    const ranked=[...ranks.values()].map(r=>{
      const denom=Math.sqrt((qNorm+queryConceptNorm)*((canonical?0:ix.norm[r.index])+ix.conceptNorm[r.index]));
      const vector=denom?(r.dot+r.conceptDot)/denom:0;
      const score=mode==='bm25'?r.lexical:mode==='vector'?vector:
        r.lexical+1.6*r.bridge+0.35*r.phone+vector;
      return {...r,score};
    }).sort((a,b)=>b.score-a.score || String(this.docs[a.index].id).localeCompare(String(this.docs[b.index].id)));
    const offset=Math.max(0,Math.trunc(Number(options.offset)||0));
    const limit=Math.max(0,Math.min(100,Math.trunc(Number(options.limit??20)||0)));
    return {results:ranked.slice(offset,offset+limit).map(r=>({...this.docs[r.index],
      score:Number(r.score.toFixed(5)),evidence:[...r.evidence]})), total:ranked.length,
      tokens:input,analysis,mode,canonical,elapsedMs:Number((performance.now()-start).toFixed(2))};
  }
}
