import { cx } from "class-variance-authority";
import { extendTailwindMerge } from "tailwind-merge";

/** Tachyon type-scale names, so tailwind-merge treats them as sizes, not colours. */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "caption",
            "body",
            "lead",
            "title",
            "heading",
            "display",
            "hero",
          ],
        },
      ],
    },
  },
});

export const cn = (...inputs: Parameters<typeof cx>) => twMerge(cx(inputs));
