import React from "react";
import { Text as RNText, StyleSheet, TextProps, TextStyle } from "react-native";
import { colors, fonts, textFontFor, type as typeStyles } from "@/constants/theme";

type Variant = keyof typeof typeStyles;

interface Props extends TextProps {
  variant?: Variant;
  color?: string;
  center?: boolean;
  weight?: TextStyle["fontWeight"];
}

/**
 * Loaded fonts carry one weight per family, so a fontWeight override has to
 * switch the family too (Android ignores fontWeight on custom fonts).
 */
function resolveFamily(style: TextStyle): TextStyle {
  const family = style.fontFamily;
  if (!family || style.fontWeight == null) return style;
  if (family.startsWith("Figtree_")) return { ...style, fontFamily: textFontFor(style.fontWeight) };
  if (family.startsWith("BricolageGrotesque_")) {
    const w = parseInt(String(style.fontWeight), 10) || 700;
    return { ...style, fontFamily: w >= 800 ? fonts.display : fonts.displayBold };
  }
  return style;
}

/** Canonical typographic component. Always prefer this over raw RN Text. */
export function AppText({ variant = "body", color, center, weight, style, ...rest }: Props) {
  const flat = StyleSheet.flatten([
    typeStyles[variant],
    color ? { color } : null,
    center ? { textAlign: "center" as const } : null,
    weight ? { fontWeight: weight } : null,
    style,
  ]) as TextStyle;
  return <RNText {...rest} style={resolveFamily(flat)} />;
}

export { colors };
