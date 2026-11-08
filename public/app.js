'use strict';
const $=id=>document.getElementById(id);
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const e=escapeHtml;
const langNames=new Intl.DisplayNames(['en'],{type:'language'});
const language=code=>langNames.of(code);
const nice=n=>Number(n).toLocaleString('en');
const rankers={hybrid:'Hybrid',bm25:'BM25',vector:'TF–IDF cosine'};
const option=(v,t,selected)=>'<option value="'+e(v)+'" '+(v===selected?'selected':'')+'>'+e(t)+'</option>';
const external=url=>/^https?:\/\//i.test(url)?e(url):'#';
const link=(tab,params={})=>'#'+tab+(Object.keys(params).length?'?'+new URLSearchParams(params):'');
const api=async(path,params={})=>{const r=await fetch('/api/'+path+'?'+new URLSearchParams(params));if(!r.ok)throw Error((await r.json()).error||'Request failed');return r.json();};
const fail=err=>'<p class="error" role="alert">'+e(err.message)+'. Please try again.</p>';
let meta,routeVersion=0,cmpVersion=0;
function art(){
  const c=$('weave'),rect=c.getBoundingClientRect(),w=rect.width,h=rect.height;
  if(!w||!h)return;
  const d=Math.min(window.devicePixelRatio||1,2);c.width=w*d;c.height=h*d;
  const g=c.getContext('2d');g.scale(d,d);
  for(let i=0;i<96;i++){
    const t=i/95;g.beginPath();
    for(let j=0;j<=240;j++){
      const x=j/240,u=x*6.28;
      const y=h*(.53+.22*Math.sin(u*1.25+t*4.4)+.16*Math.cos(u*1.8-t*3.2)+.18*(t-.5));
      if(!j)g.moveTo(-.12*w,y);else g.lineTo((x*1.18-.12)*w,y);
    }
    g.strokeStyle=i%4===0?'rgba(108,65,34,.58)':'rgba(136,83,44,.35)';g.lineWidth=i%4===0?.9:.65;g.stroke();
  }
}
new ResizeObserver(art).observe($('weave'));
const notebooks=[
 ['Cross-script search','Follow one weather query from Roman Hindi to Devanagari.','kal ka mausam',['क','ka','क'],'#dce9df','#426959','#b8cdc0'],
 ['Spelling variants','Trace different spellings of India’s lunar mission.','chandrayan',['च','~','चं'],'#f3e5cc','#926037','#d8c39d'],
 ['Code-mixed queries','Find scholarship information with Hindi and English together.','छात्रवृत्ति application',['अ','+','A'],'#e4e4f0','#645976','#c7c4d7']
];
$('cards').innerHTML=notebooks.map(([title,desc,q,g,t,f,d])=>'<a class="card" href="'+link('search',{q})+'"><div aria-hidden="true" class="mini" style="--tint:'+t+';--fg:'+f+';--dots:'+d+'">'+g.map(s=>'<span>'+s+'</span>').join('')+'</div><div class="cardBody"><h3>'+title+'</h3><p>'+desc+'</p><small>Try query ↗</small></div></a>').join('');
function state(){const [tab,params]=location.hash.slice(1).split('?');return {tab:['corpus','lab'].includes(tab)?tab:'search',p:Object.fromEntries(new URLSearchParams(params))};}
function route(tab,p){const next=link(tab,p);if(next===location.hash)render();else location.hash=next;}
function controls(p){const languages=Object.keys(meta.langs).sort((a,b)=>language(a).localeCompare(language(b)));return '<label>Language<select data-key="lang">'+option('all','All languages',p.lang)+languages.map(l=>option(l,language(l),p.lang)).join('')+'</select></label><label>Source<select data-key="source">'+option('all','All sources',p.source)+meta.sources.map(s=>option(s.name,s.name,p.source)).join('')+'</select></label>';}
function result(d){return '<article class="result"><div class="meta"><strong>'+e(d.source)+'</strong><span>'+e(language(d.lang))+'</span><span>'+e(d.category)+'</span></div><h3 lang="'+e(d.lang)+'">'+e(d.title)+'</h3><p lang="'+e(d.lang)+'">'+e(d.text)+'</p><div class="meta"><a target="_blank" rel="noopener noreferrer" href="'+external(d.url)+'">Open source ↗</a>'+('score' in d?'<span>Score '+e(d.score.toFixed(3))+'</span>':'')+'</div>'+(d.evidence?'<details><summary>Why this matched</summary>'+e(d.evidence.join(' · '))+'</details>':'')+'</article>';}
function pager(total,off,tab,p){return '<div class="pager">'+(off?'<a class="soft" href="'+e(link(tab,{...p,offset:String(Math.max(0,off-10))}))+'">Previous</a>':'')+(off+10<total?'<a class="soft" href="'+e(link(tab,{...p,offset:String(off+10)}))+'">Next page</a>':'')+'</div>';}
function table(cols,rows){return '<div class="tableWrap"><table><thead><tr>'+cols.map(c=>'<th>'+e(c)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(v=>'<td>'+e(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';}
async function render(){
  const v=++routeVersion,{tab,p}=state(),off=Math.max(0,Number(p.offset)||0);
  for(const t of ['search','corpus','lab']){$(t+'Page').hidden=tab!==t;const a=document.querySelector('[data-tab="'+t+'"]');if(tab===t)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
  if(!meta)return;
  if(tab==='lab')return;
  if(tab==='corpus'){
    const filtered=p.source||p.lang||p.browse;
    $('catalogue').innerHTML='<div class="catalogTools">'+controls(p)+'<a class="soft" href="#corpus?browse=1">Browse records</a>'+(filtered?'<a href="#corpus">All collections</a>':'')+'</div><div id="catalogContent" aria-live="polite"></div>';
    const el=$('catalogContent');
    if(!filtered){el.innerHTML='<div class="sourceGrid">'+meta.sources.map(s=>'<article class="source"><div class="meta">'+nice(s.count)+' records</div><h3>'+e(s.name)+'</h3><p>'+e(s.description)+'</p><p class="meta">'+e(s.license)+'</p><div><a href="'+e(link('corpus',{source:s.name}))+'">Browse records</a><a target="_blank" rel="noopener" href="'+external(s.url)+'">Provenance ↗</a></div></article>').join('')+'</div>';return;}
    el.textContent='Loading records…';
    try{const data=await api('browse',{...p,offset:off});if(v!==routeVersion)return;el.innerHTML='<p class="count">'+nice(data.total)+' records</p>'+data.results.map(result).join('')+pager(data.total,off,tab,p);}catch(err){if(v===routeVersion)el.innerHTML=fail(err);}return;
  }
  $('query').value=p.q||'';$('discovery').hidden=!!p.q;$('searchOutput').hidden=!p.q;
  if(!p.q)return;
  $('filters').innerHTML=controls(p)+'<label>Ranker<select data-key="mode">'+Object.entries(rankers).map(([k,t])=>option(k,t,p.mode||'hybrid')).join('')+'</select></label>'+[['stemming','Stemming'],['stopwords','Remove stop words']].map(([k,t])=>'<label class="check"><input data-key="'+k+'" type="checkbox" '+(p[k]==='false'?'':'checked')+'>'+t+'</label>').join('');
  $('results').textContent='Searching the index…';$('resultTitle').textContent='Results for “'+p.q+'”';
  try{const data=await api('search',{...p,offset:off});if(v!==routeVersion)return;
    const trace=table(['Token','Stem','Roman form','Concept','Index DF','Hindi IDF','Treatment'],data.analysis.map(a=>[a.term,a.stem,a.roman,a.concepts.join(', ')||'—',a.df,a.hindiIdf.toFixed(2),a.removed?'Removed':'Retained']));
    $('results').innerHTML='<p class="count">'+nice(data.total)+' matches · '+e(data.elapsedMs)+' ms</p><details class="inspect"><summary>Inspect query analysis</summary>'+trace+'<p>Index DF counts documents containing the indexed term. Hindi IDF uses unstemmed tokens in the Hindi subset.</p></details>'+(data.results.map(result).join('')||'<p class="empty">No results on this page. Try a shorter query or change the source and language filters.</p>')+pager(data.total,off,tab,p);
    if(!off)$('searchOutput').scrollIntoView({block:'start'});
  }catch(err){if(v===routeVersion)$('results').innerHTML=fail(err);}
}
$('searchForm').onsubmit=ev=>{ev.preventDefault();const q=$('query').value.trim();if(q)route('search',{q});};
$('examples').onclick=ev=>{if(ev.target.tagName==='BUTTON')route('search',{q:ev.target.textContent});};
$('clear').onclick=()=>{route('search',{});window.scrollTo(0,0);};
document.addEventListener('change',ev=>{const key=ev.target.dataset.key;if(key){const {tab,p}=state();route(tab,{...p,[key]:ev.target.type==='checkbox'?String(ev.target.checked):ev.target.value,offset:'0'});}});
document.addEventListener('keydown',ev=>{if(ev.key==='/'&&!ev.ctrlKey&&!ev.metaKey&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)){ev.preventDefault();if(state().tab!=='search'){location.hash='search';$('searchPage').hidden=false;}$('query').focus();}});
$('compare').onsubmit=async ev=>{ev.preventDefault();const id=++cmpVersion,f=new FormData(ev.target),q=f.get('q').trim(),queries=[q,f.get('variant').trim()||q],modes=[f.get('left'),f.get('right')];$('comparison').textContent='Comparing rankings…';try{const lists=await Promise.all(modes.map((mode,i)=>api('search',{q:queries[i],mode,limit:5})));if(id!==cmpVersion)return;const sets=lists.map(l=>new Set(l.results.map(d=>d.id))),union=new Set([...sets[0],...sets[1]]),overlap=[...sets[0]].filter(x=>sets[1].has(x)).length;
$('comparison').innerHTML='<p>'+overlap+' shared results · Top-five Jaccard overlap '+(union.size?(overlap/union.size).toFixed(2):'—')+'</p><div class="compareGrid">'+lists.map((l,i)=>'<section><h3>'+e(rankers[modes[i]])+'</h3><p>'+e(queries[i])+'</p>'+(l.total?'<ol>'+l.results.map(d=>'<li><a target="_blank" rel="noopener" href="'+external(d.url)+'">'+e(d.title)+'</a> <small>'+e(language(d.lang))+'</small></li>').join('')+'</ol>':'<p>No matches</p>')+'</section>').join('')+'</div>'+rankChanges(lists);}catch(err){if(id===cmpVersion)$('comparison').innerHTML=fail(err);}};
function rankChanges(lists){
  const ranks=lists.map(list=>new Map(list.results.map((d,i)=>[d.id,{title:d.title,rank:i+1}])));
  const ids=new Set([...ranks[0].keys(),...ranks[1].keys()]);
  if(!ids.size)return '';
  const rows=[...ids].map(id=>{
    const a=ranks[0].get(id),b=ranks[1].get(id);
    const change=!a?'Entered top five':!b?'Left top five':a.rank===b.rank?'Same position':a.rank>b.rank?'Up '+(a.rank-b.rank):'Down '+(b.rank-a.rank);
    return [(a||b).title,a?.rank||'—',b?.rank||'—',change];
  });
  return '<details class="inspect"><summary>Trace passage movement</summary>'+table(['Passage','First rank','Second rank','Change'],rows)+'</details>';
}
$('runEval').onclick=async()=>{const el=$('evaluation');el.textContent='Loading benchmark…';try{const data=await api('evaluation'),rows=data.rows||data.editorial.map(r=>({...r,suite:'Service navigation'})),suites=[...new Set(rows.map(r=>r.suite))];el.innerHTML='<label>Evaluation set <select id="suite">'+suites.map(s=>option(s,s,s==='Upstream pooled'?s:'')).join('')+'</select></label><div id="metrics"></div><a href="/api/evaluation" download="akshara-benchmark.json">Download report</a>';function show(){const slice=rows.filter(r=>r.suite===$('suite').value);$('metrics').innerHTML='<p>'+slice[0].queries+' judged queries · cutoff '+slice[0].k+' · '+(slice[0].suite==='Service navigation'?'Project-authored navigation intents with bilingual judgments.':'Source question-to-passage links. Additional relevant passages can be unjudged.')+'</p>'+table(['Configuration','P@5','Recall@5','nDCG@5','MRR@5','Variant overlap'],slice.map(r=>[r.label,...[r.precision,r.recall,r.ndcg,r.mrr,r.stability].map(x=>x==null?'—':x.toFixed(3))]));}$('suite').onchange=show;show();}catch(err){el.innerHTML=fail(err);}};
window.addEventListener('hashchange',render);
render();api('meta').then(m=>{meta=m;$('stats').innerHTML=[[nice(m.documents),'Indexed records'],[Object.keys(m.langs).length,'Document languages'],[m.sources.length,'Corpus sources']].map(([v,s])=>'<div class="stat"><strong>'+v+'</strong><span>'+s+'</span></div>').join('');render();}).catch(err=>{$('stats').innerHTML=fail(err);});

function experiment(formId, outputId, endpoint, format) {
  const output=$(outputId);
  $(formId).onsubmit=async event=>{
    event.preventDefault();
    const form=event.target,button=form.querySelector('button');
    button.disabled=true;
    output.textContent='Searching the corpus…';
    try{
      const response=await api(endpoint,Object.fromEntries(new FormData(form)));
      output.innerHTML=format(response);
    }catch(error){output.innerHTML=fail(error);}
    finally{button.disabled=false;}
  };
}
experiment('attributionForm','attributionResult','attribution',data=>{
  if(!data.target)return '<p>No matching passage.</p>';
  return '<h3>'+e(data.target.title)+'</h3><p>'+data.subsets+' token subsets including the empty query. Positive values improve the winner’s rank on average. Negative values lower it.</p>'+
    table(['Token','Contribution'],data.contributions.map(c=>[c.term,c.impact.toFixed(4)]));
});
experiment('relayForm','relayResult','relay',data=>{
  if(!data.results.length)return '<p>No matching passages in either retrieval route.</p>';
  return data.results.map((row,i)=>'<details class="inspect"><summary>'+e(String(i+1)+'. '+row.doc.title)+'</summary><p>Direct rank: '+e(row.directRank||'outside top 20')+' · Translation anchor rank: '+e(row.anchorRank||'outside top 10')+'</p>'+result(row.doc)+(row.anchor?'<h3>Source-language anchor</h3>'+result(row.anchor):'')+'</details>').join('');
});


const shortcuts = [
  {label:'Search the index',tab:'search',target:'query'},
  {label:'Browse the corpus',tab:'corpus',target:'catalogue'},
  {label:'Explain first place',tab:'lab',target:'attributionForm'},
  {label:'Trace translated passages',tab:'lab',target:'relayForm'},
  {label:'Compare rankings',tab:'lab',target:'compare'},
  {label:'View benchmarks',tab:'lab',target:'runEval'}
];
function jumpToTool(item) {
  route(item.tab,{});
  requestAnimationFrame(()=>{
    const target=$(item.target);
    if(!target)return;
    const control=target.matches('input,button')?target:target.querySelector('input,button,select,a');
    target.scrollIntoView({block:'center'});
    control?.focus({preventScroll:true});
  });
}
const toolDialog=$('toolsDialog');
$('openTools').onclick=()=>toolDialog.showModal();
$('closeTools').onclick=()=>toolDialog.close();
for(const item of shortcuts){
  const button=document.createElement('button');
  button.textContent=item.label;
  button.onclick=()=>{toolDialog.close();jumpToTool(item);};
  $('toolLinks').append(button);
}
document.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
    event.preventDefault();
    if(toolDialog.open)toolDialog.close();else toolDialog.showModal();
  }
});
const motionControl=$('quietMotion');
try{motionControl.checked=localStorage.getItem('akshara-quiet')==='true';}catch{}
document.documentElement.toggleAttribute('data-quiet',motionControl.checked);
motionControl.onchange=()=>{
  document.documentElement.toggleAttribute('data-quiet',motionControl.checked);
  try{localStorage.setItem('akshara-quiet',String(motionControl.checked));}catch{}
};
const researchCards=[
  [2,'Query attribution','Discover which words put a passage first by testing every token subset.',['क','−','का'],'#e8e6d8','#685e36','#c9c5aa'],
  [3,'Translation relay','Follow an English or Hindi passage to its counterpart in the other language.',['A','⇄','अ'],'#dce8ed','#3d6070','#bdced5'],
  [4,'Ranking comparison','Compare two rankers and trace which passages change position.',['१','⇅','२'],'#ede0d8','#815742','#d7beb0']
];
for(const [index,title,description,glyphs,tint,fg,dots] of researchCards){
  const card=document.createElement('a');
  card.href='#lab';
  card.className='card';
  card.innerHTML='<div class="mini" aria-hidden="true" style="--tint:'+tint+';--fg:'+fg+';--dots:'+dots+'">'+glyphs.map(g=>'<span>'+g+'</span>').join('')+'</div><div class="cardBody"><h3>'+title+'</h3><p>'+description+'</p><small>Open experiment ↗</small></div>';
  card.onclick=event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();jumpToTool(shortcuts[index]);};
  $('cards').append(card);
}
