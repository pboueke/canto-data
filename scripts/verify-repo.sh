#!/bin/sh

set -eu

CHANGELOG_VERSION=$(grep -m1 '^## v' CHANGELOG.md | sed 's/^## v\([^ ]*\).*/\1/')
PACKAGE_VERSION=$(node -p "require('./package.json').version")
README_VERSION=$(sed -nE 's/.*badge\/version-([0-9.]+)-green.*/\1/p' README.md | head -n1)
README_TESTS=$(sed -nE 's/.*badge\/tests-([0-9]+)%2F([0-9]+)%20passed-.*/\1 \2/p' README.md | head -n1)
README_COVERAGE=$(sed -nE 's/.*badge\/coverage-([0-9]+)%25-.*/\1/p' README.md | head -n1)

if [ -z "$CHANGELOG_VERSION" ]; then
  echo "Missing top changelog version entry in CHANGELOG.md" >&2
  exit 1
fi

if [ "$CHANGELOG_VERSION" != "$PACKAGE_VERSION" ]; then
  echo "package.json version ($PACKAGE_VERSION) does not match CHANGELOG.md ($CHANGELOG_VERSION)" >&2
  exit 1
fi

if [ "$README_VERSION" != "$PACKAGE_VERSION" ]; then
  echo "README version badge ($README_VERSION) does not match package.json ($PACKAGE_VERSION)" >&2
  exit 1
fi

TEST_OUTPUT=$(npm run test:ci -- --coverageReporters=text-summary 2>&1)
TESTS_LINE=$(printf '%s\n' "$TEST_OUTPUT" | sed -nE 's/^Tests:[[:space:]]+([0-9]+) passed,[[:space:]]+([0-9]+) total/\1 \2/p' | tail -n1)
TESTS_PASSED=$(printf '%s\n' "$TESTS_LINE" | cut -d' ' -f1)
TESTS_TOTAL=$(printf '%s\n' "$TESTS_LINE" | cut -d' ' -f2)
COVERAGE=$(printf '%s\n' "$TEST_OUTPUT" | sed -nE 's/^Statements[[:space:]]*:[[:space:]]*([0-9.]+)%.*/\1/p' | tail -n1)
COVERAGE_INT=$(printf '%.0f' "$COVERAGE")

if [ "$README_TESTS" != "$TESTS_PASSED $TESTS_TOTAL" ]; then
  echo "README tests badge does not match test suite output ($TESTS_PASSED/$TESTS_TOTAL)" >&2
  exit 1
fi

if [ "$README_COVERAGE" != "$COVERAGE_INT" ]; then
  echo "README coverage badge does not match test coverage ($COVERAGE_INT%)" >&2
  exit 1
fi
