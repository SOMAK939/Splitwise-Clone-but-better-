/**
 * pending-invite.ts — remembers an invite code while someone logs in.
 *
 * If a friend opens an invite link before they have an account, we save the
 * code, let them sign up, then join the group automatically on the home screen.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'splitfree.pendingInvite';

export async function savePendingInvite(code: string) {
  await AsyncStorage.setItem(KEY, code);
}

/** Returns the saved code (if any) and forgets it, so it's used only once. */
export async function takePendingInvite(): Promise<string | null> {
  const code = await AsyncStorage.getItem(KEY);
  if (code) await AsyncStorage.removeItem(KEY);
  return code;
}
