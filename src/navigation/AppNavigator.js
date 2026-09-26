import { ActivityIndicator, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  LoginScreen,
  ActivateAccountScreen,
} from '../screens/auth/LoginScreen';
import { AssignedSites, InstallerAddVisit, InstallerDashboard, InstallerExtraRequests, InstallerMore, InstallerOrderForm, InstallerSiteDetails, InstallerVisitHistory } from '../screens/installer/InstallerScreens';
import { AddCity, AddInstaller, ApprovalsScreen, AssignNewSiteFinal, AssignSite, CitiesScreen, CityDetails, Dashboard, EditInstaller, InstallerDetails, InstallersScreen, MoreScreen, PaymentDetails, PaymentsScreen, SiteDetails, SitesScreen, VisitDetails, VisitsScreen } from '../screens/admin/AdminScreens';
import { colors } from '../theme';
import { useAuth } from '../auth';

const RootStack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();
const AdminStack = createNativeStackNavigator();
const InstallerStack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();
function AuthNavigator() { return <AuthStack.Navigator screenOptions={{ headerShown: false }}><AuthStack.Screen name="Login" component={LoginScreen} /><AuthStack.Screen
  name="ActivateAccount"
  component={ActivateAccountScreen}
/></AuthStack.Navigator>; }
function AdminTabs() { return <Tabs.Navigator backBehavior="initialRoute" screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.textSecondary, tabBarStyle: { height: 62, paddingTop: 6 } }}><Tabs.Screen name="Dashboard" component={Dashboard} /><Tabs.Screen name="Cities" component={CitiesScreen} /><Tabs.Screen name="More" component={MoreScreen} /></Tabs.Navigator>; }
function AdminNavigator() { return <AdminStack.Navigator screenOptions={{ headerBackTitle: 'Back', headerTintColor: colors.primary, headerTitleStyle: { color: colors.text } }}><AdminStack.Screen name="AdminHome" component={AdminTabs} options={{ headerShown: false }} /><AdminStack.Screen name="Cities" component={CitiesScreen} /><AdminStack.Screen name="AddCity" component={AddCity} options={{ title: 'Add City' }} /><AdminStack.Screen name="CityDetails" component={CityDetails} options={{ title: 'City Details' }} /><AdminStack.Screen name="Installers" component={InstallersScreen} /><AdminStack.Screen name="Sites" component={SitesScreen} /><AdminStack.Screen name="AddInstaller" component={AddInstaller} options={{ title: 'Add Installer' }} /><AdminStack.Screen name="EditInstaller" component={EditInstaller} options={{ title: 'Edit Installer' }} /><AdminStack.Screen name="InstallerDetails" component={InstallerDetails} options={{ title: 'Installer Details' }} /><AdminStack.Screen name="AssignSite" component={AssignNewSiteFinal} options={{ title: 'Assign Site' }} /><AdminStack.Screen name="EditSite" component={AssignNewSiteFinal} options={{ title: 'Edit Site' }} /><AdminStack.Screen name="SiteDetails" component={SiteDetails} options={{ title: 'Site Details' }} /><AdminStack.Screen name="Visits" component={VisitsScreen} /><AdminStack.Screen name="VisitDetails" component={VisitDetails} options={{ title: 'Visit Details' }} /><AdminStack.Screen name="Approvals" component={ApprovalsScreen} /><AdminStack.Screen name="Payments" component={PaymentsScreen} /><AdminStack.Screen name="PaymentDetails" component={PaymentDetails} options={{ title: 'Payment Details' }} /></AdminStack.Navigator>; }
function InstallerTabs() { return <Tabs.Navigator backBehavior="initialRoute" screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.textSecondary, tabBarStyle: { height: 62, paddingTop: 6 } }}><Tabs.Screen name="InstallerDashboard" component={InstallerDashboard} options={{ title: 'Dashboard' }} /><Tabs.Screen name="AssignedSites" component={AssignedSites} options={{ title: 'Sites' }} /><Tabs.Screen name="InstallerMore" component={InstallerMore} options={{ title: 'More' }} /></Tabs.Navigator>; }
function InstallerNavigator() { return <InstallerStack.Navigator screenOptions={{ headerBackTitle: 'Back', headerTintColor: colors.primary, headerTitleStyle: { color: colors.text } }}><InstallerStack.Screen name="InstallerHome" component={InstallerTabs} options={{ headerShown: false }} /><InstallerStack.Screen name="InstallerSiteDetails" component={InstallerSiteDetails} options={{ title: 'Site Details' }} /><InstallerStack.Screen name="InstallerOrderForm" component={InstallerOrderForm} options={{ title: 'Order Form' }} /><InstallerStack.Screen name="InstallerVisitHistory" component={InstallerVisitHistory} options={{ title: 'Visit History' }} /><InstallerStack.Screen name="InstallerAddVisit" component={InstallerAddVisit} options={{ title: 'Add Visit' }} /><InstallerStack.Screen name="InstallerExtraRequests" component={InstallerExtraRequests} options={{ title: 'Extra Visit Requests' }} /></InstallerStack.Navigator>; }
export default function AppNavigator() {
  const { isLoading, isAuthenticated, role } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const initialRoute = !isAuthenticated
    ? 'AuthFlow'
    : role === 'ADMIN'
    ? 'AdminFlow'
    : 'InstallerFlow';

  return (
    <RootStack.Navigator
      key={isAuthenticated ? `auth-${role}` : 'guest'}
      id="RootStack"
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false, animation: 'fade' }}
    >
      <RootStack.Screen name="AuthFlow" component={AuthNavigator} />
      <RootStack.Screen name="AdminFlow" component={AdminNavigator} />
      <RootStack.Screen name="InstallerFlow" component={InstallerNavigator} />
    </RootStack.Navigator>
  );
}