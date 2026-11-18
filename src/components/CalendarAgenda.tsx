import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { makeStyles } from "../hooks/useTheme";
import { CalendarItem, calendarItemTime } from "../lib/calendarItems";
import { t } from "../i18n";

interface Props {
  items: CalendarItem[];
  onCompleteReminder: (item: CalendarItem) => void;
}

// The shown day's calendar events and reminders on Today, under their own heading so they never mix with
// PaceTasks tasks. Each row carries its calendar's color; a reminder's circle checks it off in Reminders.
export function CalendarAgenda({ items, onCompleteReminder }: Props) {
  const styles = useStyles();
  if (items.length === 0) return null;
  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {t("Calendar")}
        </Text>
        <Text style={styles.meta}>{items.length}</Text>
      </View>
      {items.map((item) => {
        const time = calendarItemTime(item);
        const details = [time, item.calendarTitle].filter(Boolean).join(" · ");
        return (
          <View key={item.id} style={styles.card}>
            {item.kind === "reminder" ? (
              <TouchableOpacity
                style={styles.checkTarget}
                onPress={() => onCompleteReminder(item)}
                accessibilityRole="button"
                accessibilityLabel={t("Complete {0}", item.title)}
              >
                <View style={[styles.checkCircle, { borderColor: item.colorHex }]} />
              </TouchableOpacity>
            ) : (
              <View style={styles.checkTarget}>
                <View style={[styles.eventBar, { backgroundColor: item.colorHex }]} />
              </View>
            )}
            <View style={styles.text}>
              <Text style={styles.itemTitle} numberOfLines={2}>
                {item.title}
              </Text>
              {details ? (
                <Text style={styles.details} numberOfLines={1}>
                  {details}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: theme.spacing.sm,
    paddingHorizontal: 4,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: {
    flexShrink: 1,
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  meta: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 56,
    paddingVertical: 6,
    paddingRight: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  checkTarget: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
  },
  eventBar: {
    width: 4,
    height: 28,
    borderRadius: 2,
  },
  text: {
    flex: 1,
    gap: 3,
  },
  itemTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "500",
  },
  details: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
  },
}));
