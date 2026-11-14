import {readFile} from 'node:fs/promises';
import {SearchEngine,benchmarkCases,evaluate} from '../lib/engine.mjs';
import {configurations} from '../lib/evaluation.mjs';

const data=new URL('../data/',import.meta.url);
const get=async name=>JSON.parse(await readFile(new URL(name,data),'utf8'));
const [corpus,guides,upstream]=await Promise.all(['corpus.json','guides.json','upstream-qrels.json'].map(get));
const docs=[...corpus,...guides];
if (new Set(docs.map(d=>d.id)).size!==docs.length) throw new Error('Duplicate document IDs');
const engine=new SearchEngine(docs);
const rows=[];
// Align on the upstream question identifier. Translation partners supply a
// known-positive passage in the other language, with the whole target-language
// corpus competing for rank. Document numbering is never assumed to align.
const xquad=upstream.filter(q=>q.source==='XQuAD');
const crossLanguage=[];
for (const q of xquad) {
  const key=q.id.split('-q-')[1];
  const partner=xquad.find(p=>p.lang!==q.lang && p.id.split('-q-')[1]===key);
  if (partner) crossLanguage.push({...q,id:q.id+'-to-'+partner.lang,
    targetLang:partner.lang,relevant:partner.relevant});
}
const groups=[['Service navigation',benchmarkCases],['Upstream pooled',upstream],
  ['XQuAD cross-language',crossLanguage]];
for (const lang of [...new Set(upstream.map(q=>q.lang))].sort()) {
  groups.push(['Upstream / '+lang,upstream.filter(q=>q.lang===lang)]);
}
// Group by configuration first to reuse the matching index across language slices.
for (const config of configurations) {
  for (const [suite,cases] of groups) {
    const [metrics]=evaluate(engine,cases,5,[config]);
    rows.push({suite,...metrics});
  }
}
if (process.argv.includes('--json')) console.log(JSON.stringify({documents:docs.length,rows},null,2));
else console.table(rows.map(({suite,label,queries,skipped,precision,recall,ndcg,mrr,stability})=>({
  suite,ranker:label,queries,skipped,'P@5':precision.toFixed(3),'R@5':recall.toFixed(3),
  'nDCG@5':ndcg.toFixed(3),'MRR@5':mrr.toFixed(3),'variant Jaccard@5':stability?.toFixed(3)??'—'
})));
