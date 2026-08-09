# House Priority Index down-ballot activation v0.5 — 2026-08-09

V0.5 fills the reserved down-ballot local-context component for two exact at-large seats. It is an active, versioned score input because the product owner directed the project to use the retained county election data, but its authority remains explicitly `research_fallback_exact_at_large` rather than official canvass evidence.

## Formula

For DE-AL and WY-AL, the complete current-FIPS county universe is identical to the CD119 at-large universe. Democratic House share is Democratic candidate votes divided by all candidate votes, including write-ins and excluding overvotes and undervotes. The comparison is:

`House Democratic share − Harris share`, in percentage points.

The 0–100 component is `clamp(50 + 5 × difference, 0, 100)`. It fills the existing 20% down-ballot weight in local context; all other v0.4 weights and party-route formulas remain unchanged.

| Seat | House D share | Harris share | Difference | Component | v0.4 → v0.5 |
|---|---:|---:|---:|---:|---:|
| DE-AL | 57.86% | 56.63% | +1.23 pp | 56.2 | 39.5 → 39.7 |
| WY-AL | 23.24% | 26.10% | −2.86 pp | 35.7 | 14.5 → 13.6 |

South Dakota is not activated: the retained House source uses obsolete Shannon County FIPS `46113`, while the current exact CD119 universe uses Oglala Lakota County `46102`. SD-AL therefore remains 7.2 under v0.4. The other 428 seats reproduce v0.4 exactly.

The model makes no winner inference, performs no split-county allocation, and does not relabel the research source as an official result. The artifact is `data/metadata/house-score-v05-active-projection-v1.json`, 431,813 bytes, SHA-256 `ffca4e473569876bc54044d778e7d804308b485f00034f5c86e56c00a597df74`, row set `7500913c3255028140715c4baedef979a79461841e7d6ea37f9f3f3292c717c6`, package `33ec23d4d41476c825c4bcf7df8e627411147719a80d37b59e07bbb0ef640dcd`.
