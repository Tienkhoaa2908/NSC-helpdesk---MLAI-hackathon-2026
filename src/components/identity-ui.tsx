"use client";
import Link from "next/link";
import { GuestEntryLink } from "./guest-entry-link";
import { useEffect, useRef, useState } from "react";
import { applicationInputSchema, environments, operations, resources, scopeKey, scopeRisk, scopeSchema, type JobProfile, type Scope } from "@/domain/identity";
import { Alert, Button } from "./ui";

export async function identityApi<T>(path: string, body?: unknown, headers?: HeadersInit): Promise<T> {
  const response = await fetch(`/api/identity/${path}`, { method: body === undefined ? "GET" : "POST", cache: "no-store", headers: { "content-type": "application/json", ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.error?.message || "Chưa kết nối được hệ thống ID. Thử lại sau.");
  return result.data as T;
}
export const identityStatus = { PENDING: "Chờ quản trị viên duyệt", ID_CONFLICT: "Quản trị viên đang xử lý trùng ID", APPROVED: "Đã cấp ID", REJECTED: "Quản trị viên đã từ chối" };
export function ScopeList({ scopes }: { scopes: Scope[] }) {
  return <ul className="scope-list">{scopes.map((scope) => <li key={scopeKey(scope)}><strong>{operations[scope.operation]} · {resources[scope.resource]}</strong><span>{environments[scope.environment]} · <code>{scope.target}</code></span>{scopeRisk(scope) && <small className="risk-label">Cần thẩm quyền riêng — duyệt job chưa cho phép thực thi</small>}</li>)}</ul>;
}
export function LoginPanel() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "google_sign_in")
      setError("Đăng nhập Google chưa hoàn tất hoặc phiên đã hết hạn. Hãy thử lại.");
  }, []);
  return <section className="identity-login" aria-labelledby="login-title">
    <h1 id="login-title">Đăng nhập</h1>
    <div className="identity-form">
      <p>Đăng nhập bằng tài khoản Gmail đã xác minh. Nếu chưa có ID nhân viên, chọn “Nhân viên mới?” để gửi yêu cầu truy cập; quản trị viên sẽ xác minh và duyệt.</p>
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="button" disabled={busy} onClick={async () => {
        setError(""); setBusy(true);
      try {
        const next = new URLSearchParams(window.location.search).get("next");
        const returnTo = next === "/identity/review" ? next : "/send-help";
        const result = await identityApi<{ authorizationUrl: string }>("google/start", { returnTo });
        window.location.assign(result.authorizationUrl);
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa đăng nhập được. Thử lại."); }
      finally { setBusy(false); }
      }}>{busy ? "Đang chuyển tới Google…" : "Đăng nhập bằng Google"}</Button>
    </div>
    <GuestEntryLink className="button secondary guest-entry">Đăng nhập không cần tài khoản</GuestEntryLink>
    <Link className="identity-text-link" href="/identity/new">Nhân viên mới?</Link>

    <details className="login-options"><summary>Hướng dẫn & tùy chọn</summary><p>Google chỉ xác minh tài khoản và email. Quản trị viên vẫn cần xác minh nhân sự trước khi cấp ID. ID nhân viên là mã nhận diện nội bộ, không phải thông tin đăng nhập.</p><div className="identity-links"><Link href="/identity/track">Theo dõi đơn cấp ID</Link><Link href="/help">Hướng dẫn sử dụng</Link><button type="button" onClick={() => window.dispatchEvent(new Event("vng-open-guide"))}>Hướng dẫn demo</button><Link href="/send-help">Trải nghiệm demo</Link></div></details>
  </section>;
}
export function ScopeEditor({ value, onChange }: { value: Scope[]; onChange: (value: Scope[]) => void }) {
  const [draft, setDraft] = useState<Scope>({ environment: "sandbox", resource: "project", operation: "read", target: "" });
  const [error, setError] = useState("");
  return <fieldset className="scope-editor"><legend>Phạm vi cần yêu cầu</legend><p>Chọn từng quyền và đích cụ thể. Không nhập wildcard (*), mật khẩu hoặc giá trị secrets.</p><div className="identity-grid">
    <label>Môi trường<select aria-label="Môi trường" value={draft.environment} onChange={(e) => setDraft({ ...draft, environment: e.target.value as Scope["environment"] })}>{Object.entries(environments).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
    <label>Tài nguyên<select aria-label="Tài nguyên" value={draft.resource} onChange={(e) => setDraft({ ...draft, resource: e.target.value as Scope["resource"] })}>{Object.entries(resources).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
    <label>Thao tác<select aria-label="Thao tác" value={draft.operation} onChange={(e) => setDraft({ ...draft, operation: e.target.value as Scope["operation"] })}>{Object.entries(operations).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
    <label>Phạm vi đích<input value={draft.target} maxLength={120} onChange={(e) => setDraft({ ...draft, target: e.target.value })} placeholder="Ví dụ: project-demo/task-01" /></label>
  </div>{scopeRisk(draft) && <p className="risk-label">Quyền nhạy cảm: cần thẩm quyền riêng, không tự động thực thi sau khi cấp job.</p>}{error && <Alert tone="error">{error}</Alert>}
    <Button variant="secondary" type="button" onClick={() => { const parsed = scopeSchema.safeParse(draft); if (!parsed.success) { setError("Nhập đích cụ thể, 2–120 ký tự: chữ không dấu, số, dấu / . : _ hoặc -. Không dùng wildcard hay ‘all’."); return; } if (value.length >= 30 || value.some((s) => scopeKey(s) === scopeKey(parsed.data))) { setError("Phạm vi đã có hoặc đã đủ 30 quyền."); return; } onChange([...value, parsed.data]); setError(""); }}>Thêm phạm vi</Button>
    <ol className="scope-list">{value.map((scope, i) => <li key={scopeKey(scope)}><span>{operations[scope.operation]} · {resources[scope.resource]} · {environments[scope.environment]} · <code>{scope.target}</code></span><Button type="button" variant="quiet" aria-label={`Bỏ phạm vi ${i + 1}`} onClick={() => onChange(value.filter((_, index) => index !== i))}>Bỏ</Button></li>)}</ol>
  </fieldset>;
}
export function NewIdentityApplication() {
  const [principal, setPrincipal] = useState<{ status: "ACTIVE" | "PENDING" | "ADMIN"; id?: string; name: string; email: string; applicationStatus?: keyof typeof identityStatus } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [authError, setAuthError] = useState("");
  const [profiles, setProfiles] = useState<JobProfile[]>([]);
  const [existing, setExisting] = useState<Tracking | null>(null);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [job, setJob] = useState("");
  const [jobName, setJobName] = useState("");
  const [search, setSearch] = useState("");
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  const submitted = useRef<{ id: string; token: string; payload: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const load = async () => { setLoadError(""); try { setProfiles(await identityApi<JobProfile[]>("profiles")); } catch (cause) { setLoadError((cause as Error).message); } };
  const refreshApplication = async () => { try { setExisting(await identityApi<Tracking | null>("my-application")); } catch (cause) { setLoadError((cause as Error).message); } };
  useEffect(() => {
    let current = true;
    void identityApi<{ status: "ACTIVE" | "PENDING" | "ADMIN"; id?: string; name: string; email: string; applicationStatus?: keyof typeof identityStatus }>("session")
      .then(async (value) => {
        if (!current) return;
        setPrincipal(value); setSignedOut(false); setName(value.name);
        if (value.status === "PENDING") {
          const [availableProfiles, application] = await Promise.all([
            identityApi<JobProfile[]>("profiles").catch(() => []),
            identityApi<Tracking | null>("my-application").catch(() => null),
          ]);
          if (current) { setProfiles(availableProfiles); setExisting(application); }
        }
      })
      .catch((cause) => { if (current) { setSignedOut(true); setAuthError((cause as Error).message); } })
      .finally(() => { if (current) setAuthLoading(false); });
    return () => { current = false; };
  }, []);
  useEffect(() => { heading.current?.focus(); }, [step, receipt]);
  async function signIn() {
    setError(""); setAuthError(""); setBusy(true);
    try { const result = await identityApi<{ authorizationUrl: string }>("google/start", { returnTo: "/identity/new" }); window.location.assign(result.authorizationUrl); }
    catch (cause) { setAuthError((cause as Error).message); }
    finally { setBusy(false); }
  }
  const profile = profiles.find((p) => `${p.id}:${p.version}` === job);
  if (receipt) return <main className="identity-page"><section className="identity-card"><span className="eyebrow">ĐÃ LƯU ĐƠN</span><h1 ref={heading} tabIndex={-1}>Đơn đang chờ quản trị viên duyệt</h1><p>Chưa có ID chính thức. Lưu liên kết riêng bên dưới để xem kết quả và lý do xử lý.</p><label>Liên kết theo dõi riêng<input readOnly value={receipt} onFocus={(e) => e.target.select()} /></label><p className="identity-note">Ai có liên kết này có thể đọc đơn. Chỉ chia sẻ cho người liên quan. Liên kết không được lưu trong trình duyệt.</p><a className="button primary" href={receipt}>Theo dõi đơn</a><Link className="identity-text-link" href="/login">Về đăng nhập</Link></section></main>;
  if (authLoading) return <main className="identity-page"><section className="identity-card"><p role="status">Đang kiểm tra phiên đăng nhập…</p></section></main>;
  if (signedOut) return <main className="identity-page"><section className="identity-card"><Link href="/login" className="identity-text-link">← Đăng nhập</Link><h1 ref={heading} tabIndex={-1}>Yêu cầu cấp ID</h1><p>Đăng nhập bằng tài khoản Gmail đã xác minh trước khi gửi yêu cầu. Quản trị viên sẽ xác minh nhân sự và phạm vi.</p>{authError && <Alert tone="error">{authError}</Alert>}<Button type="button" disabled={busy} onClick={() => void signIn()}>{busy ? "Đang chuyển tới Google…" : "Đăng nhập bằng Google"}</Button></section></main>;
  if (principal?.status === "ADMIN") return <main className="identity-page"><section className="identity-card"><span className="eyebrow">QUẢN TRỊ DANH TÍNH</span><h1 ref={heading} tabIndex={-1}>Đã đăng nhập với quyền quản trị</h1><p>{principal.email} có thể xem và duyệt các yêu cầu cấp ID.</p><Link className="button primary" href="/identity/review">Mở hàng đợi duyệt ID</Link></section></main>;
  if (principal?.status === "ACTIVE") return <main className="identity-page"><section className="identity-card"><span className="eyebrow">TÀI KHOẢN ĐÃ ĐƯỢC DUYỆT</span><h1 ref={heading} tabIndex={-1}>Bạn đã có ID nhân viên</h1><p>Tài khoản Google {principal.email} đã được quản trị viên duyệt.</p><p className="issued-id">{principal.id}</p><p>ID là mã nhận diện nội bộ, không phải mật khẩu. Dùng Google Sign-In để đăng nhập.</p><Link className="button primary" href="/send-help">Gửi yêu cầu hỗ trợ</Link></section></main>;
  if (existing && ["PENDING", "ID_CONFLICT"].includes(existing.status)) return <main className="identity-page"><section className="identity-card"><span className="eyebrow">{identityStatus[existing.status]}</span><h1 ref={heading} tabIndex={-1}>Đơn cấp ID đang được xử lý</h1><p>{existing.fullName} · {existing.jobName}</p><p>Đăng nhập Google xác định đúng người gửi. Quản trị viên phải xác minh nhân sự trước khi cấp ID.</p>{existing.reason && <Alert>{existing.reason}</Alert>}<ScopeList scopes={existing.scopes} /><div className="identity-actions"><Button variant="secondary" type="button" disabled={busy} onClick={() => { setBusy(true); void refreshApplication().finally(() => setBusy(false)); }}>{busy ? "Đang tải…" : "Tải lại trạng thái"}</Button><Link className="button secondary" href="/login">Về đăng nhập</Link></div></section></main>;
  return <main className="identity-page"><section className="identity-card"><Link href="/login" className="identity-text-link">← Đăng nhập</Link><h1 ref={heading} tabIndex={-1}>Yêu cầu cấp ID</h1><p>Đã đăng nhập: <strong>{principal?.email}</strong>. Quản trị viên sẽ xác minh nhân sự và phạm vi trước khi cấp ID. Không nhập thông tin liên hệ hoặc dữ liệu mật.</p>{existing?.status === "REJECTED" && <Alert>Đơn trước bị từ chối: {existing.reason ?? "Quản trị viên yêu cầu gửi lại sau khi bổ sung thông tin."}</Alert>}<ol className="identity-steps" aria-label="Các bước cấp ID">{["Thông tin", "Phạm vi", "Xác nhận"].map((title, index) => <li key={title} aria-current={step === index + 1 ? "step" : undefined}>{index + 1}. {title}</li>)}</ol>
    {loadError && <Alert tone="error">{loadError} <button type="button" className="identity-text-link" onClick={() => void load()}>Thử tải lại</button></Alert>}
    <form className="identity-form" onSubmit={async (event) => {
      event.preventDefault(); setError("");
      if (step === 1) { if (!name.trim() || !job) { setError("Nhập họ tên và chọn job."); return; } setStep(2); return; }
      const selection = job === "new" ? { kind: "new" as const, name: jobName, scopes } : { kind: "existing" as const, profileId: profile?.id, version: profile?.version };
      const payload = JSON.stringify({ fullName: name, job: selection });
      if (!submitted.current || submitted.current.payload !== payload) submitted.current = { id: crypto.randomUUID(), token: Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join(""), payload };
      const input = { id: submitted.current.id, trackingToken: submitted.current.token, fullName: name, job: selection };
      if (!applicationInputSchema.safeParse(input).success) { setError("Kiểm tra họ tên chỉ gồm chữ, tên job tối thiểu 2 ký tự và ít nhất một phạm vi hợp lệ. Job có sẵn cần được tải thành công."); return; }
      if (step === 2) { setStep(3); return; }
      setBusy(true);
      try { await identityApi("applications", input); setReceipt(`${window.location.origin}/identity/track#id=${input.id}&token=${input.trackingToken}`); }
      catch (cause) { setError((cause as Error).message); }
      finally { setBusy(false); }
    }}>
      {step === 1 && <><label>Họ và tên người cần cấp ID<input required maxLength={120} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></label><label>Tìm job có sẵn<input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo tên job" /></label><label>Tên job<select aria-label="Tên job" required value={job} onChange={(e) => setJob(e.target.value)}><option value="">Chọn job</option>{profiles.filter((p) => p.name.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi")) || `${p.id}:${p.version}` === job).map((p) => <option key={`${p.id}:${p.version}`} value={`${p.id}:${p.version}`}>{p.name} · phiên bản {p.version}</option>)}<option value="new">Tạo job mới — quản trị viên duyệt phạm vi</option></select></label>{job === "new" && <label>Tên job mới<input required minLength={2} maxLength={100} value={jobName} onChange={(e) => setJobName(e.target.value)} /></label>}</>}
      {step === 2 && (job === "new" ? <ScopeEditor value={scopes} onChange={setScopes} /> : <><h2>{profile?.name} · phiên bản {profile?.version}</h2><p>Có thể yêu cầu các quyền dưới đây. Không được làm ngoài phạm vi hoặc đích này; quyền nhạy cảm vẫn cần thẩm quyền riêng. quản trị viên duyệt việc gắn nguyên profile cho bạn.</p><ScopeList scopes={profile?.scopes ?? []} /></>)}
      {step === 3 && <><h2>Kiểm tra trước khi gửi</h2><dl className="identity-summary"><dt>Họ tên</dt><dd>{name}</dd><dt>Job</dt><dd>{job === "new" ? `${jobName} — job mới` : `${profile?.name} — phiên bản ${profile?.version}`}</dd></dl><ScopeList scopes={job === "new" ? scopes : profile?.scopes ?? []} /><p>Gửi đơn chưa cấp tài khoản. Chỉ sau khi quản trị viên duyệt, ID chính thức mới xuất hiện trong trang theo dõi.</p></>}
      {error && <Alert tone="error">{error}</Alert>}<div className="identity-actions">{step > 1 && <Button type="button" variant="secondary" disabled={busy} onClick={() => { setStep(step - 1); setError(""); }}>Quay lại</Button>}<Button disabled={busy}>{busy ? "Đang lưu đơn…" : step === 3 ? "Gửi đơn cho quản trị viên" : "Tiếp tục"}</Button></div>
    </form></section></main>;
}
type Tracking = { fullName: string; status: keyof typeof identityStatus; jobName: string; scopes: Scope[]; grantedScopes?: Scope[]; reason?: string; employeeId?: string };
export function IdentityTracking() {
  const [id, setId] = useState(""); const [token, setToken] = useState("");
  const [data, setData] = useState<Tracking | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function load(key: string, secret: string) { setBusy(true); setData(null); setError(""); try { setData(await identityApi<Tracking>(`applications/${encodeURIComponent(key)}`, undefined, { "x-tracking-token": secret })); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); } }
  useEffect(() => { const hash = new URLSearchParams(window.location.hash.slice(1)); const key = hash.get("id") ?? "", secret = hash.get("token") ?? ""; setId(key); setToken(secret); if (key && secret) void load(key, secret); }, []);
  return <main className="identity-page"><section className="identity-card"><Link href="/login">← Đăng nhập</Link><h1>Theo dõi đơn cấp ID</h1><p>Mở liên kết riêng trong biên nhận hoặc nhập mã và khóa theo dõi.</p><form className="identity-form" onSubmit={(e) => { e.preventDefault(); void load(id, token); }}><label>Mã đơn<input required value={id} onChange={(e) => { setId(e.target.value); setData(null); }} /></label><label>Khóa theo dõi<input required autoComplete="off" value={token} onChange={(e) => { setToken(e.target.value); setData(null); }} /></label><Button disabled={busy}>{busy ? "Đang tải…" : "Xem trạng thái"}</Button></form>{error && <Alert tone="error">{error}</Alert>}{data && <section className="identity-result" aria-live="polite"><span className="eyebrow">{identityStatus[data.status]}</span><h2>{data.fullName}</h2><p>{data.jobName}</p>{data.reason && <Alert>{data.reason}</Alert>}{data.employeeId ? <><h3>ID chính thức của bạn</h3><p className="issued-id">{data.employeeId}</p><p>ID là mã nhận diện nội bộ, không phải mật khẩu. Đăng nhập bằng tài khoản Google đã dùng để gửi đơn.</p><Link className="button primary" href="/login">Đăng nhập bằng Google</Link></> : <p>Chưa cấp ID. {data.status === "REJECTED" ? "Xem lý do và gửi đơn mới với thông tin phù hợp." : "Quản trị viên sẽ xem xét đơn; dùng nút Xem trạng thái để cập nhật."}</p>}<h3>Phạm vi đã yêu cầu</h3><ScopeList scopes={data.scopes} />{data.grantedScopes && <><h3>Phạm vi Quản trị viên đã duyệt</h3><ScopeList scopes={data.grantedScopes} /></>}{data.status === "REJECTED" && <Link href="/identity/new">Gửi đơn mới</Link>}</section>}</section></main>;
}
