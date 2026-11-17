"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Input } from "@/components/ui";
import { GuestRequestHistory } from "@/components/guest-request-history";
export default function TrackPage() {
  const [value, setValue] = useState(""),
    [error, setError] = useState("");
  const router = useRouter();
  return (
    <main className="page page-narrow">
      <h1>Theo dõi yêu cầu</h1>
      <GuestRequestHistory />
      <Card>
        <p>Dán liên kết theo dõi đầy đủ đã nhận sau khi gửi.</p>
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
            setError("Cần dán liên kết theo dõi đầy đủ đã nhận sau khi gửi; mã yêu cầu riêng lẻ không cấp quyền truy cập.");
          }}
        >
          <label>
            Liên kết theo dõi
            <Input
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setError("");
              }}
              required
            />
          </label>
          {error && <Alert tone="error">{error}</Alert>}
          <Button>Theo dõi</Button>
        </form>
      </Card>
    </main>
  );
}
