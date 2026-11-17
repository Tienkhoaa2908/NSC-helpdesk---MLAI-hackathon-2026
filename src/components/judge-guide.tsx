"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { GUIDE_SESSION_PREFIX, guideStages, type GuideRole } from "@/domain/judge-guide";
import { GuideIllustration } from "./guide-illustration";
import { usePathname } from "next/navigation";
import { useNavigationInFlight } from "./route-transition";

type Position = { left: number; top: number; width: number; height: number };
type Guide = { stage: string; index: number };
const waitingStages = ["sender-form", "sender-preview", "reviewer-list"];

function introKeyForPath(pathname: string) {
  if (/^\/(login|send-help|workspace|track)(\/|$)/.test(pathname)) return "sender-intro";
  if (/^\/(review|audit|verify|identity\/(review|authority))(\/|$)/.test(pathname)) return "reviewer-intro";
  return null;
}

export function JudgeGuide({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const navigating = useNavigationInFlight();
  const content = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const tip = useRef<HTMLElement>(null);
  const seen = useRef(new Set<string>());
  const activeRole = useRef<GuideRole | null>(null);
  const lastStage = useRef("");
  const lastTarget = useRef("");
  const [ready, setReady] = useState(false);
  const [intro, setIntro] = useState(false);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0, headerBottom: 0 });
  const introKey = introKeyForPath(pathname);

  const remember = useCallback((key: string) => {
    seen.current.add(key);
    try { sessionStorage.setItem(`${GUIDE_SESSION_PREFIX}${key}`, "seen"); }
    catch { /* In-memory state still avoids repeats during SPA navigation. */ }
  }, []);

  useEffect(() => {
    for (const key of ["sender-intro", "reviewer-intro", "sender", "reviewer"]) {
      try {
        if (sessionStorage.getItem(`${GUIDE_SESSION_PREFIX}${key}`) === "seen") seen.current.add(key);
      } catch { /* Storage may be disabled by the browser. */ }
    }
    setIntro(Boolean(introKey && !seen.current.has(introKey)));
    setReady(true);
  }, [introKey]);

  useEffect(() => {
    const open = () => setIntro(true);
    window.addEventListener("vng-open-guide", open);
    return () => window.removeEventListener("vng-open-guide", open);
  }, []);

  const dismissIntro = useCallback(() => {
    remember(introKey ?? "intro");
    setIntro(false);
  }, [introKey, remember]);

  useEffect(() => {
    if (!ready || !intro || navigating) { dialog.current?.close(); return; }
    const modal = dialog.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modal?.showModal();
    return () => {
      modal?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [ready, intro, navigating]);

  // Stages are declared by the rendered page, including asynchronous detail pages.
  // Mark a role on entry: returning from Home never restarts an abandoned tour.
  useEffect(() => {
    if (!ready || intro || !content.current) return;
    const inspect = () => {
      // Suspense temporarily replaces the stage. Keep the active role until the
      // destination arrives, otherwise its already-seen flag ends the tour.
      if (Array.from(content.current?.querySelectorAll<HTMLElement>("[data-guide-loading]") ?? []).some(element => element.getClientRects().length > 0)) return;
      const stage = content.current?.querySelector<HTMLElement>("[data-guide-stage]")?.dataset.guideStage ?? "";
      const definition = guideStages[stage];
      if (!definition) {
        activeRole.current = null;
        lastStage.current = "";
        setGuide(null);
        return;
      }
      if (activeRole.current !== definition.role) {
        if (seen.current.has(definition.role)) { setGuide(null); return; }
        remember(definition.role);
        activeRole.current = definition.role;
        lastStage.current = "";
      }
      if (lastStage.current !== stage) {
        lastStage.current = stage;
        setGuide({ stage, index: 0 });
      }
    };
    inspect();
    const observer = new MutationObserver(inspect);
    observer.observe(content.current, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-guide-stage"] });
    return () => observer.disconnect();
  }, [ready, intro, remember]);

  const finish = useCallback(() => {
    activeRole.current = null;
    setGuide(null);
  }, []);
  const next = useCallback(() => {
    if (!guide) return;
    const steps = guideStages[guide.stage].steps;
    if (guide.index + 1 < steps.length) setGuide({ ...guide, index: guide.index + 1 });
    else if (!waitingStages.includes(guide.stage)) finish();
  }, [guide, finish]);

  useEffect(() => {
    if (!guide || !content.current) { setPosition(null); return; }
    let frame = 0;
    const steps = guideStages[guide.stage].steps;
    const measure = () => {
      const index = steps.findIndex((step, index) => {
        if (index < guide.index) return false;
        const target = content.current?.querySelector<HTMLElement>(`[data-guide="${step.target}"]`);
        return target && target.getClientRects().length > 0;
      });
      if (index < 0) { setPosition(null); return; }
      if (index !== guide.index) { setGuide({ ...guide, index }); return; }
      const target = content.current!.querySelector<HTMLElement>(`[data-guide="${steps[index].target}"]`)!;
      const identity = `${guide.stage}:${index}`;
      if (lastTarget.current !== identity) {
        lastTarget.current = identity;
        target.scrollIntoView({ block: "center", behavior: "auto" });
      }
      const rect = target.getBoundingClientRect();
      const value = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      setPosition((previous) => JSON.stringify(previous) === JSON.stringify(value) ? previous : value);
      const headerBottom = Math.max(0, content.current?.querySelector<HTMLElement>(".site-header")?.getBoundingClientRect().bottom ?? 0);
      setViewport((previous) => previous.width === innerWidth && previous.height === innerHeight && previous.headerBottom === headerBottom
        ? previous : { width: innerWidth, height: innerHeight, headerBottom });
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const advance = (event: Event) => {
      const step = steps[guide.index];
      if (event.type !== step.advanceOn || !(event.target instanceof Element)) return;
      if (event instanceof MouseEvent && event.button !== 0) return;
      if (!event.target.closest(`[data-guide="${step.target}"]`)) return;
      if (event.type === "click" && !event.target.closest("button, a, summary")) return;
      if (event.target.closest(":disabled")) return;
      if (event.type === "change" && event.target instanceof HTMLSelectElement &&
          event.target.required && !event.target.value) return;
      if (event.type === "input") {
        if (!(event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement)) return;
        if (event.target.value.trim().length < (step.target === "reviewer-reason" ? 8 : 2)) return;
      }
      next();
    };
    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(content.current, { subtree: true, childList: true, attributes: true });
    const resize = new ResizeObserver(schedule);
    resize.observe(content.current);
    const header = content.current.querySelector<HTMLElement>(".site-header");
    if (header) resize.observe(header);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    // Capture before React disables a submitted form for its pending request.
    for (const event of ["click", "input", "change"]) document.addEventListener(event, advance, true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      for (const event of ["click", "input", "change"]) document.removeEventListener(event, advance, true);
    };
  }, [guide, next]);

  const step = guide && guideStages[guide.stage].steps[guide.index];
  // On narrow screens reserve space for the bottom tip so native scrolling can
  // reveal *any* control, including history links outside the current tour step.
  const mobileTipSpace = guide && viewport.width > 0 && viewport.width <= 760 ? viewport.height * 0.4 + 24 : 0;
  useEffect(() => {
    if (!mobileTipSpace) return;
    const root = document.documentElement;
    const previous = root.style.scrollPaddingBottom;
    root.style.scrollPaddingBottom = `${mobileTipSpace}px`;
    return () => { root.style.scrollPaddingBottom = previous; };
  }, [mobileTipSpace]);
  const dockTop = position && viewport.width > 760 ? position.top + Math.min(position.height, 200) / 2 > viewport.height / 2 : false;
  const tipLeft = position ? Math.max(12, Math.min(position.left, viewport.width - 332)) : 12;
  // Keep navigation reachable while the tour is open, including a wrapped mobile header.
  const tipTop = viewport.headerBottom + 12;
  const tipMaxHeight = Math.max(0, Math.min(viewport.height * 0.4, viewport.height - tipTop - 12));
  const targetX = position ? Math.max(12, Math.min(viewport.width - 12, position.left + position.width / 2)) : 0;
  const targetY = position ? Math.max(8, Math.min(viewport.height - 8, dockTop ? position.top : position.top + position.height)) : 0;
  const last = guide ? guide.index === guideStages[guide.stage].steps.length - 1 : false;

  return (
    <>
      <div ref={content} inert={intro ? true : undefined} style={mobileTipSpace ? { paddingBottom: mobileTipSpace } : undefined}>{children}</div>
      <dialog ref={dialog} className="guide-modal" aria-labelledby="support-guide-title" onCancel={(event) => { event.preventDefault(); dismissIntro(); }} onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = event.currentTarget.querySelectorAll<HTMLElement>('a[href], button, [tabindex="0"]');
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}>
        <header className="guide-modal-heading">
          <p className="eyebrow">HƯỚNG DẪN SỬ DỤNG</p>
          <h2 id="support-guide-title">Bắt đầu cùng VNG Support</h2>
          <p>Chọn hướng dẫn phù hợp với công việc bạn cần thực hiện.</p>
        </header>
        <div className="guide-modal-scroll" tabIndex={0} aria-label="Nội dung hướng dẫn sử dụng">
          <section>
            <h3>1. Nhân viên gửi yêu cầu</h3>
            <p>Chọn <strong>Tôi cần hỗ trợ</strong> rồi đăng nhập bằng Google với tài khoản đã được IT duyệt. Nếu chưa có ID, đăng nhập Google và gửi đơn qua mục <strong>Nhân viên mới?</strong>; IT phải xác minh trước khi cấp ID. ID nội bộ không phải mật khẩu. Có thể chọn luồng không cần tài khoản để thử yêu cầu demo, nhưng luồng đó không xác minh người gửi.</p>
          </section>
          <section>
            <h3>Gửi yêu cầu hỗ trợ</h3>
            <p>Chọn mô tả tự do hoặc danh mục, điền những dữ kiện bạn biết rồi bấm <strong>Gửi</strong> để xem preview. Ví dụ: “VPN không kết nối”. Preview chưa lưu hồ sơ; kiểm tra nội dung trước khi xác nhận.</p>
            <GuideIllustration kind="sender" />
            <p>Đọc phản hồi, sửa nếu cần rồi bấm <strong>Xác nhận và gửi yêu cầu</strong>. Với câu hỏi trò chuyện, bấm <strong>Lưu và tiếp tục trò chuyện</strong> để mở trang theo dõi. <Link className="button primary" href="/send-help">Bấm để gửi yêu cầu hỗ trợ</Link></p>
            <GuideIllustration kind="feedback" />
            <p>Thử A/B/C/D tùy kết quả: đã giải quyết, vẫn lỗi, giải thích thêm hoặc chuyển nhân viên. Có thể hỏi tiếp, bổ sung dữ kiện và mở lịch sử. Lưu liên kết nếu muốn xem lại yêu cầu.</p>
          </section>
          <section>
            <h3>2. Admin xử lý yêu cầu</h3>
            <p>Mở hàng đợi, tìm một hồ sơ, đọc dữ kiện và bằng chứng trước khi phản hồi. <Link href="/help/admin">Mở hướng dẫn Admin</Link>.</p>
            <GuideIllustration kind="reviewer" />
            <p>Chọn thao tác phù hợp với điều kiện của hồ sơ. Mở <strong>Lịch sử xử lý</strong> để đối chiếu kết quả. <Link href="/review">Mở hàng đợi Admin</Link></p>
          </section>
          <section className="guide-note">
            <h3>Hướng dẫn riêng theo vai trò</h3>
            <p>Không gian Admin và ID demo không xác minh danh tính, không cấp quyền tổ chức và không thay đổi hạ tầng thật. Chỉ dùng dữ liệu minh họa.</p>
            <p><Link href="/help/employee">Hướng dẫn nhân viên</Link> · <Link href="/help/admin">Hướng dẫn Admin</Link> · <Link href="/send-help">Gửi yêu cầu hỗ trợ</Link></p>
          </section>
        </div>
        <div className="guide-modal-footer"><button className="button primary" onClick={dismissIntro}>Đã hiểu</button></div>
      </dialog>
      {ready && !intro && guide && step && position && (
        <div className="guide-overlay">
          <div className="guide-target-ring" style={{ left: position.left - 4, top: position.top - 4, width: position.width + 8, height: position.height + 8 }} />
          <svg className="guide-arrow" aria-hidden="true" width={viewport.width} height={viewport.height}>
            <defs><marker id="live-guide-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626" /></marker></defs>
            <path d={`M ${tipLeft + 160} ${dockTop ? tipTop + (tip.current?.offsetHeight ?? 210) : viewport.height - 12 - (tip.current?.offsetHeight ?? 210)} Q ${targetX + 45} ${targetY + (dockTop ? -50 : 50)} ${targetX} ${targetY}`} stroke="#dc2626" strokeWidth="4" fill="none" strokeLinecap="round" markerEnd="url(#live-guide-arrow)" />
          </svg>
          <aside ref={tip} className="guide-tip" role="region" aria-label="Hướng dẫn thao tác" style={{ left: tipLeft, maxHeight: tipMaxHeight, ...(dockTop ? { top: tipTop } : { bottom: 12 }) }}>
            <p className="eyebrow">{guideStages[guide.stage].role === "sender" ? "NGƯỜI GỬI" : "ADMIN"}</p>
            <div aria-live="polite"><h3>{step.title}</h3><p>{step.text}</p></div>
            <div className="guide-tip-actions">
              {(!last || !waitingStages.includes(guide.stage)) && <button className="button primary" onClick={next}>{last ? "Hoàn tất hướng dẫn" : "Tiếp theo"}</button>}
              <button className="guide-skip" onClick={finish}>Bỏ qua hướng dẫn</button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
