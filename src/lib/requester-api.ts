import { BrowserApiError } from "@/lib/browser-api";

export async function requesterApi<T>(path: string, trackingToken: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(path, {
      signal: controller.signal,
      method: body === undefined ? "GET" : "POST",
      cache: "no-store",
      headers: {
        "x-tracking-token": trackingToken,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result: {
      success?: boolean;
      data?: unknown;
      error?: { message?: string; code?: string };
    } = await response.json();
    if (!response.ok || result.success !== true)
      throw new BrowserApiError(result.error?.message || "Không thể hoàn tất yêu cầu.", result.error?.code);
    return result.data as T;
  } catch (error) {
    if (error instanceof BrowserApiError) throw error;
    if (controller.signal.aborted)
      throw new Error("Hết thời gian chờ. Thử tải lại sau.");
    throw new Error("Mất kết nối. Kiểm tra mạng và thử lại.");
  } finally {
    clearTimeout(timer);
  }
}
