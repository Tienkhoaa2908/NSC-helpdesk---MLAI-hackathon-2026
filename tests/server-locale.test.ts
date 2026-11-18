import { expect, it } from "vitest";
import { modelOutputLanguageInstruction, requestLocale } from "@/i18n/server";

it("reads only the supported app_locale cookie and defaults safely to Vietnamese", () => {
  expect(requestLocale(new Request("https://example.test", {
    headers: { cookie: "theme=dark; app_locale=en; session=synthetic" },
  }))).toBe("en");
  expect(requestLocale(new Request("https://example.test", {
    headers: { cookie: "app_locale=vi; theme=dark" },
  }))).toBe("vi");
  expect(requestLocale(new Request("https://example.test", {
    headers: { cookie: "app_locale=fr" },
  }))).toBe("vi");
  expect(requestLocale(new Request("https://example.test"))).toBe("vi");
});

it("adds a locale-only output instruction while preserving source text", () => {
  expect(modelOutputLanguageInstruction("en")).toContain("prose in English");
  expect(modelOutputLanguageInstruction("en")).toContain("preserve user text, source evidence");
  expect(modelOutputLanguageInstruction("vi")).toContain("prose in Vietnamese");
});
