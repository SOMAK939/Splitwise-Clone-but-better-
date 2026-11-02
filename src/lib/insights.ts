/**
 * insights.ts — the fun part: badges, nudges and the monthly recap.
 *
 * Like balances.ts, everything here is a pure function: plain data in, plain
 * data out, no database or screens. That keeps the rules easy to read, easy
 * to tweak, and easy to test (see insights.test.ts).
 *
 * Amounts are in paise (₹1 = 100 paise). Dates are "YYYY-MM-DD" strings.
 */
import { computeBalances, formatINR, type Payer, type Share } from './balances.ts';

// ---------- Input shapes ----------

export type RoastLevel = 'off' | 'mild' | 'spicy';

export type InsightMember = {
  id: string;
  name: string;
  /** This person chose to hide their own negative badges. */
  hideNegative: boolean;
};

export type InsightExpense = {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string; // when it was spent
  createdBy: string;
  payers: Payer[];
  shares: Share[];
};

export type InsightSettlement = {
  fromUser: string;
  toUser: string;
  amount: number;
  date: string;
  createdBy: string;
};

export type InsightInput = {
  members: InsightMember[];
  expenses: InsightExpense[];
  settlements: InsightSettlement[];
  roastLevel: RoastLevel;
  /** "Today", passed in so tests can pretend it's any day. */
  today: string;
};

// ---------- Output shapes ----------

export type BadgeId =
  | 'big_spender'
  | 'pays_first'
  | 'foodie'
  | 'banker'
  | 'speedy_settler'
  | 'most_improved'
  | 'chindi'
  | 'slow_settler'
  | 'ghost';

export type Badge = {
  id: BadgeId;
  userId: string;
  emoji: string;
  title: string;
  /** A short, fun line explaining why they got it. */
  line: string;
  /** Negative badges are the "roasts". They can be switched off. */
  negative: boolean;
};

export type Nudge = {
  userId: string;
  amount: number; // how much they owe in total
  days: number; // age of their oldest unpaid debt
  /** A ready-to-send reminder message, in the group's roast style. */
  message: string;
};

export type Recap = {
  month: string; // "2026-11"
  total: number;
  count: number;
  topCategory: { id: string; amount: number } | null;
  biggest: { description: string; amount: number } | null;
};

// ---------- Small date helpers ----------

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days between two "YYYY-MM-DD" dates (b minus a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);
}

/** "2026-11-02" → "2026-11" */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** The month before, e.g. "2026-01" → "2025-12". */
export function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

// ---------- How fast does each person pay back? ----------

/**
 * For each person, track WHEN each rupee of debt started and WHEN it was paid.
 *
 * Analogy: a queue at a counter. Every time you end up owing money, a ticket
 * with today's date joins your queue. Every time you pay (or pay for the group,
 * which cancels debt), the oldest tickets are served first. How long a ticket
 * waited = how long you took to settle that money.
 */
export type SettleStats = {
  /** Paid-back debt, grouped by the month it was paid back in. */
  closedByMonth: Record<string, { amount: number; amountDays: number }>;
  /** Debt still unpaid: each piece with the date it started. */
  open: { amount: number; since: string }[];
};

export function settleStats(expenses: InsightExpense[], settlements: InsightSettlement[]): Record<string, SettleStats> {
  // 1. Turn everything into dated "balance changes" per person.
  type Change = { date: string; userId: string; delta: number; order: number };
  const changes: Change[] = [];
  let order = 0;
  for (const e of expenses) {
    const net: Record<string, number> = {};
    for (const p of e.payers) net[p.userId] = (net[p.userId] ?? 0) + p.amount;
    for (const s of e.shares) net[s.userId] = (net[s.userId] ?? 0) - s.amount;
    for (const [userId, delta] of Object.entries(net)) {
      if (delta !== 0) changes.push({ date: e.date, userId, delta, order: order++ });
    }
  }
  for (const s of settlements) {
    changes.push({ date: s.date, userId: s.fromUser, delta: s.amount, order: order++ });
    changes.push({ date: s.date, userId: s.toUser, delta: -s.amount, order: order++ });
  }
  // Oldest first (ties keep their original order).
  changes.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);

  // 2. Replay them through each person's queue.
  const stats: Record<string, SettleStats & { credit: number }> = {};
  for (const c of changes) {
    const st = (stats[c.userId] ??= { closedByMonth: {}, open: [], credit: 0 });
    if (c.delta < 0) {
      // Owing more: first use up any money others owed them, then queue a debt ticket.
      let need = -c.delta;
      const fromCredit = Math.min(st.credit, need);
      st.credit -= fromCredit;
      need -= fromCredit;
      if (need > 0) st.open.push({ amount: need, since: c.date });
    } else {
      // Paying back: serve the oldest tickets first.
      let pay = c.delta;
      while (pay > 0 && st.open.length > 0) {
        const ticket = st.open[0];
        const used = Math.min(ticket.amount, pay);
        const month = monthOf(c.date);
        const bucket = (st.closedByMonth[month] ??= { amount: 0, amountDays: 0 });
        bucket.amount += used;
        bucket.amountDays += used * daysBetween(ticket.since, c.date);
        ticket.amount -= used;
        pay -= used;
        if (ticket.amount === 0) st.open.shift();
      }
      st.credit += pay; // anything left over means others now owe them
    }
  }

  const result: Record<string, SettleStats> = {};
  for (const [userId, { closedByMonth, open }] of Object.entries(stats)) result[userId] = { closedByMonth, open };
  return result;
}

/** Average days to pay back money that was paid back in `month` (null if none). */
function avgClosedDays(st: SettleStats | undefined, month: string): number | null {
  const bucket = st?.closedByMonth[month];
  return bucket && bucket.amount > 0 ? bucket.amountDays / bucket.amount : null;
}

/**
 * Average "waiting time" of debt for the Slow Settler badge: money paid back
 * this month, plus money still unpaid (counted up to today).
 */
function avgSlowDays(st: SettleStats | undefined, month: string, today: string): number | null {
  if (!st) return null;
  let amount = 0;
  let amountDays = 0;
  const bucket = st.closedByMonth[month];
  if (bucket) {
    amount += bucket.amount;
    amountDays += bucket.amountDays;
  }
  for (const t of st.open) {
    amount += t.amount;
    amountDays += t.amount * daysBetween(t.since, today);
  }
  return amount > 0 ? amountDays / amount : null;
}

// ---------- Badges ----------

/** Badge wording for each roast level. {name} is filled in later. */
const BADGE_TEXT: Record<BadgeId, { emoji: string; title: string; mild: string; spicy: string; negative: boolean }> = {
  big_spender: {
    emoji: '💸', title: 'Big Spender', negative: false,
    mild: 'Paid the most for the group this month.',
    spicy: 'Basically the group’s ATM this month.',
  },
  pays_first: {
    emoji: '👑', title: 'Always Pays First', negative: false,
    mild: 'Picked up the most bills this month.',
    spicy: 'Wallet out before anyone even asks for the bill.',
  },
  foodie: {
    emoji: '🍕', title: 'Foodie', negative: false,
    mild: 'Biggest share of food and drinks this month.',
    spicy: 'Single-handedly keeping Swiggy in business.',
  },
  banker: {
    emoji: '🏦', title: 'The Banker', negative: false,
    mild: 'Owed the most by everyone right now.',
    spicy: 'Running an interest-free loan service. Collect your dues!',
  },
  speedy_settler: {
    emoji: '⚡', title: 'Speedy Settler', negative: false,
    mild: 'Pays back in under 2 days on average.',
    spicy: 'Pays back faster than UPI can send the notification.',
  },
  most_improved: {
    emoji: '📈', title: 'Most Improved', negative: false,
    mild: 'Settling up much faster than last month.',
    spicy: 'Character development! Paying back way faster than last month.',
  },
  chindi: {
    emoji: '🪙', title: 'Chindi of the Month', negative: true,
    mild: 'Joins lots of plans but rarely picks up the bill.',
    spicy: 'Shows up for every plan. Wallet never shows up.',
  },
  slow_settler: {
    emoji: '🐢', title: 'Slow Settler', negative: true,
    mild: 'Takes a while to pay back. Settle within 2 days to lose this badge.',
    spicy: 'Debts age like fine wine with this one. Pay up to shake it off!',
  },
  ghost: {
    emoji: '👻', title: 'Ghost', negative: true,
    mild: 'Owes money and has gone quiet for 2 weeks.',
    spicy: 'Owes money and vanished. Have you checked under the bed?',
  },
};

/**
 * Pick the member with the highest score. People with no score (null) or a
 * score below `minScore` can't win. A tie at the top means nobody stands out,
 * so nobody gets the badge (e.g. no Foodie when everyone split food equally).
 */
function best(memberIds: string[], score: (id: string) => number | null, minScore = -Infinity): string | null {
  let winner: string | null = null;
  let winnerScore = -Infinity;
  let tied = false;
  for (const id of memberIds) {
    const s = score(id);
    if (s === null || s < minScore) continue;
    if (s > winnerScore) {
      winner = id;
      winnerScore = s;
      tied = false;
    } else if (s === winnerScore) {
      tied = true;
    }
  }
  return tied ? null : winner;
}

/**
 * Work out this month's badges for a group.
 *
 * Each badge goes to at most one person. Negative badges ("roasts") are left
 * out when the group's roast level is "off", for people who hid them, and
 * Chindi is never given in groups of fewer than 3 people.
 */
export function computeBadges(input: InsightInput): Badge[] {
  const { members, expenses, settlements, roastLevel, today } = input;
  const month = monthOf(today);
  const ids = members.map((m) => m.id);
  const monthExpenses = expenses.filter((e) => monthOf(e.date) === month);

  // Per-person totals for this month.
  const paid: Record<string, number> = {}; // money paid
  const payCount: Record<string, number> = {}; // bills paid
  const owed: Record<string, number> = {}; // total of their shares
  const joined: Record<string, number> = {}; // expenses they were part of
  const food: Record<string, number> = {}; // their share of food
  for (const e of monthExpenses) {
    for (const p of e.payers) {
      paid[p.userId] = (paid[p.userId] ?? 0) + p.amount;
      payCount[p.userId] = (payCount[p.userId] ?? 0) + 1;
    }
    for (const s of e.shares) {
      owed[s.userId] = (owed[s.userId] ?? 0) + s.amount;
      if (s.amount > 0) joined[s.userId] = (joined[s.userId] ?? 0) + 1;
      if (e.category === 'food') food[s.userId] = (food[s.userId] ?? 0) + s.amount;
    }
  }

  const balances = computeBalances(expenses, settlements);
  const stats = settleStats(expenses, settlements);
  const winners: Partial<Record<BadgeId, string | null>> = {};

  // --- Positive badges ---
  winners.big_spender = best(ids, (id) => paid[id] ?? null, 1);
  winners.pays_first = best(ids, (id) => payCount[id] ?? null, 2);
  winners.foodie = best(ids, (id) => food[id] ?? null, 1);
  winners.banker = best(ids, (id) => balances[id] ?? null, 1);
  // Fastest average payback this month, and it must be under 2 days.
  winners.speedy_settler = best(ids, (id) => {
    const avg = avgClosedDays(stats[id], month);
    return avg === null || avg >= 2 ? null : -avg; // lower days = better
  });
  // Biggest drop in payback time vs last month, at least 2 days faster.
  winners.most_improved = best(
    ids,
    (id) => {
      const now = avgClosedDays(stats[id], month);
      const before = avgClosedDays(stats[id], previousMonth(month));
      return now === null || before === null ? null : before - now;
    },
    2,
  );

  // --- Negative badges (roasts) ---
  // Chindi: in on at least 5 expenses but paid under half of their share.
  if (members.length >= 3) {
    winners.chindi = best(ids, (id) => {
      if ((joined[id] ?? 0) < 5 || !owed[id]) return null;
      const ratio = (paid[id] ?? 0) / owed[id];
      return ratio < 0.5 ? -ratio : null; // lowest ratio wins
    });
  }
  // Slow Settler: debts wait 7+ days on average.
  winners.slow_settler = best(ids, (id) => avgSlowDays(stats[id], month, today), 7);
  // Ghost: has owed money for 14+ days and hasn't added, paid or settled
  // anything in that time.
  winners.ghost = best(ids, (id) => {
    if ((balances[id] ?? 0) >= 0) return null;
    const oldestDebt = stats[id]?.open[0]?.since;
    if (!oldestDebt || daysBetween(oldestDebt, today) < 14) return null;
    const lastActive = [
      ...expenses.filter((e) => e.createdBy === id || e.payers.some((p) => p.userId === id)).map((e) => e.date),
      ...settlements.filter((s) => s.createdBy === id || s.fromUser === id).map((s) => s.date),
    ].sort().pop();
    const quietDays = lastActive ? daysBetween(lastActive, today) : Infinity;
    return quietDays >= 14 ? -(balances[id] ?? 0) : null; // owes most wins
  });

  // --- Turn winners into badges, respecting roast settings ---
  const badges: Badge[] = [];
  for (const [badgeId, userId] of Object.entries(winners) as [BadgeId, string | null][]) {
    if (!userId) continue;
    const text = BADGE_TEXT[badgeId];
    const member = members.find((m) => m.id === userId);
    if (text.negative && (roastLevel === 'off' || member?.hideNegative)) continue;
    badges.push({
      id: badgeId,
      userId,
      emoji: text.emoji,
      title: text.title,
      line: roastLevel === 'spicy' ? text.spicy : text.mild,
      negative: text.negative,
    });
  }
  return badges;
}

// ---------- Nudges ----------

/**
 * Friendly reminders for everyone who owes money, oldest debt first.
 * The message gets cheekier the longer a debt has waited (within the
 * group's roast level).
 */
export function computeNudges(input: InsightInput & { groupName: string }): Nudge[] {
  const { members, expenses, settlements, roastLevel, today, groupName } = input;
  const balances = computeBalances(expenses, settlements);
  const stats = settleStats(expenses, settlements);

  const nudges: Nudge[] = [];
  for (const m of members) {
    const owes = -(balances[m.id] ?? 0);
    if (owes <= 0) continue;
    const oldest = stats[m.id]?.open[0]?.since ?? today;
    const days = Math.max(0, daysBetween(oldest, today));
    nudges.push({ userId: m.id, amount: owes, days, message: nudgeMessage(m.name, owes, days, groupName, roastLevel) });
  }
  return nudges.sort((a, b) => b.days - a.days || b.amount - a.amount);
}

export function nudgeMessage(name: string, amount: number, days: number, group: string, roast: RoastLevel): string {
  const amt = formatINR(amount);
  if (roast === 'off' || days < 3) {
    return `Hi ${name}, quick reminder: you owe ${amt} in "${group}" on SplitFree. 🙏`;
  }
  if (roast === 'mild' || days < 7) {
    return `Hey ${name}! Your ${amt} in "${group}" has been waiting ${days} days. Settle up when you can 😊`;
  }
  if (days < 30) {
    return `${name}, it's been ${days} days. The ${amt} you owe in "${group}" misses you 🐢 Settle up on SplitFree!`;
  }
  return `${name}!! ${days} days?! The ${amt} you owe in "${group}" is old enough to vote. Pay up 😤`;
}

// ---------- Monthly recap ----------

export function computeRecap(expenses: InsightExpense[], month: string): Recap {
  const list = expenses.filter((e) => monthOf(e.date) === month);
  const byCategory: Record<string, number> = {};
  let biggest: Recap['biggest'] = null;
  let total = 0;
  for (const e of list) {
    total += e.amount;
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
    if (!biggest || e.amount > biggest.amount) biggest = { description: e.description, amount: e.amount };
  }
  const top = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
  return {
    month,
    total,
    count: list.length,
    topCategory: top ? { id: top[0], amount: top[1] } : null,
    biggest,
  };
}
