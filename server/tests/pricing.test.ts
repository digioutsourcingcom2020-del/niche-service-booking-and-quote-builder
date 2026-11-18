import assert from 'node:assert/strict';
import test from 'node:test';
import { formatDuration, formatMoney, quoteFor } from '../../shared/pricing';

test('quoteFor adds add-on prices and durations to the base service', () => {
  const quote = quoteFor(18000, 120, [
    { id: 'a1', name: 'Ceramic', priceCents: 4500, durationMin: 30 },
    { id: 'a2', name: 'Pet hair', priceCents: 4000, durationMin: 30 },
  ]);
  assert.deepEqual(quote, {
    basePriceCents: 18000,
    addonsPriceCents: 8500,
    totalCents: 26500,
    durationMin: 180,
  });
});

test('quoteFor with no add-ons returns the base quote', () => {
  const quote = quoteFor(14000, 90, []);
  assert.equal(quote.totalCents, 14000);
  assert.equal(quote.durationMin, 90);
});

test('money and duration formatting read naturally', () => {
  assert.equal(formatMoney(29000), '$290');
  assert.equal(formatMoney(26450), '$264.50');
  assert.equal(formatDuration(90), '1 hr 30 min');
  assert.equal(formatDuration(120), '2 hrs');
  assert.equal(formatDuration(45), '45 min');
});
