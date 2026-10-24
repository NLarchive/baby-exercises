# Artwork organization

The active catalog contains 172 WebP activity illustrations and five shared WebP decorative images. The catalog's imageUrl always selects WebP. PNG originals are optional local companions and are excluded from publication. When moving locally maintained artwork, keep any original with its WebP companion.

## Active stage folders

| Folder | Activities | Catalog |
| --- | ---: | --- |
| infancy/early/ | 13 | exercises_infancy_early.json |
| infancy/middle/ | 17 | exercises_infancy_middle.json |
| infancy/late/ | 13 | exercises_infancy_late.json |
| toddlerhood/ | 30 | exercises_toddlerhood.json |
| childhood/early/ | 14 | exercises_childhood_early.json |
| childhood/middle/ | 17 | exercises_childhood_middle.json |
| adolescence/early/ | 10 | exercises_adolescence_early.json |
| adolescence/middle/ | 9 | exercises_adolescence_middle.json |
| adolescence/late/ | 10 | exercises_adolescence_late.json |
| adulthood/early/ | 13 | exercises_adulthood_early.json |
| adulthood/middle/ | 13 | exercises_adulthood_middle.json |
| adulthood/late/ | 13 | exercises_adulthood_late.json |

Toddlerhood is one catalog with no early/middle/late stagePart. Its images live directly in toddlerhood/, including activities with retained LS-ECH IDs. Infancy and adolescence retain their three catalog parts. The former misspelled adolescence folder has been corrected.

## Naming and ownership

Use <id>-<stable-description>.png and the matching .webp filename. The ID is stable; editorial title changes do not require image renaming. Folder ownership follows the current lifespanStage, not the ID prefix or the activity's historical category. core.js provides stageAssetDirectory and stageFilenames so validation and tooling share those rules.

The consolidated infancy and adolescence files are compatibility snapshots. Their records must match their authoritative split files, including artwork paths. Journal backups refer to activity IDs, so asset relocation does not change saved history.

## Shared and archived assets

- journal-banner: decorative page banner.
- movement, learning, communication, connection: decorative domain illustrations.
- archive/optimized_assets_studio.zip: retained historical image package. It is not loaded by the app and may contain obsolete paths; current catalogs and files are authoritative.

## Verification

Run npm run check and npm run check:assets -- --strict. The audit checks stage folders, stable ID filenames, dimensions, PNG/WebP file signatures and companions, missing files and unassigned images in activity folders. Its generated report lives in .verification/asset-audit.md, excluded from Git, rather than cluttering assets/ with generated reports.

On October 23, 2026, 118 files were relocated: 60 toddler PNG/WebP files and 58 adolescence PNG/WebP files. SHA-256 comparisons confirmed unchanged file contents before and after every move. This verifies organization and byte preservation, not a new clinical or visual review. Historical generation/review manifests remain absent; the original claims about visual approval cannot be independently audited from this checkout.

Images illustrate activities. Written readiness, safety instructions and adaptations remain authoritative.

## Final prompts

### Banner

Use case: illustration-story. Asset type: a wide decorative banner for a lifespan activity journal website. Primary request: a calm editorial watercolor illustration of an open picture book, three large wooden stacking blocks, two overlapping speech bubbles and a small leafy plant arranged on a warm ivory tabletop. Style: elegant simple painted shapes, generous negative space, muted pine green, terracotta, ochre and lavender. No people, no medical symbols, no letters or text, no logos. This is decorative artwork, not an exercise technique diagram.

### movement

Use case: illustration-story. Asset type: reusable category illustration on a lifespan activity journal. A comfortable pair of walking shoes, a soft large ball, and a folded exercise mat. Pine green palette. Warm ivory background, gentle editorial watercolor, simple objects with generous space, wide horizontal composition. No people, no anatomy, no positioning demonstration, no words, no letters, no logo. Decorative theme illustration only, not an exercise instruction.

### learning

Use case: illustration-story. Asset type: reusable category illustration on a lifespan activity journal. Large wooden stacking blocks, a simple unbranded puzzle, and a leafy plant. Muted blue and ochre palette. Warm ivory background, gentle editorial watercolor, simple objects with generous space, wide horizontal composition. No people, no anatomy, no positioning demonstration, no words, no letters, no logo. Decorative theme illustration only, not an exercise instruction.

### communication

Use case: illustration-story. Asset type: reusable category illustration on a lifespan activity journal. An open picture book showing abstract shapes and two floating speech bubbles without writing. Ochre and sage palette. Warm ivory background, gentle editorial watercolor, simple objects with generous space, wide horizontal composition. No people, no anatomy, no positioning demonstration, no words, no letters, no logo. Decorative theme illustration only, not an exercise instruction.

### connection

Use case: illustration-story. Asset type: reusable category illustration on a lifespan activity journal. Two ceramic cups near each other on a table, with a leafy plant and a soft warm curved line linking the composition. Lavender and terracotta palette. Warm ivory background, gentle editorial watercolor, simple objects with generous space, wide horizontal composition. No people, no anatomy, no positioning demonstration, no words, no letters, no logo. Decorative theme illustration only, not an exercise instruction.

