import { errorResponse } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET() {
  return errorResponse("GOOGLE_SIGN_IN_DISABLED", "Đăng nhập Google đã được thay bằng ID nhân viên và mật khẩu.", 410);
}
