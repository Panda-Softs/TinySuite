#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
node --check TinyInlineEditor.js
node --check demo.js
python -m unittest discover -s tests -v
