import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Token persistence. We use expo-secure-store on iOS (Keychain) and Android
 * (EncryptedSharedPreferences). On web (Expo for Web / preview), SecureStore
 * is unavailable — we transparently fall back to localStorage so the same
 * code path keeps working in the browser dev preview.
 *
 * Keys are prefixed `nf_` so we never collide with another app sharing the
 * keychain access group during dev.
 */

const ACCESS_KEY = "nf_access_token";
const REFRESH_KEY = "nf_refresh_token";

const isWeb = Platform.OS === "web";

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    if (typeof globalThis.localStorage !== "undefined") {
      globalThis.localStorage.setItem(key, value);
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    if (typeof globalThis.localStorage === "undefined") return null;
    return globalThis.localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    if (typeof globalThis.localStorage !== "undefined") {
      globalThis.localStorage.removeItem(key);
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function saveTokens(input: {
  accessToken: string;
  refreshToken: string;
}): Promise<void> {
  await Promise.all([
    setItem(ACCESS_KEY, input.accessToken),
    setItem(REFRESH_KEY, input.refreshToken),
  ]);
}

export async function loadTokens(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
}> {
  const [accessToken, refreshToken] = await Promise.all([
    getItem(ACCESS_KEY),
    getItem(REFRESH_KEY),
  ]);
  return { accessToken, refreshToken };
}

export async function clearTokens(): Promise<void> {
  await Promise.all([deleteItem(ACCESS_KEY), deleteItem(REFRESH_KEY)]);
}
