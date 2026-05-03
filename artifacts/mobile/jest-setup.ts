/* eslint-env node, jest */
/**
 * Jest bootstrap for the NeuroFit mobile package.
 *
 * Goals:
 *   - Make every `useTranslation()` call resolve to a stable identity
 *     function so tests can assert on translation KEYS instead of locale
 *     copy. That keeps tests stable across copy changes.
 *   - Stub out native modules that don't exist in the JSDOM-ish test
 *     environment (expo-secure-store, expo-router, expo-haptics).
 *
 * Lives at the package root so jest's rootDir picks it up via the
 * `setupFilesAfterEach` config in package.json.
 */

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && typeof opts === "object") {
        // Render `{{var}}` interpolations so progress strings look natural.
        let out = key;
        for (const [k, v] of Object.entries(opts)) {
          out = out.replace(`{{${k}}}`, String(v));
        }
        return out;
      }
      return key;
    },
    i18n: { changeLanguage: () => Promise.resolve() },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

jest.mock("expo-secure-store", () => ({
  __esModule: true,
  setItemAsync: jest.fn(async () => undefined),
  getItemAsync: jest.fn(async () => null),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock("expo-router", () => ({
  __esModule: true,
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
  Stack: ({ children }: { children?: unknown }) => children ?? null,
  Link: ({ children }: { children?: unknown }) => children ?? null,
}));

// In-memory AsyncStorage for tests. Keeps writes deterministic and avoids
// the "NativeModule: AsyncStorage is null" error that the real package
// throws under jsdom.
jest.mock("@react-native-async-storage/async-storage", () => {
  let store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => (k in store ? store[k] : null)),
      setItem: jest.fn(async (k: string, v: string) => {
        store[k] = v;
      }),
      removeItem: jest.fn(async (k: string) => {
        delete store[k];
      }),
      clear: jest.fn(async () => {
        store = {};
      }),
      getAllKeys: jest.fn(async () => Object.keys(store)),
      multiGet: jest.fn(async (keys: string[]) =>
        keys.map((k) => [k, k in store ? store[k] : null] as [string, string | null]),
      ),
      multiSet: jest.fn(async (pairs: [string, string][]) => {
        for (const [k, v] of pairs) store[k] = v;
      }),
      multiRemove: jest.fn(async (keys: string[]) => {
        for (const k of keys) delete store[k];
      }),
    },
  };
});
