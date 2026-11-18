"use client";
import { useLocale, localized } from "@/i18n/locale";

/**
 * Count completed responses, including failed cases, rather than simulate an ETA.
 * Transform-only easing inspired by Motion's loading progress bar example.
 */
export function VerifyProgress({ completed, total, pending, loading, starting }: {
  completed: number; total: number; pending: boolean; loading: boolean; starting: boolean;
}) {
  const { locale } = useLocale();
  const t = (vi: string, en: string) => localized(vi, en, locale);
  const count = Math.min(Math.max(completed, 0), total);
  const indeterminate = starting || loading;
  const percent = total > 0 ? Math.round(count / total * 100) : 0;
  const label = loading ? t("Đang đọc lại kết quả đã lưu…", "Reading saved results…") : starting ? t("Đang khởi tạo bộ kiểm thử…", "Starting test pack…") :
    pending ? t("Đang chạy kiểm thử…", "Running tests…") : count === total ? t("Đã nhận đủ kết quả", "All results received") : t("Kết quả đã lưu · có thể tiếp tục", "Results saved · you can resume");
  return <section className="verify-progress" aria-label={t("Tiến độ kiểm thử", "Test progress")}>
    <div className="verify-progress-heading"><strong>{label}</strong><span>{count}/{total} {t("ca", "cases")}</span></div>
    <div className={`verify-progress-track${indeterminate ? " is-indeterminate" : ""}`}
      role="progressbar" aria-label={t("Tiến độ kiểm thử", "Test progress")} aria-valuemin={0} aria-valuemax={total}
      aria-valuenow={indeterminate ? undefined : count}
      aria-valuetext={indeterminate ? label : t(`${count} trên ${total} ca đã có kết quả, ${percent}%`, `${count} of ${total} cases have results, ${percent}%`)}>
      <span style={indeterminate ? undefined : { transform: `scaleX(${total > 0 ? count / total : 0})` }} />
    </div>
    <small>{indeterminate ? t("Chờ phản hồi từ server; kết quả cũ vẫn được giữ.", "Waiting for the server; completed results are retained.") : t("Tiến độ tính theo số ca đã có kết quả, gồm cả PASS và FAIL.", "Progress counts cases with a saved result, including PASS and FAIL.")}</small>
  </section>;
}
