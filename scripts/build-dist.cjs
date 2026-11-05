#!/usr/bin/env node
'use strict';
/** Build only maintained JavaScript and CSS entry points. No concatenation, no source mutation.
 * All outputs are classic browser scripts (no ES modules; usable with file://).
 */
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const manifest = require('./dist-entries.json');
const {minify} = require('terser');
const postcss = require('postcss');
const cssnano = require('cssnano');
const check = process.argv.includes('--check');
let generated = 0;

function outputFile(target, content) {
  if (check) {
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== content) {
      throw Error(`Distribution absent/stale: ${path.relative(root,target)}. Run npm run build.`);
    }
  } else {
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, content, 'utf8');
  }
  generated++;
}
async function buildOne(component, name, kind) {
  const source = path.join(root, component, name);
  if (!fs.existsSync(source)) throw Error(`Source missing: ${path.relative(root,source)}`);
  const destination = path.join(root, component, 'dist', name.replace(/\.(js|css)$/, '.min.$1'));
  const input = fs.readFileSync(source, 'utf8');
  let value;
  if (kind === 'js') {
    const result = await minify(input, {module: false, toplevel: false, compress: {passes: 1},
      mangle: false, format: {comments: 'some', beautify: false}});
    if (!result.code) throw Error(`No minified output for ${source}`);
    value = result.code + '\n';
  } else {
    const result = typeof cssnano.process === 'function'
      ? await cssnano.process(input, {from: source}) // older cached cssnano during offline validation
      : await postcss([cssnano({preset: 'default'})]).process(input, {from: source});
    value = result.css + '\n';
  }
  outputFile(destination, value);
}
async function main() {
  for (const [component,files] of Object.entries(manifest.javascript)) {
    for (const name of files) await buildOne(component,name,'js');
  }
  for (const [component,files] of Object.entries(manifest.css)) {
    for (const name of files) await buildOne(component,name,'css');
  }
  // Scheduler has its own canonical build (multi-file JS + SCSS -> UMD bundle).
  // Do not minify already minified artifacts or break its published globals.
  const schedRoot=path.join(root,'TinyScheduler');
  const needs=['dist/tiny-scheduler.min.js','dist/tiny-scheduler.min.css'];
  if (!check) {
    const gulp=path.join(schedRoot,'node_modules','.bin','gulp');
    if (!fs.existsSync(gulp)) throw Error('TinyScheduler needs its existing Gulp toolchain. Run: npm install --prefix TinyScheduler, then npm run build');
    const result=spawnSync(gulp,['build'],{cwd:schedRoot,stdio:'inherit'});
    if (result.status!==0) throw Error(`TinyScheduler build failed (${result.status})`);
  }
  for (const rel of needs) {
    const full=path.join(schedRoot,rel);
    if (!fs.existsSync(full) || fs.statSync(full).size<1000) throw Error(`Missing scheduler output: ${rel}`);
  }
  console.log(`${check?'Checked':'Generated'} ${generated} Tiny* dist assets; TinyScheduler dist verified.`);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
