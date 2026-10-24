# Akshara · Indic Search Lab

Akshara is an independent, from-scratch multilingual information retrieval project. Search the bundled collection using native-script terms, Roman Hindi, mixed-script phrases and English. Inspect the evidence for each hit, compare ranking models and reproduce the evaluation offline.

## Start

Install Node.js 22 or newer. From this directory run:

```sh
node server.mjs
```

Open **http://127.0.0.1:4173**. The app needs no package install, API keys, remote model, or dataset download. To use another port, set the environment variable `PORT` before starting the server.

## A three-minute demonstration

1. Search **kal ka mausam**, then **कल का मौसम**, then **weather tomorrow**. Compare their first five results. Open **Inspect query analysis** to see the raw tokens, stems, Roman forms, concept mappings, document frequency and Hindi IDF. Open **Why this matched** to inspect each hit.
2. Search **chandrayan** or **छात्रवृत्ति application**. Filter by document language, switch between hybrid retrieval, BM25 and cross-lingual TF–IDF, then toggle stemming or stop-word removal.
3. Open **Corpus** and browse a collection. Each record links to its originating source or dataset. Natural Earth place records include coordinates and available multilingual names. Historical World Bank observations include a year and a series identifier.
4. Open **Retrieval lab**. Compare two ranked lists for the same query or enter a variant in a different script. Inspect their top-five overlap and trace which passages entered, left or changed position. **View benchmark** opens a measured report with six model configurations and language-specific slices. The report download contains unrounded metrics.

## Corpus and evidence

The default snapshot combines 600 MIRACL passages, all 2,759 IndicQA contexts, 480 XQuAD paragraphs, 214 Natural Earth place records, 30 bilingual World Bank observations and 16 original bilingual navigation guides to eight public resources. These 4,099 records cover English and eleven Indic languages. Native-script lexical search covers the indexed languages. Hindi–English and Roman Hindi receive the most extensive cross-script treatment. The service guides describe where to find current information, including weather and railway services.

The [data card](data/DATA-CARD.md) records sampling, licenses, provenance and the rebuild workflow. Run `node scripts/import-corpus.mjs` for the full default edition or add `--compact` to use 84 contexts per IndicQA language. After any corpus change, regenerate the benchmark, rebuild the package and restart the local server.

## Research design

The inverted index combines title-weighted BM25, sparse cosine scoring, shared bilingual concepts and conservative phonetic expansion. Context disambiguates Roman Hindi **kal** in weather expressions. Fully mapped multi-concept queries share a ranking route. Partly mapped queries retain lexical evidence. Inspect the [retrieval methodology](RETRIEVAL.md) for the exact scoring rules and limitations.

Three complementary evaluations separate curated navigation from passage retrieval. The first uses 25 authored variants in eight families. The second uses 104 upstream questions with known answer-bearing passages. The third uses 16 Hindi–English searches aligned through XQuAD question IDs, with results restricted to the opposite language. Measures include precision, recall, nDCG, reciprocal rank and within-family Jaccard overlap at five. Additional relevant passages can be unjudged. The small cross-language set and the deliberate coverage of guide vocabulary limit generalisation.

```sh
node --test
node scripts/benchmark.mjs
node scripts/refresh-report.mjs
node scripts/build.mjs
```

The refresh command saves the measured report in `data/report.json`. The build generates a self-contained server Worker in `dist/server/index.js`, with the indexed texts compressed for delivery. Both server entry points use the same retrieval implementation.

## HTTP API

| GET endpoint | Purpose |
| --- | --- |
| `/api/health` | Status and loaded record count |
| `/api/meta` | Counts by language, category and source, plus source terms |
| `/api/search?q=kal+ka+mausam` | Ranked passages and per-token analysis |
| `/api/browse?source=MIRACL&lang=hi` | Paginated records from a source or language |
| `/api/evaluation` | Precomputed benchmark rows for this corpus |

Search accepts `mode=hybrid|bm25|vector`, `stemming=true|false`, `stopwords=true|false`, `lang`, `source`, `offset` and `limit` (1–50). The corpus stays in server memory. The browser receives only the requested results and metadata.

## Project map

- `public/` contains the responsive interface and original script-weave canvas.
- `lib/language.mjs`, `lib/engine.mjs` and `lib/evaluation.mjs` implement token processing, ranking and evaluation.
- `lib/api.mjs` and `server.mjs` provide the HTTP backend.
- `data/` holds the corpus, source registry, evaluation judgments, measured report and provenance notes.
- `scripts/` contains ingestion, evaluation and build tools.
- `tests/` checks ranking, cross-script behaviour, API contracts and evaluation formulas.


## Query attribution and passage relay

In Retrieval lab, **Explain first place** evaluates every token-position subset of a query (maximum five tokens). Its Shapley values allocate the original winner’s reciprocal rank at ten, using zero for absence. This explains sensitivity to tokens in this particular index. The values sum to one for a matched full query.

**Trace passages** searches directly in the target language and also retrieves ten source-language XQuAD anchors. Their translated counterparts compete with twenty direct hits through reciprocal rank fusion with constant 60. Each result exposes its rank on each route and its source passage where available. All 240 Hindi–English passage positions in the pinned release were verified against shared upstream question IDs. This route covers the parallel XQuAD collection. The existing hybrid benchmark measures the original ranker independently of this experiment.

Both experiments accept GET requests at `/api/attribution?q=kal+ka+mausam` and `/api/relay?q=American+football&lang=hi`.

## Reconstructed corpus history

This repository contains 100 explicitly backdated reconstruction commits across 28 active days from 24 October through 22 November 2026. These batches reconstruct the published software and data. Their timestamps are illustrative and do not represent the original development schedule.
