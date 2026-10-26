# Retrieval and evaluation

Akshara indexes titles and passage text. The title contributes three term occurrences for each visible occurrence. Unicode compatibility normalization, Hindi nukta folding and join-control removal precede tokenization. Indic vowel signs remain part of their words. The optional Devanagari light stemmer handles selected plural and verbal endings. Other scripts retain their surface forms.

## Rankers

| Ranker | Evidence used |
| --- | --- |
| BM25 | Lexical postings, with document-length normalization, k₁ = 1.3 and b = 0.75 |
| Cross-lingual TF–IDF | Cosine similarity over the concatenated word and shared-concept vectors. Term weight is (1 + ln tf) × (1 + ln((N + 1)/(df + 1))). A concept receives the same dimension across languages. |
| Hybrid | Word BM25 + 1.6 × concept BM25 + 0.35 × phonetic BM25 + cosine. Phonetic contributions decay with spelling distance. |

The bilingual weather phrases illustrate a special case. When every retained query term maps to the lexicon and the query supplies at least two distinct concepts, hybrid scores entirely in the shared space. Consequently, the English, Hindi and Roman Hindi weather queries return the same ordered results. Queries with an unknown term retain lexical and phonetic evidence. A consonant signature retrieves potential phonetic variants after approximate transliteration. Edit distance filters candidates and large, ambiguous signature buckets are discarded.

The search response exposes the indexed stem, phonetic transliteration, concept mapping, document frequency and IDF for each query token. The Hindi-only frequency and IDF use original normalized words across Hindi titles and passages, including stop words. This allows direct inspection of words such as **का** even when the ranker drops them. Corpus-level IDF uses the selected processing configuration. Source and language filters restrict candidate documents while retaining corpus-wide ranking statistics.

## Experiments

Run `node scripts/benchmark.mjs` from the project directory. Add `--json` for machine-readable results. The bundled report records all six configurations on every suite and gives per-language slices of the upstream questions.

| Suite | Construction | Interpretation |
| --- | --- | --- |
| Service navigation | 25 editorial queries across eight intents. Each family targets the English and Hindi version of its guide. | Measures delivery of these guides and sensitivity to spelling and script. The lexicon covers these topics. |
| Upstream pooled | 104 IndicQA and XQuAD questions with a verified source answer span in the indexed passage. | Measures retrieval of a known answer-bearing passage across all indexed documents. Other relevant passages can be unjudged. |
| XQuAD cross-language | Eight aligned question IDs, each searched in both directions. Only passages in the opposite language compete, and the paired answer passage is the known positive. | Measures retrieval across Hindi and English on 16 searches. Primary source data, numeric cues and shared named entities can all affect scores. |

All metrics use k = 5. Precision divides hits by five even when fewer passages return. Recall divides hits by the number of indexed known positives. nDCG discounts each relevant hit by its rank and normalizes by the ideal ordering. MRR uses the reciprocal rank of the first hit through rank five. Variant stability averages top-five Jaccard overlap across within-family query pairs, including pairs with no shared results. An empty pair scores zero. The external suites have no spelling-variant family labels.

## Limits

The corpus is a bounded reproducible sample. The finite translation lexicon and approximate Brahmic transliterator offer uneven coverage across topics and scripts. Dictionary sharing can conflate meanings, particularly for short or ambiguous queries. The system fetches no live weather or account data. The test collection has incomplete relevance labels and only eight paired XQuAD intents. The small measured differences on pooled questions need a larger held-out collection and human judgments before supporting claims about general web search.
