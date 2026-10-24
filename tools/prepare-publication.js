#!/usr/bin/env node
'use strict';

// Explicit publication list: never copy local Git history, PNGs or journal backups.
const fs = require('node:fs');
const path = require('node:path');
const R = require('../core');
const { assetInfo } = require('./asset-info');
const root = path.resolve(__dirname, '..');
const mode = process.argv[2];
if (!['site', 'github'].includes(mode)) throw new Error('Use site or github');
const output = path.join(root, '.publication', mode);
if (fs.existsSync(output)) {
  const publicationRoot = path.join(root, '.publication');
  const outputInfo = fs.lstatSync(output);
  if (path.dirname(output) !== publicationRoot || outputInfo.isSymbolicLink() || !outputInfo.isDirectory()) throw new Error(`Unsafe output path: ${output}`);
  if (fs.existsSync(path.join(output, '.git'))) throw new Error(`Refusing to replace Git repository: ${output}`);
  fs.rmSync(output, { recursive: true });
}
const files = new Set(['index.html', 'style.css', 'core.js', 'calendar.js', 'app.js', 'sources.json', 'LICENSE', 'NOTICE', 'assets/ASSETS.md', '.github/github-pages-instructions.md']);
for (const entry of fs.readdirSync(root)) if (/\.md$/i.test(entry)) files.add(entry);
for (const entry of fs.readdirSync(path.join(root, 'exercises'))) {
  if (/^exercises(?:_[a-z_]+)?(?:\.schema)?\.json$/.test(entry)) files.add('exercises/' + entry);
}
const images = new Set(['journal-banner', 'movement', 'learning', 'communication', 'connection'].map(name => `assets/${name}.webp`));
for (const stage of Object.keys(R.STAGES)) {
  for (const filename of R.stageFilenames(stage)) {
    for (const ex of JSON.parse(fs.readFileSync(path.join(root, 'exercises', filename), 'utf8'))) {
      if (!/^assets\/[a-zA-Z0-9_/-]+\.webp$/.test(ex.imageUrl)) throw new Error(`Non-WebP or unsafe artwork path: ${ex.id}`);
      images.add(ex.imageUrl);
    }
  }
}
for (const image of images) {
  const info = assetInfo(fs.readFileSync(path.join(root, image)));
  if (info.format !== 'webp' || info.width < 512 || info.height < 512) throw new Error(`Invalid WebP: ${image}`);
  files.add(image);
}
if (mode === 'github') {
  for (const name of fs.readdirSync(path.join(root, '.github'))) {
    if (/\.md$/i.test(name)) files.add('.github/' + name);
  }
  for (const file of ['.gitignore', 'package.json', 'assets/ASSETS.md', '.github/github-pages-instructions.md']) files.add(file);
  for (const dir of ['tests', 'tools', '.github/workflows']) {
    for (const name of fs.readdirSync(path.join(root, dir))) {
      if (/\.(js|ya?ml)$/.test(name)) files.add(dir + '/' + name);
    }
  }
}
// Validate all inputs before producing a partial tree. Symlinks are not published.
for (const file of files) {
  const parts = file.split('/');
  for (let i = 1; i <= parts.length; i++) {
    if (fs.lstatSync(path.join(root, ...parts.slice(0, i))).isSymbolicLink()) throw new Error(`Symlink: ${file}`);
  }
  if (!fs.statSync(path.join(root, file)).isFile()) throw new Error(`Not a file: ${file}`);
}
for (const file of files) {
  // Pages' artifact action excludes .github, so expose this guide at the site root.
  const publishedPath = mode === 'site' && file === '.github/github-pages-instructions.md' ? 'github-pages-instructions.md' : file;
  const destination = path.join(output, publishedPath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (mode === 'site' && /\.md$/.test(file)) {
    const content = fs.readFileSync(path.join(root, file), 'utf8').replaceAll('](.github/github-pages-instructions.md)', '](github-pages-instructions.md)');
    fs.writeFileSync(destination, content);
  } else fs.copyFileSync(path.join(root, file), destination);
}
fs.writeFileSync(path.join(output, '.nojekyll'), '');
console.log(`Prepared ${files.size + 1} files with ${images.size} WebP images at ${output}`);
console.log(mode === 'github' ? 'No Git history was copied. Initialize a new public repository here; never push the private working history.' : 'Serve this directory over HTTP to preview the Pages artifact.');
