import test from 'node:test';
import assert from 'node:assert/strict';
import {makeApi} from '../lib/api.mjs';
const doc={id:'d1',title:'मौसम',text:'आज का मौसम',lang:'hi',source:'Example',url:'https://example.com',category:'Weather'};
const api=makeApi([doc],[],{documents:1,rows:[]});
const get=(path,method='GET')=>api(new Request('https://example.com/api/'+path,{method}));
test('metadata, browse filters and search agree on source records',async()=>{
  assert.equal((await get('meta').json()).sources[0].count,1);
  assert.equal((await get('browse?lang=en').json()).total,0);
  assert.equal((await get('search?q=मौसम').json()).results[0].id,'d1');
});
test('API rejects invalid searches, pagination and unsupported methods',()=>{
  for(const p of ['search?q=','search?q=test&mode=x','browse?limit=0','browse?offset=-1'])assert.equal(get(p).status,400);
  assert.equal(get('missing').status,404);
  assert.equal(get('meta','POST').status,405);
});
test('Shapley contributions sum to the full rank utility',async()=>{
  const r=await get('attribution?q=मौसम+का').json();
  assert.equal(r.subsets,4);
  assert.equal(r.contributions.reduce((a,c)=>a+c.impact,0),1);
  assert.equal(get('attribution?q=a+b+c+d+e+f').status,400);
});
test('relay reaches an aligned passage without shared vocabulary',async()=>{
  const handler=makeApi([{...doc,id:'xquad-en-0',source:'XQuAD',lang:'en',title:'Seismology',text:'earthquakes'},
    {...doc,id:'xquad-hi-0',source:'XQuAD',title:'भूकंप',text:'पृथ्वी'}],[],null);
  const r=await handler(new Request('https://example.com/api/relay?q=seismology&lang=hi')).json();
  assert.equal(r.results[0].doc.id,'xquad-hi-0');
  assert.equal(r.results[0].anchor.id,'xquad-en-0');
  assert.equal(r.results[0].directRank,undefined);
});
