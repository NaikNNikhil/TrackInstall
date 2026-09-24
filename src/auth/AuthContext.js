import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../api';
import authStorage from './authStorage';

const AuthContext = createContext({
  user: null,
  token: null,
  role: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
  fetchCurrentUser: async () => {},
});

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Session restoration on app launch
  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const storedToken = await authStorage.getToken();
        if (!storedToken) {
          if (isMounted) {
            setToken(null);
            setUser(null);
            setIsLoading(false);
          }
          return;
        }

        // Validate token with backend GET /api/v1/auth/me
        try {
          const res = await apiClient.get('/auth/me', { token: storedToken });
          if (res?.success && res.data) {
            const storedUser = await authStorage.getUser();
            const authenticatedUser = {
              ...(storedUser || {}),
              id: res.data.userId || storedUser?.id,
              userId: res.data.userId,
              role: res.data.role,
            };

            if (isMounted) {
              setToken(storedToken);
              setUser(authenticatedUser);
              setIsLoading(false);
            }
            return;
          } else {
            // Malformed or unsuccessful response
            await authStorage.clearSession();
            if (isMounted) {
              setToken(null);
              setUser(null);
              setIsLoading(false);
            }
          }
        } catch (verifyError) {
          // Token is invalid/expired or verification failed
          await authStorage.clearSession();
          if (isMounted) {
            setToken(null);
            setUser(null);
            setIsLoading(false);
          }
        }
      } catch {
        if (isMounted) {
          setToken(null);
          setUser(null);
          setIsLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  // Login handler
  const login = async (identifier, password) => {
    if (!identifier || !identifier.trim()) {
      return { success: false, error: 'Please enter your email or phone number' };
    }
    if (!password) {
      return { success: false, error: 'Please enter your password' };
    }

    try {
      const response = await apiClient.post('/auth/login', {
        identifier: identifier.trim(),
        password,
      });

      if (response?.success && response.data?.token) {
        const authToken = response.data.token;
        const authUser = response.data.user;

        await authStorage.saveSession(authToken, authUser);
        setToken(authToken);
        console.log('[AUTH] Login token set:', authToken ? 'TOKEN_PRESENT' : 'TOKEN_MISSING');
        setUser(authUser);

        return { success: true, user: authUser, token: authToken };
      }

      return {
        success: false,
        error: response?.message || 'Login failed. Please check your credentials.',
      };
    } catch (err) {
      return {
        success: false,
        error: err.message || 'Unable to connect to server. Please try again.',
      };
    }
  };

  // Fetch current authenticated user
  const fetchCurrentUser = async () => {
    const currentToken = token || (await authStorage.getToken());
    if (!currentToken) return null;

    try {
      const res = await apiClient.get('/auth/me', { token: currentToken });
      if (res?.success && res.data) {
        setUser((prev) => ({
          ...(prev || {}),
          id: res.data.userId,
          userId: res.data.userId,
          role: res.data.role,
        }));
        return res.data;
      }
      return null;
    } catch {
      return null;
    }
  };

  // Logout handler
  const logout = async () => {
    await authStorage.clearSession();
    setToken(null);
    setUser(null);
  };

  const role = user?.role || null;
  const isAuthenticated = Boolean(token && user);

  const value = useMemo(
    () => ({
      token,
      user,
      role,
      isAuthenticated,
      isLoading,
      login,
      logout,
      fetchCurrentUser,
    }),
    [token, user, role, isAuthenticated, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
