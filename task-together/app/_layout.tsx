import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { TouchableOpacity, Text } from 'react-native';
import { Colors, Typography } from '../constants/design';

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
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="group-setup" options={{ headerShown: false }} />
        <Stack.Screen
          name="task/[id]"
          options={({ navigation }) => ({
            title: 'Aufgabe',
            headerLeft: () => (
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={{ paddingRight: 16, paddingVertical: 8 }}
              >
                <Text style={{ color: Colors.primary, fontSize: Typography.sizeMD }}>
                  ‹ Zurück
                </Text>
              </TouchableOpacity>
            ),
          })}
        />
      </Stack>
    </>
  );
}
