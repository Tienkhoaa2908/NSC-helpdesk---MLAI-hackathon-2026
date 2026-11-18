import { fieldOptions } from "@/domain/catalog";
import { optionName } from "@/domain/presentation";
import { localized, useLocale } from "@/i18n/locale";

export function EmployeeIdentityFields({
  fields,
  onChange,
  lockedId,
}: {
  fields: Record<string, string>;
  onChange: (fields: Record<string, string>) => void;
  lockedId?: string;
}) {
  const { locale } = useLocale();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label>
        {localized("Phòng ban", "Department", locale)} <span aria-hidden="true">*</span>
        <select
          aria-label={localized("Phòng ban", "Department", locale)}
          data-guide="sender-department"
          aria-required="true"
          required
          value={fields.department ?? ""}
          onChange={(event) =>
            onChange({ ...fields, department: event.target.value })
          }
        >
          <option value="">{localized("Chọn phòng ban", "Select a department", locale)}</option>
          {fieldOptions.department.map((department) => (
            <option key={department} value={department}>
              {optionName(department, locale)}
            </option>
          ))}
        </select>
        <span className="field-hint">{localized("Bắt buộc trước khi gửi yêu cầu.", "Required before submitting a request.", locale)}</span>
      </label>
      <label>
        {localized("Mã nhân viên", "Employee ID", locale)} <span aria-hidden="true">*</span>
        <input
          aria-label={localized("Mã nhân viên", "Employee ID", locale)}
          type="text"
          maxLength={254}
          pattern="(?:[A-Za-z0-9][A-Za-z0-9_-]{0,31}|[A-Za-z0-9][A-Za-z0-9._%+-]{0,63}@gmail\\.com)"
          autoCapitalize="none"
          autoComplete="off"
          aria-required="true"
          required
          value={fields.employeeId ?? ""}
          readOnly={!!lockedId}
          onChange={(event) =>
            onChange({ ...fields, employeeId: event.target.value })
          }
        />
        <span className="field-hint">{lockedId ? localized("ID từ phiên hiện tại; đăng xuất để đổi ID.", "ID from the current session; sign out to change it.", locale) : localized("Dùng ID demo hoặc Gmail đã đăng ký. ID demo chưa xác minh danh tính.", "Use a demo ID or a registered Gmail address. Demo IDs do not verify identity.", locale)}</span>
      </label>
    </div>
  );
}
