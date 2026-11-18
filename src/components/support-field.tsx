import { fieldOptions, labelForField } from "@/domain/catalog";
import { optionName } from "@/domain/presentation";
import { hintFor } from "@/domain/questions";
import { Input } from "./ui";
import { localized, useLocale } from "@/i18n/locale";
export function SupportField({
  field,
  value,
  onChange,
}: {
  field: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { locale } = useLocale();
  const name = field === "verifiedApproval" ? "approvalReference" : field;
  return (
    <label>
      {labelForField(name, locale)}
      {fieldOptions[name] ? (
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">{localized("Tôi không biết / chưa cung cấp", "I don't know / not provided", locale)}</option>
          {fieldOptions[name].map((option) => (
            <option key={option} value={option}>
              {optionName(option, locale)}
            </option>
          ))}
        </select>
      ) : (
        <Input
          value={value}
          maxLength={300}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      <span className="field-hint">{hintFor(field, locale)}</span>
    </label>
  );
}
