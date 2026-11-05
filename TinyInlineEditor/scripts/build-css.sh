#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
if ! command -v sass >/dev/null 2>&1; then
    echo 'Sass CLI is required to rebuild CSS (e.g. npm install --global sass).' >&2
    exit 1
fi
sass --no-source-map --style=compressed TinyInlineEditor.scss TinyInlineEditor.css
