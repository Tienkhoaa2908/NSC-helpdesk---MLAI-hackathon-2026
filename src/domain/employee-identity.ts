import { fieldOptions } from "./catalog";

// Legacy employee IDs remain short slugs. Password accounts use a normalized
// Gmail address as their employee ID.
export const employeeIdPattern = /^(?:[a-z0-9][a-z0-9_-]{0,31}|[a-z0-9][a-z0-9._%+-]{0,63}@gmail\.com)$/;

export function normalizeEmployeeId(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

export function employeeIdentityError(fields: Record<string, string>) {
  if (!fieldOptions.department.includes(fields.department?.trim()))
    return "Chọn phòng ban trước khi gửi yêu cầu.";
  const employeeId = normalizeEmployeeId(fields.employeeId ?? "");
  if (!employeeId)
    return "Nhập mã nhân viên để liên kết yêu cầu với hồ sơ người gửi.";
  if (!employeeIdPattern.test(employeeId))
    return "ID nhân viên phải gồm chữ, số, dấu gạch ngang hoặc gạch dưới (tối đa 32 ký tự), hoặc địa chỉ Gmail đã đăng ký.";
  return "";
}

export function isEmployeeIdentityField(field: string) {
  return field === "department" || field === "employeeId";
}

export function employeeIdentityOnly(fields: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(fields).filter(([field]) => isEmployeeIdentityField(field)),
  );
}
