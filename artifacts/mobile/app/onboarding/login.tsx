import { router } from "expo-router";
import React from "react";

import { LoginScreen } from "@app/screens/onboarding/LoginScreen";
import { useAuthStore } from "@app/lib/auth-store";

export default function LoginRoute() {
  const login = useAuthStore((s) => s.login);

  return (
    <LoginScreen
      onSubmit={async (email, password) => {
        await login(email, password);
        // Successful login also marks onboarded inside the store.
        router.replace("/(tabs)");
      }}
      onCreateAccount={() => router.replace("/onboarding/register")}
    />
  );
}
