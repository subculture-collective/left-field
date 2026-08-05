# Oregon primary official-abstract source receipt

Status: **exact official source acquisition; no parsed contest package, identity review, evaluator value, publication, or deployment**

The Oregon Secretary of State records archive now supplies the retired 2022 and 2024 primary-result documents plus the 2026 official abstract through durable record-viewer IDs. This source receipt retains the exact PDF payload embedded by each official viewer and a deterministic `pdftotext -layout` 26.07.0 extract.

| Cycle | Election | Official archive record | PDF pages | PDF SHA-256 |
| --- | --- | --- | ---: | --- |
| 2022 | May 17, 2022 primary | `uri=13735452` | 59 | `dd885013df98d584488091ffdf69d359a3a7fe494f037276fcda60f03e15beca` |
| 2024 | May 21, 2024 primary | `uri=13735456` | 67 | `a3d68250380c4b49fbd8a7a98548822c0c0ad870cd61b90aa98b737f259c876d` |
| 2026 | May 19, 2026 primary | `uri=16180585` | 63 | `19e936d34a664062ef0cbb89b273d87ddf3f9b3e5b994c091bf4919428d2ae3e` |

Each document calls itself a `Primary Election Abstract of Votes`, covers the statewide county-by-candidate results, includes all six U.S. House districts, and prints the legend `* Nominee`. Democratic and Republican sections remain distinct. `Misc.` is an aggregate source channel, not a named candidate or zero.

The archive's form-backed download response appends session-dependent HTML after the stable PDF EOF despite using an `application/pdf` response type. The importer therefore extracts the viewer's single base64 PDF payload and pins the exact PDF bytes, avoiding both the HTML tail and false raw-response hash drift. Three repeated 2026 acquisitions reproduced the retained PDF hash. The human-readable text is a derived convenience artifact and does not replace the PDF.

The former public result URLs for 2022 and 2024 return official-site 404 pages. That is URL retirement, not source unavailability: the official archive records above are retained. The next package must parse exactly six Democratic House contests per cycle, preserve nominee markers as direct source facts, reconcile every named-candidate and `Misc.` total, and remain identity/geography/reviewer gated.

```sh
npm run import:or-primary-abstracts
npm run data:verify
```

No source row is yet selected, scored, approved, published, or displayed by this acquisition-only receipt.
