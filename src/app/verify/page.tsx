"use client";
import type { VerifyRun } from "@/domain/verification";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { supportVerifyCases, verifyPersistence, judgePackIds } from "@/lib/support-verify";
import { Alert, Button, Card, Textarea } from "@/components/ui";
import { browserApi } from "@/lib/browser-api";
import type { SupportRequest } from "@/domain/contracts";
import { SupportResult } from "@/components/support-result";
import { EmployeeIdentityFields } from "@/components/employee-identity-fields";
import { employeeIdentityError } from "@/domain/employee-identity";
import { StaffWorkspace } from "@/components/staff-workspace";
import { VerifyProgress } from "@/components/verify-progress";
import { AiPending } from "@/components/loading-feedback";
import { cachePackId, cachePackName, cacheVerificationCases } from "@/domain/cache-verification";
import { CacheGroupResults } from "@/components/cache-group-results";
import { divisionLabel } from "@/domain/support-divisions";
import { useLocale, localized, localizedError } from "@/i18n/locale";

export default function VerifyPage() {
  const { locale } = useLocale();
  const t = useCallback((vi: string, en: string) => localized(vi, en, locale), [locale]);
  const router = useRouter();
  const [pack, setPack] = useState("de-a-v3"),
    [running, setRunning] = useState(false);
  const [readback, setReadback] = useState("");
  const [judging, setJudging] = useState(false);
  const [identity, setIdentity] = useState<Record<string, string>>({});
  const [judge, setJudge] = useState(""),
    [judged, setJudged] = useState<SupportRequest | null>(null),
    [error, setError] = useState("");
  const judgeSubmission = useRef<{
    inputKey: string;
    idempotencyKey: string;
    trackingProof: string;
  } | null>(null);
  const cases = supportVerifyCases.filter((item) => item.pack === pack);
  const [currentRun, setCurrentRun] = useState<VerifyRun | null>(null);
  const [history, setHistory] = useState<
    Array<{
      id: string;
      pack: string;
      status: string;
      completed: number;
      total: number;
    }>
  >([]);
  const stop = useRef(false);
  const activeOperation = useRef(false);
  const loadingRun = useRef(false);
  const loadSequence = useRef(0);
  const [loading, setLoading] = useState(false);
  const busy = running || loading;
  const results = currentRun?.results ?? [];
  const cacheRun = currentRun?.pack === cachePackId ? currentRun : null;
  function exposeQueue() {
    try {
      sessionStorage.setItem("vng-review-filters-v1", JSON.stringify({ filter: "all", origin: "all", queue: "all", search: "", employeeId: "" }));
    } catch { /* The queue link also sets its own filters when storage is unavailable. */ }
  }
  async function openCacheRequests() {
    if (!cacheRun || activeOperation.current || loadingRun.current) return;
    activeOperation.current = true;
    setLoading(true);
    setError("");
    let row = cacheRun;
    try {
      for (const result of cacheRun.results.filter(item => !item.requestId)) {
        row = await browserApi<VerifyRun>(`/api/support/verify-runs/${row.id}/cases`, { caseId: result.caseId });
        setCurrentRun(row);
      }
      exposeQueue();
      router.push(`/review?verifyRunId=${row.id}`);
    } catch (error) {
      setError(localizedError(error, locale, "Không mở được yêu cầu. Vui lòng thử lại.", "Could not open the requests. Please try again."));
    } finally {
      activeOperation.current = false;
      setLoading(false);
    }
  }
  const loadRun = useCallback(async (id: string) => {
    const sequence = ++loadSequence.current;
    loadingRun.current = true;
    setLoading(true);
    try {
      const row = await browserApi<VerifyRun>(`/api/support/verify-runs/${id}`);
      if (sequence !== loadSequence.current) return;
      setCurrentRun(row);
      setPack(judgePackIds.includes(row.pack) ? row.pack : "de-a-v3");
      window.history.replaceState(null, "", `/verify?run=${id}`);
    } catch {
      if (sequence === loadSequence.current) setError(t("Không tải được lần kiểm thử.", "Could not load the test run."));
    } finally {
      if (sequence === loadSequence.current) {
        loadingRun.current = false;
        setLoading(false);
      }
    }
  }, [t]);
  useEffect(() => {
    void browserApi<typeof history>("/api/support/verify-runs")
      .then(setHistory)
      .catch(() => setError(t("Không tải được lịch sử Verify.", "Could not load test history.")));
    const id = new URLSearchParams(window.location.search).get("run");
    if (id) void loadRun(id);
  }, [loadRun, t]);
  async function run(resume = false) {
    if (activeOperation.current || loadingRun.current) return;
    activeOperation.current = true;
    setRunning(true);
    setError("");
    stop.current = false;
    if (!resume) setCurrentRun(null);
    let row: VerifyRun | null = null;
    try {
      row =
        resume && currentRun
          ? await browserApi<VerifyRun>(
              `/api/support/verify-runs/${currentRun.id}`,
              { action: "resume" },
            )
          : await browserApi<VerifyRun>("/api/support/verify-runs", { pack });
      setCurrentRun(row);
      window.history.replaceState(null, "", `/verify?run=${row.id}`);
      for (const entry of row.cases) {
        if (stop.current) break;
        if (row.results.some((result) => result.caseId === entry.caseId))
          continue;
        row = await browserApi<VerifyRun>(
          `/api/support/verify-runs/${row.id}/cases`,
          { caseId: entry.caseId },
        );
        setCurrentRun(row);
        if (row.pack === cachePackId) exposeQueue();
      }
    } catch (error) {
      setError(localizedError(error, locale, "Không thể tiếp tục Verify. Kết quả đã chạy vẫn được lưu; dùng Tiếp tục.", "Could not continue the test run. Completed results are saved; select Resume to continue."));
    } finally {
      // Keep pack selection locked until the final persisted readback completes.
      if (row) await loadRun(row.id);
      activeOperation.current = false;
      setRunning(false);
      void browserApi<typeof history>("/api/support/verify-runs")
        .then(setHistory)
        .catch(() => setError(t("Không tải được lịch sử Verify.", "Could not load test history.")));
    }
  }
  async function stopRun() {
    stop.current = true;
    try {
      if (currentRun)
        setCurrentRun(
          await browserApi<VerifyRun>(
            `/api/support/verify-runs/${currentRun.id}`,
            { action: "stop" },
          ),
        );
    } catch {
      setError(t("Không lưu được trạng thái dừng. Lần chạy trên trang đã dừng; tải lại để kiểm tra.", "Could not save the stopped status. This page has stopped the run; reload to check its status."));
    }
  }
  async function runJudge() {
    if (activeOperation.current || loadingRun.current) return;
    const identityError = employeeIdentityError(identity);
    if (identityError) {
      setError(t(identityError, "Enter a valid department and employee ID."));
      return;
    }
    activeOperation.current = true;
    setJudging(true);
    setRunning(true);
    setError("");
    setJudged(null);
    setReadback("");
    try {
      const inputKey = JSON.stringify({ rawText: judge, fields: identity });
      if (!judgeSubmission.current || judgeSubmission.current.inputKey !== inputKey) {
        judgeSubmission.current = {
          inputKey,
          idempotencyKey: crypto.randomUUID(),
          trackingProof: Array.from(
            crypto.getRandomValues(new Uint8Array(32)),
            (byte) => byte.toString(16).padStart(2, "0"),
          ).join(""),
        };
      }
      const submission = judgeSubmission.current;
      const row = await browserApi<SupportRequest>("/api/support/requests", {
        rawText: judge,
        fields: identity,
        confirmed: true,
        idempotencyKey: submission.idempotencyKey,
      }, { "x-tracking-proof": submission.trackingProof });
      setJudged(row);
      setReadback(t("Đang kiểm tra…", "Checking saved results…"));
      try {
        const persistence = await verifyPersistence(row);
        setReadback(
          `${persistence.pass ? "PASS" : "FAIL"}: ${persistence.checks.join(" · ")}`,
        );
      } catch (error) {
        setReadback(t("Chưa xác minh: không đọc lại được hồ sơ qua API.", "Not verified: the saved request could not be read through the API."));
        throw error;
      }
      setJudge("");
      judgeSubmission.current = null;
    } catch (error) {
      setError(localizedError(error, locale, "Lỗi API.", "The API request failed."));
    } finally {
      activeOperation.current = false;
      setJudging(false);
      setRunning(false);
    }
  }
  return (
    <StaffWorkspace active="verify">
      <main className="it-content space-y-6">
        <header className="it-page-heading">
          <div>
            <p className="eyebrow">{t("KIỂM THỬ · ĐỀ A", "TESTS · PROBLEM A")}</p>
            <h1>{t("Đối chiếu bằng dữ liệu, không phỏng đoán.", "Verify against data, not assumptions.")}</h1>
          </div>
        </header>
        <Alert>
          {t(
            "Khu vực kiểm thử dành cho ban giám khảo MLAI 2026, theo yêu cầu của track VNG. Các bộ dữ liệu tổng hợp gồm: 15 tình huống; Đề A gồm 5 ca (3 tự động xử lý, 2 chuyển tiếp); bộ chung gồm 4 ca; bộ cache gồm 42 ca; bộ mở rộng gồm 30 ca cho IT, Commercial và HR. Mỗi lượt chạy gọi API hỗ trợ và lưu kết quả cùng nhật ký audit. Đây là dữ liệu kiểm thử tổng hợp, không phải kết quả thử nghiệm người dùng thật.",
            "Test area for MLAI 2026 judges, prepared for the VNG track. Synthetic test packs include: 15 scenarios; Problem A with 5 cases (3 automated, 2 escalated); a 4-case general pack; a 42-case cache pack; and a 30-case expansion pack for IT, Commercial, and HR. Each run uses the support API and saves results with an audit trail. These are synthetic tests, not real-user study results."
          )}
        </Alert>
        <fieldset disabled={busy} className="flex flex-wrap items-end gap-3">
          <label>
            {t("Bộ kiểm thử", "Test pack")}
            <select
              className="mt-1 block max-w-full rounded border p-3"
              value={pack}
              onChange={(event) => {
                setPack(event.target.value);
                setCurrentRun(null);
              }}
            >
              <option value="de-a-v3">
                {t("Đề A — 5 ca (3 tự động / 2 chuyển tiếp)", "Problem A — 5 cases (3 automated / 2 escalated)")}
              </option>
              <option value="submission-4">
                {t("Bộ chung — 4 ca", "General pack — 4 cases")}
              </option>
              <option value="judge-15">
                {t("Bộ kiểm thử — 15 tình huống", "Test pack — 15 scenarios")}
              </option>
              <option value={cachePackId}>{t("Bộ cache — 42 ca", "Cache system — 42 cases")}</option>
              <option value="support-desk-expansion">{t("Bộ mở rộng — 30 ca, IT / Commercial / HR", "Expansion pack — 30 cases, IT / Commercial / HR")}</option>
            </select>
          </label>
          <Button onClick={() => void run(false)}>
            {t("Chạy toàn bộ ca", "Run all cases")} ({cases.length})
          </Button>
        </fieldset>
        {pack === cachePackId && <Card>
          <h2 className="text-xl font-bold">{t("Bộ kiểm thử cache", "Cache test pack")}</h2>
          <details className="mt-3">
            <summary>{t("Xem 42 tình huống và kết quả kỳ vọng", "View 42 scenarios and expected outcomes")}</summary>
            <ul className="space-y-2 mt-2">
              {cacheVerificationCases.map(item => <li key={item.id}>
                <strong>{item.group} · {item.expected}</strong>: {item.rawText}
                <p className="text-sm text-slate-600">{item.reason}</p>
              </li>)}
            </ul>
          </details>
        </Card>}
        {!judging && (busy || currentRun) && <VerifyProgress
          completed={results.length} total={currentRun?.cases.length ?? cases.length}
          pending={running} loading={loading} starting={running && !currentRun} />}
        {currentRun && (
          <Card>
            <h2>{t("Lần chạy", "Test run")} {currentRun.id.slice(0, 8)}</h2>
            <p>
              {t("Bắt đầu:", "Started:")} {new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(currentRun.createdAt))} ·{" "}
              {{ RUNNING: t("Đang chạy", "Running"), COMPLETE: t("Hoàn tất", "Complete"), STOPPED: t("Đã dừng", "Stopped") }[currentRun.status]}
            </p>
            <div className="flex flex-wrap items-center gap-3 my-3">
            <Link
              className="text-accent underline"
              href={`/verify?run=${currentRun.id}`}
            >
              {t("Mở kết quả đã lưu", "Open saved results")}
            </Link>
            {cacheRun && cacheRun.results.length > 0 && <Button disabled={busy} onClick={() => void openCacheRequests()}>
              {t("Xem yêu cầu cần xử lý", "View requests to review")}
            </Button>}
            {running && !judging ? (
              <Button variant="danger" onClick={() => void stopRun()}>
                {t("Dừng sau ca hiện tại", "Stop after this case")}
              </Button>
            ) : (
              currentRun.status !== "COMPLETE" && judgePackIds.includes(currentRun.pack) && (
                <Button disabled={busy} onClick={() => void run(true)}>
                  {t("Tiếp tục lần chạy", "Resume run")}
                </Button>
              )
            )}
            </div>
            <p className="text-sm">
              {t("Có thể rời trang rồi mở lại liên kết này. Nếu gặp giới hạn tốc độ, chờ một phút rồi chọn Tiếp tục.", "You can leave the page and reopen this link. If rate-limited, wait one minute and select Resume.")}
            </p>
          </Card>
        )}
        {!!history.length && (
          <details>
            <summary>{t("Lịch sử kiểm thử gần đây", "Recent test runs")}</summary>
            <ul>
              {history.filter((row) => judgePackIds.includes(row.pack)).map((row) => (
                <li key={row.id}>
                  <button
                    className="text-accent underline"
                    disabled={busy}
                    onClick={() => void loadRun(row.id)}
                  >
                    {row.pack === cachePackId ? cachePackName : row.pack} · {row.completed}/{row.total} ·{" "}
                    {row.id.slice(0, 8)}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
        <p role="status">
          {loading ? t("Đang tải kết quả đã lưu… ", "Loading saved results… ") : ""}
          {running ? t("Đang chạy… ", "Running… ") : ""}
          {results.length}/{currentRun?.cases.length ?? cases.length} · {t("Đạt:", "Pass:")}{" "}
          {results.filter((result) => result.pass).length} · {t("Lỗi:", "Fail:")}{" "}
          {results.filter((result) => !result.pass).length}
        </p>
        {error && <Alert tone="error">{error}</Alert>}
        {cacheRun && <CacheGroupResults run={cacheRun} />}
        {!cacheRun && !!results.length && (
          <div
            className="overflow-x-auto"
            tabIndex={0}
            aria-label={t("Bảng kết quả kiểm thử", "Test results table")}
          >
            <table className="w-full text-left text-sm">
              <caption>{t("Kết quả của lần chạy đã lưu", "Saved test run results")}</caption>
              <thead>
                <tr>
                  {[
                    "Case",
                    t("Kỳ vọng", "Expected"),
                    t("Thực tế", "Actual"),
                    t("Kết quả", "Result"),
                    t("Thời điểm", "Time"),
                    t("Quy tắc", "Rules"),
                  ].map((text) => (
                    <th className="p-2 border-b" key={text}>
                      {text}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <tr key={result.caseId}>
                    <td className="p-2">{result.caseId}</td>
                    <td className="p-2">{result.expected.action}</td>
                    <td className="p-2">{result.cache?.actual ?? result.actual?.action ?? "ERROR"}</td>
                    <td className="p-2">{result.pass ? "PASS" : "FAIL"}</td>
                    <td className="p-2 whitespace-nowrap">
                      {new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(result.timestamp))}
                    </td>
                    <td className="p-2">
                      {result.actual?.ruleIds.join(", ") ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="space-y-3">
          {!cacheRun && results.map((result) => (
            <Card key={result.caseId}>
              <div className="flex flex-wrap justify-between gap-2">
                <h2 className="font-bold">{result.caseId}</h2>
                <strong
                  className={result.pass ? "text-emerald-700" : "text-red-700"}
                >
                  {result.pass ? "PASS" : "FAIL"}
                </strong>
              </div>
              <p>
                {t("Tình huống:", "Scenario:")} {supportVerifyCases.find((item) => item.id === result.caseId)?.rawText ?? t("Xem input trong hồ sơ đã lưu.", "See the input in the saved request.")}
              </p>
              <p className="text-xs text-slate-500">{new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(result.timestamp))}</p>
              {result.cache && <div className="rounded border p-3 space-y-1">
                <p>{t("Nhóm:", "Group:")} {result.cache.group}</p>
                <p>{t("Cache kỳ vọng:", "Expected cache:")} {result.cache.expected} · {t("thực tế:", "actual:")} {result.cache.actual}</p>
                <p>{t("Chủ đề nhận diện:", "Recognized topic:")} {result.cache.topic ?? t("Không thuộc FAQ dùng chung", "Not a shared FAQ topic")} · {t("số câu mồi:", "seed count:")} {result.cache.seeds}</p>
                {result.cache.lexicalSimilarity !== undefined && <p>{t("Độ tương đồng từ vựng:", "Lexical similarity:")} {Math.round(result.cache.lexicalSimilarity * 100)}%. {t("Cache ghép theo cùng đối tượng và triệu chứng; đây không phải độ tin cậy của AI.", "Cache matching uses the same object and symptom; this is not an AI confidence score.")}</p>}
                <p>{result.cache.checks.join(" · ")}</p>
              </div>}
              <p>
                {t("Kỳ vọng:", "Expected:")} {result.expected.action} · {result.expected.bucket}{" "}
                {result.expected.rule && `· ${result.expected.rule}`}
              </p>
              <p>
                {t("Thực tế:", "Actual:")} {result.actual?.action ?? "ERROR"} ·{" "}
                {result.actual?.bucket}
              </p>
              <p>{t("Mã quy tắc:", "Rule IDs:")} {result.actual?.ruleIds.join(", ") ?? "—"}</p>
              {result.response && <p>{t("Kiểm tra phản hồi:", "Response checks:")} {result.response.checks.join(" · ")}</p>}
              {result.actual && <>
                <p>{t("Ban tiếp nhận:", "Assigned team:")} {result.actual.division ? divisionLabel(result.actual.division, locale) : t("Chưa xác định", "Unassigned")}{result.expected.division && ` · ${t("kỳ vọng:", "expected:")} ${divisionLabel(result.expected.division, locale)}`}</p>
                <p>Policy: {result.actual.policyVersion}</p>
                <details>
                  <summary>{t("Bằng chứng cho quyết định", "Decision evidence")}</summary>
                  <ul className="list-disc pl-5">{result.actual.safeEvidence.map((quote, index) => <li className="break-words" key={index}>{quote}</li>)}</ul>
                </details>
              </>}
              <p>{result.actual?.adminReason ?? result.error}</p>
              {!result.cache && <p>
                {t("Kiểm tra lưu trữ:", "Persistence checks:")}{" "}
                {result.persistence?.checks.join(" · ") ?? result.error}
              </p>}
              <ul>
                {[
                  ...(result.actual?.questions ?? []),
                  ...(result.actual?.reviewerQuestions ?? []),
                ].map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
              {supportVerifyCases.find((item) => item.id === result.caseId)
                ?.fault && (
                <p className="text-sm text-amber-800">
                  {t("Fault injection của adapter mô hình (mô phỏng lỗi, không phải mất kết nối thật).", "Model adapter fault injection (simulated failure, not a real connection loss).")}
                </p>
              )}
              {result.requestId && (
                <Link
                  className="text-accent underline"
                  href={`/review?requestId=${result.requestId}`}
                >
                  {t("Mở hồ sơ / nhật ký", "Open request / audit")}
                </Link>
              )}
            </Card>
          ))}
        </div>
        <Card>
          <h2 className="mb-3 text-xl font-bold">{t("Đánh giá tình huống mới", "Evaluate a new scenario")}</h2>
          <p className="mb-3 text-sm">
            {t("Nhập yêu cầu chưa có trong bộ dữ liệu. Kết quả được lưu thành hồ sơ demo để kiểm tra luồng reviewer và audit.", "Enter a request that is not in the fixture. The result is saved as a demo request for reviewer and audit checks.")}
          </p>
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void runJudge();
            }}
            className="space-y-3"
          >
            <fieldset disabled={busy}>
              <EmployeeIdentityFields fields={identity} onChange={setIdentity} />
            </fieldset>
            <label className="block">
              {t("Nội dung yêu cầu", "Request description")}
              <Textarea
                value={judge}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value !== judge) judgeSubmission.current = null;
                  setJudge(value);
                }}
                maxLength={6000}
                required
              />
            </label>
            <Button disabled={busy || !judge.trim()}>
              {t("Đánh giá yêu cầu", "Evaluate request")}
            </Button>
          </form>
          {judging && <AiPending message="Đang kiểm tra tình huống mới và đọc lại hồ sơ…" messageEn="Evaluating the scenario and reading back the saved request…" />}
          {judged?.decision && judged.canonical && (
            <div className="mt-4 space-y-3">
              <p>{t("Kiểm tra lưu trữ:", "Persistence checks:")} {readback}</p>
              <SupportResult
                decision={judged.decision}
                canonical={judged.canonical}
                audience="reviewer"
              />
              <Link
                className="text-accent underline"
                href={`/review?requestId=${judged.id}`}
              >
                {t("Xem hướng dẫn / chuyển Admin", "View guidance / route to Admin")}
              </Link>
            </div>
          )}
        </Card>
      </main>
    </StaffWorkspace>
  );
}
