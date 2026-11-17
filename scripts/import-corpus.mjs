import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dataDir = fileURLToPath(new URL('../data/', import.meta.url));
const cache = process.env.AKSHARA_DATA_CACHE || join(tmpdir(), 'akshara-upstreams');
const compact = process.argv.includes('--compact');
mkdirSync(cache, { recursive: true });
mkdirSync(dataDir, { recursive: true });
const indicRevision = 'd7e91454f5c8a85b82e2549453521a2b7a185c44';
const xquadRevision = '7d30520c717524000f0d9d2f9c10a069acd9d285';
const languages = 'as bn gu hi kn ml mr or pa ta te'.split(' ');
const sources = [
  { name: 'MIRACL', url: 'https://huggingface.co/datasets/miracl/miracl-corpus', license: 'Apache-2.0 collection · CC BY-SA Wikipedia text', description: 'Wikipedia contributors and Project MIRACL. Hindi, Bengali and Telugu passage samples with original article titles and passage IDs.' },
  { name: 'IndicQA', url: 'https://huggingface.co/datasets/ai4bharat/IndicQA', license: 'CC BY 4.0', description: 'AI4Bharat reading-comprehension passages across eleven Indic languages. Display titles are extracted from passages when the original title is empty.' },
  { name: 'XQuAD', url: 'https://github.com/google-deepmind/xquad', license: 'CC BY-SA 4.0', description: 'Artetxe, Ruder and Yogatama, with SQuAD and Wikipedia contributors. Complete Hindi and English passage sets with aligned question identifiers.' },
  { name: 'Natural Earth', url: 'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-populated-places/', license: 'Public domain', description: 'Indian places from Natural Earth 5.1.2, including available names in English, Hindi and Bengali, state labels and coordinates.' },
  { name: 'World Bank', url: 'https://data.worldbank.org/country/india', license: 'CC BY 4.0 · World Bank data terms', description: 'Historical World Development Indicators for India. Population, access to electricity and irrigated agricultural land for 2001–2023 with English and Hindi descriptions.' },
];
const docs = [], qrels = [], inputs = [];
const knownIds = new Set();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const lock = JSON.parse(readFileSync(new URL('./upstreams.lock.json', import.meta.url), 'utf8'));
function sourceFile(name, url, snapshot) {
  const path = snapshot || join(cache, name);
  if (!existsSync(path)) {
    const partial = path + '.' + process.pid + '.partial';
    execFileSync('curl', ['--fail', '--location', '--silent', '--show-error', '--retry', '3', '--max-time', '180', url, '-o', partial]);
    renameSync(partial, path);
  }
  const raw = readFileSync(path);
  const value = JSON.parse(raw.toString('utf8'));
  // The viewer may change surrounding API metadata independently of its rows.
  const digest = hash(name.startsWith('miracl-') ? JSON.stringify(value.rows.map(x => x.row)) : raw);
  if (lock[name] !== digest) throw new Error('Unexpected upstream content for ' + name + '. Review the source revision and checksum.');
  inputs.push({ name, url, sha256: digest });
  return value;
}
function add(doc) {
  if (knownIds.has(doc.id)) throw new Error('Duplicate ID ' + doc.id);
  if (!doc.text?.trim() || !doc.title?.trim()) throw new Error('Empty record ' + doc.id);
  knownIds.add(doc.id);
  docs.push(doc);
}
function sample(rows, n) {
  return Array.from({ length: Math.min(n, rows.length) }, (_, i) => rows[Math.floor(i * rows.length / Math.min(n, rows.length))]);
}
function excerptTitle(text) {
  const words = text.trim().replace(/^[\s"'.,।]+/u, '').split(/\s+/u);
  return words.slice(0, 9).join(' ') + (words.length > 9 ? '…' : '');
}
function addQA(kind, lang, dataset, url) {
  const rows = dataset.data.flatMap(article => article.paragraphs.map(p => ({ title: article.title, ...p })));
  const available = rows.map((row, idx) => ({ row, idx })).filter(({ row }) => row.context?.trim());
  const included = kind === 'IndicQA' && compact ? sample(available, 84) : available;
  const labeled = [];
  for (const { row, idx } of included) {
    const id = kind.toLowerCase() + '-' + lang + '-' + idx;
    const title = row.title?.trim()?.replaceAll('_', ' ') || excerptTitle(row.context);
    add({ id, title, text: row.context.trim(), lang, source: kind, url, category: 'Knowledge' });
    const qa = row.qas.find(q => q.question?.trim() && q.answers?.some(a => a.text?.trim() && row.context.includes(a.text)));
    if (qa) labeled.push({ id: kind.toLowerCase() + '-' + lang + '-q-' + qa.id, lang, source: kind, query: qa.question.trim(), relevant: [id] });
  }
  qrels.push(...sample(labeled, 8));
}
for (const lang of languages) {
  const path = 'data/indicqa.' + lang + '.json';
  const home = sources[1].url;
  const data = sourceFile('indicqa-' + lang + '.json', home + '/resolve/' + indicRevision + '/' + path);
  addQA('IndicQA', lang, data, home + '/blob/' + indicRevision + '/' + path);
}
for (const lang of ['hi', 'en']) {
  const path = 'xquad.' + lang + '.json';
  const data = sourceFile('xquad-' + lang + '.json', 'https://raw.githubusercontent.com/google-deepmind/xquad/' + xquadRevision + '/' + path);
  addQA('XQuAD', lang, data, sources[2].url + '/blob/' + xquadRevision + '/' + path);
}
for (const lang of ['hi', 'bn', 'te']) {
  for (const offset of [0, 50000]) {
    const url = 'https://datasets-server.huggingface.co/rows?dataset=miracl%2Fmiracl-corpus&config=' + lang + '&split=train&offset=' + offset + '&length=100';
    const data = sourceFile('miracl-' + lang + '-' + offset + '.json', url);
    for (const { row, truncated_cells } of data.rows) {
      if (truncated_cells.length || !row.text.trim() || !row.title.trim()) continue;
      add({ id: 'miracl-' + lang + '-' + row.docid, title: row.title, text: row.text, lang, source: 'MIRACL', url: 'https://' + lang + '.wikipedia.org/wiki/' + encodeURIComponent(row.title.replaceAll(' ', '_')), category: 'Encyclopedia' });
    }
  }
}
const places = sourceFile('earth.json', 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_populated_places.geojson');
for (const { properties: p } of places.features) {
  if (p.ADM0_A3 !== 'IND') continue;
  const title = p.NAME_EN || p.NAME;
  const aliases = [...new Set([p.NAME, p.NAMEALT, p.NAME_HI, p.NAME_BN].filter(v => v && v !== title))];
  const labels = aliases.length ? ' Recorded names include ' + aliases.join(' · ') + '.' : '';
  const state = p.ADM1NAME ? p.ADM1NAME + ', India' : 'India';
  const url = p.WIKIDATAID?.match(/^Q\d+$/) ? 'https://www.wikidata.org/wiki/' + p.WIKIDATAID : sources[3].url;
  add({ id: 'ne-' + p.NE_ID, title, text: title + ' is a populated place in ' + state + '.' + labels + ' Coordinates: ' + p.LATITUDE.toFixed(3) + '° N, ' + p.LONGITUDE.toFixed(3) + '° E.', lang: 'en', source: 'Natural Earth', url, category: 'Geography' });
}
const worldBankUrl = 'https://api.worldbank.org/v2/country/IND/indicator/SP.POP.TOTL;AG.LND.IRIG.AG.ZS;EG.ELC.ACCS.ZS?source=2&date=2001:2023&per_page=100&format=json';
const snapshot = fileURLToPath(new URL('./snapshots/world-bank.json', import.meta.url));
const [, observations] = sourceFile('world-bank.json', worldBankUrl, snapshot);
const series = {
  'SP.POP.TOTL': ['India population', 'भारत की कुल जनसंख्या', 'people', 'लोग'],
  'AG.LND.IRIG.AG.ZS': ['Irrigated agricultural land in India', 'भारत में सिंचित कृषि भूमि', '% of agricultural land', '% कृषि भूमि'],
  'EG.ELC.ACCS.ZS': ['Access to electricity in India', 'भारत में बिजली की उपलब्धता', '% of the population', '% जनसंख्या'],
};
for (const [code, [english, hindi, enUnit, hiUnit]] of Object.entries(series)) {
  const points = observations.filter(x => x.indicator.id === code && x.value !== null).sort((a, b) => Number(a.date) - Number(b.date));
  for (let i = 0; i < points.length; i += 5) {
    const window = points.slice(i, i + 5);
    const years = window[0].date + '–' + window.at(-1).date;
    for (const [lang, title, unit] of [['hi', hindi, hiUnit], ['en', english, enUnit]]) {
      const formatter = new Intl.NumberFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', { maximumFractionDigits: 3 });
      const text = window.map(o => o.date + ' · ' + formatter.format(o.value) + ' ' + unit).join(' / ');
      add({ id: 'wdi-' + code + '-' + window[0].date + '-' + lang, title: title + ' (' + years + ')', text: title + '. ' + text + '.', lang, source: 'World Bank', url: 'https://data.worldbank.org/indicator/' + code + '?locations=IN', category: 'Statistics' });
    }
  }
}
if (new Set(qrels.map(q => q.id)).size !== qrels.length) throw new Error('Nonunique judgment IDs');
for (const q of qrels) if (!q.relevant.every(id => knownIds.has(id))) throw new Error('Dangling judgment ' + q.id);
function save(name, data) {
  const target = join(dataDir, name + '.json');
  const tmp = target + '.' + process.pid + '.partial';
  writeFileSync(tmp, JSON.stringify(data) + '\n');
  renameSync(tmp, target);
}
save('corpus', docs);
save('sources', sources);
save('upstream-qrels', qrels);
console.log(JSON.stringify({ records: docs.length, judgments: qrels.length, bytes: Buffer.byteLength(JSON.stringify(docs)), sources: Object.fromEntries(sources.map(s => [s.name, docs.filter(d => d.source === s.name).length])), verifiedInputs: inputs.length }));
