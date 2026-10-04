import React, { useMemo } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, makeStyles, useTheme } from "./src/hooks/useTheme";
import { useSession } from "./src/hooks/useSession";
import { TaskListScreen } from "./src/screens/TaskListScreen";
import { StatsScreen } from "./src/screens/StatsScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";

const Tab = createBottomTabNavigator();

// Text-only pill tab bar matching the design: a single rounded bar, the
// active tab shown as a filled ink pill, inactive tabs plain secondary text.
// Kept compact, and padded by the bottom safe-area inset so it clears the
// home indicator without a fixed gap on phones that have none.
function PillTabBar({ state, descriptors, navigation, insets }: any) {
  const styles = useStyles();
  const bottomInset = insets?.bottom ?? 0;
  return (
    <View style={[styles.tabBarWrapper, { paddingBottom: Math.max(bottomInset, 8) }]}>
      <View style={styles.tabBar}>
        {state.routes.map((route: any, index: number) => {
          const isFocused = state.index === index;
          const label = String(descriptors[route.key]?.options.tabBarLabel ?? route.name).toUpperCase();

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
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
            >
              <Text
                style={[styles.tabLabel, isFocused && styles.tabLabelActive]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.3}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// Waits for the anonymous Supabase session and the saved appearance, then
// wires the three tabs (Today / Pace / Settings) behind the pill tab bar.
function AppContent() {
  const { theme, appearanceLoaded } = useTheme();
  const styles = useStyles();
  const { session, loading, error } = useSession();

  const navigationTheme = useMemo(() => {
    const base = theme.isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.textPrimary,
        border: theme.colors.border,
        primary: theme.colors.accent,
      },
    };
  }, [theme]);

  if (loading || !appearanceLoaded) {
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
      <StatusBar style={theme.isDark ? "light" : "dark"} />
      <Tab.Navigator
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <PillTabBar {...props} />}
      >
        <Tab.Screen name="Tasks" options={{ tabBarLabel: "Today" }}>
          {() => <TaskListScreen userId={userId} />}
        </Tab.Screen>
        <Tab.Screen name="Stats" options={{ tabBarLabel: "Pace" }}>
          {() => <StatsScreen userId={userId} />}
        </Tab.Screen>
        <Tab.Screen name="Settings" options={{ tabBarLabel: "Settings" }}>
          {() => <SettingsScreen userId={userId} session={session} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

const useStyles = makeStyles((theme) => ({
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
    backgroundColor: theme.colors.backgroundEnd,
    paddingHorizontal: theme.spacing.md,
    paddingTop: 2,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.pill,
    padding: 3,
    gap: 3,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 4,
    borderRadius: theme.radius.pill,
  },
  tabActive: {
    backgroundColor: theme.colors.textPrimary,
  },
  tabLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  tabLabelActive: {
    color: theme.colors.surface,
  },
}));
