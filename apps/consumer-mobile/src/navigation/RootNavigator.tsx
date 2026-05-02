import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { lightColors } from '@eazepay/ui/tokens';
import WelcomeScreen from '../screens/WelcomeScreen.js';
import RegisterScreen from '../screens/RegisterScreen.js';
import LoginScreen from '../screens/LoginScreen.js';
import VerifyOtpScreen from '../screens/VerifyOtpScreen.js';
import OnboardingScreen from '../screens/OnboardingScreen.js';
import HomeScreen from '../screens/HomeScreen.js';
import NewApplicationScreen from '../screens/NewApplicationScreen.js';
import OffersScreen from '../screens/OffersScreen.js';
import AcceptedOfferScreen from '../screens/AcceptedOfferScreen.js';
import { useAuthStore } from '../state/auth.store.js';
import type { RootStackParamList } from './types.js';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const state = useAuthStore((s) => s.state);
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  if (state === 'unknown') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: lightColors.bgDefault }}>
        <ActivityIndicator color={lightColors.accentDefault} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: lightColors.bgDefault },
          headerTintColor: lightColors.textPrimary,
          headerShadowVisible: false,
        }}
      >
        {state === 'unauthenticated' ? (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Sign up' }} />
            <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Sign in' }} />
            <Stack.Screen name="VerifyOtp" component={VerifyOtpScreen} options={{ title: 'Verify' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ title: 'Quick KYC' }} />
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'EazePay' }} />
            <Stack.Screen name="NewApplication" component={NewApplicationScreen} options={{ title: 'New application' }} />
            <Stack.Screen name="Offers" component={OffersScreen} options={{ title: 'Your offers' }} />
            <Stack.Screen name="AcceptedOffer" component={AcceptedOfferScreen} options={{ title: 'All set' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
