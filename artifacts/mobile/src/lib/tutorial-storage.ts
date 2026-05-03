import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Persists per-game "tutorial seen" flags so the one-screen tutorial
 * (FR-4.8) only ever shows once per game per device.
 *
 * Backend mirrors `tokenStorage.ts` / `guest.ts`: SecureStore on native
 * (Keychain on iOS, EncryptedSharedPreferences on Android), AsyncStorage
 * on web because SecureStore isn't supported there. The flag itself is
 * not security-sensitive — we just want a consistent backend.
 */

const KEY_PREFIX = "nf_tutorial_seen_";

function key(slug: string): string {
  return `${KEY_PREFIX}${slug}`;
}

async function readFlag(slug: string): Promise<boolean> {
  try {
    const raw =
      Platform.OS === "web"
        ? await AsyncStorage.getItem(key(slug))
        : await SecureStore.getItemAsync(key(slug));
    return raw === "1";
  } catch {
    // If the storage layer fails for any reason we fail OPEN — the user
    // sees the tutorial again, which is the safe default.
    return false;
  }
}

async function writeFlag(slug: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      await AsyncStorage.setItem(key(slug), "1");
    } else {
      await SecureStore.setItemAsync(key(slug), "1");
    }
  } catch (err) {
    console.warn("tutorial-storage.write_failed", err);
  }
}

/**
 * Tutorial-seen state for a single game.
 *
 * `seen === undefined` means we're still hydrating from storage — the
 * caller should render a neutral loading state, not the tutorial,
 * otherwise the tutorial would flash and disappear for users who have
 * already dismissed it.
 */
export type TutorialState = {
  seen: boolean | undefined;
  markSeen: () => Promise<void>;
};

export function useTutorialSeen(slug: string): TutorialState {
  const [seen, setSeen] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const v = await readFlag(slug);
      if (!cancelled) setSeen(v);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return {
    seen,
    markSeen: async () => {
      setSeen(true);
      await writeFlag(slug);
    },
  };
}

// Test helper — clears any in-process cache. The on-disk flags are
// owned by SecureStore / AsyncStorage which jest mocks per-test.
export async function _resetTutorialForTests(slug: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(key(slug));
  } else {
    await SecureStore.deleteItemAsync(key(slug));
  }
}
