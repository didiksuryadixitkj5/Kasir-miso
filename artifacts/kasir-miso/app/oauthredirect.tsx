import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useGoogleAccount } from '@/context/GoogleAccountContext';
import { useColors } from '@/hooks/useColors';

export default function OAuthRedirectScreen() {
  const router = useRouter();
  const c = useColors();
  const { isConnected, authError } = useGoogleAccount();

  useEffect(() => {
    if (!isConnected && !authError) return;
    const timer = setTimeout(() => router.replace('/other'), 250);
    return () => clearTimeout(timer);
  }, [authError, isConnected, router]);

  useEffect(() => {
    const timeout = setTimeout(() => router.replace('/other'), 15000);
    return () => clearTimeout(timeout);
  }, [router]);

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ActivityIndicator size="large" color={c.primary} />
      <Text style={[styles.title, { color: c.foreground }]}>Menyelesaikan login Google</Text>
      <Text style={[styles.body, { color: c.mutedForeground }]}>
        Tunggu sebentar, akun sedang dihubungkan dengan backup Google Drive.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    marginTop: 18,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});