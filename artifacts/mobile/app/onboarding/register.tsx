import { router } from "expo-router";
import React from "react";

import { RegisterScreen } from "@app/screens/onboarding/RegisterScreen";
import { useAuthStore } from "@app/lib/auth-store";

export default function RegisterRoute() {
  const register = useAuthStore((s) => s.register);

  return (
    <RegisterScreen
      onSubmit={async (email, password) => {
        await register(email, password);
        router.replace("/(tabs)");
      }}
      onSignIn={() => router.replace("/onboarding/login")}
    />
  );
}
