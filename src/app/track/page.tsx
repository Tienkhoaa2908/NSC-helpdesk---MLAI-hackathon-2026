"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Input } from "@/components/ui";
import { localized, useLocale } from "@/i18n/locale";
export default function TrackPage() {
  const { locale } = useLocale();
  const [value, setValue] = useState(""),
    [error, setError] = useState("");
  const router = useRouter();
  return (
    <main className="page page-narrow">
      <h1>{localized("Theo dõi yêu cầu", "Track a request", locale)}</h1>
      <Card>
        <p>{localized("Dán liên kết theo dõi đầy đủ đã nhận sau khi gửi.", "Paste the complete tracking link you received after submitting.", locale)}</p>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            try {
              const url = new URL(value.trim(), window.location.origin);
              const id = url.pathname.match(/^\/requests\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i)?.[1];
              const token = new URLSearchParams(url.hash.slice(1)).get("token");
              if (url.origin === window.location.origin && id && token && /^[a-f0-9]{64}$/i.test(token)) {
                router.push(`/requests/${id.toLowerCase()}#token=${token}`);
                return;
              }
            } catch { /* Show the same validation message for malformed links. */ }
            setError(localized("Cần dán liên kết theo dõi đầy đủ đã nhận sau khi gửi; mã yêu cầu riêng lẻ không cấp quyền truy cập.", "Paste the full tracking link you received after submitting. A request ID alone does not grant access.", locale));
          }}
        >
          <label>
            {localized("Liên kết theo dõi", "Tracking link", locale)}
            <Input
              aria-label={localized("Liên kết theo dõi", "Tracking link", locale)}
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setError("");
              }}
              required
            />
          </label>
          {error && <Alert tone="error">{error}</Alert>}
          <Button>{localized("Theo dõi", "Track", locale)}</Button>
        </form>
      </Card>
    </main>
  );
}
