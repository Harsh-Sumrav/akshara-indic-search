import test from 'node:test';
import assert from 'node:assert/strict';
import {SearchEngine,evaluate} from '../lib/engine.mjs';
import {measure} from '../lib/evaluation.mjs';
import {romanize,stem,tokens} from '../lib/language.mjs';

const docs=[
  {id:'imd-forecast-hi',title:'मौसम का पूर्वानुमान',text:'कल बारिश होगी',lang:'hi',source:'IMD'},
  {id:'imd-forecast-en',title:'Weather forecast',text:'Tomorrow rain is expected',lang:'en',source:'IMD'},
  {id:'rivers',title:'नदी तट',text:'नदियों के शहर',lang:'hi',source:'Gazette'},
  {id:'name',title:'जयपुर',text:'Rajasthan',lang:'hi',source:'Gazette'}
];
const engine=new SearchEngine(docs);
test('preserves script marks, folds nukta, and normalizes join controls',()=>{
  assert.deepEqual(tokens('क़लम। மழை! कि\u200dसान'),['कलम','மழை','किसान']);
  assert.equal(stem('किसानों'),'किसान');
  assert.equal(romanize('जयपुर'),'jayapur');
});
test('retrieves both translations in shared concept space for three scripts/spellings',()=>{
  for (const mode of ['hybrid','vector']) {
    for (const query of ['कल का मौसम','kal ka mosam','weather tomorrow']) {
      const {results}=engine.search(query,{mode});
      assert.deepEqual(new Set(results.slice(0,2).map(d=>d.id)),new Set(['imd-forecast-hi','imd-forecast-en']));
    }
  }
});
test('fully mapped variants have identical ranks while partially interpreted queries retain native evidence',()=>{
  const order=q=>engine.search(q).results.map(d=>d.id);
  assert.deepEqual(order('kal ka mousam'),order('कल का मौसम'));
  assert.deepEqual(order('कल का मौसम'),order('weather tomorrow'));
  assert.equal(engine.search('jaipur tomorrow').canonical,false);
  const [entry]=engine.search('का').analysis;
  assert.equal(entry.removed,true);
  assert.equal(entry.hindiDf,1);
  assert.equal(entry.hindiDocuments,3);
});
test('unknown named entity matches across scripts through the phonetic index',()=>{
  const [hit]=engine.search('jaipur').results;
  assert.equal(hit.id,'name');
  assert.ok(hit.evidence.some(x=>x.startsWith('Sound')));
});
test('filtering precedes pagination and scores preserve order',()=>{
  const {total,results}=engine.search('मौसम',{lang:'en',source:'IMD',limit:1});
  assert.equal(total,1);
  assert.equal(results[0].id,'imd-forecast-en');
  assert.equal(engine.search('मौसम',{lang:'en',offset:1}).results.length,0);
  assert.deepEqual(engine.search('का हैं').results,[]);
});
test('stemming and stopword switches modify lexical retrieval',()=>{
  const e=new SearchEngine([{id:'a',title:'किसानों के लिए',text:''}]);
  assert.equal(e.search('किसान',{mode:'bm25',stemming:false}).total,0);
  assert.equal(e.search('किसान',{mode:'bm25',stemming:true}).total,1);
  assert.equal(e.search('के',{mode:'bm25',stopwords:true}).total,0);
  assert.equal(e.search('के',{mode:'bm25',stopwords:false}).total,1);
});
test('metrics use cutoff precision, judged recall and rank discount',()=>{
  const metrics=measure(['miss','a','b'],['a','b'],3);
  assert.equal(metrics.precision,2/3);
  assert.equal(metrics.recall,1);
  assert.equal(metrics.mrr,0.5);
  assert.ok(metrics.ndcg<1 && metrics.ndcg>0.5);
  const result=evaluate(engine);
  assert.equal(result.length,6);
  assert.equal(result.at(-1).queries,4);
  assert.equal(result.at(-1).stability,1);
});
