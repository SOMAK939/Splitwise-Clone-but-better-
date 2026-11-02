/**
 * sounds.ts — little sound effects for fun moments.
 *
 * Want different sounds? Replace the files in assets/sounds/ with your own
 * clips (keep the same names, mp3 works everywhere). Keep them short: under
 * about 1 second feels snappy, longer gets annoying fast.
 *
 * Each person can turn sounds off in Profile. The choice is saved on their
 * phone (not in the database), so it's per device.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

/** Every sound the app can play, and the file for it. */
const FILES = {
  'add-expense': require('@/assets/sounds/add-expense.mp3'), // 💸 ka-ching
  'settle-up': require('@/assets/sounds/settle-up.mp3'), // 🎉 ta-da
  nudge: require('@/assets/sounds/nudge.mp3'), // 👀 ding-dong
  delete: require('@/assets/sounds/delete.mp3'), // 🗑️ whoosh
  roast: require('@/assets/sounds/roast.mp3'), // 🎺 sad trombone
};

export type SoundName = keyof typeof FILES;

const STORAGE_KEY = 'splitfree.soundsOn';
const VOLUME = 0.6; // fairly quiet: fun, not startling

// Remember the setting in memory so we don't read storage on every tap.
let soundsOn: boolean | null = null;
// One player per sound, created the first time it's needed and then reused.
const players: Partial<Record<SoundName, AudioPlayer>> = {};

export async function getSoundsOn(): Promise<boolean> {
  if (soundsOn === null) {
    try {
      soundsOn = (await AsyncStorage.getItem(STORAGE_KEY)) !== 'off'; // on by default
    } catch {
      soundsOn = true;
    }
  }
  return soundsOn;
}

export async function setSoundsOn(on: boolean): Promise<void> {
  soundsOn = on;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // Storage can fail in private browsing; the setting still works until reload.
  }
}

/**
 * Play a sound, if sounds are on. Never throws: a sound that fails to play
 * (e.g. the browser blocked it) must never break the action itself.
 */
export async function playSound(name: SoundName): Promise<void> {
  try {
    if (!(await getSoundsOn())) return;
    let player = players[name];
    if (!player) {
      player = createAudioPlayer(FILES[name]);
      player.volume = VOLUME;
      players[name] = player;
    }
    await player.seekTo(0); // restart if it was played before
    player.play();
  } catch {
    // Ignore: sound is a nice extra, not essential.
  }
}
