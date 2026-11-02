/// <reference types="node" />
/**
 * Tests for the money math. Run them with:  npm test
 *
 * Uses Node's built-in test runner (no extra libraries needed).
 * Amounts are in paise: 10000 = ₹100.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  computeBalances,
  formatINR,
  pairwiseDebts,
  rupeesToPaise,
  simplifyDebts,
  splitEqually,
  type Balances,
  type Transfer,
} from './balances.ts';

/** Helper: apply transfers to balances; everyone should end at zero. */
function applyTransfers(balances: Balances, transfers: Transfer[]): Balances {
  const result = { ...balances };
  for (const t of transfers) {
    result[t.from] += t.amount;
    result[t.to] -= t.amount;
  }
  return result;
}

describe('splitEqually', () => {
  it('splits evenly when it divides', () => {
    assert.deepEqual(splitEqually(9000, ['a', 'b', 'c']), [
      { userId: 'a', amount: 3000 },
      { userId: 'b', amount: 3000 },
      { userId: 'c', amount: 3000 },
    ]);
  });

  it('hands leftover paise to the first people and still adds up', () => {
    const shares = splitEqually(10000, ['a', 'b', 'c']);
    assert.deepEqual(
      shares.map((s) => s.amount),
      [3334, 3333, 3333],
    );
    assert.equal(
      shares.reduce((sum, s) => sum + s.amount, 0),
      10000,
    );
  });

  it('returns nothing for nobody', () => {
    assert.deepEqual(splitEqually(500, []), []);
  });
});

describe('computeBalances', () => {
  it('payer is owed, sharers owe, and everything sums to zero', () => {
    // A pays ₹300 dinner, split equally between A, B, C.
    const balances = computeBalances([
      { payers: [{ userId: 'A', amount: 30000 }], shares: splitEqually(30000, ['A', 'B', 'C']) },
    ]);
    assert.deepEqual(balances, { A: 20000, B: -10000, C: -10000 });
    assert.equal(
      Object.values(balances).reduce((a, b) => a + b, 0),
      0,
    );
  });

  it('settlements reduce debts', () => {
    const balances = computeBalances(
      [{ payers: [{ userId: 'A', amount: 20000 }], shares: splitEqually(20000, ['A', 'B']) }],
      [{ fromUser: 'B', toUser: 'A', amount: 10000 }],
    );
    assert.deepEqual(balances, { A: 0, B: 0 });
  });

  it('handles multiple payers on one bill', () => {
    // A paid ₹200 and B paid ₹100 for a ₹300 bill split 3 ways.
    const balances = computeBalances([
      {
        payers: [
          { userId: 'A', amount: 20000 },
          { userId: 'B', amount: 10000 },
        ],
        shares: splitEqually(30000, ['A', 'B', 'C']),
      },
    ]);
    assert.deepEqual(balances, { A: 10000, B: 0, C: -10000 });
  });
});

describe('simplifyDebts', () => {
  it('collapses a chain into one payment', () => {
    // A owes B ₹100, B owes C ₹100 → A just pays C.
    const transfers = simplifyDebts({ A: -10000, B: 0, C: 10000 });
    assert.deepEqual(transfers, [{ from: 'A', to: 'C', amount: 10000 }]);
  });

  it('settles everyone to zero with at most n-1 payments', () => {
    const balances = { A: 5000, B: -2000, C: -2500, D: 3000, E: -3500 };
    const transfers = simplifyDebts(balances);
    assert.ok(transfers.length <= 4);
    for (const amount of Object.values(applyTransfers(balances, transfers))) {
      assert.equal(amount, 0);
    }
  });

  it('returns nothing when everyone is settled', () => {
    assert.deepEqual(simplifyDebts({ A: 0, B: 0 }), []);
  });
});

describe('pairwiseDebts', () => {
  it('keeps debts between the original pairs and nets them', () => {
    const transfers = pairwiseDebts([
      // A paid ₹100 for A and B → B owes A ₹50
      { payers: [{ userId: 'A', amount: 10000 }], shares: splitEqually(10000, ['A', 'B']) },
      // B paid ₹40 for A and B → A owes B ₹20
      { payers: [{ userId: 'B', amount: 4000 }], shares: splitEqually(4000, ['A', 'B']) },
    ]);
    assert.deepEqual(transfers, [{ from: 'B', to: 'A', amount: 3000 }]);
  });

  it('agrees with computeBalances on what each person is owed in total', () => {
    const expenses = [
      { payers: [{ userId: 'A', amount: 30000 }], shares: splitEqually(30000, ['A', 'B', 'C']) },
      { payers: [{ userId: 'C', amount: 9000 }], shares: splitEqually(9000, ['A', 'B', 'C']) },
    ];
    const settlements = [{ fromUser: 'B', toUser: 'A', amount: 5000 }];
    const balances = computeBalances(expenses, settlements);
    const zeroed = applyTransfers(balances, pairwiseDebts(expenses, settlements));
    for (const amount of Object.values(zeroed)) assert.equal(amount, 0);
  });
});

describe('rupeesToPaise', () => {
  it('parses what people type', () => {
    assert.equal(rupeesToPaise('250'), 25000);
    assert.equal(rupeesToPaise('249.5'), 24950);
    assert.equal(rupeesToPaise('₹1,299.99'), 129999);
  });

  it('rejects junk and too many decimals', () => {
    assert.equal(rupeesToPaise('abc'), null);
    assert.equal(rupeesToPaise('10.999'), null);
    assert.equal(rupeesToPaise(''), null);
  });
});

describe('formatINR', () => {
  it('uses Indian digit grouping', () => {
    assert.equal(formatINR(12345600), '₹1,23,456');
    assert.equal(formatINR(24950), '₹249.50');
    assert.equal(formatINR(-5000), '-₹50');
  });
});
