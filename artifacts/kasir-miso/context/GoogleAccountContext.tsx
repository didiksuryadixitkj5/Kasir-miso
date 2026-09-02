import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import {
  ApiError,
  connectGoogleAccount,
  disconnectGoogleAccount,
  downloadGoogleDriveBackup,
  getGoogleConnection,
  setAuthTokenGetter,
  uploadGoogleDriveBackup,
} from '@workspace/api-client-react';

WebBrowser.maybeCompleteAuthSession();

export const GOOGLE_SESSION_TOKEN_KEY = 'warung-google-server-session-v1';
const LEGACY_GOOGLE_CONNECTION_KEY = 'warung-google-connection-v1';
const GOOGLE_ACCOUNT_EMAIL_KEY = 'warung-google-account-email-v1';
const GOOGLE_CLIENT_ID_FALLBACK = 'google-client-id-not-configured';
const configuredGoogleClientIds = (Constants.expoConfig?.extra?.googleClientIds ?? {}) as {
  web?: string;
  ios?: string;
  android?: string;
};
const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || configuredGoogleClientIds.web || GOOGLE_CLIENT_ID_FALLBACK;
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || configuredGoogleClientIds.ios || GOOGLE_CLIENT_ID_FALLBACK;
const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || configuredGoogleClientIds.android || GOOGLE_CLIENT_ID_FALLBACK;
const nativeGoogleRedirectUri = 'com.kasirwarung.app:/oauthredirect';

const googleClientConfigured = Platform.select({
  web: Boolean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || configuredGoogleClientIds.web),
  ios: Boolean(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || configuredGoogleClientIds.ios),
  android: Boolean(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || configuredGoogleClientIds.android),
  default: false,
});

type GoogleAccountContextValue = {
  isConnected: boolean;
  email: string;
  hydrated: boolean;
  hasDriveAccess: boolean;
  authError: string;
  request: ReturnType<typeof Google.useAuthRequest>[0];
  promptAsync: ReturnType<typeof Google.useAuthRequest>[2];
  clientConfigured: boolean;
  uploadDriveBackup: (content: string) => Promise<void>;
  downloadDriveBackup: () => Promise<string>;
  logout: () => Promise<void>;
};

const GoogleAccountContext = createContext<GoogleAccountContextValue | null>(null);

const reconnectMessage = 'Koneksi Google Drive berakhir. Hubungkan ulang akun Google untuk melanjutkan backup.';

export function GoogleAccountProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [email, setEmail] = useState('');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const authResponseHandled = useRef(false);
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: googleWebClientId,
    iosClientId: googleIosClientId,
    androidClientId: googleAndroidClientId,
    redirectUri: Platform.OS === 'web' ? undefined : nativeGoogleRedirectUri,
    scopes: ['openid', 'profile', 'email', 'https://www.googleapis.com/auth/drive.file'],
    responseType: 'code',
    shouldAutoExchangeCode: false,
    extraParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  });

  const clearLocalSession = useCallback(async (message = '') => {
    await AsyncStorage.multiRemove([
      GOOGLE_SESSION_TOKEN_KEY,
      GOOGLE_ACCOUNT_EMAIL_KEY,
      LEGACY_GOOGLE_CONNECTION_KEY,
    ]);
    setSessionToken(null);
    setIsConnected(false);
    setEmail('');
    setAuthError(message);
  }, []);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(GOOGLE_SESSION_TOKEN_KEY),
      AsyncStorage.getItem(GOOGLE_ACCOUNT_EMAIL_KEY),
      AsyncStorage.removeItem(LEGACY_GOOGLE_CONNECTION_KEY),
    ])
      .then(([savedToken, savedEmail]) => {
        if (!authResponseHandled.current && savedToken) {
          setSessionToken(savedToken);
          setEmail(savedEmail ?? '');
          setIsConnected(true);
        }
      })
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    setAuthTokenGetter(() => sessionToken);
    return () => setAuthTokenGetter(null);
  }, [sessionToken]);

  useEffect(() => {
    if (!hydrated || !sessionToken) return;
    let mounted = true;
    void getGoogleConnection({
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then(async (connection) => {
        if (!mounted) return;
        setEmail(connection.email);
        setIsConnected(true);
        setAuthError('');
        await AsyncStorage.setItem(GOOGLE_ACCOUNT_EMAIL_KEY, connection.email);
      })
      .catch((reason) => {
        if (!mounted) return;
        if (reason instanceof ApiError && reason.status === 401) {
          void clearLocalSession(reconnectMessage);
          return;
        }
        setAuthError('Status Google Drive belum dapat diperiksa. Backup akan dicoba lagi saat server tersedia.');
      });
    return () => {
      mounted = false;
    };
  }, [clearLocalSession, hydrated, sessionToken]);

  useEffect(() => {
    if (!response) return;
    if (response.type !== 'success') {
      if (response.type === 'cancel' || response.type === 'dismiss') {
        setAuthError('Login Google dibatalkan.');
      } else {
        setAuthError('Login Google Drive belum berhasil. Periksa izin OAuth lalu coba lagi.');
      }
      return;
    }

    const code = response.params.code;
    const codeVerifier = request?.codeVerifier;
    if (!code || !codeVerifier || !request) {
      setAuthError('Google tidak mengembalikan kode aman untuk menghubungkan Drive. Coba lagi.');
      return;
    }

    authResponseHandled.current = true;
    setAuthError('');
    let mounted = true;
    void connectGoogleAccount({
      code,
      codeVerifier,
      redirectUri: request.redirectUri,
      clientId: request.clientId,
    })
      .then(async (connection) => {
        await AsyncStorage.multiSet([
          [GOOGLE_SESSION_TOKEN_KEY, connection.sessionToken],
          [GOOGLE_ACCOUNT_EMAIL_KEY, connection.email],
        ]);
        if (!mounted) return;
        setSessionToken(connection.sessionToken);
        setEmail(connection.email);
        setIsConnected(true);
        setAuthError('');
      })
      .catch((reason) => {
        if (!mounted) return;
        setAuthError(
          reason instanceof Error
            ? reason.message
            : 'Koneksi Google Drive belum berhasil. Hubungkan ulang akun Google.',
        );
      });

    return () => {
      mounted = false;
    };
  }, [request, response]);

  const handleDriveError = useCallback(async (reason: unknown): Promise<never> => {
    if (reason instanceof ApiError && reason.status === 401) {
      await clearLocalSession(reconnectMessage);
      throw new Error(reconnectMessage);
    }
    throw reason;
  }, [clearLocalSession]);

  const uploadDriveBackup = useCallback(async (content: string) => {
    if (!sessionToken) throw new Error('Hubungkan akun Google Drive terlebih dahulu.');
    try {
      await uploadGoogleDriveBackup(
        { content },
        { headers: { Authorization: `Bearer ${sessionToken}` } },
      );
    } catch (reason) {
      return handleDriveError(reason);
    }
  }, [handleDriveError, sessionToken]);

  const downloadDriveBackup = useCallback(async () => {
    if (!sessionToken) throw new Error('Hubungkan akun Google Drive terlebih dahulu.');
    try {
      const backup = await downloadGoogleDriveBackup({
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      return backup.content;
    } catch (reason) {
      return handleDriveError(reason);
    }
  }, [handleDriveError, sessionToken]);

  const logout = useCallback(async () => {
    if (sessionToken) {
      try {
        await disconnectGoogleAccount({
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
      } catch {
        // Local logout still succeeds if the server is temporarily unavailable.
      }
    }
    await clearLocalSession();
  }, [clearLocalSession, sessionToken]);

  const value = useMemo<GoogleAccountContextValue>(() => ({
    isConnected,
    email,
    hydrated,
    hasDriveAccess: Boolean(sessionToken && isConnected),
    authError,
    request,
    promptAsync,
    clientConfigured: Boolean(googleClientConfigured),
    uploadDriveBackup,
    downloadDriveBackup,
    logout,
  }), [
    authError,
    downloadDriveBackup,
    email,
    hydrated,
    isConnected,
    logout,
    promptAsync,
    request,
    sessionToken,
    uploadDriveBackup,
  ]);

  return <GoogleAccountContext.Provider value={value}>{children}</GoogleAccountContext.Provider>;
}

export function useGoogleAccount() {
  const context = useContext(GoogleAccountContext);
  if (!context) throw new Error('useGoogleAccount must be used within GoogleAccountProvider');
  return context;
}