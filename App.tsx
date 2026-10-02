import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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

// Text-only pill tab bar matching the design: a single rounded white bar,
// the active tab shown as a filled dark-green pill, inactive tabs plain
// gray text — no icons, unlike the previous iOS-style tab bar.
function PillTabBar({ state, descriptors, navigation }: any) {
  return (
    <View style={styles.tabBarWrapper}>
      <View style={styles.tabBar}>
        {state.routes.map((route: any, index: number) => {
          const isFocused = state.index === index;
          const label = route.name.toUpperCase();

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={[styles.tab, isFocused && styles.tabActive]}
            >
              <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// Root component: waits for the anonymous Supabase session, then wires the
// three tabs (Tasks / Stats / Settings) behind the custom pill tab bar.
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
      <StatusBar style="dark" />
      <Tab.Navigator
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <PillTabBar {...props} />}
      >
        <Tab.Screen name="Tasks">
          {() => <TaskListScreen userId={userId} />}
        </Tab.Screen>
        <Tab.Screen name="Stats">
          {() => <StatsScreen userId={userId} />}
        </Tab.Screen>
        <Tab.Screen name="Settings">
          {() => <SettingsScreen userId={userId} session={session} />}
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
  tabBarWrapper: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    paddingTop: theme.spacing.xs,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.pill,
    padding: 6,
    gap: 6,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: theme.radius.pill,
  },
  tabActive: {
    backgroundColor: theme.colors.accentDark,
  },
  tabLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption.fontSize,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  tabLabelActive: {
    color: "#FFFFFF",
  },
});
