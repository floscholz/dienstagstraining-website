import assert from 'node:assert/strict';
import test from 'node:test';
import { explicitTime, isTrainingSlot, parseNuudel } from '../netlify/functions/nuudel.mjs';

test('recognizes supported explicit time labels', () => {
  for (const label of ['20:00', '20.00', '20 Uhr', '20:00 Uhr', '20h', '20 h']) {
    assert.equal(explicitTime(label), '20:00');
  }
});

test('accepts only Tuesdays without a wrong explicit time', () => {
  assert.equal(isTrainingSlot('2026-12-08', '20:00'), true);
  assert.equal(isTrainingSlot('2026-12-08', '20 Uhr'), true);
  assert.equal(isTrainingSlot('2026-12-08', 'Training'), true);
  assert.equal(isTrainingSlot('2026-12-08', '19:00'), false);
  assert.equal(isTrainingSlot('2026-12-11', '20:00'), false);
  assert.equal(isTrainingSlot('2026-12-11', '19 Uhr WF-BB'), false);
});

test('never selects the Friday Christmas party as next training', () => {
  const csv = [
    'Name,2026-12-08,2026-12-11,2026-12-15',
    'Zeit,20 Uhr,19 Uhr WF-BB,20:00',
    'Ada,Ja,Ja,Unter Vorbehalt',
    'Ben,Nein,Ja,Ja',
  ].join('\n');
  const result = parseNuudel(csv, '<div class="poll-description">Immer Dienstags 20 Uhr · Halle</div>', new Date('2026-12-09T12:00:00Z'));
  assert.deepEqual(result.trainings.map((entry) => entry.date), ['2026-12-08', '2026-12-15']);
  assert.equal(result.date, '2026-12-15');
});

test('does not fall back to a non-training event', () => {
  const csv = ['Name,2026-12-11', 'Zeit,19 Uhr WF-BB', 'Ada,Ja'].join('\n');
  const result = parseNuudel(csv, '', new Date('2026-12-01T12:00:00Z'));
  assert.equal(result.nextTraining, null);
  assert.equal(result.date, undefined);
});
