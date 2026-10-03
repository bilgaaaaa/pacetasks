import React from "react";
import { StyleProp, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { makeStyles, useTheme } from "../hooks/useTheme";

interface Props {
  message: string;
  style?: StyleProp<ViewStyle>; // outer spacing only
}

// One line telling the user something failed, shown inside the sheet they are
// looking at: a sheet covers the screen's own error text, so each sheet needs it.
export function ErrorBanner({ message, style }: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.banner, style]} accessibilityRole="alert">
      <Ionicons name="alert-circle-outline" size={16} color={theme.colors.danger} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  text: {
    flex: 1,
    color: theme.colors.danger,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: theme.typography.footnote.fontWeight,
  },
}));
