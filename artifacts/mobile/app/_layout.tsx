import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
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
      <Stack.Screen name="game" options={{ headerShown: false }} />
    </Stack>
  );
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

  useEffect(() => {
    if ((fontsLoaded || fontError) && hydrated && i18nLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, hydrated, i18nLoaded]);

  if ((!fontsLoaded && !fontError) || !hydrated || !i18nLoaded) return null;

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
