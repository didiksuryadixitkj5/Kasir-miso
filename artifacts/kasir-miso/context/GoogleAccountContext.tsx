import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CONNECTION_KEY = 'warung-google-connection-v1';
const GOOGLE_ACCOUNT_EMAIL_KEY = 'warung-google-account-email-v1';
const GOOGLE_CLIENT_ID_FALLBACK = 'google-client-id-not-configured';
const DRIVE_BACKUP_FILENAME = 'Kasir Miso Backup.json';
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

export function GoogleAccountProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [email, setEmail] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const authResponseHandled = useRef(false);
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: googleWebClientId,
    iosClientId: googleIosClientId,
    androidClientId: googleAndroidClientId,
    scopes: ['openid', 'profile', 'email', 'https://www.googleapis.com/auth/drive.file'],
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
    if (!response) return;
    if (response.type !== 'success') {
      if (response.type === 'cancel' || response.type === 'dismiss') {
        setAuthError('Login Google dibatalkan.');
      } else {
        setAuthError('Login Google Drive belum berhasil. Periksa izin OAuth lalu coba lagi.');
      }
      return;
    }

    const accessToken = response.authentication?.accessToken ?? response.params?.access_token;
    if (!accessToken) {
      setAuthError('Google tidak mengembalikan token Drive. Pastikan scope Google Drive sudah diizinkan.');
      return;
    }
    authResponseHandled.current = true;
    setAuthError('');
    setAccessToken(accessToken);

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
        if (mounted) setAuthError('Status akun Google Drive belum dapat disimpan di perangkat.');
      }
    })();

    return () => {
      mounted = false;
    };
  }, [response]);

  const driveRequest = useCallback(async (url: string, init: RequestInit = {}) => {
    if (!accessToken) {
      throw new Error('Akses Google Drive belum aktif. Hubungkan ulang akun Google.');
    }
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init.headers || {}),
      },
    });
    if (!response.ok) {
      if (response.status === 401) setAccessToken(null);
      const detail = await response.text().catch(() => '');
      throw new Error(`Google Drive gagal merespons (${response.status})${detail ? `: ${detail}` : ''}`);
    }
    return response;
  }, [accessToken]);

  const findBackupFile = useCallback(async () => {
    const query = encodeURIComponent(`name='${DRIVE_BACKUP_FILENAME}' and trashed=false`);
    const response = await driveRequest(
      `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&orderBy=modifiedTime%20desc&pageSize=1&fields=files(id,name,modifiedTime)`,
    );
    const result = (await response.json()) as { files?: Array<{ id: string; name: string; modifiedTime?: string }> };
    return result.files?.[0] ?? null;
  }, [driveRequest]);

  const uploadDriveBackup = useCallback(async (content: string) => {
    const existing = await findBackupFile();
    let fileId = existing?.id;

    if (!fileId) {
      const metadataResponse = await driveRequest(
        'https://www.googleapis.com/drive/v3/files?fields=id',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: DRIVE_BACKUP_FILENAME,
            mimeType: 'application/json',
          }),
        },
      );
      const metadata = (await metadataResponse.json()) as { id?: string };
      fileId = metadata.id;
    }

    if (!fileId) throw new Error('Google Drive tidak mengembalikan ID file backup.');

    await driveRequest(
      `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json;charset=utf-8' },
        body: content,
      },
    );
  }, [driveRequest, findBackupFile]);

  const downloadDriveBackup = useCallback(async () => {
    const existing = await findBackupFile();
    if (!existing) throw new Error('Belum ada backup Kasir Miso di Google Drive.');
    const response = await driveRequest(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(existing.id)}?alt=media`,
    );
    return response.text();
  }, [driveRequest, findBackupFile]);

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove([GOOGLE_CONNECTION_KEY, GOOGLE_ACCOUNT_EMAIL_KEY]);
    setIsConnected(false);
    setEmail('');
    setAccessToken(null);
    setAuthError('');
  }, []);

  const value = useMemo<GoogleAccountContextValue>(() => ({
    isConnected,
    email,
    hydrated,
    hasDriveAccess: Boolean(accessToken),
    authError,
    request,
    promptAsync,
    clientConfigured: Boolean(googleClientConfigured),
    uploadDriveBackup,
    downloadDriveBackup,
    logout,
  }), [
    accessToken,
    authError,
    downloadDriveBackup,
    email,
    hydrated,
    isConnected,
    logout,
    promptAsync,
    request,
    uploadDriveBackup,
  ]);

  return <GoogleAccountContext.Provider value={value}>{children}</GoogleAccountContext.Provider>;
}

export function useGoogleAccount() {
  const context = useContext(GoogleAccountContext);
  if (!context) throw new Error('useGoogleAccount must be used within GoogleAccountProvider');
  return context;
}