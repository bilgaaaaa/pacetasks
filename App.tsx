import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { theme } from "./src/lib/theme";
import { useSession } from "./src/hooks/useSession";
import { TaskListScreen } from "./src/screens/TaskListScreen";
import { StatsScreen } from "./src/screens/StatsScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";

const Tab = createBottomTabNavigator();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: theme.colors.background,
    card: theme.colors.surface,
    text: theme.colors.textPrimary,
    border: theme.colors.border,
    primary: theme.colors.accent,
  },
};

// Root component: waits for the anonymous Supabase session, then wires the
// three tabs (Tasks / Stats / Settings), all scoped to that session's user id.
export default function App() {
  const { session, loading, error } = useSession();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.accent} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Couldn't start session: {error}</Text>
        <Text style={styles.errorHint}>
          Check that EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
          are set in your .env file.
        </Text>
      </View>
    );
  }

  const userId = session?.user.id;

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.colors.accent,
          tabBarInactiveTintColor: theme.colors.textSecondary,
          tabBarStyle: {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.border,
          },
        }}
      >
        <Tab.Screen name="Tasks">
          {() => <TaskListScreen userId={userId} />}
        </Tab.Screen>
        <Tab.Screen name="Stats">
          {() => <StatsScreen userId={userId} />}
        </Tab.Screen>
        <Tab.Screen name="Settings">
          {() => <SettingsScreen userId={userId} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  errorHint: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
    marginTop: theme.spacing.sm,
  },
});
