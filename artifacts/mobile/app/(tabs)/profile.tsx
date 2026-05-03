import React from "react";
import { Alert, Linking } from "react-native";
import { router } from "expo-router";

import { SettingsScreen } from "@app/screens/settings/SettingsScreen";
import { useAuthStore } from "@app/lib/auth-store";

/**
 * Settings tab. The actual UI lives in `src/screens/settings/SettingsScreen.tsx`
 * (pure / testable); this route only wires navigation.
 */
export default function SettingsRoute() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleSignOut = () => {
    Alert.alert("Sign out?", "You'll need to sign back in to sync progress.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => {
          void logout();
        },
      },
    ]);
  };

  return (
    <SettingsScreen
      email={user?.email ?? null}
      onAccount={() => router.push("/subscription")}
      onSubscription={() => router.push("/subscription")}
      onPreferences={() => router.push("/settings/preferences")}
      onAccessibility={() => router.push("/settings/accessibility")}
      onNotifications={() => router.push("/settings/notifications")}
      onSupport={() => {
        Alert.alert(
          "Support",
          "Email support@neurofit.app or visit help.neurofit.app",
        );
      }}
      onLegalPrivacy={() =>
        void Linking.openURL("https://neurofit.app/privacy")
      }
      onLegalTerms={() => void Linking.openURL("https://neurofit.app/terms")}
      onSignOut={handleSignOut}
      onDeleteAccount={() => router.push("/settings/delete-account")}
    />
  );
}
