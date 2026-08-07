# Colorado primary geography authority source receipt

Date: 2026-08-06
Status: official source retained; no compatibility relationship approved or published

The repository now retains the official Census TIGER 2022 Colorado CD118 archive from `https://www2.census.gov/geo/tiger/TIGER2022/CD/tl_2022_08_cd118.zip`.

- Retained path: `data/source/tiger2022/tl_2022_08_cd118.zip`
- Byte size: 1,092,324
- SHA-256: `af2ead367f9a4e11b0d2cd8a8a3035c3a3437e6d3b178470f5f013020438494b`
- DBF SHA-256: `0f796544799d90ca1f89a7f1c04558572399dbd107395e33d1b49b4b674d0d19`

The seven-member archive inventory is exact. Its DBF contains eight active Colorado district rows with state FIPS `08`, session `118`, district codes `01` through `08`, and matching GEOIDs `0801` through `0808`. No at-large or special district row is present.

The already-retained official CD119 Colorado archive likewise contains eight numbered district rows. The Census CD119 plan-change page does not identify Colorado among the five states that redrew congressional plans for the 119th Congress. Together, those sources can support bounded 2022 CD118-to-CD119 continuity candidates and 2024 exact-CD119 key candidates; they do not establish raw geometry equality, overlap, population equivalence, identity, winner, or approval.

No CD120 source or exact 2026-to-CD119 compatibility authority is retained by this receipt. The completed 2026 primary rows must therefore remain geography-pending unless separately grounded.

```bash
npm run fetch:co-primary-geography-authority
npm run test:run -- scripts/fetch-colorado-primary-geography-authority.test.ts
npm run data:verify
```
