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
  guestBanner: {
    message: "Save your progress — create a free account.",
    cta: "Sign up",
  },
  onboarding: {
    welcome: {
      title: "Train your brain. Daily.",
      subtitle:
        "Short, science-backed sessions to sharpen memory, attention, and reaction time.",
      tryWorkout: "Try a workout (no account)",
      haveAccount: "I have an account",
      noPaymentNote: "No payment, no commitment — your first 3 sessions are on us.",
    },
    assessment: {
      title: "Quick check-in",
      subtitle:
        "Five fast questions help us pick the right starting difficulty.",
      progress: "Question {{current}} of {{total}}",
      yes: "Yes, comfortable",
      no: "Not yet",
      skip: "Skip for now",
      questions: {
        vocabulary: "Are you comfortable picking the precise meaning of less-common words?",
        writing: "Can you usually structure a clear paragraph in one pass?",
        reading: "Do you keep up with long-form articles without re-reading?",
        speaking: "Are you confident speaking off the cuff in your strongest language?",
        math: "Can you do quick mental arithmetic (e.g. 17% of 85) without a calculator?",
      },
    },
    login: {
      title: "Welcome back",
      subtitle: "Sign in to pick up where you left off.",
      emailLabel: "Email",
      emailPlaceholder: "you@example.com",
      passwordLabel: "Password",
      submit: "Sign in",
      orContinueWith: "or continue with",
      apple: "Continue with Apple",
      google: "Continue with Google",
      createAccount: "Create an account",
      comingSoonTitle: "Coming soon",
      comingSoonMessage: "{{provider}} sign-in is coming soon.",
      errors: {
        invalidCredentials:
          "That email and password didn't match. Try again or create an account.",
        rateLimited: "Too many attempts. Please wait a minute and try again.",
        validation: "Check your email and password and try again.",
      },
    },
    register: {
      title: "Create your account",
      subtitle: "Save your streaks and sync across devices.",
      emailLabel: "Email",
      emailPlaceholder: "you@example.com",
      passwordLabel: "Password",
      passwordHint: "At least 8 characters.",
      submit: "Create account",
      orContinueWith: "or continue with",
      apple: "Continue with Apple",
      google: "Continue with Google",
      haveAccount: "I already have an account",
      comingSoonTitle: "Coming soon",
      comingSoonMessage: "{{provider}} sign-in is coming soon.",
      errors: {
        emailTaken: "An account with that email already exists. Try signing in.",
        validation: "Check your email and password and try again.",
        rateLimited: "Too many attempts. Please wait a minute and try again.",
        passwordTooShort: "Password must be at least 8 characters.",
      },
    },
  },
  // Legacy auth keys preserved for back-compat with the original
  // src/screens/WelcomeScreen.tsx until it's removed in a follow-up cleanup.
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
  today: {
    title: "Today",
    streakLabel: "Current streak",
    streakBest: "Best",
    gamesHeading: "TODAY'S WORKOUT",
    gameMeta: "{{domain}} · ~{{seconds}}s",
    startCta: "Start workout",
    completedCta: "Workout complete",
    freePlay: "Free play →",
    loading: "Building today's workout…",
    errorTitle: "Couldn't load today's workout",
    errorBody: "Check your connection and try again.",
  },
  runner: {
    title: "Workout in progress",
    progress: "Game {{current}} of {{total}}",
    skip: "Skip this game",
    finishingTitle: "Wrapping up…",
    finishingBody: "Saving your results.",
    errorRecordTitle: "Couldn't save that game",
    errorCompleteTitle: "Couldn't finish the workout",
    gamePlaceholder: {
      domainLabel: "Domain",
      body: "The real game ships in the next prompt. Tap below to simulate finishing.",
      relaxed: "Relaxed mode: {{scale}}× timer",
      simulateFinish: "Finish game",
    },
  },
  complete: {
    eyebrow: "WORKOUT COMPLETE",
    title: "Nice work.",
    subtitle: "Your brain just got a little sharper.",
    streakCurrent: "Streak",
    streakBest: "Best",
    newRecord: "New personal best!",
    deltasHeading: "DOMAIN SHIFTS",
    deltaScore: "Now at {{score}}/100",
    done: "Back to Today",
  },
  relaxed: {
    title: "Relaxed mode",
    subtitle:
      "Stretch the per-item timer to give yourself more thinking room.",
    indicator: "Relaxed {{scale}}×",
    indicatorLabel: "Relaxed mode, currently {{scale}} times. Tap to change.",
    option: "{{scale}}× timer",
    cancel: "Cancel",
    dismiss: "Dismiss",
  },
} as const;

export type Translations = typeof en;
