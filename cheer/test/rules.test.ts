import { test } from "node:test";
import assert from "node:assert/strict";
import { compareIds } from "../src/rules.ts";

/** Postgres `collate "C"` compares UTF-8 bytes. */
const byteOrder = (a: string, b: string) => Math.sign(Buffer.compare(Buffer.from(a), Buffer.from(b)));

test('compareIds is UTF-8 byte order (collate "C"), not code units or locale', () => {
  assert.deepEqual(["b", "ab", "a-b", "a", "z1", "z-1", "B", ""].sort(compareIds), [
    "",
    "B",
    "a",
    "a-b",
    "ab",
    "b",
    "z-1",
    "z1",
  ]);
  assert.equal(compareIds("x", "x"), 0);
  // An emoji (surrogate pair) sorts after U+E000–U+FFFF in bytes, though not in UTF-16 code units.
  assert.equal(compareIds("Open 🏆", "Open Ｓ"), 1);
  assert.equal(compareIds("Open Ｓ", "Open 🏆"), -1);
  assert.equal(compareIds("￿", "\u{10000}"), -1);
  assert.equal(compareIds("é", "z"), 1);
  const alphabet = ["A", "z", "é", "⭐", "퟿", "", "Ｓ", "￿", "\u{10000}", "🏆", "\u{10ffff}"];
  const strings = [""];
  for (const x of alphabet) for (const y of ["", ...alphabet]) strings.push(x + y);
  for (const a of strings) {
    for (const b of strings)
      assert.equal(compareIds(a, b), byteOrder(a, b), `${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
  }
});
