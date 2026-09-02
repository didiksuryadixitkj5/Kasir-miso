import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CONNECTION_KEY = 'warung-google-connection-v1';
const GOOGLE_ACCOUNT_EMAIL_KEY = 'warung-google-account-email-v1';
const GOOGLE_CLIENT_ID_FALLBACK = 'google-client-id-not-configured';
const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || GOOGLE_CLIENT_ID_FALLBACK;
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || GOOGLE_CLIENT_ID_FALLBACK;
const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || GOOGLE_CLIENT_ID_FALLBACK;

const googleClientConfigured = Platform.select({
  web: Boolean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
  ios: Boolean(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
  android: Boolean(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID),
  default: false,
});

type GoogleAccountContextValue = {
  isConnected: boolean;
  email: string;
  hydrated: boolean;
  request: ReturnType<typeof Google.useAuthRequest>[0];
  promptAsync: ReturnType<typeof Google.useAuthRequest>[2];
  clientConfigured: boolean;
  logout: () => Promise<void>;
};

const GoogleAccountContext = createContext<GoogleAccountContextValue | null>(null);

export function GoogleAccountProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [email, setEmail] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const authResponseHandled = useRef(false);
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: googleWebClientId,
    iosClientId: googleIosClientId,
    androidClientId: googleAndroidClientId,
    scopes: ['openid', 'profile', 'email'],
    selectAccount: true,
  });

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(GOOGLE_CONNECTION_KEY),
      AsyncStorage.getItem(GOOGLE_ACCOUNT_EMAIL_KEY),
    ])
      .then(([saved, savedEmail]) => {
        if (!authResponseHandled.current) {
          setIsConnected(saved === 'connected');
          setEmail(savedEmail ?? '');
        }
      })
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!response || response.type !== 'success') return;

    const accessToken = response.authentication?.accessToken ?? response.params?.access_token;
    if (!accessToken) {
      console.warn('[GoogleAccount] OAuth succeeded without an access token', response.params);
      return;
    }
    authResponseHandled.current = true;

    let mounted = true;
    (async () => {
      try {
        let accountEmail = '';
        try {
          const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (profileResponse.ok) {
            const profile = (await profileResponse.json()) as { email?: string };
            accountEmail = profile.email ?? '';
          }
        } catch {
          // The Google login remains valid even if profile lookup is unavailable.
        }

        await Promise.all([
          AsyncStorage.setItem(GOOGLE_CONNECTION_KEY, 'connected'),
          AsyncStorage.setItem(GOOGLE_ACCOUNT_EMAIL_KEY, accountEmail),
        ]);
        if (mounted) {
          setEmail(accountEmail);
          setIsConnected(true);
        }
      } catch {
        // Keep the previous account state if local persistence fails.
      }
    })();

    return () => {
      mounted = false;
    };
  }, [response]);

  const logout = async () => {
    await AsyncStorage.multiRemove([GOOGLE_CONNECTION_KEY, GOOGLE_ACCOUNT_EMAIL_KEY]);
    setIsConnected(false);
    setEmail('');
  };

  const value = useMemo<GoogleAccountContextValue>(() => ({
    isConnected,
    email,
    hydrated,
    request,
    promptAsync,
    clientConfigured: Boolean(googleClientConfigured),
    logout,
  }), [email, hydrated, isConnected, logout, promptAsync, request]);

  return <GoogleAccountContext.Provider value={value}>{children}</GoogleAccountContext.Provider>;
}

export function useGoogleAccount() {
  const context = useContext(GoogleAccountContext);
  if (!context) throw new Error('useGoogleAccount must be used within GoogleAccountProvider');
  return context;
}