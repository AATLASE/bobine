import React from "react";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { colors, shadows } from "@/constants/theme";

/**
 * Identité Bobine : une bobine de film qui se lit aussi comme une table ronde
 * vue d'en haut. Les trous sont les places de la bande (toujours transparents,
 * ils prennent la couleur du fond), le point central est le moment partagé.
 */

const SUN = "#F5C542";

function circlePath(x: number, y: number, r: number): string {
  return `M${x - r},${y}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0Z`;
}

/** Disk with `holes` member cut-outs, in a 100 × 100 box. */
export function reelPath(holes: number): string {
  const n = Math.max(2, Math.min(8, Math.round(holes)));
  const c = 50;
  const ring = 50 * 0.56;
  const hr = 50 * (n > 6 ? 0.17 : 0.215);
  let d = circlePath(c, c, 50);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    d += circlePath(c + ring * Math.cos(a), c + ring * Math.sin(a), hr);
  }
  return d;
}

const LOGO_REEL = reelPath(5);

/** Le symbole Bobine (5 trous, toujours). */
export function BrandMark({
  size = 64,
  glow = true,
  color = colors.primary,
}: {
  size?: number;
  glow?: boolean;
  color?: string;
}) {
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2 }, glow ? shadows.glow : null]}>
      <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="Bobine">
        <Path d={LOGO_REEL} fill={color} fillRule="evenodd" />
        <Circle cx={50} cy={50} r={7.5} fill={SUN} />
      </Svg>
    </View>
  );
}

/**
 * Le symbole d'une bande : un trou par membre (de 2 à 8). Sert d'avatar quand
 * la bande n'a pas de couverture. Ne jamais l'utiliser comme logo de Bobine.
 */
export function BandReel({ members, size = 40, color = colors.primary }: { members: number; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel={`Bande de ${members} membres`}>
      <Path d={reelPath(members)} fill={color} fillRule="evenodd" />
      <Circle cx={50} cy={50} r={7.5} fill={SUN} />
    </Svg>
  );
}

const WORDMARK_INK = "M39.6 96.4Q34.6 96.4 30.85 94.5Q27.1 92.6 24.75 88.8Q22.40 85.0 21.6 79.4H19.70L19.40 95.0H6.2V69.1V23.0H22.3V40.5Q22.3 42.9 21.95 45.55Q21.6 48.19 21.05 51.09Q20.5 54.0 19.90 57.3H22.20Q23.6 51.9 25.90 48.3Q28.20 44.69 31.65 42.84Q35.1 41.0 39.80 41.0Q46.40 41.0 51.25 44.4Q56.1 47.8 58.8 54.05Q61.5 60.3 61.5 69.0Q61.5 77.4 58.85 83.55Q56.2 89.7 51.30 93.05Q46.40 96.4 39.6 96.4ZM33.6 83.4Q36.9 83.4 39.40 81.55Q41.90 79.7 43.25 76.35Q44.6 73.0 44.6 68.5Q44.6 63.9 43.3 60.65Q42.0 57.4 39.65 55.59Q37.30 53.8 34.0 53.8Q31.8 53.8 29.95 54.59Q28.1 55.4 26.70 56.8Q25.3 58.19 24.3 59.94Q23.3 61.69 22.8 63.64Q22.3 65.6 22.3 67.5V69.6Q22.3 71.7 22.9 74.1Q23.5 76.5 24.85 78.6Q26.20 80.7 28.35 82.05Q30.5 83.4 33.6 83.4Z M165.6 96.4Q160.6 96.4 156.85 94.5Q153.1 92.6 150.75 88.8Q148.4 85.0 147.6 79.4H145.7L145.4 95.0H132.2V69.1V23.0H148.3V40.5Q148.3 42.9 147.95 45.55Q147.6 48.19 147.05 51.09Q146.5 54.0 145.9 57.3H148.2Q149.6 51.9 151.89 48.3Q154.2 44.69 157.64 42.84Q161.1 41.0 165.8 41.0Q172.4 41.0 177.25 44.4Q182.1 47.8 184.8 54.05Q187.5 60.3 187.5 69.0Q187.5 77.4 184.85 83.55Q182.2 89.7 177.3 93.05Q172.4 96.4 165.6 96.4ZM159.6 83.4Q162.9 83.4 165.4 81.55Q167.9 79.7 169.25 76.35Q170.6 73.0 170.6 68.5Q170.6 63.9 169.3 60.65Q168.0 57.4 165.65 55.59Q163.3 53.8 160.0 53.8Q157.8 53.8 155.95 54.59Q154.1 55.4 152.7 56.8Q151.3 58.19 150.3 59.94Q149.3 61.69 148.8 63.64Q148.3 65.6 148.3 67.5V69.6Q148.3 71.7 148.9 74.1Q149.5 76.5 150.85 78.6Q152.2 80.7 154.35 82.05Q156.5 83.4 159.6 83.4Z M197.0 95.0V42.19H213.10V95.0ZM205.10 34.80Q200.50 34.80 198.05 32.85Q195.60 30.90 195.60 27.29Q195.60 23.5 198.05 21.55Q200.50 19.60 205.10 19.60Q209.8 19.60 212.25 21.55Q214.70 23.5 214.70 27.20Q214.70 30.90 212.25 32.85Q209.8 34.80 205.10 34.80Z M225.6 95.0V63.2V42.19H238.60L238.8 57.69H240.8Q242.10 52.09 244.5 48.3Q246.9 44.5 250.60 42.65Q254.3 40.8 259.3 40.8Q268.6 40.8 273.45 47.3Q278.3 53.8 278.3 68.0V95.0H262.1V69.8Q262.1 61.6 259.75 57.84Q257.4 54.09 252.8 54.09Q249.0 54.09 246.55 56.39Q244.10 58.69 242.90 62.5Q241.70 66.3 241.70 71.0V95.0Z M315.0 96.4Q308.4 96.4 303.2 94.65Q298.0 92.9 294.35 89.5Q290.7 86.1 288.79 81.1Q286.9 76.1 286.9 69.6Q286.9 63.3 288.75 58.0Q290.59 52.69 294.04 48.84Q297.5 45.0 302.54 42.9Q307.59 40.8 313.9 40.8Q320.3 40.8 325.15 42.84Q330.0 44.9 333.15 48.9Q336.3 52.9 337.8 58.65Q339.3 64.4 338.8 71.8L297.5 72.1V63.7L329.6 63.4L323.9 67.3Q324.6 62.3 323.3 59.15Q322.0 56.0 319.5 54.55Q317.0 53.09 314.09 53.09Q310.59 53.09 307.95 55.0Q305.3 56.9 303.8 60.5Q302.3 64.1 302.3 69.3Q302.3 77.5 305.85 81.2Q309.4 84.9 314.9 84.9Q317.59 84.9 319.4 84.15Q321.2 83.4 322.35 82.25Q323.5 81.1 324.15 79.69Q324.8 78.3 325.2 77.0L339.2 80.0Q338.4 83.7 336.65 86.7Q334.9 89.7 331.95 91.9Q329.0 94.1 324.85 95.25Q320.7 96.4 315.0 96.4Z";
const WORDMARK_REEL = "M66.49,68.60a28.91,28.91 0 1,0 57.82,0a28.91,28.91 0 1,0 -57.82,0ZM89.18,52.41a6.22,6.22 0 1,0 12.43,0a6.22,6.22 0 1,0 -12.43,0ZM104.58,63.60a6.22,6.22 0 1,0 12.43,0a6.22,6.22 0 1,0 -12.43,0ZM98.70,81.70a6.22,6.22 0 1,0 12.43,0a6.22,6.22 0 1,0 -12.43,0ZM79.67,81.70a6.22,6.22 0 1,0 12.43,0a6.22,6.22 0 1,0 -12.43,0ZM73.79,63.60a6.22,6.22 0 1,0 12.43,0a6.22,6.22 0 1,0 -12.43,0Z";
const WORDMARK_VIEWBOX = "-6 0 354.4 120.0";
const WORDMARK_RATIO = 2.9533;

/** Le logotype « bobine », dont le premier « o » est le symbole. `size` se lit comme une taille de police. */
export function Wordmark({ size = 26, color = colors.text }: { size?: number; color?: string }) {
  // Drawn at a 100-unit font size in a 120-unit-high box: `size` reads like a fontSize.
  const height = size * 1.2;
  return (
    <Svg width={height * WORDMARK_RATIO} height={height} viewBox={WORDMARK_VIEWBOX} accessibilityLabel="Bobine">
      <Path d={WORDMARK_INK} fill={color} />
      <Path d={WORDMARK_REEL} fill={colors.primary} fillRule="evenodd" />
      <Circle cx={95.40} cy={68.60} r={4.34} fill={SUN} />
    </Svg>
  );
}
