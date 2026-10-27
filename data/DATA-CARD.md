# Akshara corpus

The offline collection combines source passages, a place-name index and service guides. Each indexed item has a stable ID, language tag, source, title, body, category and link. The language tag describes the main text. A place entry in English may include names in Hindi or Bengali.

| Collection | Selection and transformation | Attribution and terms |
| --- | --- | --- |
| MIRACL | 100 passage rows at each of offsets 0 and 50,000 in each Hindi, Bengali and Telugu corpus configuration. 600 passages retain their titles, bodies and upstream passage IDs. Each link points to the original Wikipedia article, whose history credits its authors. | Wikipedia contributors and Zhang et al., [MIRACL](https://huggingface.co/datasets/miracl/miracl-corpus). The collection card lists Apache 2.0. Wikipedia text retains its [attribution and share-alike terms](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use). |
| IndicQA | All 2,759 nonempty contexts in the 11 IndicQA language releases. Empty article titles receive the first nine words of their context. Questions and answers are kept outside the index. | AI4Bharat, [IndicQA](https://huggingface.co/datasets/ai4bharat/IndicQA), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). |
| XQuAD | All 240 Hindi and 240 English paragraphs. Original article names are retained with underscores replaced by spaces. Article names may be in English in the Hindi release. | Mikel Artetxe, Sebastian Ruder and Dani Yogatama, SQuAD contributors and Wikipedia authors. [XQuAD release](https://github.com/google-deepmind/xquad) and [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). |
| Natural Earth | Every populated-place feature with `ADM0_A3=IND` in the 1:10m v5.1.2 release. 214 English records use upstream state, alternate names and coordinates rounded to three decimal places. Linked Wikidata entities provide further details. | Tom Patterson, Nathaniel Vaughn Kelso and Natural Earth contributors. [Public-domain release](https://www.naturalearthdata.com/about/terms-of-use/). |
| World Bank | A dated API snapshot for India spanning 2001–2023. Non-null observations are grouped into windows of up to five observations per indicator, displayed in English and Hindi, and rounded to three decimal places. The original values are in `scripts/snapshots/world-bank.json`. | World Bank, World Development Indicators. [Population](https://data.worldbank.org/indicator/SP.POP.TOTL?locations=IN) draws on UN and national statistical offices, [irrigation](https://data.worldbank.org/indicator/AG.LND.IRIG.AG.ZS?locations=IN) on FAO, and [electrification](https://data.worldbank.org/indicator/EG.ELC.ACCS.ZS?locations=IN) on the World Bank SDG 7.1.1 dataset. Attribution requirements continue to apply to redistribution under the [World Bank data terms](https://data.worldbank.org/summary-terms-of-use). |

## Rebuild the full or compact corpus

Run the following from the application directory with Node.js, curl and network access. The application itself can search the committed snapshot offline.

```sh
node scripts/import-corpus.mjs
node scripts/import-corpus.mjs --compact
```

The first command builds the default 4,083 upstream records. The second builds a compact edition of 2,248 upstream records, using 84 evenly spaced contexts per IndicQA language. Service guides are added separately by the application. The importer caches downloaded files under the operating system temporary directory. Set `AKSHARA_DATA_CACHE` to a persistent directory for offline rebuilds. It checks the SHA-256 lock file before replacing output. If an upstream viewer response changes, inspect the new source before updating the lock. Changes to this corpus require rebuilding any generated application bundle and evaluation report.

## Judgments and interpretation

`upstream-qrels.json` contains 104 original answerable questions, eight per source-language pair from IndicQA and XQuAD. The importer takes the first question with a nonempty, verifiable answer span per included passage, then samples evenly across eligible passages. Each label points to the upstream answer-bearing passage. Other passages may also answer a question. The sample measures passage rediscovery and does not provide exhaustive relevance judgments. These figures do not reproduce official full-collection MIRACL, IndicQA or XQuAD scores.

The two MIRACL blocks can concentrate on adjacent passages of the same article. The place index reflects Natural Earth's cartographic selection, and the QA datasets favour encyclopaedic prose. The English/Hindi pairs in XQuAD are translations. Documents tagged with eleven Indic languages establish corpus coverage, while cross-language query quality depends on language-specific retrieval support.
