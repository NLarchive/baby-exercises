# Contributing

Thank you for helping improve Lifespan Activity Journal.

## Development

Use Node.js 20 or newer (CI uses Node.js 24). No npm dependencies or build framework are required.

1. Fork the public repository and create a branch for your change.
2. Serve the project over HTTP, for example with `python -m http.server 8000`.
3. Make a focused change and run:

   ```sh
   npm run check
   npm run check:assets -- --strict
   npm run build:pages
   ```

4. Check the generated site on desktop and mobile, including keyboard navigation. Test a repository subpath such as `/baby-exercices/` when changing URLs.
5. Open a pull request explaining the problem, change, and verification. Include screenshots for visible changes and primary sources for catalog changes.

## Activity and source changes

Keep stable activity IDs and preserve journal backup compatibility. Update authoritative split catalogs and matching consolidated snapshots together. Maintain reciprocal graph links, stage folders, source IDs, readiness guidance, and accessible image descriptions. The schema is in `exercises/exercises.schema.json`; editorial requirements are in [SOURCES.md](SOURCES.md).

Age windows and practice sequences are editorial suggestions. Do not present them as validated developmental assessments or introduce unsupported clinical claims. Tests include dataset, source, image, graph, storage, and interface logic checks; the minimal DOM tests do not replace real-browser review.

## Artwork and local files

Publish WebP artwork only. Every activity's `imageUrl` must select its WebP file. PNG originals may be kept locally, but must not be added to the public repository. The audit accepts missing PNG companions and validates any that are present. Do not commit personal journal exports, generated publication folders, local audit reports, credentials, or archives.

The maintainer's private working repository can retain PNG history. Use `npm run export:github` there to create a separate public source tree without that history; see [.github/github-pages-instructions.md](.github/github-pages-instructions.md). Public-clone contributors should submit their normal branch and pull request.

## Issues

Report reproducible steps, expected and actual behavior, browser version, and relevant console errors. Remove personal journal details from examples. For catalog issues, include the activity ID and supporting source.

## License

Contributions are provided under GNU Affero General Public License version 3 only (`AGPL-3.0-only`), the project's existing license. Submit only material you have the right to contribute and preserve applicable notices. No copyright assignment is required.
