import type { Locale } from "./types";

/** Read only the supported UI locale from a request cookie. */
export function requestLocale(request: Request): Locale {
  const value = request.headers.get("cookie")?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("app_locale="))
    ?.slice("app_locale=".length);
  return value === "en" ? "en" : "vi";
}

/** Appended to existing model instructions; source text and evidence stay verbatim. */
export function modelOutputLanguageInstruction(locale: Locale): string {
  return locale === "en"
    ? "Output newly authored prose in English, overriding any earlier language preference; preserve user text, source evidence, exact quotations, and machine identifiers unchanged."
    : "Output newly authored prose in Vietnamese; preserve user text, source evidence, exact quotations, and machine identifiers unchanged.";
}
