#!/usr/bin/env node
'use strict';
/** Build maintained TinySuite distributions from scripts/dist-entries.json.
 * Simple entries are minified; bundles compile their sources and emit source maps.
 * No component-local build tools or Gulp are required.
 */
const fs = require('node:fs');
const path = require('node:path');
const {fileURLToPath} = require('node:url');
const root = path.resolve(__dirname, '..');
const manifest = require('./dist-entries.json');
const {minify} = require('terser');
const {SourceMapGenerator} = require('source-map-js');
const postcss = require('postcss');
const cssnano = require('cssnano');
const check = process.argv.includes('--check');
let generated = 0;

function outputFile(target, content) {
  if (check) {
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== content) {
      throw Error(`Distribution absent/stale: ${path.relative(root, target)}. Run npm run build.`);
    }
  } else {
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, content, 'utf8');
  }
  generated++;
}

function readSource(component, name) {
  const file = path.join(root, component, name);
  if (!fs.existsSync(file)) throw Error(`Source missing: ${path.relative(root, file)}`);
  return fs.readFileSync(file, 'utf8');
}

async function buildOne(component, name, kind) {
  const source = path.join(root, component, name);
  const input = readSource(component, name);
  const destination = path.join(root, component, 'dist', path.basename(name).replace(/\.(js|css)$/, '.min.$1'));
  let value;
  if (kind === 'js') {
    const result = await minify(input, {module: false, toplevel: false, compress: {passes: 1},
      mangle: false, format: {comments: 'some', beautify: false}});
    if (!result.code) throw Error(`No minified output for ${source}`);
    value = result.code + '\n';
  } else {
    const result = typeof cssnano.process === 'function'
      ? await cssnano.process(input, {from: source})
      : await postcss([cssnano({preset: 'default'})]).process(input, {from: source});
    value = result.css + '\n';
  }
  outputFile(destination, value);
}

function umdParts(exports) {
  const globalAssignments = exports.map(name => `    root.${name} = exports.${name};`).join('\n');
  return {
    header: `(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const exports = factory();

${globalAssignments}
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const root =
    typeof self !== 'undefined'
      ? self
      : typeof window !== 'undefined'
        ? window
        : typeof global !== 'undefined'
          ? global
          : {};
`,
    footer: `\n  return {\n${exports.map(name => `    ${name}`).join(',\n')}\n  };\n});\n`
  };
}

async function buildBundleJavaScript(component, config) {
  const dist = path.join(root, component, 'dist');
  const normal = path.join(dist, config.output);
  const minified = normal.replace(/\.js$/, '.min.js');
  const mapFile = minified + '.map';
  const parts = umdParts(config.umdExports);
  // Map concatenated source lines to their original files before minification.
  const map = new SourceMapGenerator({file: config.output});
  let code = parts.header;
  for (const [index, name] of config.sources.entries()) {
    if (index) code += '\n';
    const content = readSource(component, name);
    const firstLine = code.split('\n').length;
    for (let line = 1; line <= content.split('\n').length; line++) {
      map.addMapping({generated: {line: firstLine + line - 1, column: 0},
        original: {line, column: 0}, source: name});
    }
    map.setSourceContent(name, content);
    code += content;
  }
  code += parts.footer;
  outputFile(normal, code);
  const result = await minify({[config.output]: code}, {
    module: false, toplevel: false,
    compress: {passes: 2}, mangle: true, format: {comments: false},
    sourceMap: {
      filename: path.basename(minified),
      url: path.basename(mapFile),
      includeSources: true,
      content: map.toString()
    }
  });
  if (!result.code || !result.map) throw Error(`Unable to build JS bundle: ${component}`);
  outputFile(minified, result.code + '\n');
  outputFile(mapFile, result.map + '\n');
}

async function buildBundleScss(component, config) {
  // These dependencies belong to the TinySuite workspace, not to TinyScheduler.
  const sass = require('sass');
  const autoprefixer = require('autoprefixer');
  const source = path.join(root, component, config.source);
  if (!fs.existsSync(source)) throw Error(`Source missing: ${path.relative(root, source)}`);
  const dist = path.join(root, component, 'dist');
  const normal = path.join(dist, config.output);
  const minified = normal.replace(/\.css$/, '.min.css');
  const mapFile = minified + '.map';

  const compiled = sass.compile(source, {
    style: 'expanded', sourceMap: true, sourceMapIncludeSources: true,
    silenceDeprecations: ['legacy-js-api']
  });
  const prefixed = await postcss([autoprefixer({overrideBrowserslist: config.browserslist})]).process(compiled.css, {
    from: source, to: normal,
    map: {prev: compiled.sourceMap, inline: false, annotation: false, sourcesContent: true}
  });
  outputFile(normal, prefixed.css);

  const minimized = await postcss([cssnano()]).process(prefixed.css, {
    from: normal, to: minified,
    map: {prev: prefixed.map, inline: false, annotation: path.basename(mapFile), sourcesContent: true}
  });
  if (!minimized.map) throw Error(`Unable to generate CSS source map: ${component}`);
  outputFile(minified, minimized.css.trimEnd() + '\n');
  // Sass emits absolute file:// URLs; keep maps portable across machines.
  const map = minimized.map.toJSON();
  map.sources = map.sources.map(source => source.startsWith('file://')
    ? path.relative(dist, fileURLToPath(source)).split(path.sep).join('/')
    : source);
  outputFile(mapFile, JSON.stringify(map) + '\n');
}

async function main() {
  for (const [component, files] of Object.entries(manifest.javascript)) {
    for (const name of files) await buildOne(component, name, 'js');
  }
  for (const [component, files] of Object.entries(manifest.css)) {
    for (const name of files) await buildOne(component, name, 'css');
  }
  for (const [component, bundle] of Object.entries(manifest.bundles || {})) {
    if (bundle.javascript) await buildBundleJavaScript(component, bundle.javascript);
    if (bundle.scss) await buildBundleScss(component, bundle.scss);
  }
  console.log(`${check ? 'Checked' : 'Generated'} ${generated} TinySuite dist assets.`);
}
main().catch(error => {console.error(error.message); process.exitCode = 1;});
