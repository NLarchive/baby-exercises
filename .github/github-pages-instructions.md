# Publish Lifespan Activity Journal on GitHub Pages

## Review outcome

This is a static HTML/CSS/JavaScript application with no npm dependencies. It needs HTTP hosting, not a server backend or an npm installation. Node.js 24 runs validation and publication tools in Actions. The deploy workflow validates before uploading `.publication/site`; it never uploads the entire working directory. Runtime asset URLs are relative, allowing a project URL such as `https://OWNER.github.io/baby-exercices/`.

Publication uses 172 activity WebP files and five shared WebP images. PNG originals and archives are excluded. The asset audit requires WebP files and checks optional PNG companions only when present. The license is AGPL-3.0-only, copyright 2026 Nicolas Ivan Larenas Bustamante.

## Keep PNG history local

Git pushes reachable committed history. `.gitignore` only prevents new untracked files from being added; it cannot hide tracked files or earlier commits from GitHub. This working repository already has PNGs in its history. Removing them from the latest commit is insufficient to prevent their upload.

To retain local PNG tracking, keep this working repository private and publish a separate repository with fresh history. Do not add a GitHub remote here and push the existing branches. No history rewrite or index changes are needed here.

1. In the working repository, run:

   ```powershell
   npm run check
   npm run check:assets -- --strict
   npm run export:github
   ```

2. Review `.publication/github`. It contains the full public project source, tests, tools, documentation and workflows, with WebP images only. It has no `.git` directory, PNGs, private journal exports, audit output, or archive files.
3. Move that folder to a permanent location outside this working repository. Initialize a new repository there with `git init -b main`, review `git status`, then use `git add .` and `git commit -m "Initial public release"`.
4. Create an empty GitHub repository. Add its URL as `origin` in the new public repository and push `main`. Do not connect or push the private repository's history. For later releases, regenerate an export, review and copy changed files into the permanent public checkout, remove obsolete public files explicitly, then commit and push there.

The ignore pattern matches PNG extensions regardless of letter case. It leaves already tracked local PNGs tracked. Public-clone contributors can use normal branches and pull requests.

## Enable Pages

1. In the GitHub repository, open **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
2. Ensure Actions is enabled and the `github-pages` environment permits deployments from `main`.
3. Push to `main` or manually run **Deploy to GitHub Pages** from the Actions tab on `main`.
4. Wait for both `build` and `deploy` to succeed. Open the URL shown by the deployment.

The validation workflow checks pushes and pull requests with read-only permissions. Deployment grants `pages: write` and `id-token: write` only to the deployment job. There is no `npm ci`, npm cache or Playwright requirement because there is no lockfile or Playwright setup in this project. If dependencies are introduced later, commit a lockfile and update these workflows.

Official reference: [Using custom workflows with GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Preview and verify

From a fresh public export or clone:

```powershell
npm run check
npm run check:assets -- --strict
npm run build:pages
python -m http.server 8000 --directory .publication
```

Open `http://localhost:8000/site/`. This tests a subpath, like a GitHub project site. Check all eight stages, image loading, source links, age controls, routine tabs, and keyboard/mobile layouts. Create a sample journal, refresh, export and import it. Use test data only. Browser records belong to their origin: localhost data does not automatically transfer to GitHub Pages. Export/import a backup when moving origins.

Publication commands refuse to overwrite an existing output folder. To regenerate after review, move the old `.publication/site` or `.publication/github` folder out of the way, then rerun the command. The generated site includes source, license, and documentation; the public export includes development tooling as well.

## Remaining checks on GitHub

Repository creation, authentication, remote URL, Pages settings, environment rules, and the live deployment must be verified in your GitHub account. Local checks cannot confirm those settings. Node integration tests use a minimal DOM; passing them does not establish real-browser visual correctness. Historical review manifests absent from this checkout remain unverified, as described in README.md.
