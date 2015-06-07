#!/usr/bin/env bash
set -e

echo ""
echo ""
echo "### check_ssllabs"
mkdir -p ../tmp

../node_modules/.bin/nexe \
--output "../dist/check_ssllabs" \
--temp "../tmp/nexe"

rm -f ../tmp
