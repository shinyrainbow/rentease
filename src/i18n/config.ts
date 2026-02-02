export const locales = ["en", "th"] as const;
export const defaultLocale = "th" as const;

export type Locale = (typeof locales)[number];
