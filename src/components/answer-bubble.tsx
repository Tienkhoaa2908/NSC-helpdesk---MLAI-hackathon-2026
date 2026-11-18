import type { ReactNode } from "react";
import type { Assistance } from "@/domain/contracts";
import { localized, useLocale } from "@/i18n/locale";
export function AnswerBubble({
  item,
  children,
  audience = "employee",
}: {
  item: Assistance;
  children?: ReactNode;
  audience?: "employee" | "reviewer";
}) {
  const { locale } = useLocale();
  // Older saved answers may have cacheHit but predate the distinct cache source.
  const cached = item.source === "cache" || item.answer?.cacheHit === true;
  return (
    <div className="assistant-reveal" aria-live="polite">
        <article className="assistant-bubble" aria-label={localized("Câu trả lời của trợ lý", "Assistant response", locale)}>
        <p className="assistant-byline">
          ✦{" "}
          {audience === "employee" && item.source !== "mock"
            ? "VNG Support"
            : cached
              ? localized("VNG Support · Câu trả lời từ bộ nhớ đệm", "VNG Support · Cached response", locale)
              : item.source === "openai" || item.source === "gemini"
                ? localized("VNG Support · AI trả lời", "VNG Support · AI response", locale)
                : item.source === "mock"
                  ? localized("VNG Support · Câu trả lời mẫu", "VNG Support · Sample response", locale)
                  : localized("VNG Support · Hướng dẫn đã kiểm duyệt", "VNG Support · Reviewed guidance", locale)}
        </p>
        {item.fallbackReason && !item.answer && (
          <p className="assistant-note" role="status">
            {localized("Đang dùng hướng dẫn đã kiểm duyệt vì AI chưa trả về kết quả hợp lệ. Bạn vẫn có thể làm theo các bước an toàn hoặc nhờ nhân viên hỗ trợ.", "Reviewed guidance is shown because the AI did not return a valid response. You can follow the safe steps or ask support staff for help.", locale)}
            {audience === "reviewer" && (
              <span className="block">{localized("Mã lý do:", "Reason code:", locale)} {item.fallbackReason}</span>
            )}
          </p>
        )}
        {item.answer ? (
          <>
            <div className="assistant-text">{item.answer.text}</div>
            {cached && audience === "reviewer" && (
              <p className="assistant-note">
                {localized("Câu trả lời đã lưu được kiểm tra lại trước khi dùng. Không gọi AI để tạo lại nội dung này trong lượt hiện tại.", "The saved response was revalidated before use. The AI was not called to regenerate it for this request.", locale)}
              </p>
            )}
            {item.answer.scopeNotice && (
              <p className="assistant-note">{item.answer.scopeNotice}</p>
            )}
            {item.answer.fallbackReason &&
              item.answer.fallbackReason !== "INTERNAL_POLICY_UNVERIFIED" && (
                <p className="assistant-note">
                  {localized("AI đang tạm không sẵn sàng. Đây là hướng dẫn có sẵn, câu hỏi chưa được chuyển cho nhân viên.", "The AI is temporarily unavailable. This is existing guidance, your question has not been sent to a staff member.", locale)}
                </p>
              )}
            {item.answer.webSearch === "unavailable" && (
              <p className="assistant-note">
                {localized("Chưa tra cứu được web mới nhất, nguồn có sẵn được ghi ngày kiểm tra bên dưới.", "A live web search was unavailable. The available sources and their check dates are listed below.", locale)}
              </p>
            )}
            {item.answer.sources.length > 0 && (
              <details className="assistant-sources">
                <summary>
                  {localized("Nguồn tham khảo (" + item.answer.sources.length + ")", "Sources (" + item.answer.sources.length + ")", locale)}
                </summary>
                <ul>
                  {item.answer.sources.map((source) => (
                    <li key={source.url}>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {source.title}
                      </a>
                      <span>
                        {" "}
                        ·{" "}
                        {source.scope === "public"
                          ? localized("Nguồn công khai", "Public source", locale)
                          : localized("Tài liệu dự án", "Project document", locale)}{" "}
                        · {localized("kiểm tra", "checked", locale)} {source.checkedAt.slice(0, 10)}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        ) : (
          children
        )}
      </article>
    </div>
  );
}
