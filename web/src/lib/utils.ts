import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Teach tailwind-merge about the custom theme tokens in globals.css so they override defaults.
const twMerge = extendTailwindMerge({
  extend: {
    theme: { shadow: ["glow", "elevated"] },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
