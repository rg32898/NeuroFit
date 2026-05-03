import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

const KEY = "@neurofit_settings_v1";

export type ColorblindPalette = "off" | "deuteranopia" | "protanopia" | "tritanopia";

export type Settings = {
  // Preferences
  relaxedMode: boolean;
  timerScale: 1 | 1.5 | 2;
  // Notifications (FR-8.x)
  notificationsMaster: boolean;
  dailyReminderEnabled: boolean;
  dailyReminderHour: number; // 0-23
  dailyReminderMinute: number; // 0-59
  marketingOptIn: boolean; // FR-8.4 — DEFAULT FALSE
  quietHoursEnabled: boolean;
  quietHoursStartHour: number;
  quietHoursEndHour: number;
  // Accessibility
  fontScale: 1 | 1.15 | 1.3;
  highContrast: boolean;
  colorblindPalette: ColorblindPalette;
};

export const DEFAULT_SETTINGS: Settings = {
  relaxedMode: false,
  timerScale: 1,
  notificationsMaster: true,
  dailyReminderEnabled: true,
  dailyReminderHour: 19,
  dailyReminderMinute: 0,
  marketingOptIn: false, // FR-8.4
  quietHoursEnabled: false,
  quietHoursStartHour: 22,
  quietHoursEndHour: 7,
  fontScale: 1,
  highContrast: false,
  colorblindPalette: "off",
};

type SettingsState = Settings & {
  hydrated: boolean;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  patch: (partial: Partial<Settings>) => void;
  hydrate: () => Promise<void>;
  reset: () => void;
};

async function persist(s: Settings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // best-effort
  }
}

export const useSettingsStore = create<SettingsState>((setState, get) => ({
  ...DEFAULT_SETTINGS,
  hydrated: false,

  set(key, value) {
    setState({ [key]: value } as Pick<Settings, typeof key>);
    const { hydrated: _h, set: _s, patch: _p, hydrate: _hy, reset: _r, ...snapshot } =
      get();
    void persist(snapshot as Settings);
  },

  patch(partial) {
    setState(partial as Partial<SettingsState>);
    const { hydrated: _h, set: _s, patch: _p, hydrate: _hy, reset: _r, ...snapshot } =
      get();
    void persist(snapshot as Settings);
  },

  async hydrate() {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Settings>;
        // Merge so newly added keys pick up their defaults.
        setState({ ...DEFAULT_SETTINGS, ...parsed, hydrated: true });
        return;
      }
    } catch {
      // fall through to defaults
    }
    setState({ hydrated: true });
  },

  reset() {
    setState({ ...DEFAULT_SETTINGS, hydrated: true });
    void persist(DEFAULT_SETTINGS);
  },
}));
