import { Redirect, Stack } from 'expo-router';

export default function OAuthRedirectScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Redirect href="/" />
    </>
  );
}