import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { colors } from './src/theme';
import { AdminDataProvider } from './src/data/AdminDataContext';

export default function App() {
  return (
    <AdminDataProvider>
      <NavigationContainer>
        <StatusBar style="dark" backgroundColor={colors.background} />
        <AppNavigator />
      </NavigationContainer>
    </AdminDataProvider>
  );
}
