import assert from 'node:assert/strict';
import { test } from 'node:test';
import { geometryFor, groupedFaces, faceIndicesFor } from '../src/dice.js';

test('cada dado possui o número correto de faces numeradas', () => {
  for (const sides of [4, 6, 8, 10, 12, 20]) {
    const geometry = geometryFor(sides);
    assert.equal(groupedFaces(geometry).length, sides, `D${sides}`);
    geometry.dispose();
  }
});

test('D100 usa dois D10 para dezenas e unidades', () => {
  assert.deepEqual(faceIndicesFor(100, 1), [0, 1]);
  assert.deepEqual(faceIndicesFor(100, 37), [3, 7]);
  assert.deepEqual(faceIndicesFor(100, 100), [0, 0]);
});
