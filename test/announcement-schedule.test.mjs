import assert from 'node:assert/strict';
import test from 'node:test';
import { easterSunday, seasonalEntriesForYear, selectAnnouncement } from '../src/lib/announcement-schedule.mjs';

test('calculates Easter Sunday for multiple years', () => {
  assert.equal(easterSunday(2026), '2026-04-05');
  assert.equal(easterSunday(2027), '2027-03-28');
  assert.equal(easterSunday(2028), '2028-04-16');
});

test('starts Easter after the last valid training before Good Friday', () => {
  const easter = seasonalEntriesForYear(2026, [{ date: '2026-03-24' }, { date: '2026-03-31' }]).find((entry) => entry.id === 'easter');
  assert.equal(easter.displayFrom, '2026-04-01T00:00:00');
  assert.equal(easter.displayUntil, '2026-04-07T23:59:59');
});

test('uses the Easter fallback when no suitable training exists', () => {
  const easter = seasonalEntriesForYear(2027, [{ date: '2026-12-29' }]).find((entry) => entry.id === 'easter');
  assert.equal(easter.displayFrom, '2027-03-24T00:00:00');
});

test('concrete events win and local preview can force all variants', () => {
  const duringParty = new Date('2026-11-10T12:00:00Z');
  assert.equal(selectAnnouncement({ now: duringParty })?.id, 'party-2026');
  assert.equal(selectAnnouncement({ preview: 'easter', allowPreview: true })?.id, 'easter');
  assert.equal(selectAnnouncement({ preview: 'none', allowPreview: true }), null);
});

test('preview parameters are ignored when preview is not allowed', () => {
  const inactive = new Date('2026-08-01T12:00:00Z');
  assert.equal(selectAnnouncement({ now: inactive, preview: 'party', allowPreview: false }), null);
});

test('uses Europe/Berlin boundaries for the 2026 Christmas party', () => {
  assert.equal(selectAnnouncement({ now: new Date('2026-11-09T22:59:59Z') }), null);
  assert.equal(selectAnnouncement({ now: new Date('2026-11-09T23:00:00Z') })?.id, 'party-2026');
  assert.equal(selectAnnouncement({ now: new Date('2026-12-12T02:59:59Z') })?.id, 'party-2026');
  assert.equal(selectAnnouncement({ now: new Date('2026-12-12T03:00:00Z') }), null);
});

test('switches seasonal greetings automatically at Berlin midnight', () => {
  assert.equal(selectAnnouncement({ now: new Date('2026-12-19T22:59:59Z') }), null);
  assert.equal(selectAnnouncement({ now: new Date('2026-12-19T23:00:00Z') })?.id, 'christmas');
  assert.equal(selectAnnouncement({ now: new Date('2026-12-26T22:59:59Z') })?.id, 'christmas');
  assert.equal(selectAnnouncement({ now: new Date('2026-12-26T23:00:00Z') })?.id, 'newyear-eve');
  assert.equal(selectAnnouncement({ now: new Date('2026-12-31T23:00:00Z') })?.id, 'newyear');
  assert.equal(selectAnnouncement({ now: new Date('2027-01-07T23:00:00Z') }), null);
});

test('uses filtered trainings for the Christmas start without manual changes', () => {
  const trainings = [{ date: '2026-12-15' }, { date: '2026-12-22' }];
  assert.equal(selectAnnouncement({ now: new Date('2026-12-22T22:59:59Z'), trainings }), null);
  assert.equal(selectAnnouncement({ now: new Date('2026-12-22T23:00:00Z'), trainings })?.id, 'christmas');
});
