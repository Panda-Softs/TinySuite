# Offline dependencies for TinyDataTable demo

Run `npm run vendor` **once with Internet access** from the TinySuite root.
Commit the downloaded files if you want `demo/index.html` to work offline
immediately after cloning. The demo references only local JS/CSS.

Pinned package versions and URLs are declared in `scripts/vendor-manifest.json`.
- Tippy.js 6.3.7, bundled with Popper (MIT)
- mark.js 8.11.1 (MIT)
- SheetJS 0.20.3 (Apache 2.0); 0.18.5 is outdated and has known advisories
- jsPDF 2.5.2 (MIT)
- jsPDF AutoTable 3.8.4 (MIT)

When redistributing these libraries, preserve their original license notices.
After vendoring, check each upstream LICENSE and its bundled copyright headers.
