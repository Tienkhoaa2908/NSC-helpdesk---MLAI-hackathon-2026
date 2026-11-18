"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ElementType,
  type ReactNode,
} from "react";
import type { Locale } from "./types";
export type { Locale } from "./types";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale: Locale;
}) {
  const [locale, setCurrentLocale] = useState(initialLocale);
  const setLocale = useCallback((next: Locale) => {
    setCurrentLocale(next);
    document.documentElement.lang = next;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `app_locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  }, []);
  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used inside LocaleProvider");
  return value;
}

export function localized(vi: string, en: string, locale: Locale): string {
  return locale === "en" ? en : vi;
}

const errorMessagesEnglish: Record<string, string> = {
  AUTHENTICATION_REQUIRED: "Sign in again to continue.",
  IDENTITY_REQUIRED: "Sign in with an employee account to continue.",
  IDENTITY_STORAGE_UNAVAILABLE: "Employee account service is unavailable. Please try again later.",
  NOT_FOUND: "The requested item could not be found.",
  RATE_LIMITED: "Too many attempts. Wait a minute and try again.",
  STORAGE_UNAVAILABLE: "The request could not be saved. Please try again.",
  IDEMPOTENCY_CONFLICT: "This request key was already used for different content.",
  INVALID_INPUT: "Check the information and try again.",
  NETWORK_ERROR: "Connection lost. Check your network and try again.",
  ID_LOGIN_DISABLED: "Sign in with an employee ID and password.",
  IDENTITY_DISABLED: "This employee account is disabled. Contact an administrator.",
};

export function localizedError(
  error: unknown,
  locale: Locale,
  viFallback: string,
  enFallback: string,
): string {
  if (locale === "vi") return error instanceof Error ? error.message : viFallback;
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && errorMessagesEnglish[code]) return errorMessagesEnglish[code];
  }
  return enFallback;
}

export function LocaleText({
  vi,
  en,
  as: Component = "span",
  ...props
}: {
  vi: string;
  en: string;
  as?: ElementType;
} & Record<string, unknown>) {
  const { locale } = useLocale();
  return <Component {...props}>{localized(vi, en, locale)}</Component>;
}
