import React from "react";
import { Modal, Pressable, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { makeStyles, useTheme } from "../hooks/useTheme";

interface Props {
  visible: boolean;
  onDecideForMe: () => void; // One Thing mode: a single task, chosen for you
  onFitMyTime: () => void; // Do Now: tasks that fit the time and energy you have
  onClose: () => void;
}

type IconName = React.ComponentProps<typeof Ionicons>["name"];

// The small chooser behind Today's one "Pick my next task" button. It folds
// the two helpers that used to be separate buttons into one entry point.
export function PickNextTaskSheet({ visible, onDecideForMe, onFitMyTime, onClose }: Props) {
  const { theme } = useTheme();
  const styles = useStyles();

  const option = (icon: IconName, title: string, hint: string, onPress: () => void) => (
    <TouchableOpacity style={styles.option} onPress={onPress} accessibilityRole="button" accessibilityHint={hint}>
      <View style={styles.optionIcon}>
        <Ionicons name={icon} size={20} color={theme.colors.accentDark} />
      </View>
      <View style={styles.optionText}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionHint}>{hint}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        {/* Taps inside the panel must not reach the backdrop. */}
        <Pressable style={styles.panel} onPress={() => {}}>
          <Text style={styles.title} accessibilityRole="header">
            Pick my next task
          </Text>
          {option("sparkles-outline", "Decide for me", "One task at a time, picked for you", onDecideForMe)}
          {option("time-outline", "Fit my time", "See what fits the minutes and energy you have", onFitMyTime)}
          <TouchableOpacity style={styles.cancel} onPress={onClose} accessibilityRole="button">
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = makeStyles((theme) => ({
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  panel: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 420,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.headline.fontSize,
    fontWeight: "700",
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    padding: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.quickFill,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "600",
  },
  optionHint: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "400",
  },
  cancel: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  cancelText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "600",
  },
}));
