/**
 * _layout.tsx — the root of the app. Every screen is shown inside this.
 *
 * Expo Router turns each file in src/app/ into a screen:
 *   index.tsx                  → "/"            (home: your groups)
 *   login.tsx                  → "/login"
 *   group/[id]/index.tsx       → "/group/123"   ([id] is a variable part)
 *
 * The <Stack> below stacks screens like cards: opening a group puts its
 * screen on top, and "back" takes it off again.
 */
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AuthProvider, useAuth } from '@/lib/auth';

SplashScreen.preventAutoHideAsync(); // keep the splash up until we know who's logged in

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <Screens />
      </AuthProvider>
    </ThemeProvider>
  );
}

function Screens() {
  const { session, loading } = useAuth();
  const loggedIn = !!session;

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null; // splash screen is still showing

  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      {/* Only reachable when logged out. Listed first so logged-out visitors land here. */}
      <Stack.Protected guard={!loggedIn} redirectTo="/">
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>

      {/* Only reachable when logged in. Logged-out visitors get sent to /login. */}
      <Stack.Protected guard={loggedIn} redirectTo="/login">
        <Stack.Screen name="index" options={{ title: 'SplitFree' }} />
        <Stack.Screen name="profile" options={{ title: 'Your profile' }} />
        <Stack.Screen name="new-group" options={{ title: 'New group', presentation: 'modal' }} />
        <Stack.Screen name="group/[id]/index" options={{ title: 'Group' }} />
        <Stack.Screen name="group/[id]/add-expense" options={{ title: 'Add expense', presentation: 'modal' }} />
        <Stack.Screen name="group/[id]/settle" options={{ title: 'Settle up', presentation: 'modal' }} />
      </Stack.Protected>

      {/* Invite links work either way (see join.tsx). */}
      <Stack.Screen name="join" options={{ title: 'Join a group' }} />
    </Stack>
  );
}
