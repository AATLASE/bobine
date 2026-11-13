import { Platform, useWindowDimensions } from "react-native";

/**
 * Responsive breakpoints for the web build. The native apps are phone-only
 * (`supportsTablet: false`), so every wide layout is gated on the web: a phone
 * in landscape keeps the phone layout it was designed for.
 *
 * - below `wide`: the phone layout (bottom tab bar, full-width forms).
 * - `wide` and up: side navigation (icons only), centered content columns,
 *   modal flows shown as dialogs over the page.
 * - `desktop` and up: full side navigation with labels, multi-column screens.
 */
export const BREAKPOINTS = { wide: 768, desktop: 1024 } as const;

/** Max content widths, by what the screen holds. */
export const CONTENT_WIDTH = {
  /** Grids and dashboards (Moments). */
  page: 1180,
  /** Lists and prose (ideas, notifications, profile). */
  reading: 760,
  /** Dialog panels (create space, write a review…). */
  dialog: 640,
} as const;

export const SIDEBAR_WIDTH = { full: 248, compact: 76 } as const;

export function useLayout() {
  const { width, height } = useWindowDimensions();
  const web = Platform.OS === "web";
  const wide = web && width >= BREAKPOINTS.wide;
  const desktop = web && width >= BREAKPOINTS.desktop;
  return { width, height, wide, desktop };
}
