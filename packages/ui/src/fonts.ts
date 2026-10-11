import {
  Architects_Daughter,
  Archivo,
  Azeret_Mono,
  Doto,
  Funnel_Display,
  Funnel_Sans,
  Kode_Mono,
  Martian_Mono,
  Recursive,
  Saira,
} from "next/font/google";

/*
 * Tachyon typefaces, self-hosted by next/font and exposed as CSS variables.
 * Direction tokens (--tc-font-*) choose among them, so only the families a
 * direction actually renders are downloaded by the browser. Once a direction
 * is chosen, the unused loaders here are deleted.
 */

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});
const martianMono = Martian_Mono({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-martian-mono",
  display: "swap",
  preload: false,
});
const architectsDaughter = Architects_Daughter({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-architects-daughter",
  display: "swap",
  preload: false,
});
const funnelDisplay = Funnel_Display({
  subsets: ["latin"],
  variable: "--font-funnel-display",
  display: "swap",
  preload: false,
});
const funnelSans = Funnel_Sans({
  subsets: ["latin"],
  variable: "--font-funnel-sans",
  display: "swap",
  preload: false,
});
const azeretMono = Azeret_Mono({
  subsets: ["latin"],
  variable: "--font-azeret-mono",
  display: "swap",
  preload: false,
});
const saira = Saira({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-saira",
  display: "swap",
  preload: false,
});
const doto = Doto({
  subsets: ["latin"],
  axes: ["ROND"],
  variable: "--font-doto",
  display: "swap",
  preload: false,
});
const kodeMono = Kode_Mono({
  subsets: ["latin"],
  variable: "--font-kode-mono",
  display: "swap",
  preload: false,
});
const recursive = Recursive({
  subsets: ["latin"],
  axes: ["CASL", "MONO", "CRSV", "slnt"],
  variable: "--font-recursive",
  display: "swap",
  preload: false,
});

/** Class list that defines every Tachyon font variable; put it on <html>. */
export const tachyonFontVariables = [
  archivo,
  martianMono,
  architectsDaughter,
  funnelDisplay,
  funnelSans,
  azeretMono,
  saira,
  doto,
  kodeMono,
  recursive,
]
  .map((font) => font.variable)
  .join(" ");
