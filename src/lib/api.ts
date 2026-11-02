/**
 * api.ts — every way the app reads or writes data, in one place.
 *
 * Screens call these small functions instead of talking to Supabase directly.
 * That keeps screens simple, and if the database changes we fix it here once.
 *
 * Each function throws an Error if Supabase reports a problem, so screens can
 * show the message to the user.
 */
import {
  computeBalances,
  pairwiseDebts,
  simplifyDebts,
  type Balances,
  type ExpenseMoney,
  type SettlementMoney,
  type Transfer,
} from './balances';
import { supabase } from './supabase';

// ---------- Types: the shape of our data in the app ----------

export type Profile = { id: string; display_name: string; upi_id: string | null };

export type Group = {
  id: string;
  name: string;
  emoji: string;
  roast_level: 'off' | 'mild' | 'spicy';
  simplify_debts: boolean;
  invite_code: string;
};

export type Expense = {
  id: string;
  group_id: string;
  description: string;
  amount_paise: number;
  category: string;
  spent_on: string; // "2026-11-02"
  created_by: string;
  payers: { user_id: string; amount_paise: number }[];
  shares: { user_id: string; amount_paise: number }[];
};

export type Settlement = {
  id: string;
  group_id: string;
  from_user: string;
  to_user: string;
  amount_paise: number;
  method: 'upi' | 'cash' | 'other';
  settled_on: string;
};

/** Everything a group screen needs, loaded together. */
export type GroupDetail = {
  group: Group;
  members: Profile[];
  expenses: Expense[];
  settlements: Settlement[];
  balances: Balances;
  /** Suggested payments to settle everyone up. */
  transfers: Transfer[];
};

export const CATEGORIES = [
  { id: 'food', label: 'Food & drinks', emoji: '🍕' },
  { id: 'travel', label: 'Travel', emoji: '🚕' },
  { id: 'stay', label: 'Stay & rent', emoji: '🏠' },
  { id: 'groceries', label: 'Groceries', emoji: '🛒' },
  { id: 'bills', label: 'Bills', emoji: '💡' },
  { id: 'fun', label: 'Fun', emoji: '🎉' },
  { id: 'general', label: 'Other', emoji: '🧾' },
] as const;

export function categoryEmoji(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.emoji ?? '🧾';
}

/** Small helper: turn a Supabase error into a normal thrown Error. */
function check<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

// ---------- Profile ----------

export async function getProfile(userId: string): Promise<Profile> {
  return check(
    await supabase.from('profiles').select('id, display_name, upi_id').eq('id', userId).single(),
  );
}

export async function updateProfile(
  userId: string,
  changes: { display_name?: string; upi_id?: string | null },
): Promise<void> {
  check(await supabase.from('profiles').update(changes).eq('id', userId));
}

// ---------- Groups ----------

/** Groups I'm in. RLS already limits this to my groups. */
export async function listMyGroups(): Promise<Group[]> {
  return check(
    await supabase
      .from('groups')
      .select('id, name, emoji, roast_level, simplify_debts, invite_code')
      .order('created_at', { ascending: false }),
  );
}

export async function createGroup(name: string, emoji: string): Promise<Group> {
  return check(await supabase.rpc('create_group', { p_name: name, p_emoji: emoji }));
}

/** Join with an invite code; returns the group's id. */
export async function joinGroup(inviteCode: string): Promise<string> {
  return check(await supabase.rpc('join_group', { p_invite_code: inviteCode }));
}

export async function updateGroup(
  groupId: string,
  changes: Partial<Pick<Group, 'name' | 'emoji' | 'roast_level' | 'simplify_debts'>>,
): Promise<void> {
  check(await supabase.from('groups').update(changes).eq('id', groupId));
}

/** Load a group with its members, expenses, settlements and balances. */
export async function getGroupDetail(groupId: string): Promise<GroupDetail> {
  // Run the four queries at the same time instead of one after another.
  const [groupRes, membersRes, expensesRes, settlementsRes] = await Promise.all([
    supabase
      .from('groups')
      .select('id, name, emoji, roast_level, simplify_debts, invite_code')
      .eq('id', groupId)
      .single(),
    // "profiles(...)" pulls in each member's profile through the foreign key.
    supabase.from('group_members').select('profiles(id, display_name, upi_id)').eq('group_id', groupId),
    supabase
      .from('expenses')
      .select(
        'id, group_id, description, amount_paise, category, spent_on, created_by, ' +
          'payers:expense_payers(user_id, amount_paise), shares:expense_shares(user_id, amount_paise)',
      )
      .eq('group_id', groupId)
      .order('spent_on', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('settlements')
      .select('id, group_id, from_user, to_user, amount_paise, method, settled_on')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false }),
  ]);

  const group = check(groupRes) as Group;
  const members = (check(membersRes) as unknown as { profiles: Profile }[]).map((m) => m.profiles);
  const expenses = check(expensesRes) as unknown as Expense[];
  const settlements = check(settlementsRes) as Settlement[];

  const money = toMoney(expenses, settlements);
  const balances = computeBalances(money.expenses, money.settlements);
  // Make sure every member shows up, even with a zero balance.
  for (const m of members) balances[m.id] ??= 0;

  const transfers = group.simplify_debts
    ? simplifyDebts(balances)
    : pairwiseDebts(money.expenses, money.settlements);

  return { group, members, expenses, settlements, balances, transfers };
}

/** My net balance in each of my groups (for the home screen). */
export async function getMyBalancesByGroup(
  userId: string,
  groupIds: string[],
): Promise<Record<string, number>> {
  if (groupIds.length === 0) return {};
  const [expensesRes, settlementsRes] = await Promise.all([
    supabase
      .from('expenses')
      .select('group_id, payers:expense_payers(user_id, amount_paise), shares:expense_shares(user_id, amount_paise)')
      .in('group_id', groupIds),
    supabase.from('settlements').select('group_id, from_user, to_user, amount_paise').in('group_id', groupIds),
  ]);
  const expenses = check(expensesRes) as unknown as Expense[];
  const settlements = check(settlementsRes) as Settlement[];

  const result: Record<string, number> = {};
  for (const gid of groupIds) {
    const money = toMoney(
      expenses.filter((e) => e.group_id === gid),
      settlements.filter((s) => s.group_id === gid),
    );
    result[gid] = computeBalances(money.expenses, money.settlements)[userId] ?? 0;
  }
  return result;
}

/** Convert database rows into the plain shapes balances.ts works with. */
function toMoney(expenses: Expense[], settlements: Settlement[]) {
  return {
    expenses: expenses.map<ExpenseMoney>((e) => ({
      payers: e.payers.map((p) => ({ userId: p.user_id, amount: Number(p.amount_paise) })),
      shares: e.shares.map((s) => ({ userId: s.user_id, amount: Number(s.amount_paise) })),
    })),
    settlements: settlements.map<SettlementMoney>((s) => ({
      fromUser: s.from_user,
      toUser: s.to_user,
      amount: Number(s.amount_paise),
    })),
  };
}

// ---------- Expenses ----------

export async function createExpense(input: {
  groupId: string;
  description: string;
  amountPaise: number;
  category: string;
  payers: { user_id: string; amount_paise: number }[];
  shares: { user_id: string; amount_paise: number }[];
}): Promise<string> {
  return check(
    await supabase.rpc('create_expense', {
      p_group_id: input.groupId,
      p_description: input.description,
      p_amount_paise: input.amountPaise,
      p_payers: input.payers,
      p_shares: input.shares,
      p_category: input.category,
    }),
  );
}

export async function deleteExpense(expenseId: string): Promise<void> {
  check(await supabase.from('expenses').delete().eq('id', expenseId));
}

// ---------- Settling up ----------

export async function recordSettlement(input: {
  groupId: string;
  fromUser: string;
  toUser: string;
  amountPaise: number;
  method: Settlement['method'];
}): Promise<void> {
  check(
    await supabase.from('settlements').insert({
      group_id: input.groupId,
      from_user: input.fromUser,
      to_user: input.toUser,
      amount_paise: input.amountPaise,
      method: input.method,
    }),
  );
}

/**
 * Build a UPI payment link. Opening it on a phone shows a list of UPI apps
 * (GPay, PhonePe, Paytm...) with the payee and amount already filled in.
 */
export function upiLink(payee: Profile, amountPaise: number, note: string): string | null {
  if (!payee.upi_id) return null;
  const params = new URLSearchParams({
    pa: payee.upi_id, // payee address, e.g. rahul@okicici
    pn: payee.display_name, // payee name
    am: (amountPaise / 100).toFixed(2), // amount in rupees
    cu: 'INR',
    tn: note.slice(0, 50), // transaction note
  });
  return `upi://pay?${params.toString()}`;
}

// ---------- Live updates ----------

/**
 * Call `onChange` whenever someone adds or deletes an expense or payment in
 * this group, so everyone's screen stays up to date. Returns a function that
 * stops listening.
 */
export function subscribeToGroup(groupId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`group-${groupId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'expenses', filter: `group_id=eq.${groupId}` },
      onChange,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'settlements', filter: `group_id=eq.${groupId}` },
      onChange,
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
