#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
node -e "const fs=require('fs'); const code=fs.readFileSync('$ROOT/app.js','utf8'); new Function(code); console.log('app.js syntax OK');"
test -f "$ROOT/index.html"
test -f "$ROOT/styles.css"
test -f "$ROOT/schema.sql"
test -f "$ROOT/realtime-contract.json"
test -d "$ROOT/assets/ui-reference"
echo "Package smoke test OK"
