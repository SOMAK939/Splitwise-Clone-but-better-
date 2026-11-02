/**
 * balances.ts — the money math behind SplitFree.
 *
 * Everything in here is a "pure function": it takes plain data in and gives
 * plain data back, with no database or screen code. That makes it easy to test
 * (see balances.test.ts) and easy to trust.
 *
 * IMPORTANT: all amounts are whole numbers of PAISE (1 rupee = 100 paise).
 * We never use decimals like 33.33 for money, because computers store decimals
 * imprecisely (0.1 + 0.2 = 0.30000000000000004 in JavaScript!). Whole paise
 * add up exactly, every time.
 */

/** Someone who paid (part of) a bill. */
export type Payer = { userId: string; amount: number };

/** Someone's share of a bill, i.e. how much of it they "used". */
export type Share = { userId: string; amount: number };

/** The parts of an expense the math needs. */
export type ExpenseMoney = { payers: Payer[]; shares: Share[] };

/** A recorded payment from one person to another to settle up. */
export type SettlementMoney = { fromUser: string; toUser: string; amount: number };

/** A suggested payment: `from` should pay `to` this many paise. */
export type Transfer = { from: string; to: string; amount: number };

/**
 * Net balance per person.
 * Positive = the group owes them money. Negative = they owe the group.
 */
export type Balances = Record<string, number>;

/**
 * Split a total equally between people.
 *
 * Example: ₹100 (10000 paise) between 3 people can't be split exactly.
 * We give everyone 3333 paise, then hand out the leftover 1 paisa to the first
 * person, so the shares still add up to exactly 10000.
 */
export function splitEqually(total: number, userIds: string[]): Share[] {
  if (userIds.length === 0) return [];
  const base = Math.floor(total / userIds.length); // everyone gets at least this
  let leftover = total - base * userIds.length; // paise that didn't divide evenly

  return userIds.map((userId) => {
    const extra = leftover > 0 ? 1 : 0; // first few people get 1 extra paisa
    leftover -= extra;
    return { userId, amount: base + extra };
  });
}

/**
 * Work out everyone's net balance from expenses and settlements.
 *
 * Analogy: think of each person's balance as a scoreboard.
 * - Paying for something adds to your score (people now owe you).
 * - Your share of something subtracts from your score (you used it).
 * - Paying someone back adds to your score and subtracts from theirs.
 * At the end, all scores always add up to zero.
 */
export function computeBalances(
  expenses: ExpenseMoney[],
  settlements: SettlementMoney[] = [],
): Balances {
  const balances: Balances = {};
  const add = (userId: string, amount: number) => {
    balances[userId] = (balances[userId] ?? 0) + amount;
  };

  for (const expense of expenses) {
    for (const payer of expense.payers) add(payer.userId, payer.amount);
    for (const share of expense.shares) add(share.userId, -share.amount);
  }

  for (const s of settlements) {
    add(s.fromUser, s.amount); // the payer's debt shrinks
    add(s.toUser, -s.amount); // the receiver is owed less
  }

  return balances;
}

/**
 * Turn balances into the FEWEST payments that settle everyone up.
 *
 * Idea: repeatedly match the person who owes the most with the person who is
 * owed the most, and have one pay the other as much as possible. This "greedy"
 * approach needs at most (number of people - 1) payments.
 *
 * Example: A owes B ₹100 and B owes C ₹100. Instead of two payments,
 * simplified it becomes one: A pays C ₹100.
 */
export function simplifyDebts(balances: Balances): Transfer[] {
  // People who are owed money (creditors) and people who owe (debtors).
  const creditors = Object.entries(balances)
    .filter(([, amount]) => amount > 0)
    .map(([userId, amount]) => ({ userId, amount }));
  const debtors = Object.entries(balances)
    .filter(([, amount]) => amount < 0)
    .map(([userId, amount]) => ({ userId, amount: -amount })); // store as positive

  const transfers: Transfer[] = [];

  while (creditors.length > 0 && debtors.length > 0) {
    // Biggest first. Sorting each round keeps the logic simple to read;
    // groups are small, so speed is not a concern.
    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    const creditor = creditors[0];
    const debtor = debtors[0];
    const amount = Math.min(creditor.amount, debtor.amount);

    transfers.push({ from: debtor.userId, to: creditor.userId, amount });

    creditor.amount -= amount;
    debtor.amount -= amount;
    if (creditor.amount === 0) creditors.shift();
    if (debtor.amount === 0) debtors.shift();
  }

  return transfers;
}

/**
 * Who owes whom WITHOUT simplifying: every pair of people keeps its own debt.
 * Used when a group turns "simplify debts" off.
 *
 * For each expense, every person's share is owed to the payers, in proportion
 * to how much each payer paid. Then debts in both directions between the same
 * two people cancel out.
 */
export function pairwiseDebts(
  expenses: ExpenseMoney[],
  settlements: SettlementMoney[] = [],
): Transfer[] {
  // owes[a][b] = how much a owes b (can go negative while we net things out)
  const owes: Record<string, Record<string, number>> = {};
  const addDebt = (from: string, to: string, amount: number) => {
    if (from === to || amount === 0) return;
    owes[from] ??= {};
    owes[from][to] = (owes[from][to] ?? 0) + amount;
  };

  for (const expense of expenses) {
    const totalPaid = expense.payers.reduce((sum, p) => sum + p.amount, 0);
    if (totalPaid === 0) continue;
    for (const share of expense.shares) {
      // Split this person's share across payers, proportional to what each paid.
      const parts = splitProportionally(share.amount, expense.payers);
      parts.forEach((part, i) => addDebt(share.userId, expense.payers[i].userId, part));
    }
  }

  // A settlement from A to B reduces what A owes B.
  for (const s of settlements) addDebt(s.fromUser, s.toUser, -s.amount);

  // Net out each pair (A owes B ₹50, B owes A ₹20 → A owes B ₹30).
  const transfers: Transfer[] = [];
  const seen = new Set<string>();
  for (const a of Object.keys(owes)) {
    for (const b of Object.keys(owes[a])) {
      const key = [a, b].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const net = (owes[a]?.[b] ?? 0) - (owes[b]?.[a] ?? 0);
      if (net > 0) transfers.push({ from: a, to: b, amount: net });
      if (net < 0) transfers.push({ from: b, to: a, amount: -net });
    }
  }
  return transfers.sort((x, y) => y.amount - x.amount);
}

/** Split `amount` into whole-paise parts proportional to each payer's amount. */
function splitProportionally(amount: number, payers: Payer[]): number[] {
  const totalPaid = payers.reduce((sum, p) => sum + p.amount, 0);
  const parts = payers.map((p) => Math.floor((amount * p.amount) / totalPaid));
  // Give any leftover paise (from rounding down) to the first payers.
  let leftover = amount - parts.reduce((sum, x) => sum + x, 0);
  for (let i = 0; leftover > 0; i = (i + 1) % parts.length) {
    parts[i] += 1;
    leftover -= 1;
  }
  return parts;
}

/** Convert rupees typed by a person ("249.50") into paise (24950). */
export function rupeesToPaise(input: string): number | null {
  const cleaned = input.replace(/[₹,\s]/g, '');
  // Up to 2 decimal places, nothing else allowed.
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole, decimals = ''] = cleaned.split('.');
  return Number(whole) * 100 + Number(decimals.padEnd(2, '0'));
}

/** Format paise as Indian rupees, e.g. 123456 → "₹1,234.56", 50000 → "₹500". */
export function formatINR(paise: number): string {
  const rupees = Math.abs(paise) / 100;
  const hasPaise = Math.abs(paise) % 100 !== 0;
  const text = rupees.toLocaleString('en-IN', {
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${paise < 0 ? '-' : ''}₹${text}`;
}
