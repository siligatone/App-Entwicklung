import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../constants/design';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: Colors.backgroundPrimary,
          },
          headerTintColor: Colors.primary,
          headerTitleStyle: {
            fontWeight: '600',
            color: Colors.textPrimary,
          },
          contentStyle: {
            backgroundColor: Colors.backgroundPrimary,
          },
          headerShadowVisible: false,
        }}
      />
    </>
  );
}
