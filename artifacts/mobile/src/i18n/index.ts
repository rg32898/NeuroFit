import { getLocales } from "expo-localization";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./locales/en";

/**
 * Lazy i18n init. We only ship `en` for now — adding a locale is one entry
 * in the resources map. Device locale is detected via expo-localization;
 * unsupported locales fall back to English.
 *
 * Idempotent: safe to call from app bootstrap multiple times (HMR will
 * re-run module initializers).
 */
const SUPPORTED = ["en"] as const;

function pickInitialLocale(): string {
  try {
    const tags = getLocales();
    for (const t of tags) {
      const code = (t.languageCode ?? "").toLowerCase();
      if ((SUPPORTED as readonly string[]).includes(code)) return code;
    }
  } catch {
    // expo-localization can throw on web in some sandbox configs.
  }
  return "en";
}

export async function initI18n(): Promise<void> {
  if (i18next.isInitialized) return;
  await i18next.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: pickInitialLocale(),
    fallbackLng: "en",
    compatibilityJSON: "v4",
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

export { default as i18n } from "i18next";
