import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = '@trackinstall_jwt_token';
const USER_KEY = '@trackinstall_user_session';

export const authStorage = {
  async getToken() {
    try {
      return await AsyncStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  async setToken(token) {
    try {
      if (token) {
        await AsyncStorage.setItem(TOKEN_KEY, token);
      } else {
        await AsyncStorage.removeItem(TOKEN_KEY);
      }
    } catch {
      // Storage errors handled silently to avoid crashes
    }
  },

  async getUser() {
    try {
      const data = await AsyncStorage.getItem(USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  async setUser(user) {
    try {
      if (user) {
        const { password, password_hash, ...safeUser } = user;
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(safeUser));
      } else {
        await AsyncStorage.removeItem(USER_KEY);
      }
    } catch {
      // Storage errors handled silently to avoid crashes
    }
  },

  async saveSession(token, user) {
    try {
      if (token) {
        await AsyncStorage.setItem(TOKEN_KEY, token);
      }
      if (user) {
        const { password, password_hash, ...safeUser } = user;
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(safeUser));
      }
    } catch {
      // Storage errors handled silently to avoid crashes
    }
  },

  async clearSession() {
    try {
      await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    } catch {
      // Storage errors handled silently to avoid crashes
    }
  },
};

export default authStorage;
