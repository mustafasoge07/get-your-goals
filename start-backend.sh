#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/backend"
if [ ! -d node_modules ]; then npm install; fi
npm start
