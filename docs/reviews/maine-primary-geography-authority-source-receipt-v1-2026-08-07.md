# Maine primary geography authority source receipt v1 — 2026-08-07

## Outcome

This reviewer-only receipt retains the official Maine plan-law and current-statute evidence needed to evaluate the 2022, 2024, and 2026 congressional-primary geographies. It also closes a complete official Census block-assignment comparison for Maine: CD118 and CD119 each contain the same 47,138 unique blocks, assigned identically to district 01 (15,307 blocks) and district 02 (31,831 blocks).

The six district-cycle authority rows are candidates, not approvals:

- 2022 ME-01/02: enacted-plan plus identical complete CD118/CD119 assignment candidates.
- 2024 ME-01/02: same-CD119-session assignment candidates.
- 2026 ME-01/02: current state-law plan-continuity candidates without a retained Census CD120 geometry or exact CD120 GEOID.

All six remain geography-unapproved, evaluator-null, score-ineligible, unpublished, and undeployed.

## Official authority

The retained LD 1739 status page records enactment and gubernatorial signature on September 29, 2021 as Public Law 2021, chapter 487. The retained chapter text states that the plan applies to U.S. House elections first occurring in 2022 “and thereafter.” Current 21-A MRSA §1205-A codifies Maine's two congressional districts; §1206 provides the 2021-and-every-ten-years reapportionment review cadence.

The chapter PDF is an official Legislature bill-system rendering but identifies itself as an unofficial generated copy. The receipt therefore binds the enacted/signed status page, chapter text, current codification, and cadence statute together rather than treating the PDF alone as unconditional authority.

The Census CD119 plan-change page names Alabama, Georgia, Louisiana, New York, and North Carolina as the five redraw states and does not name Maine. Maine's absence from that list supports the CD118/CD119 continuity evidence but is not a raw-geometry equality or CD120 claim. The official TIGER CD119 DBF independently closes exactly two Maine keys, `2301` and `2302`, in session 119.

## Evidence boundaries

- The exact CD118/CD119 comparison is a normalized Census block-to-district assignment comparison. It is not an assertion that raw TIGER geometries are byte- or coordinate-identical.
- The enacted plan text and retained Census assignment files have not been directly crosswalked to one another at block level, so `sourcePlanToCd119ExactBlockConcordanceAssessed` remains false.
- The 2026 rows are bounded state-law continuity candidates. No Census CD120 layer, exact CD120 historical GEOID, election-result conclusion, identity conclusion, or automatic compatibility approval is created.
- No threshold, population-equivalence rule, evaluator value, score, publication, or deployment state is introduced.

## Provenance and immutable pins

The receipt has exactly eleven ordered direct parents: five Maine law/status/statute nodes, the CD118 national bundle and Maine extract, the CD119 national bundle and Maine extract, the Census CD119 plan-change page, and Maine's TIGER CD119 archive.

- artifact bytes: `15743`
- file SHA-256: `2564507cdd32043f4f4c0b25fb5c94fc15daad1a05d23400c9e27ba6996e2a4f`
- package SHA-256: `e3407eaf10aca8dcb526a88524b1a1ed466a031fcdaf6b1b0d038b16824f23a2`
- cycle-disposition row-set SHA-256: `3b6560e9d785198c9c108b85341a9afa91a7dedb80ae65a87c2701b50ac6c0d7`

## Reproduction

```bash
npm run fetch:me-primary-geography-authority
npm run generate:me-primary-geography-authority-receipt-v1
npx vitest run src/ingestion/elections/maine-primary-geography-authority-source-receipt.test.ts
npm run typecheck
npm run data:verify
npm run lint
```

The acquisition and generator paths are create-only and accept existing outputs only when the bytes are identical.
