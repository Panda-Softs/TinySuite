#!/usr/bin/env node
'use strict';
// Validate every demo's main file and local script/style dependencies without network.
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
const m=require('./dist-entries.json');
const components=[...new Set([...Object.keys(m.javascript),'TinyScheduler'])];
const allowMissingVendor=process.argv.includes('--allow-missing-vendor');
let errors=[];let count=0;let skipped=0;
for(const component of components){
  const file=path.join(root,component,'demo','index.html');
  if(!fs.existsSync(file)){errors.push(`MISSING ${component}/demo/index.html`);continue;}
  const html=fs.readFileSync(file,'utf8');
  const regex=/<(?:script|link|img|source)\b[^>]*?(?:src|href)\s*=\s*["']([^"']+)["'][^>]*>/gi;
  for(const match of html.matchAll(regex)){
    const src=match[1];
    if(src.includes('${'))continue; // dynamic string in a code example, not a static asset
    if(/^(?:https?:|\/\/|#|data:)/i.test(src)){
      if(/^https?:/i.test(src))errors.push(`External script or stylesheet: ${component}: ${src}`);
      continue;
    }
    const asset=path.resolve(path.dirname(file),decodeURIComponent(src.split(/[?#]/)[0]));
    if(!fs.existsSync(asset)) {
      if(allowMissingVendor && component==='TinyDataTable' && src.startsWith('./vendor/')) skipped++;
      else errors.push(`Missing local reference: ${component}: ${src}`);
    }
    else count++;
  }
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
else console.log(`Checked ${components.length} demos, ${count} resolved local script/CSS/image references, ${skipped} explicitly deferred vendor files`);
