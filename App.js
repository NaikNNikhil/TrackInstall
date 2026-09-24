import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { colors } from './src/theme';
import { AdminDataProvider } from './src/data/AdminDataContext';
import { AuthProvider } from './src/auth';
import { apiClient } from './src/api';

export default function App() {
  useEffect(() => {
    if (__DEV__) {
      apiClient.get('/health')
        .then((res) => {
          console.log('[Module 8.1] Backend Health Check SUCCESS:', JSON.stringify(res));
        })
        .catch((err) => {
          console.error('[Module 8.1] Backend Health Check ERROR:', err.message, err.status);
        });
    }
  }, []);

  return (
    <AuthProvider>
      <AdminDataProvider>
        <NavigationContainer>
          <StatusBar style="dark" backgroundColor={colors.background} />
          <AppNavigator />
        </NavigationContainer>
      </AdminDataProvider>
    </AuthProvider>
  );
}


