#!/usr/bin/env node
'use strict';
// Pin dependency versions and download only on explicit invocation.
// NEVER silently download a dependency when opening a file:// demo.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const manifest = require('./vendor-manifest.json');
const check = process.argv.includes('--check');
const lockPath=path.join(__dirname, 'vendor-lock.json');
const lock=fs.existsSync(lockPath) ? JSON.parse(fs.readFileSync(lockPath,'utf8')) : {};
const allowHosts = new Set(['cdn.jsdelivr.net','cdn.sheetjs.com']);
function sha(input) {return crypto.createHash('sha256').update(input).digest('hex');}
async function main() {
  let errors=0;
  for (const entry of manifest) {
    const destination=path.resolve(root,entry.path);
    if (!destination.startsWith(root+path.sep)) throw Error(`Invalid path: ${entry.path}`);
    if (check) {
      if (!fs.existsSync(destination) || fs.statSync(destination).size<1024) {
        console.error(`MISSING: ${entry.path}`);errors++;
      } else {
        const actual=sha(fs.readFileSync(destination));
        if(lock[entry.path] && lock[entry.path]!==actual){errors++; console.error(`CHECKSUM MISMATCH: ${entry.path}`);}
        else if(!lock[entry.path]){errors++;console.error(`MISSING SHA256 LOCK: ${entry.path}`);}
        else console.log(`OK ${entry.path} (${actual.slice(0,12)})`);
      }
      continue;
    }
    if (fs.existsSync(destination) && fs.statSync(destination).size>1024) {
      console.log(`Already present: ${entry.path} (use --force to update)`);
      if (!process.argv.includes('--force')) {
        const actual=sha(fs.readFileSync(destination));
        if(lock[entry.path] && lock[entry.path]!==actual) throw Error(`Checksum drift: ${entry.path}. Investigate before updating.`);
        lock[entry.path]=actual;continue;
      }
    }
    const u = new URL(entry.url);
    if (u.protocol!=='https:' || !allowHosts.has(u.hostname)) throw Error(`Disallowed CDN: ${entry.url}`);
    console.log(`Downloading ${entry.package} ...`);
    const response = await fetch(u, {signal: AbortSignal.timeout(60000)});
    if (!response.ok || !allowHosts.has(new URL(response.url).hostname)) throw Error(`Download failed: ${entry.url} (${response.status})`);
    const content=Buffer.from(await response.arrayBuffer());
    if (content.length < 1024 || /<html/i.test(content.subarray(0,200).toString())) throw Error(`Invalid asset: ${entry.url}`);
    fs.mkdirSync(path.dirname(destination),{recursive:true});
    fs.writeFileSync(destination,content);
    lock[entry.path]=sha(content);
    console.log(`Saved ${entry.path} (${content.length} bytes; SHA-256 ${lock[entry.path]})`);
  }
  if (errors) throw Error(`${errors} vendor files missing or invalid. Run: npm run vendor (requires Internet once).`);
  if(!check)fs.writeFileSync(lockPath,JSON.stringify(lock,null,2)+'\n');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
