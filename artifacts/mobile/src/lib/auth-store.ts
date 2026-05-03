import { create } from "zustand";
import { api, ApiError, onForcedLogout } from "./api";
import { clearTokens, loadTokens, saveTokens } from "./tokenStorage";
import {
  clearGuestData,
  isOnboarded as readOnboarded,
  promoteGuestToAccount,
  setOnboarded as writeOnboarded,
} from "./guest";

export type AuthUser = {
  id: string;
  email: string;
};

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** True until the first restoreFromStorage() resolves. Gates the nav. */
  hydrated: boolean;
  /** True while a login / restore call is in flight. */
  loading: boolean;
  /**
   * True once the user has completed (or skipped) the onboarding journey.
   * Persisted in secure-store so we never re-show onboarding on app launch.
   */
  onboarded: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreFromStorage: () => Promise<void>;
  /** Mark onboarding complete (called from skip / finish handlers). */
  markOnboarded: () => Promise<void>;
  /** Set by api.ts when a forced logout occurs (refresh failed). */
  _handleForcedLogout: () => Promise<void>;
};

/**
 * Centralised auth state. The Zustand store is the single source of truth
 * the navigator reads from to pick AuthStack vs TabNavigator.
 *
 * Token persistence lives in `tokenStorage.ts` (SecureStore on native,
 * localStorage on web). We mirror the tokens into the store so screens can
 * read them synchronously without an await.
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  hydrated: false,
  loading: false,
  onboarded: false,

  async login(email, password) {
    set({ loading: true });
    try {
      const res = await api.post<AuthResponse>("/api/auth/login", {
        email,
        password,
      });
      await saveTokens({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
      });
      set({
        user: res.user,
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
      });
      // Best-effort: drain any guest-queued events into the new account.
      // Failures are logged inside promoteGuestToAccount; the auth call
      // itself must still succeed even if a replay event fails.
      try {
        await promoteGuestToAccount();
      } catch (err) {
        console.warn("auth.login.promote_failed", err);
      }
      // Logging in implies onboarding is done.
      await writeOnboarded(true);
      set({ onboarded: true });
    } finally {
      set({ loading: false });
    }
  },

  async register(email, password) {
    set({ loading: true });
    try {
      const res = await api.post<AuthResponse>("/api/auth/register", {
        email,
        password,
      });
      await saveTokens({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
      });
      set({
        user: res.user,
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
      });
      try {
        await promoteGuestToAccount();
      } catch (err) {
        console.warn("auth.register.promote_failed", err);
      }
      await writeOnboarded(true);
      set({ onboarded: true });
    } finally {
      set({ loading: false });
    }
  },

  async logout() {
    // Best-effort server-side revocation. We always clear local state even if
    // the network call fails — otherwise a flaky network would trap the user
    // in a logged-in shell with stale tokens.
    try {
      await api.post("/api/auth/logout");
    } catch (err) {
      if (!(err instanceof ApiError)) {
        // Surface unexpected errors to the console; swallow API ones (401,
        // 403 are expected if the token has already been invalidated).
        console.warn("auth.logout.network_error", err);
      }
    } finally {
      await clearTokens();
      // Logging out wipes guest residue too — next launch should treat the
      // device as a fresh install and re-show onboarding.
      await clearGuestData();
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        onboarded: false,
      });
    }
  },

  async restoreFromStorage() {
    set({ loading: true });
    try {
      const onboarded = await readOnboarded();
      const { accessToken, refreshToken } = await loadTokens();
      if (!accessToken || !refreshToken) {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          onboarded,
        });
        return;
      }
      // We trust the access token until the first authenticated request
      // proves it stale. The /me probe gives us the user record AND
      // exercises the refresh-on-401 path automatically.
      try {
        const me = await api.get<{ user: AuthUser }>("/api/auth/me");
        // /me may have triggered a refresh inside api.ts which rotated
        // tokens in storage. Re-read so the store mirrors persisted state
        // instead of the pre-refresh values.
        const fresh = await loadTokens();
        set({
          user: me.user,
          accessToken: fresh.accessToken ?? accessToken,
          refreshToken: fresh.refreshToken ?? refreshToken,
          // Having a valid session implies onboarding completed in the past;
          // backfill the flag so an upgrade from a pre-flag build behaves.
          onboarded: true,
        });
        if (!onboarded) await writeOnboarded(true);
      } catch (err) {
        // /api/auth/me failed even after one refresh attempt — clear and
        // present the auth stack.
        if (err instanceof ApiError && err.status === 401) {
          await clearTokens();
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            onboarded,
          });
        } else {
          // Network error — keep tokens so we can try again on next
          // foreground; just don't promote to authenticated yet.
          set({
            user: null,
            accessToken,
            refreshToken,
            onboarded,
          });
        }
      }
    } finally {
      set({ hydrated: true, loading: false });
    }
  },

  async markOnboarded() {
    await writeOnboarded(true);
    set({ onboarded: true });
  },

  async _handleForcedLogout() {
    await clearTokens();
    set({ user: null, accessToken: null, refreshToken: null });
  },
}));

// Wire api.ts → auth-store. Done at module scope so the subscription is
// set up before the first request fires.
onForcedLogout(() => {
  void useAuthStore.getState()._handleForcedLogout();
});

