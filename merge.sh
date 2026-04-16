#!/usr/bin/env bash
set -euo pipefail

echo "Verifying concept assembly..."
echo ""

ALL_GOOD=true

for letter in A B C D; do
  FILE="concept-${letter}/index.tsx"
  if [ ! -f "$FILE" ]; then
    echo "  ✗  $FILE — missing"
    ALL_GOOD=false
    continue
  fi

  if grep -q "export default function Concept${letter}" "$FILE" || \
     grep -q "export default Concept${letter}" "$FILE"; then
    echo "  ✓  $FILE — default export Concept${letter} found"
  else
    echo "  ⚠  $FILE — exists but no 'export default' for Concept${letter} detected"
    ALL_GOOD=false
  fi
done

echo ""

if [ "$ALL_GOOD" = true ]; then
  echo "All four concepts verified. Run 'npm run dev' to start on port 3001."
else
  echo "Some concepts are missing or incomplete. See warnings above."
  exit 1
fi
