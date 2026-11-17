export type ModelProvider = "openai" | "gemini" | "mock";

export const GEMINI_OPENAI_COMPAT_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/";

export function modelProvider(): ModelProvider {
  const configured = process.env.AI_PROVIDER;
  return configured === "openai" || configured === "gemini" ? configured : "mock";
}

export function modelProviderApiKey(provider = modelProvider()): string {
  if (provider === "gemini") return process.env.GEMINI_API_KEY ?? "";
  if (provider === "openai") return process.env.OPENAI_API_KEY ?? "";
  return "";
}

export function modelProviderSource(): "openai" | "gemini" | "mock" {
  return modelProvider();
}

export function isLiveModelProvider(provider = modelProvider()): boolean {
  return provider === "openai" || provider === "gemini";
}
