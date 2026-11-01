import { loadFont as bricolage } from "@remotion/google-fonts/BricolageGrotesque";
import { loadFont as dmSans } from "@remotion/google-fonts/DMSans";
import { loadFont as geist } from "@remotion/google-fonts/Geist";
import { loadFont as geistMono } from "@remotion/google-fonts/GeistMono";
import { loadFont as instrumentSerif } from "@remotion/google-fonts/InstrumentSerif";
import { loadFont as inter } from "@remotion/google-fonts/Inter";
import { loadFont as jetbrains } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as sora } from "@remotion/google-fonts/Sora";
import { loadFont as spaceGrotesk } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as syne } from "@remotion/google-fonts/Syne";
import type { FontName } from "./schema";

const latin = { subsets: ["latin" as const] };

// headingWeight: what looks right for display text in each family.
const FONTS: Record<FontName, { load: () => { fontFamily: string }; headingWeight: number }> = {
  Inter: { load: () => inter("normal", { weights: ["400", "500", "600", "800"], ...latin }), headingWeight: 800 },
  "Space Grotesk": { load: () => spaceGrotesk("normal", { weights: ["400", "500", "700"], ...latin }), headingWeight: 700 },
  "Bricolage Grotesque": { load: () => bricolage("normal", { weights: ["400", "500", "800"], ...latin }), headingWeight: 800 },
  "Instrument Serif": { load: () => instrumentSerif("normal", { weights: ["400"], ...latin }), headingWeight: 400 },
  "DM Sans": { load: () => dmSans("normal", { weights: ["400", "500", "700"], ...latin }), headingWeight: 700 },
  Sora: { load: () => sora("normal", { weights: ["400", "500", "700"], ...latin }), headingWeight: 700 },
  Syne: { load: () => syne("normal", { weights: ["400", "500", "800"], ...latin }), headingWeight: 800 },
  "JetBrains Mono": { load: () => jetbrains("normal", { weights: ["400", "500", "700"], ...latin }), headingWeight: 700 },
  Geist: { load: () => geist("normal", { weights: ["400", "500", "600"], ...latin }), headingWeight: 500 },
  "Geist Mono": { load: () => geistMono("normal", { weights: ["400", "500"], ...latin }), headingWeight: 500 },
};

const loaded = new Map<FontName, string>();

/** Loads a font once (Remotion waits for it before rendering) and returns its CSS family. */
export function font(name: FontName) {
  let family = loaded.get(name);
  if (!family) {
    family = FONTS[name].load().fontFamily;
    loaded.set(name, family);
  }
  return { fontFamily: family, headingWeight: FONTS[name].headingWeight };
}
