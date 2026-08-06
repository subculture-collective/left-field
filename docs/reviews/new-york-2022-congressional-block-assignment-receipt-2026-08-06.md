# New York 2022 congressional block-assignment receipt

## Outcome

This reviewer-only receipt retains the New York State Legislative Task Force on Demographic Research and Reapportionment (LATFOR) 2022 congressional map index and its June 2, 2022 corrected district block-assignment DBF. The official index labels the file as the 2022 congressional district block assignments and says it was updated in June 2022 for court-ordered technical corrections.

The DBF contains exactly 288,819 unique 15-digit 2020 Census tabulation-block GEOIDs assigned to all 26 numbered New York congressional districts. Its two fields are `BLOCK` (character, 15) and `DISTRICTID` (numeric, 8). No duplicate, malformed, deleted, or out-of-inventory record is accepted.

As an independent grain and assignment check, the receipt also retains the Census Bureau's CD118 national Block Equivalency File bundle and its `36_NY_CD118.txt` member. All 288,819 LATFOR block GEOIDs and district assignments agree exactly with the Census New York CD118 representation: zero missing blocks and zero district-assignment differences.

That concordance establishes the assignment inventory, not legal effect or election use. The receipt makes zero continuity, election, identity, nomination, result, approval, scoring, publication, or deployment conclusions. Block counts are explicitly not population, voter, partisan, or electoral weights.

## Source and integrity closure

| Retained input | Bytes | SHA-256 |
|---|---:|---|
| LATFOR 2022 congressional map index | 7,681 | `a36754eead5ee7b3bc6263fa0b47ebd8867de035c46a6b385467dc5c5bf8aa92` |
| LATFOR corrected block-assignment DBF | 6,931,754 | `460c38cf2cbbc07172782a2f508e6ad80a96a00dd4d57e5c22f6af011d42f3e6` |
| Census CD118 national BEF bundle | 25,922,515 | `a2f38d0dd7c207fa144a88b66df9f59f8a6e5c27e932fbd4a32d1bcf587c5763` |
| Census `36_NY_CD118.txt` extract | 5,776,393 | `359d8ec177dacf6511baf68c734a999ca9ff21ec4ef9897b85213838ed5c218a` |

The generated receipt is 11,669 bytes with file SHA-256 `dd0d8f450b632ce1e043dfc6b861e22de957e30cf9f2e8cc9eb438f018befbc9`, package SHA-256 `dc58cc56e0f1feb6424aafcf2e08f3433bb6559ad0dc432d32506f3d631878a8`, and district-set SHA-256 `9d5390b9df04bae0b065492424fac673a74624e927b36f5a1534c6817b4a9443`.

The exact public source URLs are retained in the source lock. No explicit reuse license was identified next to the LATFOR download, so the repository records governmental provenance and public availability without asserting a license grant; any publication policy relying on redistribution remains a separate review matter.

## Reproduction

```bash
npm run fetch:ny-2022-primary-block-authority
npm run fetch:ny-cd118-bef
npm run generate:ny-2022-block-assignment-receipt
npx vitest run src/ingestion/elections/new-york-2022-congressional-block-assignment-receipt.test.ts
npm run data:verify
```
