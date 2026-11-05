// Service-navigation intents. Each item has an editorial relevance judgment
// for the English and Hindi version of the designated guide.
const families = [
  ['imd-forecast',['weather tomorrow','कल का मौसम','kal ka mausam','kal ka mosam']],
  ['isro-chandrayaan',['ISRO lunar mission Chandrayaan','इसरो चंद्रयान मिशन','isro chandrayan mission']],
  ['scholarships',['student scholarships','छात्रवृत्ति पोर्टल','student chhatravritti']],
  ['rail-enquiry',['railway train enquiry','रेलवे ट्रेन पूछताछ','railway train poochtaach']],
  ['pm-kisan',['PM Kisan farmer scheme','पीएम किसान योजना','pm kisaan yojana']],
  ['uidai-aadhaar',['update Aadhaar UIDAI','आधार अपडेट','aadhar update']],
  ['payments',['UPI payment','यूपीआई भुगतान','upi bhugtan']],
  ['heritage',['Indian heritage','भारत की धरोहर','bharat ki virasat']]
];
export const benchmarkCases = families.flatMap(([family,variants])=>variants.map((query,i)=>({
  id:`${family}-q${i+1}`,family,query,relevant:[family+'-en',family+'-hi']
})));
export const configurations = [
  {mode:'bm25',label:'BM25 baseline',stemming:false,stopwords:true},
  {mode:'bm25',label:'BM25 + stemming',stemming:true,stopwords:true},
  {mode:'vector',label:'Cross-lingual TF–IDF',stemming:true,stopwords:true},
  {mode:'hybrid',label:'Hybrid · no stemming',stemming:false,stopwords:true},
  {mode:'hybrid',label:'Hybrid · keep stop words',stemming:true,stopwords:false},
  {mode:'hybrid',label:'Hybrid',stemming:true,stopwords:true}
];

export function measure(ids,relevant,k) {
  const targets=new Set(relevant), top=ids.slice(0,k);
  const hits=top.map(id=>Number(targets.has(id)));
  const found=hits.reduce((a,b)=>a+b,0), first=hits.indexOf(1);
  const gain=hits.reduce((sum,hit,i)=>sum+hit/Math.log2(i+2),0);
  let ideal=0;
  for (let i=0;i<Math.min(k,targets.size);i++) ideal+=1/Math.log2(i+2);
  return {precision:found/k,recall:targets.size?found/targets.size:0,
    mrr:first<0?0:1/(first+1),ndcg:ideal?gain/ideal:0};
}

export function evaluate(engine,cases=benchmarkCases,k=5,configs=configurations) {
  if (!Number.isInteger(k)||k<1||k>100) throw new RangeError('k must be an integer from 1 through 100');
  const corpus=new Set(engine.docs.map(d=>d.id));
  const eligible=cases.filter(c=>c.relevant.some(id=>corpus.has(id)));
  return configs.map(config=>{
    const sums={precision:0,recall:0,ndcg:0,mrr:0}, variants=new Map();
    for (const item of eligible) {
      const ids=engine.search(item.query,{...config,lang:item.targetLang,limit:k}).results.map(d=>d.id);
      const metrics=measure(ids,item.relevant.filter(id=>corpus.has(id)),k);
      for (const key of Object.keys(sums)) sums[key]+=metrics[key];
      if (item.family) {
        if (!variants.has(item.family)) variants.set(item.family,[]);
        variants.get(item.family).push(new Set(ids));
      }
    }
    for (const key of Object.keys(sums)) sums[key]/=Math.max(eligible.length,1);
    let overlap=0,pairs=0;
    for (const group of variants.values()) {
      for (let i=0;i<group.length;i++) for (let j=0;j<i;j++) {
        const union=new Set([...group[i],...group[j]]);
        const shared=[...group[i]].filter(id=>group[j].has(id)).length;
        overlap+=union.size?shared/union.size:0;
        pairs++;
      }
    }
    return {...config,...sums,stability:pairs?overlap/pairs:null,pairs,queries:eligible.length,
      skipped:cases.length-eligible.length,k};
  });
}
