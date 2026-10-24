# GitHub Pages: create, publish, update

Copy and run each PowerShell cell in order. Each cell is complete. If a cell stops with an error, stop and fix it before continuing.

Repository: https://github.com/NLarchive/baby-exercises  
Website: https://nlarchive.github.io/baby-exercises/

The original folder D:\web\baby\baby-exercices keeps your local PNG history. These steps publish WebP-only source from .publication\github using a separate Git checkout at .publication\public-repo. GitHub Actions builds and deploys the website after each push to main. You do not upload .publication\site; it is only for local preview.

## 1. Sign in, create the public repository, and clone it

You already signed in as NLarchive. If you are no longer signed in, run gh auth login first. If the repository already exists, skip its create command and run the clone command.

~~~powershell
& {
    $ErrorActionPreference = 'Stop'
    gh auth status
    if ($LASTEXITCODE -ne 0) { throw 'Run gh auth login, then retry.' }

    gh repo create NLarchive/baby-exercises --public
    if ($LASTEXITCODE -ne 0) { throw 'If it already exists, skip creation and run clone below.' }

    $publicRepo = 'D:\web\baby\baby-exercices\.publication\public-repo'
    if (Test-Path -LiteralPath $publicRepo) { throw 'public-repo already exists; do not clone over it.' }
    git clone 'https://github.com/NLarchive/baby-exercises.git' $publicRepo
    if ($LASTEXITCODE -ne 0) { throw 'Clone failed; stop here.' }
}
~~~

## 2. Validate and prepare the WebP-only source

Run before every upload. The export command refreshes .publication\github.

~~~powershell
& {
    $ErrorActionPreference = 'Stop'
    Set-Location 'D:\web\baby\baby-exercices'
    npm run check
    if ($LASTEXITCODE -ne 0) { throw 'Tests failed; stop here.' }
    npm run check:assets -- --strict
    if ($LASTEXITCODE -ne 0) { throw 'Artwork check failed; stop here.' }
    npm run export:github
    if ($LASTEXITCODE -ne 0) { throw 'Public export failed; stop here.' }
}
~~~

## 3. Sync the export into the public checkout

Run before every upload. It checks the destination and preserves its Git history.

~~~powershell
& {
    $ErrorActionPreference = 'Stop'
    $exportPath = 'D:\web\baby\baby-exercices\.publication\github'
    $publicRepo = 'D:\web\baby\baby-exercices\.publication\public-repo'
    if (-not (Test-Path -LiteralPath (Join-Path $publicRepo '.git') -PathType Container)) { throw 'Public checkout missing; finish step 1.' }
    if (-not (Test-Path -LiteralPath (Join-Path $exportPath 'index.html'))) { throw 'Public export missing; finish step 2.' }
    if ((Resolve-Path -LiteralPath $publicRepo).Path -ne $publicRepo) { throw 'Unexpected checkout path.' }

    Set-Location $publicRepo
    $repoTop = git rev-parse --show-toplevel
    if ($LASTEXITCODE -ne 0 -or $repoTop.Replace('/','\') -ne $publicRepo) { throw 'Wrong Git folder; stop here.' }
    $originUrl = git remote get-url origin
    if ($LASTEXITCODE -ne 0 -or $originUrl -ne 'https://github.com/NLarchive/baby-exercises.git') { throw 'Unexpected GitHub remote.' }
    if (git status --porcelain) { throw 'Public checkout has uncommitted changes; review them first.' }

    git fetch origin
    if ($LASTEXITCODE -ne 0) { throw 'Fetch failed; stop here.' }
    $remoteMain = git ls-remote --heads origin main
    if ($LASTEXITCODE -gt 1) { throw 'Could not check the GitHub main branch.' }
    if ($remoteMain) {
        git pull --ff-only origin main
        if ($LASTEXITCODE -ne 0) { throw 'GitHub history diverged; stop and review it.' }
    }
    $historyFiles = git rev-list --objects --all
    if ($LASTEXITCODE -ne 0) { throw 'Could not check Git history.' }
    if ($historyFiles | Select-String -Pattern '(?i)\.png$') { throw 'PNG found in public Git history; stop before pushing.' }

    robocopy $exportPath $publicRepo /MIR /XD .git .publication .verification /R:1 /W:1 /NFL /NDL /NJH /NJS
    if ($LASTEXITCODE -ge 8) { throw 'Copy failed; stop here.' }
    if (Get-ChildItem -LiteralPath $publicRepo -Recurse -File | Where-Object { $_.Extension -match '^\.png$' }) { throw 'PNG found in public checkout; stop before pushing.' }

    git status --short
    git --no-pager diff --stat
}
~~~

Review the changes: index.html and .github/workflows/deploy.yml should be at the repository root, and the artwork should be WebP. There should be no PNGs.

## 4. Commit and push

Use this cell for the first upload and every update.

~~~powershell
& {
    $ErrorActionPreference = 'Stop'
    $publicRepo = 'D:\web\baby\baby-exercices\.publication\public-repo'
    if (-not (Test-Path -LiteralPath (Join-Path $publicRepo '.git') -PathType Container)) { throw 'Public checkout missing; finish step 1.' }
    Set-Location $publicRepo
    $repoTop = git rev-parse --show-toplevel
    if ($LASTEXITCODE -ne 0 -or $repoTop.Replace('/','\') -ne $publicRepo) { throw 'Wrong Git folder; nothing staged.' }

    git add --all
    if ($LASTEXITCODE -ne 0) { throw 'Git staging failed.' }
    git --no-pager diff --cached --stat
    git commit -m 'Publish website update'
    if ($LASTEXITCODE -ne 0) { throw 'Commit failed; stop here.' }
    git push -u origin main
    if ($LASTEXITCODE -ne 0) { throw 'Push failed; do not force-push.' }
}
~~~

If Git requests your name or email, set your real values in this checkout and retry this step:

~~~powershell
git -C 'D:\web\baby\baby-exercices\.publication\public-repo' config user.name 'Nicolas Ivan Larenas Bustamante'
git -C 'D:\web\baby\baby-exercices\.publication\public-repo' config user.email 'YOUR_VERIFIED_GITHUB_EMAIL'
~~~

Replace the email placeholder with an address you verified on GitHub before running the second command.

## 5. Enable Pages and start deployment

Once, open https://github.com/NLarchive/baby-exercises/settings/pages, choose **Build and deployment → Source → GitHub Actions**, and save. Ensure Actions is enabled.

Start a deployment for the current main commit. Pushes to main also start deployment automatically.

~~~powershell
& {
    $ErrorActionPreference = 'Stop'
    gh workflow run deploy.yml --repo NLarchive/baby-exercises --ref main
    if ($LASTEXITCODE -ne 0) { throw 'Could not start deployment; confirm Pages uses GitHub Actions.' }
}
~~~

## 6. Wait for deployment and test the live page and image

~~~powershell
& {
    $ErrorActionPreference = 'Stop'
    $runId = gh run list --repo NLarchive/baby-exercises --workflow deploy.yml --branch main --limit 1 --json databaseId --jq '.[0].databaseId'
    if ($LASTEXITCODE -ne 0 -or -not $runId) { throw 'No deployment run yet; wait briefly and retry.' }
    gh run watch $runId --repo NLarchive/baby-exercises --exit-status
    if ($LASTEXITCODE -ne 0) { throw "Deployment failed. Inspect with: gh run view $runId --repo NLarchive/baby-exercises --log-failed" }

    $siteUrl = 'https://nlarchive.github.io/baby-exercises/'
    $page = Invoke-WebRequest -UseBasicParsing -Uri $siteUrl
    if ($page.StatusCode -ne 200 -or $page.Content -notmatch 'Lifespan') { throw 'Live page check failed.' }

    $catalog = Get-Content 'D:\web\baby\baby-exercices\.publication\github\exercises\exercises_infancy_early.json' -Raw | ConvertFrom-Json
    $imageUrl = $siteUrl + $catalog[0].imageUrl
    $image = Invoke-WebRequest -UseBasicParsing -Uri $imageUrl
    if ($image.StatusCode -ne 200 -or $image.Headers['Content-Type'] -notmatch 'image/webp') { throw 'Live WebP image check failed.' }

    Start-Process $siteUrl
    Write-Host "Deployment $runId succeeded. The page and WebP image returned HTTP 200."
}
~~~

Also try the site in the browser: switch stages, load images, and use the journal controls.

## Future updates

Edit the original project, then repeat **steps 2 → 3 → 4 → 6**. Every push to main starts a new GitHub Pages deployment. Check the run and live site after each update.
