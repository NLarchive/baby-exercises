#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { assetInfo } = require('./asset-info');
const R = require('../core');

const root = path.resolve(__dirname, '..');

const stageFiles = Object.keys(R.STAGES).flatMap(stage => R.stageFilenames(stage).map(file => 'exercises/' + file));

let totalExercises = 0;
let matchedCount = 0;
const allAssets = [];
const mismatches = [];
const missing = [];

stageFiles.forEach(relFile => {
  const fullPath = path.join(root, relFile);
  const list = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  
  list.forEach(ex => {
    totalExercises++;
    const dir = path.dirname(ex.imageUrl).replace(/\\/g, '/');
    const expectedDir = R.stageAssetDirectory(ex.lifespanStage, ex.stagePart);
    if (dir !== expectedDir) mismatches.push({id:ex.id,currentImageUrl:ex.imageUrl,issue:'Expected folder: '+expectedDir});
    // Stable asset IDs survive editorial title corrections; format must match bytes.
    const expectedImageUrl = ex.imageUrl;
    
    // Check if JSON imageUrl matches the formula
    if (!path.basename(ex.imageUrl).startsWith(ex.id + '-')) {
      mismatches.push({
        id: ex.id,
        title: ex.title,
        currentImageUrl: ex.imageUrl,
        expectedImageUrl
      });
    }
    
    // Check if asset exists on disk
    const diskPath = path.join(root, ex.imageUrl);
    const exists = fs.existsSync(diskPath);
    let valid = false;
    let issue = null;

    if (!exists) {
      missing.push({
        id: ex.id,
        stage: ex.lifespanStage,
        stagePart: ex.stagePart || null,
        title: ex.title,
        imagePrompt: ex.imagePrompt,
        imageUrl: ex.imageUrl,
        imageAlt: ex.imageAlt
      });
    } else {
      const buf = fs.readFileSync(diskPath);
      let info;
      try { info = assetInfo(buf); } catch (err) { issue = err.message; }
      const extension = path.extname(ex.imageUrl).slice(1).toLowerCase();
      if (!info || info.format !== extension || info.width < 512 || info.height < 512) {
        issue = issue || `Invalid format or dimensions under 512px (${info?.width || 0}x${info?.height || 0})`;
        mismatches.push({
          id: ex.id,
          title: ex.title,
          currentImageUrl: ex.imageUrl,
          issue
        });
      } else {
        valid = true;
        matchedCount++;
      }
    }

    allAssets.push({
      id: ex.id,
      stage: ex.lifespanStage,
      stagePart: ex.stagePart || '',
      title: ex.title,
      imageUrl: ex.imageUrl,
      status: !exists ? 'MISSING' : (valid ? 'OK' : 'INVALID'),
      issue
    });
  });
});

// WebP is required for publication; PNG originals are optional local companions.
const expectedFiles = new Set();
for (const ex of allAssets) {
  for (const extension of ['png','webp']) {
    const rel = ex.imageUrl.replace(/\.[^.]+$/, '.' + extension);
    expectedFiles.add(rel);
    if (rel === ex.imageUrl || (extension === 'png' && !fs.existsSync(path.join(root, rel)))) continue;
    try {
      const info = assetInfo(fs.readFileSync(path.join(root, rel)));
      if (info.format !== extension || info.width < 512 || info.height < 512) throw new Error('Invalid companion format or dimensions');
    } catch (err) { mismatches.push({id:ex.id,currentImageUrl:rel,issue:err.message}); }
  }
}
function walkImages(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry => {
    const file = path.join(dir,entry.name);
    return entry.isDirectory() ? walkImages(file) : /\.(png|webp|svg|jpe?g)$/i.test(entry.name) ? [path.relative(root,file).replaceAll('\\','/')] : [];
  });
}
const exerciseRoots = ['infancy','toddlerhood','childhood','adolescence','adolecence','adulthood'];
const orphanFiles = exerciseRoots.flatMap(dir=>walkImages(path.join(root,'assets',dir))).filter(file=>!expectedFiles.has(file));
for (const file of orphanFiles) mismatches.push({id:'unassigned',currentImageUrl:file,issue:'Unassigned image in exercise folders'});

console.log('='.repeat(80));
console.log('                 LIFESPAN ROADMAP - ASSET INTEGRITY AUDIT');
console.log('='.repeat(80));
console.log(`Total Exercises:       ${totalExercises}`);
console.log(`Valid On-Disk Assets:  ${matchedCount} / ${totalExercises}`);
console.log(`Formula Mismatches:    ${mismatches.length}`);
console.log(`Missing Assets:        ${missing.length}`);
console.log(`Known Image Paths:     ${expectedFiles.size} (PNG originals optional)`);
console.log(`Unassigned Images:     ${orphanFiles.length}`);
console.log('='.repeat(80));

if (mismatches.length > 0) {
  console.log('\n[!] FORMULA / INTEGRITY MISMATCHES:');
  mismatches.forEach(m => {
    console.log(`  - ${m.id}: "${m.title}"`);
    console.log(`      Current:  ${m.currentImageUrl}`);
    if (m.expectedImageUrl) console.log(`      Expected: ${m.expectedImageUrl}`);
    if (m.issue) console.log(`      Issue:    ${m.issue}`);
  });
}

console.log('\n' + '='.repeat(80));
console.log(`                       MISSING ASSETS REPORT (${missing.length} Missing)`);
console.log('='.repeat(80));

missing.forEach((item, index) => {
  console.log(`\n[Missing Image #${index + 1}]`);
  console.log(`Image Title:  ${item.title} (${item.id})`);
  console.log(`Image Prompt: ${item.imagePrompt}`);
  console.log(`Image URL:    ${item.imageUrl}`);
});

console.log('\n' + '='.repeat(80));
console.log('                         ALL ASSETS SUMMARY LIST');
console.log('='.repeat(80));

let currentStage = '';
allAssets.forEach(item => {
  const stageHeader = `${item.stage}${item.stagePart ? ` / ${item.stagePart}` : ''}`;
  if (stageHeader !== currentStage) {
    currentStage = stageHeader;
    console.log(`\n-- ${currentStage.toUpperCase()} --`);
  }
  const statusBadge = item.status === 'OK' ? '[OK]     ' : '[MISSING]';
  console.log(`  ${statusBadge} ${item.id.padEnd(12)} ${item.imageUrl}`);
});

console.log('\n' + '='.repeat(80));

// Generate Markdown Report
const reportLines = [
  '# Lifespan Roadmap - Asset Integrity Report',
  '',
  `Generated on ${new Date().toISOString()}`,
  '',
  `## Summary Statistics`,
  `- **Total Exercises**: ${totalExercises}`,
  `- **Valid Present Assets**: ${matchedCount}`,
  `- **Missing Assets**: ${missing.length}`,
  `- **Formula / Naming Mismatches**: ${mismatches.length}`,
  '',
  '## Missing Assets Specification',
  'Below is the list of missing assets formatted with Title, Prompt, and Image URL for direct asset generation.',
  ''
];

missing.forEach((item, index) => {
  reportLines.push(`### ${index + 1}. ${item.title} (\`${item.id}\`)`);
  reportLines.push(`- **Image Title**: ${item.title}`);
  reportLines.push(`- **Image Prompt**: ${item.imagePrompt}`);
  reportLines.push(`- **Image URL**: \`${item.imageUrl}\``);
  if (item.imageAlt) reportLines.push(`- **Image Alt**: ${item.imageAlt}`);
  reportLines.push(`- **Lifespan Stage**: \`${item.stage}\` (${item.stagePart || 'all'})`);
  reportLines.push('');
});

reportLines.push('## Complete Asset Catalog Audit');
reportLines.push('| Status | ID | Title | Image URL |');
reportLines.push('|:------:|:---|:------|:----------|');
allAssets.forEach(a => {
  const badge = a.status === 'OK' ? '✅ OK' : `❌ ${a.status}`;
  reportLines.push(`| ${badge} | \`${a.id}\` | ${a.title} | \`${a.imageUrl}\` |`);
});
reportLines.push('');

const reportFilePath = path.join(root, '.verification', 'asset-audit.md');
fs.mkdirSync(path.dirname(reportFilePath), {recursive:true});
fs.writeFileSync(reportFilePath, reportLines.join('\n'), 'utf8');
console.log(`\nReport successfully written to: .verification/asset-audit.md\n`);

if (process.argv.includes('--strict') && (missing.length > 0 || mismatches.length > 0)) {
  process.exit(1);
}
