'use strict';

/** Release heading grammar: `## vX.Y.Z - description`. */
const HEADING = /^## v(\d+\.\d+\.\d+) - (.+)$/;
/** Typed release note grammar: `- type: description`. */
const NOTE = /^-\s+([a-zA-Z][a-zA-Z0-9-]*):\s+(\S.*)$/;

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version));
  if (!match) {
    throw new Error(`invalid release version '${version}' (expected X.Y.Z)`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] < right[index] ? -1 : 1;
  }
  return 0;
}

/** The bump level actually applied between two versions. */
function actualBump(from, to) {
  const [fromMajor, fromMinor] = parseVersion(from);
  const [toMajor, toMinor] = parseVersion(to);
  if (toMajor !== fromMajor) return 'major';
  if (toMinor !== fromMinor) return 'minor';
  return 'patch';
}

/** Parse every release entry, newest first, with its typed note lines. */
function parseChangelog(text) {
  const entries = [];
  let current = null;
  for (const rawLine of String(text).split('\n')) {
    const heading = HEADING.exec(rawLine.trim());
    if (heading) {
      current = { version: heading[1], title: heading[2], notes: [] };
      entries.push(current);
      continue;
    }
    if (current && rawLine.startsWith('- ')) {
      current.notes.push(rawLine.trim());
    }
  }
  return entries;
}

/** The newest release entry, which is the authored package version. */
function topEntry(text) {
  const [entry] = parseChangelog(text);
  if (!entry) {
    throw new Error('CHANGELOG.md has no "## vX.Y.Z - description" entry');
  }
  return entry;
}

function classifyNote(note) {
  const match = NOTE.exec(note);
  if (!match) return { type: null, text: note };
  return { type: match[1].toLowerCase(), text: match[2] };
}

/**
 * The minimum bump the typed notes declare: `breaking:` requires major,
 * `feat:`/`feature:` requires minor, anything else requires a patch.
 */
function requiredBump(notes) {
  if (notes.length === 0) {
    throw new Error('release entry has no typed notes (expected "- type: description")');
  }
  const typed = notes.map(classifyNote);
  const untyped = typed.find((note) => note.type === null);
  if (untyped) {
    throw new Error(`untyped release note '${untyped.text}' (expected "- type: description")`);
  }
  if (typed.some((note) => note.type === 'breaking')) return 'major';
  if (typed.some((note) => note.type === 'feat' || note.type === 'feature')) return 'minor';
  return 'patch';
}

module.exports = {
  parseVersion,
  compareVersions,
  actualBump,
  parseChangelog,
  topEntry,
  classifyNote,
  requiredBump,
};
