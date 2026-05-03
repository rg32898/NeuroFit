import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider } from "@/context/AppContext";
import { useAuthStore } from "@app/lib/auth-store";
import { initI18n } from "@app/i18n";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// Fire-and-forget bootstrap. Done at module scope so i18n is ready before
// the first screen renders. The promise resolves quickly (no network).
const i18nReady = initI18n();

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Back",
        contentStyle: { backgroundColor: "#0A0E1A" },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="game" options={{ headerShown: false }} />
    </Stack>
  );
}

/**
 * Decides where to land the user once everything has hydrated.
 *
 *   - Has a session         → keep current route (tabs by default).
 *   - Hasn't completed onboarding (and not signed in) → /onboarding/welcome.
 *   - Otherwise (guest who already onboarded) → keep current route.
 *
 * We only replace ONCE on hydration completion; downstream navigation is
 * driven by the route handlers themselves.
 */
function useOnboardingGate(ready: boolean) {
  const user = useAuthStore((s) => s.user);
  const onboarded = useAuthStore((s) => s.onboarded);
  const [redirected, setRedirected] = React.useState(false);

  useEffect(() => {
    if (!ready || redirected) return;
    if (!user && !onboarded) {
      router.replace("/onboarding/welcome");
    }
    setRedirected(true);
  }, [ready, redirected, user, onboarded]);
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const restoreFromStorage = useAuthStore((s) => s.restoreFromStorage);
  const hydrated = useAuthStore((s) => s.hydrated);
  const [i18nLoaded, setI18nLoaded] = React.useState(false);

  useEffect(() => {
    void restoreFromStorage();
    // Fail-open: even if i18n init throws (rare — network-free, in-memory),
    // we must not deadlock the splash gate. We log and continue with whatever
    // i18next has loaded (its fallback chain still resolves keys to the key
    // string, which is preferable to a blank app forever).
    i18nReady
      .catch((err) => {
        console.warn("i18n.init.failed", err);
      })
      .finally(() => setI18nLoaded(true));
  }, [restoreFromStorage]);

  const ready = (fontsLoaded || !!fontError) && hydrated && i18nLoaded;
  useOnboardingGate(ready);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AppProvider>
            <GestureHandlerRootView>
              <KeyboardProvider>
                <RootLayoutNav />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </AppProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
