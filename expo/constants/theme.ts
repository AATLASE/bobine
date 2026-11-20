import { TextStyle, ViewStyle } from "react-native";

/**
 * Bobine : palette « Salle » (sombre) et « Jour » (clair), issue du système
 * d'identité Bobine. Le rouge de marque #D7372A tient 4,7:1 avec du texte blanc
 * (l'ancien #EF233C ne tenait que 4,2:1). Quand le rouge sert de couleur de
 * texte, utiliser `primaryText`, plus lisible sur les fonds de chaque thème.
 * The exported `colors` object is mutable: `applyPalette()` swaps every value
 * in place so all inline styles pick up the active theme on re-render.
 */
export type ThemeScheme = "dark" | "light";

const darkColors = {
  // Canvas (noir de salle de cinéma, légèrement chaud)
  bg: "#151012",
  bgDeep: "#0E0A0B",
  bgElevated: "#1C1517",

  // Surfaces
  card: "#221A1C",
  cardElevated: "#2A2023",
  surface: "#2E2427",

  // Lines
  border: "#33292B",
  borderStrong: "#4A3E40",
  // The field being typed in. Neutral on purpose: red means the brand.
  focus: "#E8E0DA",

  // Text (textFaint carries dates and counts: 6,8:1 on bg, 6,2:1 on card)
  text: "#F4EEE6",
  textMuted: "#BDB3AE",
  textFaint: "#A39A95",

  // Brand
  primary: "#D7372A",
  primaryDark: "#B92F24",
  primarySoft: "rgba(215,55,42,0.18)",
  primaryFg: "#FFFFFF",
  // Red used as text or link color (6,7:1 on bg, 6,1:1 on card).
  primaryText: "#FF6B57",

  // Highlights : le « soleil », le moment partagé
  accent: "#F5C542",
  accentSoft: "rgba(245,197,66,0.16)",

  // Status
  success: "#4FCB86",
  successSoft: "rgba(79,203,134,0.14)",
  warning: "#E8A13A",
  destructive: "#FF8A75",
  destructiveSoft: "rgba(255,138,117,0.16)",

  // Poster blocks (bilan scellé, affiches sans photo): they stay dark in both
  // themes, so their text is always white rather than following `text`.
  heroFrom: "#3A1418",
  heroTo: "#1E1012",
  onHero: "#FFFFFF",
  onHeroMuted: "rgba(255,255,255,0.72)",
  // Top of the sign-in and splash backgrounds, fading into `bg`.
  brandGlow: "#2E1210",

  // Misc
  overlay: "rgba(0,0,0,0.6)",
  scrim: "rgba(14,10,11,0.92)",
  white: "#FFFFFF",
  black: "#000000",
};

export type Palette = { [K in keyof typeof darkColors]: string };

const lightColors: Palette = {
  // Canvas (papier chaud)
  bg: "#FBF6EE",
  bgDeep: "#F3EBDF",
  bgElevated: "#FFFFFF",

  // Surfaces
  card: "#FFFFFF",
  cardElevated: "#FFFFFF",
  surface: "#F3EBDF",

  // Lines
  border: "#E6DCCF",
  borderStrong: "#CFC2B2",
  focus: "#1E1416",

  // Text (textFaint: 5,5:1 on bg, 5:1 on surface)
  text: "#1E1416",
  textMuted: "#574B48",
  textFaint: "#6E625E",

  // Brand
  primary: "#D7372A",
  primaryDark: "#B92F24",
  primarySoft: "rgba(215,55,42,0.10)",
  primaryFg: "#FFFFFF",
  primaryText: "#B3261E",

  // Highlights (doré lisible en texte sur papier)
  accent: "#8C6A10",
  accentSoft: "rgba(245,197,66,0.22)",

  // Status
  success: "#2E7D4F",
  successSoft: "rgba(46,125,79,0.12)",
  warning: "#B26A0E",
  destructive: "#A4161A",
  destructiveSoft: "rgba(164,22,26,0.10)",

  // Poster blocks: same as dark on purpose (see darkColors).
  heroFrom: "#3A1418",
  heroTo: "#1E1012",
  onHero: "#FFFFFF",
  onHeroMuted: "rgba(255,255,255,0.72)",
  // The dark bordeaux sat behind dark text here; a light tint keeps the glow.
  brandGlow: "#F9DDD8",

  // Misc
  overlay: "rgba(30,20,22,0.45)",
  scrim: "rgba(30,20,22,0.88)",
  white: "#FFFFFF",
  black: "#000000",
};

/** Mutable palette — values are swapped in place when the theme changes. */
export const colors: Palette = { ...darkColors };

let scheme: ThemeScheme = "dark";

/** Swaps every color value in place for the given scheme. */
export function applyPalette(next: ThemeScheme): void {
  scheme = next;
  Object.assign(colors, next === "dark" ? darkColors : lightColors);
}

/** The scheme currently applied to `colors`. */
export function currentScheme(): ThemeScheme {
  return scheme;
}

export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  xxl: 22,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

/**
 * Polices Bobine, chargées dans app/_layout.tsx avec @expo-google-fonts.
 * Une famille par graisse : Android ignore fontWeight sur une police chargée,
 * donc chaque style nomme directement la bonne graisse.
 */
export const fonts = {
  /** Titres : Bricolage Grotesque. */
  display: "BricolageGrotesque_800ExtraBold",
  displayBold: "BricolageGrotesque_700Bold",
  /** Texte : Figtree. */
  regular: "Figtree_400Regular",
  medium: "Figtree_500Medium",
  semibold: "Figtree_600SemiBold",
  bold: "Figtree_700Bold",
  extrabold: "Figtree_800ExtraBold",
  /** Avis révélés et légendes uniquement : Gochi Hand. */
  hand: "GochiHand_400Regular",
  /** Kept for older call sites: the default text family. */
  family: "Figtree_500Medium",
  black: "BricolageGrotesque_800ExtraBold",
} as const;

/** The Figtree file matching a fontWeight, so `weight` props keep working. */
export function textFontFor(weight?: TextStyle["fontWeight"]): string {
  const w = typeof weight === "number" ? weight : parseInt(String(weight ?? "500"), 10) || (weight === "bold" ? 700 : 500);
  if (w >= 800) return fonts.extrabold;
  if (w >= 700) return fonts.bold;
  if (w >= 600) return fonts.semibold;
  if (w >= 500) return fonts.medium;
  return fonts.regular;
}

/** Getter-based so text colors always follow the active palette. */
export const type = {
  get display(): TextStyle {
    return { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, fontWeight: "800" as const, letterSpacing: -0.8, color: colors.text };
  },
  get title(): TextStyle {
    return { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, fontWeight: "800" as const, letterSpacing: -0.6, color: colors.text };
  },
  get h2(): TextStyle {
    return { fontFamily: fonts.displayBold, fontSize: 20, lineHeight: 25, fontWeight: "700" as const, letterSpacing: -0.3, color: colors.text };
  },
  get h3(): TextStyle {
    return { fontFamily: fonts.displayBold, fontSize: 17, lineHeight: 22, fontWeight: "700" as const, letterSpacing: -0.2, color: colors.text };
  },
  get body(): TextStyle {
    return { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, fontWeight: "500" as const, color: colors.text };
  },
  get bodyMuted(): TextStyle {
    return { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, fontWeight: "500" as const, color: colors.textMuted };
  },
  get label(): TextStyle {
    return { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 17, fontWeight: "600" as const, color: colors.textMuted };
  },
  get caption(): TextStyle {
    return { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 15, fontWeight: "600" as const, letterSpacing: 0.2, color: colors.textFaint };
  },
  get overline(): TextStyle {
    return {
      fontFamily: fonts.bold,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "700" as const,
      letterSpacing: 1.4,
      textTransform: "uppercase" as const,
      color: colors.textFaint,
    };
  },
};

/** Getter-based so shadows soften automatically on the light theme. */
export const shadows = {
  get poster(): ViewStyle {
    return {
      shadowColor: "#000000",
      shadowOpacity: scheme === "dark" ? 0.55 : 0.16,
      shadowRadius: 26,
      shadowOffset: { width: 0, height: 16 },
      elevation: scheme === "dark" ? 14 : 6,
    };
  },
  get card(): ViewStyle {
    return {
      shadowColor: "#000000",
      shadowOpacity: scheme === "dark" ? 0.4 : 0.08,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: scheme === "dark" ? 8 : 3,
    };
  },
  get glow(): ViewStyle {
    return {
      shadowColor: colors.primary,
      shadowOpacity: scheme === "dark" ? 0.5 : 0.3,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 0 },
      elevation: 10,
    };
  },
};

export const theme = { colors, radius, spacing, type, shadows, fonts } as const;
export type Theme = typeof theme;
