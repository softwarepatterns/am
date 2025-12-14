#!/usr/bin/env bash
set -euo pipefail

# Step 0: move to repo root
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== Step 1: build =="
npm run build

echo "== Step 2: pack (create a real install artifact) =="
TGZ="$(npm pack | tail -n 1)"
echo "Packed: $TGZ"

echo "== Step 3: install + run Node ESM consumer (current node) =="
cd matrix/node-esm
npm install
node index.mjs

echo "== Step 4: install + run Node CJS consumer (current node) =="
cd ../node-cjs
npm install
node index.cjs

echo "== Step 5: install + run TypeScript consumer (exports + types) =="
cd ../ts-types
npm install
npx tsc --noEmit

echo "== Step 6: run Node ESM consumer with Node 18 (via npx node@18) =="
cd ../node-esm
npx -y node@18 index.mjs

echo "== Step 7: run Node ESM consumer with Node 20 (via npx node@20) =="
npx -y node@20 index.mjs

echo "== Step 8: run Node ESM consumer with Node 22 (via npx node@22) =="
npx -y node@22 index.mjs

echo "== OK: matrix passed =="
