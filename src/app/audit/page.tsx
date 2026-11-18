"use client";
import { ContentSkeleton } from "@/components/loading-feedback";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AuditEvent, ResultPage } from "@/domain/contracts";
import { browserApi } from "@/lib/browser-api";
import { Alert, Button, Card, Input } from "@/components/ui";
import { AuditTimeline } from "@/components/support-history";
import { StaffWorkspace } from "@/components/staff-workspace";
import { useLocale, localized, localizedError } from "@/i18n/locale";
export default function AuditPage() {
  const { locale } = useLocale();
  const t = useCallback((vi: string, en: string) => localized(vi, en, locale), [locale]);
  const number = new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US");
  const sequence = useRef(0),
    [events, setEvents] = useState<AuditEvent[]>([]),
    [query, setQuery] = useState(""),
    [employeeId, setEmployeeId] = useState(""),
    [origin, setOrigin] = useState("support"),
    [error, setError] = useState(""),
    [metricsError, setMetricsError] = useState(""),
    [pending, setPending] = useState(true),
    [cursor, setCursor] = useState<string | null>(null),
    [total, setTotal] = useState(0);
  const [metrics, setMetrics] = useState<{
    total: number;
    resolvedFeedback: number;
    handoffs: number;
    modelFailures: number;
    pendingReview: number;
  } | null>(null);
  const load = useCallback(
    async (next: string | null = null) => {
      const current = ++sequence.current;
      setPending(true);
      setError("");
      if (!next) {
        setEvents([]);
        setCursor(null);
        setTotal(0);
      }
      try {
        const params = new URLSearchParams({
          view: "page",
          q: query,
          origin,
          limit: "30",
          ...(employeeId.trim() ? { employeeId: employeeId.trim() } : {}),
          ...(next ? { cursor: next } : {}),
        });
        const page = await browserApi<ResultPage<AuditEvent>>(
          `/api/support/events?${params}`,
        );
        if (current === sequence.current) {
          setEvents((previous) =>
            next ? [...previous, ...page.items] : page.items,
          );
          setCursor(page.nextCursor);
          setTotal(page.total);
          setError("");
        }
      } catch (e) {
        if (current === sequence.current)
          setError(localizedError(e, locale, "Không tải được lịch sử.", "Could not load activity history."));
      } finally {
        if (current === sequence.current) setPending(false);
      }
    },
    [query, employeeId, origin, locale],
  );
  useEffect(() => {
    const tracker = sequence;
    // A cursor belongs to its original filter. Clear it before the debounce so
    // a new filter cannot append a later page onto results from the old one.
    setPending(true);
    setEvents([]);
    setCursor(null);
    setTotal(0);
    setError("");
    const timer = setTimeout(() => void load(), 250);
    return () => {
      clearTimeout(timer);
      tracker.current++;
    };
  }, [load]);
  useEffect(() => {
    void browserApi<typeof metrics>("/api/support/metrics")
      .then(setMetrics)
      .catch(() => setMetricsError(t("Không tải được số liệu.", "Could not load metrics.")));
  }, [t]);
  return (
    <StaffWorkspace active="audit">
      <main className="it-content space-y-6">
        <header className="it-page-heading">
          <div>
            <p className="eyebrow">{t("LỊCH SỬ XỬ LÝ", "ACTIVITY HISTORY")}</p>
            <h1>{t("Mỗi quyết định, một dấu vết.", "Every decision leaves a trace.")}</h1>
          </div>
        </header>
        <p>
          {t("Tìm bằng mã nhân viên, nội dung hoặc mã yêu cầu. Các trang tiếp theo vẫn có thể tra cứu hồ sơ cũ, case Verify có bộ lọc riêng.", "Search by employee ID, request text, or request ID. Later pages remain searchable, Verify cases have a separate filter.")}
        </p>
        {metrics && (
          <Card>
            <dl className="audit-metrics" aria-label={t("Tổng quan hồ sơ demo", "Demo request overview")}>
              {[
                [t("Tổng hồ sơ", "Total requests"), metrics.total], [t("Đã tự giải quyết", "Resolved by requester"), metrics.resolvedFeedback],
                [t("Chuyển người", "Escalated"), metrics.handoffs], [t("Lỗi trợ lý", "Assistant failures"), metrics.modelFailures],
                [t("Chờ xử lý", "Pending review"), metrics.pendingReview],
              ].map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{number.format(Number(count))}</dd></div>)}
            </dl>
            <p className="text-sm">
              {t("Tổng số dữ liệu demo đã lưu, gồm Verify, không phải số liệu đo trên người dùng thật.", "Total saved demo data, including Verify, these are not measurements from real users.")}
            </p>
          </Card>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
          className="audit-filters"
        >
          <label>
            {t("Nội dung hoặc mã yêu cầu", "Request text or ID")}
            <Input
              maxLength={200}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Ví dụ: VPN hoặc HT-AB12CD34", "For example: VPN or HT-AB12CD34")}
            />
          </label>
          <label>
            {t("Mã nhân viên", "Employee ID")}
            <Input
              maxLength={32}
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder={t("Nhập mã nhân viên", "Enter an employee ID")}
            />
          </label>
          <label>
            {t("Nguồn dữ liệu", "Data source")}
            <select value={origin} onChange={(e) => setOrigin(e.target.value)}>
              <option value="support">{t("Người gửi yêu cầu", "Requester")}</option>
              <option value="verify">Case Verify</option>
              <option value="all">{t("Tất cả", "All")}</option>
            </select>
          </label>
          <Button disabled={pending}>{t("Lọc / tải lại", "Filter / reload")}</Button>
        </form>
        {metricsError && <Alert tone="error">{metricsError}</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
        <Card aria-busy={pending}>
          <p role="status">
            {pending ? t("Đang tải lịch sử…", "Loading history…") : t(`${number.format(events.length)}/${number.format(total)} sự kiện`, `${number.format(events.length)}/${number.format(total)} events`)}
          </p>
          {pending && !events.length && <div aria-hidden="true"><ContentSkeleton compact /></div>}
          {events.length ? (
            <div
              className="it-contained-scroll"
              role="region"
              aria-label={t("Danh sách sự kiện xử lý", "Activity events")}
              tabIndex={0}
            >
              <AuditTimeline events={events} />
            </div>
          ) : (
            !pending && !error && <p>{t("Chưa có sự kiện phù hợp.", "No matching events.")}</p>
          )}
          {cursor && (
            <Button
              disabled={pending}
              variant="secondary"
              onClick={() => void load(cursor)}
            >
              {t("Tải thêm lịch sử", "Load more history")}
            </Button>
          )}
        </Card>
      </main>
    </StaffWorkspace>
  );
}
