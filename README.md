# Akshara · Indic Search Lab

Akshara is an independent, from-scratch multilingual information retrieval project. Search a bundled collection using native-script terms, Roman Hindi, mixed-script phrases and English; inspect why each result matched; compare ranking models; and reproduce the evaluation offline.

## Quick start

Requires Node.js 22+. No package install, API keys, remote models or dataset downloads.

```sh
node server.mjs
```

Open **http://127.0.0.1:4173** (set `PORT` to change it).

## Features

- **Cross-script search**: `kal ka mausam`, `कल का मौसम` and `weather tomorrow` all reach the same results. Roman Hindi *kal* is disambiguated by context.
- **Transparent ranking**: inspect query analysis (tokens, stems, Roman forms, concept mappings, IDF) and a per-hit "Why this matched".
- **Switchable models**: hybrid, BM25 or cross-lingual TF–IDF, with stemming and stop-word toggles and language/source filters.
- **Corpus browser**: every record links back to its source or dataset.
- **Retrieval lab**: compare ranked lists, check top-5 overlap, view the benchmark report (six configurations, per-language slices), explain first place with Shapley token attribution, and trace passages across languages via reciprocal rank fusion.

## Corpus

4,099 records covering English and eleven Indic languages:

| Source | Records |
| --- | --- |
| MIRACL passages | 600 |
| IndicQA contexts | 2,759 |
| XQuAD paragraphs | 480 |
| Natural Earth places | 214 |
| World Bank observations (bilingual) | 30 |
| Original bilingual navigation guides | 16 |

Sampling, licences and provenance are in [`data/DATA-CARD.md`](data/DATA-CARD.md). Rebuild with `node scripts/import-corpus.mjs` (add `--compact` for 84 IndicQA contexts per language). After any corpus change, regenerate the benchmark, rebuild and restart.

## How it works

An inverted index combines title-weighted BM25, sparse cosine scoring, shared bilingual concepts and conservative phonetic expansion. Fully mapped queries share a ranking route; partly mapped queries keep lexical evidence. Details and limitations: [`RETRIEVAL.md`](RETRIEVAL.md).

## Evaluation

Three complementary sets: 25 authored query variants (8 families), 104 upstream questions with known answer passages, and 16 Hindi–English searches aligned via XQuAD question IDs. Metrics: precision, recall, nDCG, reciprocal rank and within-family Jaccard@5. The small cross-language set and deliberate guide-vocabulary coverage limit generalisation.

```sh
node --test                      # tests
node scripts/benchmark.mjs       # run benchmark
node scripts/refresh-report.mjs  # save data/report.json
node scripts/build.mjs           # build dist/server/index.js (Worker)
```

## HTTP API

| Endpoint | Purpose |
| --- | --- |
| `/api/health` | Status and record count |
| `/api/meta` | Counts by language, category, source; source terms |
| `/api/search?q=kal+ka+mausam` | Ranked passages and token analysis |
| `/api/browse?source=MIRACL&lang=hi` | Paginated records |
| `/api/evaluation` | Precomputed benchmark rows |
| `/api/attribution?q=kal+ka+mausam` | Shapley token attribution |
| `/api/relay?q=American+football&lang=hi` | Cross-language passage relay |

Search options: `mode=hybrid|bm25|vector`, `stemming`, `stopwords`, `lang`, `source`, `offset`, `limit` (1–50).

## Project layout

- `public/` – responsive UI and script-weave canvas
- `lib/` – `language.mjs`, `engine.mjs`, `evaluation.mjs`, `api.mjs`
- `server.mjs` – HTTP backend
- `data/` – corpus, source registry, judgments, report, provenance
- `scripts/` – ingestion, evaluation, build
- `tests/` – ranking, cross-script, API and metric tests
