"use client";
import { ContentSkeleton } from "./loading-feedback";
import Link from "next/link";
import { IncidentQueue } from "./incident-panel";
import {
  Inbox,
  Search,
  RefreshCw,
  ChevronRight,
  ShieldAlert,
  UserCheck,
  Users,
  BookOpen,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type ResultPage,
  type RequestStatus,
  type SupportRequest,
} from "@/domain/contracts";
import { displayId, statusLabel, serviceGroupName } from "@/domain/presentation";
import { type ReviewAction } from "@/domain/transitions";
import { browserApi } from "@/lib/browser-api";
import { Alert, Badge, Button } from "@/components/ui";
import { ReviewDetail } from "@/components/review-detail";
import { StaffWorkspace } from "@/components/staff-workspace";
import type { SupportQueueItem } from "@/domain/request-groups";
import { supportDivisions, divisionLabels, type SupportDivision } from "@/domain/support-divisions";
import { useLocale, localized, localizedError } from "@/i18n/locale";

export function ReviewConsole({ requestId, initialVerifyRunId }: { requestId?: string; initialVerifyRunId?: string }) {
  const { locale } = useLocale();
  const t = (vi: string, en: string) => localized(vi, en, locale);
  const divisionName = (value: SupportDivision) => localized(divisionLabels[value], value === "IT" ? "IT" : value === "HR" ? "Human Resources" : "Commercial", locale);
  const sequence = useRef(0);
  const detailSequence = useRef(0);
  const employeeSuggestionSequence = useRef(0);
  const [requests, setRequests] = useState<SupportQueueItem[]>([]),
    [selected, setSelected] = useState<SupportRequest | null>(null);
  const [reason, setReason] = useState(""),
    [target, setTarget] = useState<RequestStatus>("NEEDS_INFORMATION"),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [groupIncidents, setGroupIncidents] = useState(true);
  const [division, setDivision] = useState<SupportDivision>("IT");
  const [filter, setFilter] = useState("all");
  const [verifyRunId, setVerifyRunId] = useState(initialVerifyRunId);
  const [search, setSearch] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [employeeSuggestions, setEmployeeSuggestions] = useState<string[]>([]);
  const [employeeSuggestionsOpen, setEmployeeSuggestionsOpen] = useState(false);
  const [activeEmployeeSuggestion, setActiveEmployeeSuggestion] = useState(-1);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [origin, setOrigin] = useState("all");
  const [queue, setQueue] = useState("all");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filtersReady, setFiltersReady] = useState(false);
  function chooseDivision(next: SupportDivision) {
    if (next === division) return;
    sequence.current++;
    employeeSuggestionSequence.current++;
    setRequests([]); setTotal(0); setNextCursor(null); setLoading(true);
    setEmployeeSuggestions([]); setEmployeeSuggestionsOpen(false);
    setDivision(next);
  }
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem("vng-review-filters-v1") || "null");
      if (!initialVerifyRunId && saved && typeof saved === "object") {
        if ("division" in saved && supportDivisions.includes(saved.division as SupportDivision)) setDivision(saved.division as SupportDivision);
        if ("filter" in saved && typeof saved.filter === "string" && ["pending", "knowledge", "all", "auto"].includes(saved.filter)) setFilter(saved.filter);
        if ("origin" in saved && typeof saved.origin === "string" && ["support", "verify", "all"].includes(saved.origin)) setOrigin(saved.origin);
        if ("queue" in saved && typeof saved.queue === "string" && ["all", "OUT_OF_POLICY", "AUTHORITY_REQUIRED"].includes(saved.queue)) setQueue(saved.queue);
        if ("search" in saved && typeof saved.search === "string") setSearch(saved.search.slice(0, 200));
        if ("employeeId" in saved && typeof saved.employeeId === "string") setEmployeeId(saved.employeeId.slice(0, 32));
      }
    } catch { /* Storage may be disabled; filtering still works in memory. */ }
    setFiltersReady(true);
    if (initialVerifyRunId) setOrigin("verify");
  }, [initialVerifyRunId]);
  useEffect(() => {
    if (!filtersReady || requestId) return;
    try { sessionStorage.setItem("vng-review-filters-v1", JSON.stringify({ division, filter, origin, queue, search, employeeId })); }
    catch { /* Do not block the queue when session storage is unavailable. */ }
  }, [division, filter, origin, queue, search, employeeId, filtersReady, requestId, locale]);
  function clearFilters() {
    setSearch(""); setEmployeeId(""); setFilter("all"); setOrigin("all"); setQueue("all");
    setVerifyRunId(undefined);
    if (verifyRunId) window.history.replaceState(null, "", "/review");
    setSelectedEmployeeId(""); setEmployeeSuggestions([]); setEmployeeSuggestionsOpen(false);
  }
  const visibleRequests = requests;
  const quickQueues = [
    { label: ["Đã xử lý tự động", "Handled automatically"], filter: "auto", queue: "all", icon: UserCheck },
    { label: ["Chờ xử lý", "Awaiting review"], filter: "pending", queue: "all", icon: Inbox },
    { label: ["Ngoài quy định", "Outside policy"], filter: "pending", queue: "OUT_OF_POLICY", icon: ShieldAlert },
    { label: ["Cần thẩm quyền", "Authority required"], filter: "pending", queue: "AUTHORITY_REQUIRED", icon: UserCheck },
    { label: ["Gợi ý tri thức", "Knowledge suggestions"], filter: "knowledge", queue: "all", icon: BookOpen },
  ];
  const refresh = useCallback(
    async (cursor: string | null = null) => {
      const current = ++sequence.current;
      setLoading(true);
      if (!cursor) { setRequests([]); setTotal(0); setNextCursor(null); }
      try {
        const params = new URLSearchParams({
          view: groupIncidents ? "grouped" : "page",
          q: search,
          status: filter,
          origin,
          queue,
          division,
          limit: "30",
          ...(employeeId.trim() ? { employeeId: employeeId.trim() } : {}),
          ...(cursor ? { cursor } : {}),
          ...(verifyRunId ? { verifyRunId } : {}),
        });
        const page = await browserApi<ResultPage<SupportQueueItem>>(
          `/api/support/requests?${params}`,
        );
        if (current !== sequence.current) return;
        setRequests((previous) =>
          cursor ? [...previous, ...page.items] : page.items,
        );
        setNextCursor(page.nextCursor);
        setTotal(page.total);
        setError("");
      } catch (error) {
        if (current === sequence.current)
          setError(
            localizedError(error, locale, "Không thể tải danh sách.", "Could not load the request list."),
          );
      } finally {
        if (current === sequence.current) setLoading(false);
      }
    },
    [search, employeeId, filter, origin, queue, groupIncidents, verifyRunId, division, locale],
  );
  useEffect(() => {
    if (requestId || !filtersReady) return;
    setLoading(true);
    setRequests([]);
    setNextCursor(null);
    const tracker = sequence;
    const timer = setTimeout(() => void refresh(), 250);
    return () => {
      clearTimeout(timer);
      tracker.current++;
    };
  }, [refresh, requestId, filtersReady]);
  useEffect(() => {
    const current = ++employeeSuggestionSequence.current;
    const prefix = employeeId.trim();
    if (prefix.length < 2 || prefix === selectedEmployeeId) {
      setEmployeeSuggestions([]);
      setEmployeeSuggestionsOpen(false);
      setActiveEmployeeSuggestion(-1);
      return;
    }

    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        view: "employee-suggestions",
        employeePrefix: prefix,
        division,
      });
      void browserApi<string[]>(`/api/support/requests?${params}`)
        .then((suggestions) => {
          if (current !== employeeSuggestionSequence.current) return;
          setEmployeeSuggestions(suggestions);
          setEmployeeSuggestionsOpen(suggestions.length > 0);
          setActiveEmployeeSuggestion(-1);
        })
        .catch(() => {
          if (current !== employeeSuggestionSequence.current) return;
          setEmployeeSuggestions([]);
          setEmployeeSuggestionsOpen(false);
        });
    }, 180);
    return () => clearTimeout(timer);
  }, [employeeId, selectedEmployeeId, division]);
  const loadSelected = useCallback(async () => {
    if (!requestId) return;
    const current = ++detailSequence.current;
    setSelected(null);
    setError("");
    try {
      const row = await browserApi<SupportRequest>(
        `/api/support/requests/${encodeURIComponent(requestId)}`,
      );
      if (current === detailSequence.current) setSelected(row);
    } catch (error) {
      if (current === detailSequence.current)
        setError(
          localizedError(error, locale, "Không thể tải yêu cầu.", "Could not load the request."),
        );
    }
  }, [requestId, locale]);
  useEffect(() => {
    const tracker = detailSequence;
    setSelected(null);
    setReason("");
    setError("");
    setTarget("NEEDS_INFORMATION");
    void loadSelected();
    return () => {
      tracker.current++;
    };
  }, [loadSelected]);
  async function act(action: ReviewAction) {
    if (!selected || pending) return false;
    setPending(true);
    setError("");
    try {
      const updated = await browserApi<SupportRequest>(
        `/api/review/${selected.id}`,
        {
          action,
          reason,
          version: selected.version,
          ...(action === "OVERRIDE" ? { target } : {}),
        },
      );
      setSelected({ ...updated, sharedReplies: selected.sharedReplies });
      setReason("");
      if (!requestId) await refresh();
      return true;
    } catch (error) {
      setError(
        localizedError(error, locale, "Không thể cập nhật; chọn lại yêu cầu để tải phiên bản mới.", "Could not update the request. Select it again to load the latest version."),
      );
      return false;
    } finally {
      setPending(false);
    }
  }
  function chooseEmployeeSuggestion(suggestion: string) {
    setEmployeeId(suggestion);
    setSelectedEmployeeId(suggestion);
    setEmployeeSuggestionsOpen(false);
    setActiveEmployeeSuggestion(-1);
  }
  return (
    <StaffWorkspace active="review">
      <main
        className="it-content"
        data-guide-stage={requestId ? "reviewer-detail" : "reviewer-list"}
      >
        {error && <Alert tone="error">{error}</Alert>}
        {!requestId && (
          <>
            <header className="it-page-heading">
              <div>
                <h1>{t("Tiếp nhận hỗ trợ", "Support intake")}</h1>
              </div>
              <Button
                aria-label={t("Tải lại danh sách", "Reload list")}
                variant="secondary"
                onClick={() => void refresh()}
                disabled={loading || pending}
              >
                <RefreshCw
                  size={16}
                  className={loading ? "animate-spin" : ""}
                />
                <span className="it-reload-label">{t("Tải lại danh sách", "Reload list")}</span>
              </Button>
            </header>
            <div role="tablist" aria-label={t("Nhóm tiếp nhận", "Support teams")} className="flex flex-wrap gap-2 mb-4 border-b border-slate-200 pb-3">
              {supportDivisions.map((value, index) => <button key={value} id={`division-tab-${value}`}
                type="button" role="tab" aria-selected={division === value} aria-controls="division-queue"
                tabIndex={division === value ? 0 : -1}
                className={`button ${division === value ? "primary" : "secondary"}`}
                onClick={() => chooseDivision(value)}
                onKeyDown={event => {
                  const next = event.key === "ArrowRight" ? (index + 1) % 3 : event.key === "ArrowLeft" ? (index + 2) % 3
                    : event.key === "Home" ? 0 : event.key === "End" ? 2 : -1;
                  if (next < 0) return;
                  event.preventDefault(); chooseDivision(supportDivisions[next]);
                  document.getElementById(`division-tab-${supportDivisions[next]}`)?.focus();
                }}>{divisionName(value)}</button>)}
            </div>
            {division === "IT" && <IncidentQueue />}
            <label className="flex items-center gap-2 my-3"><input type="checkbox" checked={groupIncidents} onChange={event => setGroupIncidents(event.target.checked)} />{t("Gộp yêu cầu cùng vấn đề", "Group requests for the same incident")}</label>
            <div className="it-quick-queues" role="group" aria-label={t("Chọn nhanh hàng đợi", "Quick queue filters")}>
              {quickQueues.map(({ label, filter: nextFilter, queue: nextQueue, icon: Icon }) => (
                <button key={label[0]} type="button" aria-pressed={filter === nextFilter && queue === nextQueue}
                  onClick={() => { setFilter(nextFilter); setQueue(nextQueue); }}>
                  <Icon size={19} aria-hidden="true" />{localized(label[0], label[1], locale)}
                </button>
              ))}
            </div>
            <section
              id="division-queue"
              role="tabpanel"
              aria-labelledby={`division-tab-${division}`}
              className="it-queue"
              aria-label={t("Danh sách yêu cầu", "Request list")}
              aria-busy={loading}
            >
              <div className="it-filters" data-guide="reviewer-filters">
                <label className="it-search">
                  {t("Tìm nội dung hoặc mã yêu cầu", "Search request text or ID")}
                  <div>
                    <Search size={18} aria-hidden="true" />
                    <input
                      type="search"
                      maxLength={200}
                      placeholder={t("Nội dung hoặc mã HT-…", "Request text or ID…")}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                </label>
                <div className="it-employee-filter">
                  <label className="it-search" htmlFor="review-employee-id">
                    {t("Mã nhân viên", "Employee ID")}
                    <div>
                      <Search size={18} aria-hidden="true" />
                      <input
                        id="review-employee-id"
                        type="search"
                        role="combobox"
                        aria-autocomplete="list"
                        aria-expanded={employeeSuggestionsOpen}
                        aria-controls={employeeSuggestionsOpen ? "review-employee-suggestions" : undefined}
                        aria-activedescendant={
                          employeeSuggestionsOpen && activeEmployeeSuggestion >= 0
                            ? `review-employee-suggestion-${activeEmployeeSuggestion}`
                            : undefined
                        }
                        maxLength={32}
                        autoComplete="off"
                        placeholder={t("Nhập mã nhân viên", "Enter an employee ID")}
                        value={employeeId}
                        onFocus={() => {
                          if (employeeSuggestions.length) setEmployeeSuggestionsOpen(true);
                        }}
                        onChange={(event) => {
                          setEmployeeId(event.target.value);
                          setSelectedEmployeeId("");
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "ArrowDown" && employeeSuggestions.length) {
                            event.preventDefault();
                            setEmployeeSuggestionsOpen(true);
                            setActiveEmployeeSuggestion((active) =>
                              (active + 1) % employeeSuggestions.length,
                            );
                          } else if (event.key === "ArrowUp" && employeeSuggestions.length) {
                            event.preventDefault();
                            setEmployeeSuggestionsOpen(true);
                            setActiveEmployeeSuggestion((active) =>
                              active <= 0 ? employeeSuggestions.length - 1 : active - 1,
                            );
                          } else if (event.key === "Enter" && employeeSuggestionsOpen && activeEmployeeSuggestion >= 0) {
                            event.preventDefault();
                            chooseEmployeeSuggestion(employeeSuggestions[activeEmployeeSuggestion]);
                          } else if (event.key === "Escape") {
                            setEmployeeSuggestionsOpen(false);
                            setActiveEmployeeSuggestion(-1);
                          }
                        }}
                      />
                    </div>
                  </label>
                  {employeeSuggestionsOpen && employeeSuggestions.length > 0 && (
                    <ul
                      id="review-employee-suggestions"
                      className="it-employee-suggestions"
                      role="listbox"
                      aria-label={t("Mã nhân viên gợi ý", "Employee ID suggestions")}
                    >
                      {employeeSuggestions.map((suggestion, index) => (
                        <li
                          id={`review-employee-suggestion-${index}`}
                          key={suggestion}
                          role="option"
                          aria-selected={index === activeEmployeeSuggestion}
                          onMouseDown={(event) => event.preventDefault()}
                          onMouseEnter={() => setActiveEmployeeSuggestion(index)}
                          onClick={() => chooseEmployeeSuggestion(suggestion)}
                        >
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <label>
                  {t("Hiển thị", "Show")}
                  <select
                    aria-label={t("Hiển thị", "Show")}
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                  >
                    <option value="auto">{t("Đã xử lý tự động", "Handled automatically")}</option>
                    <option value="pending">{t("Đang chờ xử lý", "Awaiting review")}</option>
                    <option value="knowledge">
                      {t("Gợi ý tri thức", "Knowledge suggestions")}
                    </option>
                    <option value="all">{t("Tất cả trạng thái", "All statuses")}</option>
                  </select>
                </label>
                <label>
                  {t("Nguồn yêu cầu", "Request source")}
                  <select
                    value={origin}
                    onChange={(event) => setOrigin(event.target.value)}
                  >
                    <option value="support">{t("Người dùng gửi", "Requester")}</option>
                    <option value="verify">Case Verify</option>
                    <option value="all">{t("Tất cả", "All")}</option>
                  </select>
                </label>
                <label className="it-queue-filter">
                  {t("Hàng đợi chuyển tiếp", "Escalation queue")}
                  <select
                    value={queue}
                    onChange={(event) => setQueue(event.target.value)}
                  >
                    <option value="all">{t("Tất cả lý do", "All reasons")}</option>
                    <option value="OUT_OF_POLICY">
                      {t("Ngoài quy định", "Outside policy")}
                    </option>
                    <option value="AUTHORITY_REQUIRED">
                      {t("Cần thẩm quyền", "Authority required")}
                    </option>
                  </select>
                </label>
              </div>
              <div className="it-queue-caption">
                <h2>
                  {t("Yêu cầu phù hợp", "Matching requests")} <span>{total}</span>
                </h2>
                <span role="status" aria-live="polite">
                  {loading
                    ? t("Đang tải danh sách…", "Loading requests…")
                    : t(`${requests.length}/${total} mục`, `${requests.length}/${total} items`)}
                </span>
                {verifyRunId && <span>{t("Lần kiểm thử này", "This test run")}</span>}
                {(verifyRunId || search || employeeId || filter !== "all" || origin !== "all" || queue !== "all") && (
                  <Button variant="quiet" onClick={clearFilters}><X size={14} />{t("Xóa bộ lọc", "Clear filters")}</Button>
                )}
              </div>
              <div
                className="it-contained-scroll"
                data-guide={!requests.length ? "reviewer-list" : undefined}
                role="region"
                aria-label={t("Danh sách yêu cầu phù hợp", "Matching requests")}
                tabIndex={0}
              >
                {!loading && !requests.length && !error && (
                  <div className="it-empty">
                    <Inbox size={36} />
                    <h3>{t("Chưa có yêu cầu phù hợp", "No matching requests")}</h3>
                    <p>{t("Thử đổi bộ lọc hoặc tìm bằng mã nhân viên, nội dung hay mã yêu cầu.", "Change the filters or search by employee ID, request text, or request ID.")}</p>
                    <Button variant="secondary" onClick={clearFilters}>{t("Xem tất cả yêu cầu", "View all requests")}</Button>
                    <Link className="button secondary" href="/send-help">
                      {t("Tạo yêu cầu demo", "Create demo request")}
                    </Link>
                  </div>
                )}
                {loading && !requests.length && <div className="it-loading" aria-hidden="true">
                  {[0, 1, 2].map((row) => <div key={row}><span /><span /><span /></div>)}
                </div>}
                {error && (
                  <div className="it-empty">
                    <p>{t("Không thể tải danh sách. Hãy thử tải lại.", "Could not load the request list. Try reloading.")}</p>
                  </div>
                )}
                <ul className="it-request-list review-list">
                  {visibleRequests.map((request, index) => (
                    <li key={request.id}>
                      <Link
                        href={request.group ? `/review?groupId=${request.group.id}` : `/review?requestId=${request.id}`}
                        className="it-request-row"
                        data-guide={index === 0 ? "reviewer-list" : undefined}
                      >
                        <div className="it-row-id">
                          {request.group ? <Users size={20} aria-hidden="true" /> : displayId(request.id)}
                          <small>
                            {new Date(request.createdAt).toLocaleDateString(
                              "vi-VN",
                              { timeZone: "Asia/Ho_Chi_Minh" },
                            )}
                          </small>
                        </div>
                        <div className="it-row-subject">
                          <strong>{request.title}</strong>
                            <small>{serviceGroupName(request.serviceGroup, locale)}</small>
                          {request.employeeId && (
                            <small>{t("Mã nhân viên:", "Employee ID:")} {request.employeeId}</small>
                          )}
                          {request.assignedTeam && (
                            <small>{t("Nơi tiếp nhận:", "Assigned team:")} {divisionName(request.division ?? "IT")}</small>
                          )}
                          <div className="it-row-tags">
                            {request.verifyRunId && <Badge>Case Verify</Badge>}
                            {request.hasKnowledgeCandidate && (
                              <Badge tone="warning">{t("Gợi ý tri thức", "Knowledge suggestion")}</Badge>
                            )}
                            {request.uncertaintyClass === "OUT_OF_POLICY" && (
                              <Badge tone="warning">{t("Ngoài quy định", "Outside policy")}</Badge>
                            )}
                            {request.uncertaintyClass ===
                              "AUTHORITY_REQUIRED" && (
                              <Badge tone="warning">{t("Cần thẩm quyền", "Authority required")}</Badge>
                            )}
                          </div>
                        </div>
                        <Badge
                          tone={
                            request.status === "ESCALATED"
                              ? "warning"
                              : request.status === "COMPLETED"
                                ? "success"
                                : "neutral"
                          }
                        >
                          {statusLabel(request.status, locale)}
                        </Badge>
                        <ChevronRight size={18} aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              {nextCursor && (
                <div className="it-queue-more">
                  <Button
                    variant="secondary"
                    disabled={loading}
                    onClick={() => void refresh(nextCursor)}
                  >
                    {t("Tải thêm yêu cầu", "Load more requests")}
                  </Button>
                </div>
              )}
            </section>
          </>
        )}
        {requestId && selected?.id === requestId ? (
          <ReviewDetail
            key={selected.id}
            request={selected}
            reason={reason}
            setReason={setReason}
            target={target}
            setTarget={setTarget}
            pending={pending}
            onAct={act}
            onReload={loadSelected}
          />
        ) : requestId ? (
          error ? (
            <div className="it-recovery">
              <Button variant="secondary" onClick={() => void loadSelected()}>
                {t("Thử tải lại yêu cầu", "Reload request")}
              </Button>
              <Link href="/review" className="button secondary">
                ← {t("Danh sách yêu cầu", "Request list")}
              </Link>
            </div>
          ) : (
            <ContentSkeleton label="Đang tải yêu cầu…" labelEn="Loading request…" />
          )
        ) : null}
      </main>
    </StaffWorkspace>
  );
}
