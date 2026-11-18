import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { authResponseSchema, type PublicUser } from '@chillops/shared/auth';

type AuthState = {
  user: PublicUser | null;
  loading: boolean;
  error: string | null;
};
type AuthContextValue = AuthState & {
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);
let initialRequest: Promise<AuthState> | undefined;

async function responseError(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  if (
    body &&
    typeof body === 'object' &&
    'error' in body &&
    typeof body.error === 'string'
  )
    return body.error;
  return 'Authentication service is unavailable. Try again later.';
}
async function loadSession(): Promise<AuthState> {
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'same-origin',
    });
    if (response.status === 401)
      return { user: null, loading: false, error: null };
    if (!response.ok)
      return {
        user: null,
        loading: false,
        error: await responseError(response),
      };
    return {
      user: authResponseSchema.parse(await response.json()).user,
      loading: false,
      error: null,
    };
  } catch {
    return {
      user: null,
      loading: false,
      error: 'Unable to reach the authentication service. Reload to try again.',
    };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });
  const revision = useRef(0);
  useEffect(() => {
    let mounted = true;
    const current = revision.current;
    initialRequest ??= loadSession();
    void initialRequest.then((result) => {
      if (mounted && current === revision.current) setState(result);
    });
    return () => {
      mounted = false;
    };
  }, []);
  function update(user: PublicUser | null) {
    revision.current++;
    const next = { user, loading: false, error: null };
    initialRequest = Promise.resolve(next);
    setState(next);
  }
  async function login(email: string, password: string) {
    let response;
    try {
      response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      throw new Error('Unable to reach the authentication service. Try again.');
    }
    if (!response.ok) throw new Error(await responseError(response));
    const body = authResponseSchema.safeParse(
      await response.json().catch(() => null),
    );
    if (!body.success)
      throw new Error(
        'Authentication service is unavailable. Try again later.',
      );
    update(body.data.user);
  }
  async function logout() {
    let response;
    try {
      response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
    } catch {
      throw new Error('Unable to reach the authentication service. Try again.');
    }
    if (!response.ok && response.status !== 401)
      throw new Error(await responseError(response));
    update(null);
  }
  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('AuthProvider is required.');
  return auth;
}
