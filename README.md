# Lifespan activity journal

A local browser journal with 172 activities across eight life stages. Run an HTTP server in this directory, for example `python -m http.server 8000`, then open `http://localhost:8000`. No installation or build step is required for development.

## License and contributions

Copyright (C) 2026 Nicolas Ivan Larenas Bustamante. Licensed under the [GNU Affero General Public License version 3 only](LICENSE) (`AGPL-3.0-only`); see [NOTICE](NOTICE). External references retain their respective rights. See [CONTRIBUTING.md](CONTRIBUTING.md) to contribute.

## GitHub Pages and source code

Run `npm run build:pages` to prepare a WebP-only static site. Run `npm run export:github` in the private working repository to prepare a separate public source tree without PNGs or local Git history. These commands create new folders under `.publication/` and refuse to overwrite existing output. Full publishing and preview instructions are in [.github/github-pages-instructions.md](.github/github-pages-instructions.md).

The deployed application serves its readable source directly: [HTML](index.html), [application logic](app.js), [core logic](core.js), [calendar](calendar.js), [styles](style.css), [source registry](sources.json), and catalog files listed below. There are no compiled bundles or external runtime dependencies. The public repository export also includes tests, tooling, and deployment workflows.

## Completion and observations

- **Complete** opens the success criteria, readiness and safety requirements. Save to record the criteria text and date. An optional note and practice session are retained. Undo completion preserves practice and observation history.
- **Record observation** saves a required written note and date to the journal without claiming completion or unlocking prerequisites. Repeated observations remain separate entries.
- **Log practice** records time, optional minutes and a note without claiming success.
- **Suggested next exercises** selects unfinished exercises with satisfied prerequisites, ordered by sequence complexity and browsing age. When current-age options are complete, it previews the next available steps in the same stage. Advanced completion still requires readiness and success confirmation. Browsing age never changes automatically. When the stage is exhausted, the app says so; it does not invent exercises or automatically move an older adult into another life stage.
- **My routine** schedules explicitly selected exercises eligible at the browsing age. Advanced previews do not bypass the routine's age filter. Routine preferences control frequency and minutes.
- Search, domain and availability filters include a Completed view. The journal shows completions, observation notes and practice sessions separately. Activity balance includes confirmed completion counts.

## Catalog and relationships

The authoritative files are in `exercises/`, loaded through `stageFilenames` in `core.js`. Infancy and adolescence load three split files; the consolidated files below are matching compatibility snapshots:

| File | Stage | Count |
| --- | --- | --- |
| exercises_infancy.json | Infancy | 43 |
| exercises_toddlerhood.json | Toddlerhood | 30 |
| exercises_childhood_early.json | Early childhood | 14 |
| exercises_childhood_middle.json | Middle childhood | 17 |
| exercises_adolescence.json | Adolescence | 29 |
| exercises_adulthood_early.json | Early adulthood | 13 |
| exercises_adulthood_middle.json | Middle adulthood | 13 |
| exercises_adulthood_late.json | Later adulthood | 13 |

`exercises/exercises.schema.json` describes the record structure. `prerequisites` contains earlier exercise IDs in retained editorial practice sequences. Infant play has no mandatory completion prerequisites: `relatedActivities` provides optional ideas based on current readiness. `suggestedBefore` is the reciprocal list of next steps. `complexity` is editorial prerequisite depth, starting at 1; it is not a validated clinical difficulty rating or developmental score. Relationship validation checks IDs, reverse links, increasing complexity and cycles. Success snapshots that differ from current criteria do not count as current completions or unlock descendants.

Later-adulthood movement follows supported chair mobility, then balance, then dynamic gait. Unrelated activities are not prerequisites merely because they appear earlier in the catalog. Sources and existing exercise instructions remain source-informed editorial content, not clinically validated prescriptions. See `SOURCES.md` and `sources.json`.

Historical journal records retain their IDs. The optional version archive is absent from this checkout, so historical catalog snapshots cannot be verified.

## Artwork

All 172 activities have a unique local image. Image content is retained; paths follow the current stage folders. Only the 25 new activities receive new images, generated with the built-in image tool. Prompts and final paths are stored on each activity; the historical image job manifest is absent from this checkout. Artwork illustrates a scene and does not certify technique. Follow the written readiness and safety guidance.

## Data and recovery

Each profile keeps its own browsing ages, completions, observations, sessions and routine preferences. Export/import uses schema version 4 and localStorage key `human_lifespan_roadmap_state_v4`. Earlier v4 backups receive an empty completion list. Historical observations and legacy v3 completions are preserved as historical observations, without claiming satisfaction of current criteria. Old skipped IDs are retained only for backup compatibility and no longer hide activities.

Browser storage failure leaves records in memory and displays an export warning. Unreadable saved data is preserved for recovery. Import previews replacement and validates data before applying it. Reset affects only the current journal. Notes are local to the browser origin and are not encrypted.

## Verification

Run `npm run check` for syntax checks and the Node test suite. Tests cover dataset/source/image integrity, graph consistency, completion and observation saving, recommendations, storage/import behavior, and routine scheduling. App integration tests use a minimal DOM; they do not replace visual browser checks. CI runs the same command. Run `npm run check:assets -- --strict` to verify actual PNG/WebP formats, dimensions and missing files. The test script runs both Node test files directly, avoiding child-process restrictions in local sandboxes. No dependency install is required.


## Evidence review (2026-10-23)

The historical review report and per-record change manifest are absent from this checkout; their provenance claims cannot currently be independently verified. The catalog grew from 147 to 172 activities. Age windows, planning defaults and participation goals are editorial; the source-informed status does not imply clinical validation. Earlier completion snapshots remain stored but revised criteria need reconfirmation.


## Before and after activity links

All 25 added activities have directed graph connections. `preparationActivities` lists helpful earlier experiences and reciprocal `leadsTo` lists possible follow-on activities. These optional links appear on cards as “Helpful before” and “Can lead to”; they never require completion or change browsing ages. `prerequisites` / `suggestedBefore` continue to represent required practice-branch links. A starting activity can have no preparation, and a terminal activity can have no later exercise. The dataset fields contain the current activity mapping. Validation checks reference IDs, reciprocal arrows and cycles across both required and optional progression arrows.

## Infancy and toddlerhood

Infancy browses 0–12 months; toddlerhood browses 12–36 months; early-childhood browsing starts at three years. Activities starting before 12 months stay in infancy, including transition activities whose original windows extend beyond a year. Their written age windows, IDs and cross-stage links remain unchanged. Artwork is filed by its current stage. Activities formerly in early childhood that start before three years now belong to toddlerhood, with ages expressed in months. Broad transition activities retain their original windows, even when they extend beyond the browsing band. This is a browsing convention, not a clinical boundary. Older backups with an infancy browsing age of 12 months or more open in toddlerhood; older early-childhood browsing ages from two to under three years also migrate into toddlerhood. All journal entries and selections remain attached to their original IDs.

See [SOURCES.md](SOURCES.md) for the developmental evidence policy and source limits. Stage labels organize browsing; readiness follows observed abilities and the written activity guidance.

## Project organization

The root contains the browser entry point, scripts, styles and project documentation. exercises/ owns authoritative stage catalogs and the schema; assets/ owns stage artwork and shared illustrations; tests/ owns regression tests; tools/ owns the asset audit. .verification/ contains ignored local audit reports and working files. See [assets/ASSETS.md](assets/ASSETS.md) for the current folder/count table and image naming rules.

## Age labels and responsive controls

Cards and calendar timelines share the same age-range formatter. Month ranges starting at 24 months also show years; later adulthood displays as 65+ rather than treating the control's 120-year limit as a biological endpoint. Browsing ranges remain editorial suggestions, not clinical milestone windows. The historical age-range review report is absent from this checkout.

## Routine tabs

My routine contains activities you explicitly added for the current stage, removal controls and your seven-day plan. Saved activities that become ineligible remain visible but are not scheduled. View exercise opens the appropriate To do or Completed view in Explore.

Suggested displays a seven-day calendar balanced across movement, learning, communication and social-emotional activities. It chooses up to two activities per domain, prioritizing unfinished activities and valid completed preparation links. When a domain has fewer unfinished choices, suitable completed activities fill the remaining choices as clearly labeled repeat practice. Each day has at most one activity per domain, rotating the choices while respecting routine frequency settings and strenuous-activity recovery spacing. Both minimum and maximum browsing ages are enforced; skipped and prerequisite-blocked activities are excluded. A domain with no fitting activity stays open and is explained in the distribution summary. Existing custom selections can appear in the generated plan, but suggestions never change those selections automatically. Add to my routine is disabled for activities already added. The calendar updates after age, stage, profile and completion changes. These are editorial practice suggestions, not a developmental assessment.
