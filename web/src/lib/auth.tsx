import { createContext, createSignal, onMount, useContext } from 'solid-js';
import type { ParentProps } from 'solid-js';
import type { AuthUser } from '@shared/types';
import { api } from './api';

interface AuthContextValue {
  user: () => AuthUser | null | undefined;
  ready: () => boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (name: string, email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>();

export function AuthProvider(props: ParentProps) {
  const [user, setUser] = createSignal<AuthUser | null | undefined>(undefined);

  const refresh = async () => {
    try {
      const result = await api.me();
      setUser(result.user);
    } catch {
      setUser(null);
    }
  };

  onMount(() => {
    void refresh();
  });

  const login = async (email: string, password: string) => {
    const result = await api.login(email, password);
    setUser(result.user);
    return result.user;
  };

  const register = async (name: string, email: string, password: string) => {
    const result = await api.register(name, email, password);
    setUser(result.user);
    return result.user;
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  const value: AuthContextValue = {
    user,
    ready: () => user() !== undefined,
    refresh,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
