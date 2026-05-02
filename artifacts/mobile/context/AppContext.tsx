import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface GameResult {
  id: string;
  gameId: string;
  gameName: string;
  score: number;
  date: string;
}

interface AppState {
  streak: number;
  lastPlayedDate: string | null;
  totalXP: number;
  gameResults: GameResult[];
  dailyChallengeCompleted: boolean;
  dailyChallengeDate: string | null;
}

interface AppContextType {
  streak: number;
  totalXP: number;
  gameResults: GameResult[];
  dailyChallengeCompleted: boolean;
  totalSessions: number;
  addGameResult: (result: Omit<GameResult, "id" | "date">) => Promise<void>;
  completeDailyChallenge: () => Promise<void>;
  getBestScore: (gameId: string) => number;
  getRecentResults: (limit?: number) => GameResult[];
}

const STORAGE_KEY = "@neurofit_data_v1";

const defaultState: AppState = {
  streak: 0,
  lastPlayedDate: null,
  totalXP: 0,
  gameResults: [],
  dailyChallengeCompleted: false,
  dailyChallengeDate: null,
};

const AppContext = createContext<AppContextType | null>(null);

function getTodayStr(): string {
  return new Date().toISOString().split("T")[0] as string;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as AppState;
          const today = getTodayStr();
          if (parsed.dailyChallengeDate !== today) {
            parsed.dailyChallengeCompleted = false;
            parsed.dailyChallengeDate = null;
          }
          setState(parsed);
        } catch {}
      }
      setLoaded(true);
    });
  }, []);

  const persist = useCallback(async (newState: AppState) => {
    setState(newState);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  }, []);

  const addGameResult = useCallback(
    async (result: Omit<GameResult, "id" | "date">) => {
      const today = getTodayStr();
      const id =
        Date.now().toString() + Math.random().toString(36).substring(2, 7);
      const newResult: GameResult = { ...result, id, date: today };

      let newStreak = state.streak;
      if (state.lastPlayedDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];
        newStreak = state.lastPlayedDate === yesterdayStr ? state.streak + 1 : 1;
      }

      await persist({
        ...state,
        streak: newStreak,
        lastPlayedDate: today,
        totalXP: state.totalXP + Math.max(1, Math.floor(result.score / 10)),
        gameResults: [newResult, ...state.gameResults].slice(0, 200),
      });
    },
    [state, persist],
  );

  const completeDailyChallenge = useCallback(async () => {
    const today = getTodayStr();
    if (state.dailyChallengeCompleted) return;
    await persist({
      ...state,
      dailyChallengeCompleted: true,
      dailyChallengeDate: today,
      totalXP: state.totalXP + 50,
    });
  }, [state, persist]);

  const getBestScore = useCallback(
    (gameId: string): number => {
      const scores = state.gameResults
        .filter((r) => r.gameId === gameId)
        .map((r) => r.score);
      return scores.length > 0 ? Math.max(...scores) : 0;
    },
    [state.gameResults],
  );

  const getRecentResults = useCallback(
    (limit = 5): GameResult[] => state.gameResults.slice(0, limit),
    [state.gameResults],
  );

  return (
    <AppContext.Provider
      value={{
        streak: state.streak,
        totalXP: state.totalXP,
        gameResults: state.gameResults,
        dailyChallengeCompleted: state.dailyChallengeCompleted,
        totalSessions: state.gameResults.length,
        addGameResult,
        completeDailyChallenge,
        getBestScore,
        getRecentResults,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
