"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { QrCode } from "lucide-react";
import { localized, useLocale } from "@/i18n/locale";

export function SiteAccess() {
  const dialog = useRef<HTMLDialogElement>(null);
  const urlField = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<"copied" | "manual" | "">("");
  const { locale } = useLocale();

  useEffect(() => {
    if (!open) return;
    const modal = dialog.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modal?.showModal();
    return () => {
      modal?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("copied");
    } catch {
      urlField.current?.focus();
      urlField.current?.select();
      setMessage("manual");
    }
  }

  return <>
    <button className="site-access-button" aria-haspopup="dialog" onClick={() => {
      // Share the public home page, never a request ID, query or fragment.
      setUrl(new URL("/", window.location.origin).href);
      setMessage("");
      setOpen(true);
    }}><QrCode size={20} aria-hidden="true" /> URL / QR</button>
    <dialog ref={dialog} className="site-access-modal" aria-labelledby="site-access-title" onCancel={(event) => {
      event.preventDefault(); setOpen(false);
    }} onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const controls = event.currentTarget.querySelectorAll<HTMLElement>("button, input, a[href]");
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <h2 id="site-access-title">{localized("Mở website trên điện thoại", "Open the website on a phone", locale)}</h2>
      <p>{localized("Mở Camera hoặc ứng dụng quét QR, hướng vào mã bên dưới rồi chạm liên kết để mở trang chủ.", "Open your camera or QR scanner, point it at the code below, and tap the link to open the home page.", locale)}</p>
      {url && <div className="site-qr" role="img" aria-label={localized("Mã QR mở trang chủ", "QR code for the home page", locale)}>
        <QRCodeCanvas value={url} size={256} level="M" marginSize={4} />
      </div>}
      <label className="field">{localized("URL website", "Website URL", locale)}<input ref={urlField} value={url} readOnly onFocus={(event) => event.target.select()} /></label>
      {url && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(url).hostname) && <p className="notice">{localized("Đây là địa chỉ trên máy hiện tại. Để quét từ điện thoại, mở website bằng đường dẫn đã triển khai hoặc địa chỉ mạng mà điện thoại truy cập được.", "This address points to the current computer. To scan from a phone, open the deployed website or an IP address the phone can reach.", locale)}</p>}
      <div className="site-access-actions">
        <button className="button primary" onClick={copyUrl}>{localized("Sao chép URL", "Copy URL", locale)}</button>
        <a className="button secondary" href={url || "/"}>{localized("Mở trang chủ", "Open home page", locale)}</a>
        <button className="button secondary" onClick={() => setOpen(false)}>{localized("Đóng", "Close", locale)}</button>
      </div>
      <p role="status" className="site-access-status">{message === "copied" ? localized("Đã sao chép liên kết.", "Link copied.", locale) : message === "manual" ? localized("Hãy sao chép liên kết đã được chọn trong ô URL.", "Copy the selected link in the URL field.", locale) : ""}</p>
    </dialog>
  </>;
}
