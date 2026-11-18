import type { VerifyRun } from "@/domain/verification";
import { groupCacheResults } from "@/domain/cache-result-groups";
import { Card } from "./ui";
import { useLocale, localized } from "@/i18n/locale";

const groupNamesEnglish: Record<string, string> = {
  "VPN không kết nối": "VPN will not connect",
  "VPN liên tục ngắt kết nối": "VPN disconnects repeatedly",
  "Wi-Fi không kết nối": "Wi-Fi will not connect",
  "Máy in offline": "Printer offline",
  "Đối chứng: không dùng chung": "Controls: do not share",
};

export function CacheGroupResults({ run }: { run: VerifyRun }) {
  const { locale } = useLocale();
  const t = (vi: string, en: string) => localized(vi, en, locale);
  const groups = groupCacheResults(run);
  const similar = groups.filter(group => group.kind === "similar");
  return (
    <section aria-label={t("Thống kê kết quả cache", "Cache result summary")} className="space-y-4">
      <header>
        <h2 className="text-xl font-bold">{t("Thống kê theo nhóm yêu cầu", "Request group summary")}</h2>
        <p>{t(`${similar.length} nhóm cùng nội dung · ${similar.reduce((sum, group) => sum + group.items.length, 0)} yêu cầu trong các nhóm.`, `${similar.length} similar groups · ${similar.reduce((sum, group) => sum + group.items.length, 0)} requests in those groups.`)}</p>
        <p className="text-sm text-slate-600">{t("Số yêu cầu lấy từ bộ kiểm thử của lần chạy này, số nhận diện đúng và HIT/MISS lấy từ kết quả đã lưu.", "Request counts come from this test run, recognition and HIT/MISS counts come from saved results.")}</p>
      </header>
      {groups.map(group => (
        <Card key={group.key} role="region" aria-label={`${t("Nhóm:", "Group:")} ${localized(group.label, groupNamesEnglish[group.label] ?? group.label, locale)}`} className="space-y-3 min-w-0">
          <h3 className="text-lg font-bold">{localized(group.label, groupNamesEnglish[group.label] ?? group.label, locale)}</h3>
          <p className="text-lg font-semibold">
            {group.items.length} {group.kind === "similar" ? t("yêu cầu cùng nội dung", "similar requests") : group.kind === "controls" ? t("yêu cầu đối chứng", "control requests") : t("yêu cầu chưa phân nhóm", "ungrouped requests")}
          </p>
          {group.kind === "similar" ? <p className="text-sm">{t("Gồm câu gốc và các cách diễn đạt tương tự trong bộ kiểm thử.", "Contains the seed request and equivalent wording variants from the test pack.")}</p>
            : <p className="text-sm">{group.kind === "controls" ? t("Các câu khác nội dung hoặc cần xử lý riêng, không tính là một nhóm yêu cầu giống nhau.", "These requests differ in meaning or need separate handling, so they are not grouped as duplicates.")
              : t("Giữ lại kết quả cũ để đối chiếu, chưa xác định được nhóm từ bộ kiểm thử hiện tại.", "Saved results are retained for comparison, no group was identified in this test pack.")}</p>}
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div><dt>{t("Đã kiểm tra", "Completed")}</dt><dd className="text-lg font-semibold">{group.completed}/{group.items.length}</dd></div>
            <div><dt>{t("Chưa chạy", "Not run")}</dt><dd className="text-lg font-semibold">{group.items.length - group.completed}</dd></div>
            <div><dt>PASS</dt><dd className="text-lg font-semibold text-emerald-700">{group.passed}</dd></div>
            <div><dt>FAIL</dt><dd className="text-lg font-semibold text-red-700">{group.failed}</dd></div>
          </dl>
          {group.kind === "similar" && <p>{group.completed
            ? t(`Nhận diện đúng nhóm: ${group.recognized}/${group.completed} yêu cầu đã chạy.`, `Correct group recognition: ${group.recognized}/${group.completed} completed requests.`)
            : t("Chưa có kết quả nhận diện nhóm.", "No group recognition results yet.")}</p>}
          <p>HIT: {group.hits} · MISS: {group.misses} · BYPASS: {group.bypasses}</p>
          {group.unavailable > 0 && <p className="text-amber-800">{t("Chưa có kết quả cache:", "Cache result unavailable:")} {group.unavailable} {t("yêu cầu đã chạy.", "completed requests.")}</p>}
          <details>
            <summary>{t(`Xem ${group.items.length} yêu cầu và kết quả`, `View ${group.items.length} requests and results`)}</summary>
            <ol className="mt-3 space-y-3">
              {group.items.map(item => (
                <li key={item.caseId} className="rounded border border-line p-3 space-y-2 break-words">
                  <p>{item.text}</p>
                  <p className="text-sm">
                    {item.result ? <strong className={item.result.pass ? "text-emerald-700" : "text-red-700"}>{item.result.pass ? "PASS" : "FAIL"}</strong> : <strong>{t("Chưa chạy", "Not run")}</strong>}
                    {" · "}{t("Kỳ vọng:", "Expected:")} {item.expected ?? t("Chưa xác định", "Unknown")} · {t("Thực tế:", "Actual:")} {item.result ? item.result.cache?.actual ?? t("Chưa có kết quả cache", "No cache result") : t("Chưa chạy", "Not run")}
                  </p>
                  {item.result?.error && <p className="text-red-700">{item.result.error}</p>}
                  {item.result && <details className="text-sm">
                    <summary>{t("Chi tiết kiểm tra", "Check details")}</summary>
                    <p>{t("Mã ca:", "Case:")} {item.caseId} · {new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(item.result.timestamp))}</p>
                    {item.result.cache && <>
                      <p>{t("Chủ đề nhận diện:", "Recognized topic:")} {item.result.cache.topic ?? t("Không thuộc FAQ dùng chung", "Not a shared FAQ topic")}</p>
                      {item.result.cache.lexicalSimilarity !== undefined && <p>{t("Độ tương đồng từ vựng:", "Lexical similarity:")} {Math.round(item.result.cache.lexicalSimilarity * 100)}% · {t("không phải độ tin cậy AI.", "not an AI confidence score.")}</p>}
                      <ul>{item.result.cache.checks.map(check => <li key={check}>{check}</li>)}</ul>
                    </>}
                    {item.result.actual && <>
                      <p>Policy: {item.result.actual.action} · {item.result.actual.bucket} · {item.result.actual.ruleIds.join(", ")}</p>
                      <p>{item.result.actual.adminReason}</p>
                    </>}
                  </details>}
                </li>
              ))}
            </ol>
          </details>
        </Card>
      ))}
    </section>
  );
}
