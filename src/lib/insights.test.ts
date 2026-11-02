/// <reference types="node" />
/**
 * Tests for badges, nudges and the monthly recap. Run with:  npm test
 * Amounts are in paise: 10000 = ₹100.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { splitEqually } from './balances.ts';
import {
  computeBadges,
  computeNudges,
  computeRecap,
  nudgeMessage,
  previousMonth,
  settleStats,
  type InsightExpense,
  type InsightInput,
  type InsightMember,
  type InsightSettlement,
} from './insights.ts';

const members: InsightMember[] = [
  { id: 'A', name: 'Asha', hideNegative: false },
  { id: 'B', name: 'Bunty', hideNegative: false },
  { id: 'C', name: 'Chetan', hideNegative: false },
];

let n = 0;
/** Helper: one person pays, split equally between `between`. */
function expense(payer: string, amount: number, date: string, between = ['A', 'B', 'C'], category = 'general'): InsightExpense {
  return {
    id: `e${n++}`,
    description: `Expense ${n}`,
    amount,
    category,
    date,
    createdBy: payer,
    payers: [{ userId: payer, amount }],
    shares: splitEqually(amount, between),
  };
}

function settle(from: string, to: string, amount: number, date: string): InsightSettlement {
  return { fromUser: from, toUser: to, amount, date, createdBy: from };
}

function input(over: Partial<InsightInput>): InsightInput {
  return { members, expenses: [], settlements: [], roastLevel: 'mild', today: '2026-11-20', ...over };
}

const badgeOwner = (badges: ReturnType<typeof computeBadges>, id: string) => badges.find((b) => b.id === id)?.userId;

describe('settleStats', () => {
  it('measures how long debt waited before being paid back (oldest first)', () => {
    const stats = settleStats(
      [expense('A', 20000, '2026-11-01', ['A', 'B'])], // B owes 100 from Nov 1
      [settle('B', 'A', 10000, '2026-11-05')], // pays it back 4 days later
    );
    assert.deepEqual(stats.B.closedByMonth['2026-11'], { amount: 10000, amountDays: 40000 });
    assert.deepEqual(stats.B.open, []);
  });

  it('keeps unpaid debt open with its start date', () => {
    const stats = settleStats([expense('A', 20000, '2026-11-01', ['A', 'B'])], []);
    assert.deepEqual(stats.B.open, [{ amount: 10000, since: '2026-11-01' }]);
  });

  it('paying for the group counts as paying back older debt', () => {
    const stats = settleStats(
      [
        expense('A', 20000, '2026-11-01', ['A', 'B']), // B owes A 100
        expense('B', 20000, '2026-11-03', ['A', 'B']), // B pays next bill: square again
      ],
      [],
    );
    assert.deepEqual(stats.B.open, []);
    assert.equal(stats.B.closedByMonth['2026-11'].amountDays, 10000 * 2);
  });
});

describe('computeBadges', () => {
  it('gives Big Spender, Always Pays First and Banker to the generous one', () => {
    const badges = computeBadges(
      input({ expenses: [expense('A', 30000, '2026-11-02'), expense('A', 9000, '2026-11-03'), expense('B', 3000, '2026-11-04')] }),
    );
    assert.equal(badgeOwner(badges, 'big_spender'), 'A');
    assert.equal(badgeOwner(badges, 'pays_first'), 'A');
    assert.equal(badgeOwner(badges, 'banker'), 'A');
  });

  it('only counts this month for monthly badges', () => {
    const badges = computeBadges(input({ expenses: [expense('A', 30000, '2026-10-02'), expense('B', 3000, '2026-11-04')] }));
    assert.equal(badgeOwner(badges, 'big_spender'), 'B');
  });

  it('crowns the Foodie by share of food', () => {
    const badges = computeBadges(
      input({ expenses: [expense('A', 60000, '2026-11-02', ['B', 'C'], 'food'), expense('A', 1000, '2026-11-03', ['C'], 'food')] }),
    );
    assert.equal(badgeOwner(badges, 'foodie'), 'C');
  });

  it('finds the Chindi: in on 5+ plans but rarely pays', () => {
    const expenses = [
      expense('A', 3000, '2026-11-01'),
      expense('B', 3000, '2026-11-02'),
      expense('A', 3000, '2026-11-03'),
      expense('B', 3000, '2026-11-04'),
      expense('A', 3000, '2026-11-05'),
    ];
    const badges = computeBadges(input({ expenses }));
    assert.equal(badgeOwner(badges, 'chindi'), 'C');
  });

  it('never gives Chindi in a group of two', () => {
    const two = members.slice(0, 2);
    const expenses = Array.from({ length: 6 }, (_, i) => expense('A', 2000, `2026-11-0${i + 1}`, ['A', 'B']));
    const badges = computeBadges(input({ members: two, expenses }));
    assert.equal(badgeOwner(badges, 'chindi'), undefined);
  });

  it('spots the Slow Settler and the Speedy Settler', () => {
    const expenses = [expense('A', 30000, '2026-11-01')]; // B and C each owe 100
    const settlements = [settle('B', 'A', 10000, '2026-11-02')]; // B pays in 1 day, C never
    const badges = computeBadges(input({ expenses, settlements, today: '2026-11-15' }));
    assert.equal(badgeOwner(badges, 'speedy_settler'), 'B');
    assert.equal(badgeOwner(badges, 'slow_settler'), 'C');
  });

  it('calls out a Ghost who has owed money for 2 weeks and went quiet', () => {
    const badges = computeBadges(
      input({ expenses: [expense('A', 30000, '2026-11-01', ['A', 'B'])], today: '2026-11-20' }),
    );
    assert.equal(badgeOwner(badges, 'ghost'), 'B');
  });

  it('does not call a newcomer a Ghost just because their debt is new', () => {
    const badges = computeBadges(
      input({ expenses: [expense('A', 30000, '2026-11-15', ['A', 'B'])], today: '2026-11-20' }),
    );
    assert.equal(badgeOwner(badges, 'ghost'), undefined);
  });

  it('gives no badge when people are tied for it', () => {
    // Everyone shares food equally, so nobody is the Foodie.
    const badges = computeBadges(input({ expenses: [expense('A', 30000, '2026-11-02', ['A', 'B', 'C'], 'food')] }));
    assert.equal(badgeOwner(badges, 'foodie'), undefined);
  });

  it('rewards Most Improved when payback gets 2+ days faster', () => {
    const expenses = [expense('A', 20000, '2026-10-01', ['A', 'B']), expense('A', 20000, '2026-11-01', ['A', 'B'])];
    const settlements = [settle('B', 'A', 10000, '2026-10-11'), settle('B', 'A', 10000, '2026-11-02')];
    const badges = computeBadges(input({ expenses, settlements }));
    assert.equal(badgeOwner(badges, 'most_improved'), 'B');
  });

  it('hides roasts when the group turns them off', () => {
    const badges = computeBadges(input({ expenses: [expense('A', 30000, '2026-11-01')], roastLevel: 'off' }));
    assert.ok(badges.every((b) => !b.negative));
    assert.equal(badgeOwner(badges, 'big_spender'), 'A'); // positive ones stay
  });

  it('hides roasts for someone who opted out', () => {
    const optedOut = members.map((m) => (m.id === 'B' ? { ...m, hideNegative: true } : m));
    const badges = computeBadges(input({ members: optedOut, expenses: [expense('A', 30000, '2026-11-01')] }));
    assert.ok(!badges.some((b) => b.negative && b.userId === 'B'));
  });

  it('uses spicier lines on the spicy setting', () => {
    const mild = computeBadges(input({ expenses: [expense('A', 30000, '2026-11-01')] }));
    const spicy = computeBadges(input({ expenses: [expense('A', 30000, '2026-11-01')], roastLevel: 'spicy' }));
    assert.notEqual(mild.find((b) => b.id === 'big_spender')?.line, spicy.find((b) => b.id === 'big_spender')?.line);
  });
});

describe('computeNudges', () => {
  it('lists people who owe, oldest debt first, with days waited', () => {
    const nudges = computeNudges({
      ...input({
        expenses: [expense('A', 20000, '2026-11-01', ['A', 'B']), expense('A', 20000, '2026-11-10', ['A', 'C'])],
        today: '2026-11-13',
      }),
      groupName: 'Flat 302',
    });
    assert.deepEqual(
      nudges.map((x) => [x.userId, x.amount, x.days]),
      [
        ['B', 10000, 12],
        ['C', 10000, 3],
      ],
    );
    assert.match(nudges[0].message, /Bunty/);
  });
});

describe('nudgeMessage', () => {
  it('stays polite when roasts are off, gets cheeky on spicy', () => {
    assert.match(nudgeMessage('Bunty', 50000, 40, 'Goa', 'off'), /quick reminder/);
    assert.match(nudgeMessage('Bunty', 50000, 40, 'Goa', 'spicy'), /old enough to vote/);
    assert.match(nudgeMessage('Bunty', 50000, 10, 'Goa', 'spicy'), /misses you/);
  });
});

describe('computeRecap', () => {
  it('sums the month and finds the top category and biggest bill', () => {
    const recap = computeRecap(
      [
        expense('A', 50000, '2026-11-02', ['A', 'B'], 'food'),
        expense('A', 20000, '2026-11-03', ['A', 'B'], 'food'),
        expense('A', 60000, '2026-11-04', ['A', 'B'], 'travel'),
        expense('A', 99999, '2026-10-30', ['A', 'B'], 'travel'),
      ],
      '2026-11',
    );
    assert.equal(recap.total, 130000);
    assert.equal(recap.count, 3);
    assert.deepEqual(recap.topCategory, { id: 'food', amount: 70000 });
    assert.equal(recap.biggest?.amount, 60000);
  });

  it('knows the month before January', () => {
    assert.equal(previousMonth('2026-01'), '2025-12');
    assert.equal(previousMonth('2026-11'), '2026-10');
  });
});
