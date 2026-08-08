export type AuthState = {
  accessToken: string | null;
  accessTokenExpiresIn: number | null;
  isReady: boolean;
};

type Listener = () => void;

const STORAGE_KEY = 'citypulse.auth';

function emptyState(): AuthState {
  return {
    accessToken: null,
    accessTokenExpiresIn: null,
    isReady: true,
  };
}

function readStoredState(): AuthState {
  if (typeof window === 'undefined') {
    return emptyState();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return emptyState();
    }

    const parsed = JSON.parse(raw) as Partial<AuthState>;
    const accessToken = typeof parsed.accessToken === 'string' ? parsed.accessToken : null;
    const accessTokenExpiresIn =
      typeof parsed.accessTokenExpiresIn === 'number' ? parsed.accessTokenExpiresIn : null;
    return {
      accessToken,
      accessTokenExpiresIn,
      isReady: !accessToken,
    };
  } catch {
    return emptyState();
  }
}

function persistState(nextState: AuthState) {
  if (typeof window === 'undefined') {
    return;
  }

  if (!nextState.accessToken) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      accessToken: nextState.accessToken,
      accessTokenExpiresIn: nextState.accessTokenExpiresIn,
    }),
  );
}

let state: AuthState = readStoredState();

const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener());
}

export const authStore = {
  getState: (): AuthState => state,
  setTokens: (accessToken: string, accessTokenExpiresIn: number) => {
    state = { accessToken, accessTokenExpiresIn, isReady: true };
    persistState(state);
    notify();
  },
  clear: () => {
    state = emptyState();
    persistState(state);
    notify();
  },
  setReady: (isReady: boolean) => {
    state = { ...state, isReady };
    persistState(state);
    notify();
  },
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
