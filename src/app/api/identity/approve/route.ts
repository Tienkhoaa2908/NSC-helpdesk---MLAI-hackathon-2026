import { SupportError } from "@/lib/support-repository";
import { identityApprovalPage } from "@/lib/identity-mailer";
import { approveAccountRequest } from "@/services/account-requests";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    const result = await approveAccountRequest(token);
    return identityApprovalPage({
      titleVi: "Tài khoản đã được cấp",
      titleEn: "Account issued",
      messageVi: `Đã gửi thông tin đăng nhập tới ${result.email}.`,
      messageEn: `Sign-in details were sent to ${result.email}.`,
    }, true);
  } catch (error) {
    if (error instanceof SupportError) {
      const status = error.status === 503 ? 503 : error.status === 409 ? 409 : 400;
      const messages = error.code === "ACCOUNT_APPROVAL_PROCESSING"
        ? ["Yêu cầu này đang được xử lý. Hãy chờ một chút rồi mở lại liên kết.", "This request is being processed. Wait briefly, then reopen the link."]
        : error.code === "ACCOUNT_CREDENTIAL_EMAIL_FAILED"
          ? ["Chưa gửi được thông tin đăng nhập. Tài khoản chưa được kích hoạt; hãy thử lại bằng liên kết này.", "The sign-in details could not be sent. The account has not been activated; try this link again."]
          : error.code === "IDENTITY_EMAIL_NOT_CONFIGURED" || error.code === "IDENTITY_STORAGE_UNAVAILABLE"
            ? ["Hệ thống cấp tài khoản chưa sẵn sàng. Hãy thử lại sau hoặc liên hệ quản trị viên.", "The account service is unavailable. Try again later or contact the system administrator."]
            : ["Liên kết không hợp lệ, đã hết hạn hoặc yêu cầu đã được xử lý.", "This link is invalid, expired, or the request has already been processed."];
      return identityApprovalPage({
        titleVi: "Chưa hoàn tất cấp tài khoản",
        titleEn: "Account issuance not completed",
        messageVi: messages[0],
        messageEn: messages[1],
      }, false, status);
    }
    return identityApprovalPage({
      titleVi: "Chưa hoàn tất cấp tài khoản",
      titleEn: "Account issuance not completed",
      messageVi: "Không thể hoàn tất yêu cầu lúc này. Hãy thử lại sau.",
      messageEn: "The request could not be completed. Please try again later.",
    }, false, 503);
  }
}
