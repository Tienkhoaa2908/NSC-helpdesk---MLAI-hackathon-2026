"use client";
import { useId } from "react";
import { useLocale, localized } from "@/i18n/locale";

const panels = {
  sender: {
    title: ["Người gửi yêu cầu", "Submit a request"],
    rows: [["① Mô tả vấn đề  ·  Chọn theo danh mục", "① Describe issue · Choose a category"], ["② Nhóm hỗ trợ: Tôi chưa biết nhóm nào", "② Support area: Not sure"], ["③ VPN không kết nối, tôi nên kiểm tra gì?", "③ VPN will not connect. What should I check?"]],
    button: ["Gửi", "Submit"],
    caption: ["Nhập tình huống → bấm Gửi → kiểm tra và xác nhận", "Describe the issue → submit → review and confirm"],
  },
  feedback: {
    title: ["Đọc phản hồi và làm theo hướng dẫn", "Review guidance and try safe steps"],
    rows: [["Chẩn đoán khả dĩ và các bước hỗ trợ", "Suggested checks and next steps"], ["A. Tôi đã làm được     B. Vẫn còn lỗi", "A. Resolved  B. Still failing"], ["C. Giải thích bước này     D. Chuyển nhân viên", "C. Explain a step  D. Ask staff"]],
    button: ["Gửi câu hỏi", "Send a question"],
    caption: ["Chọn phản hồi phù hợp hoặc nhập câu hỏi tiếp theo", "Choose an outcome or ask a follow-up question"],
  },
  reviewer: {
    title: ["Admin · xử lý yêu cầu", "Admin · Review a request"],
    rows: [["① Mở một yêu cầu trong danh sách", "① Open a request from the list"], ["② Đọc nội dung, bằng chứng và rủi ro", "② Review text, evidence, and risk"], ["③ Nhập lý do cho quyết định của bạn", "③ Add a reason for your decision"]],
    button: ["Hỏi thêm thông tin", "Request more information"],
    caption: ["Chọn thao tác được phép → xem lịch sử xử lý", "Choose an allowed action → check the history"],
  },
} as const;

export function GuideIllustration({ kind }: { kind: keyof typeof panels }) {
  const id = useId();
  const { locale } = useLocale();
  const t = (value: readonly [string, string]) => localized(value[0], value[1], locale);
  const panel = panels[kind];
  const title = t(panel.title);
  const button = t(panel.button);
  return (
    <figure className="guide-figure">
      <svg viewBox="0 0 560 255" role="img" aria-labelledby={`${id}-title`}>
        <title id={`${id}-title`}>{localized(`${panel.title[0]}. Mũi tên đỏ chỉ nút ${panel.button[0]}.`, `${panel.title[1]}. The red arrow points to ${panel.button[1]}.`, locale)}</title>
        <defs>
          <marker id={`${id}-arrow`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626" />
          </marker>
        </defs>
        <rect x="2" y="2" width="556" height="250" rx="20" fill="#fff8f3" stroke="#f7c5ad" />
        <rect x="20" y="18" width="520" height="218" rx="13" fill="white" stroke="#e3e5e8" />
        <circle cx="39" cy="36" r="5" fill="#f05a22" />
        <text x="53" y="41" fill="#202124" fontSize="16" fontWeight="800">{title}</text>
        {panel.rows.map((row, index) => (
          <g key={row[0]}>
            <rect x="35" y={56 + index * 39} width="490" height="32" rx="7" fill={index === 2 ? "#fff7ed" : "#f5f5f4"} />
            <text x="46" y={77 + index * 39} fill="#404040" fontSize="14">{t(row)}</text>
          </g>
        ))}
        <rect x="35" y="182" width="190" height="37" rx="10" fill="#f05a22" />
        <text x="130" y="206" textAnchor="middle" fill="white" fontSize="15" fontWeight="800">{button}</text>
        <path d="M 401 184 Q 325 227 236 202" fill="none" stroke="#dc2626" strokeWidth="4" strokeLinecap="round" markerEnd={`url(#${id}-arrow)`} />
        <text x="404" y="181" fill="#b91c1c" fontSize="14" fontWeight="800">{localized("Bấm ở đây", "Click here", locale)}</text>
      </svg>
      <figcaption>{t(panel.caption)}</figcaption>
    </figure>
  );
}
