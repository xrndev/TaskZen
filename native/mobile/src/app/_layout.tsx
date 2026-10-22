import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { SessionProvider, useSession } from '@/lib/session'
import { useTheme } from '@/lib/theme'

function Routes() {
  const { state } = useSession()
  const t = useTheme()

  if (state.status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.background }}>
        <ActivityIndicator color={t.primary} size="large" />
      </View>
    )
  }

  const signedIn = state.status === 'in'
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.background } }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="index" />
        <Stack.Screen name="task/[id]" />
        <Stack.Screen name="new-task" options={{ presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="auto" />
        <Routes />
      </SessionProvider>
    </SafeAreaProvider>
  )
}
