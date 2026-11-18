import React from "react";
import { ActivityIndicator, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { makeStyles, useTheme } from "../hooks/useTheme";

interface Props {
  loading: boolean; // Apple's sheet is open or its answer is being checked
  disabled: boolean;
  onPress: () => void;
}

const BUTTON_HEIGHT = 48; // the app's own button height, so the two line up

// Apple's own "Continue with Apple" button, as its guidelines require: black on
// a light theme, white on a dark one. Render it only where isAppleSignInAvailable() is true.
export function AppleSignInButton({ loading, disabled, onPress }: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  const blocked = loading || disabled;

  return (
    <View style={[styles.wrap, blocked && styles.blocked]} pointerEvents={blocked ? "none" : "auto"}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={
          theme.isDark
            ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
            : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
        }
        cornerRadius={BUTTON_HEIGHT / 2} // a pill, like the app's own buttons
        style={styles.button}
        onPress={onPress}
      />
      {loading && <ActivityIndicator style={styles.spinner} color={theme.colors.textSecondary} />}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrap: {
    justifyContent: "center",
  },
  blocked: {
    opacity: 0.5,
  },
  button: {
    height: BUTTON_HEIGHT,
    width: "100%",
  },
  spinner: {
    position: "absolute",
    alignSelf: "center",
  },
}));
