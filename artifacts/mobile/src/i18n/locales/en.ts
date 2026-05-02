/**
 * English copy. Keys mirror screen path: `screens.home.greeting`,
 * `auth.login.submit`, etc. Keep keys flat-ish — over-nesting makes
 * translators' lives hard.
 */
export const en = {
  common: {
    appName: "NeuroFit",
    loading: "Loading…",
    retry: "Try again",
    cancel: "Cancel",
    save: "Save",
    error: "Something went wrong",
  },
  auth: {
    welcome: {
      title: "Train your brain. Daily.",
      subtitle:
        "Short, science-backed sessions to sharpen memory, attention, and reaction time.",
      signIn: "Sign in",
      signUp: "Create an account",
    },
    login: {
      title: "Welcome back",
      email: "Email",
      password: "Password",
      submit: "Sign in",
      noAccount: "New to NeuroFit?",
      createOne: "Create an account",
    },
    register: {
      title: "Create your account",
      email: "Email",
      password: "Password",
      submit: "Create account",
      haveAccount: "Already have an account?",
      signIn: "Sign in",
    },
  },
  tabs: {
    today: "Today",
    games: "Games",
    progress: "Progress",
    settings: "Settings",
  },
} as const;

export type Translations = typeof en;
