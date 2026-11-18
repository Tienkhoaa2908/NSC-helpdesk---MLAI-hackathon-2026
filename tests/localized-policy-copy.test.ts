import { describe, expect, it } from "vitest";
import { divisionLabel } from "@/domain/support-divisions";
import { localizeKnownPolicyCopy } from "@/i18n/policy-copy";

describe("known policy copy localization", () => {
  it("translates known deterministic decision text only in English", () => {
    const vi = "Cần làm rõ yêu cầu để hướng dẫn đúng.";
    expect(localizeKnownPolicyCopy(vi, "en")).toBe("More detail is needed to provide the right guidance.");
    expect(localizeKnownPolicyCopy(vi, "vi")).toBe(vi);
  });

  it("preserves rule IDs when translating known policy clauses", () => {
    expect(localizeKnownPolicyCopy(
      "SEC-001: Yêu cầu chứa hoặc xin thông tin xác thực; chỉ giữ bằng chứng đã che.",
      "en",
      true,
    )).toBe("SEC-001: The request contains or asks for credentials; retain only redacted evidence.");
  });

  it("translates known company policy templates without changing their rule code", () => {
    expect(localizeKnownPolicyCopy(
      "COMPANY-WORKPLACE_SAFETY-URGENT: không chờ bổ sung hoặc dùng hướng dẫn tự sửa.",
      "en",
    )).toBe("COMPANY-WORKPLACE_SAFETY-URGENT: do not wait for additional information or use self-repair guidance.");
  });

  it("localizes deterministic company guidance summaries and preserves named topics", () => {
    expect(localizeKnownPolicyCopy("Chuẩn bị yêu cầu nghỉ phép.", "en")).toBe("Prepare for leave request.");
  });

  it("translates fixed question framing while preserving the extracted system name", () => {
    expect(localizeKnownPolicyCopy(
      "Trong PostgreSQL, bạn cần dùng cơ sở dữ liệu hoặc bảng nào? Chỉ nêu tên, không gửi nội dung dữ liệu.",
      "en",
    )).toBe("In PostgreSQL, which database or table do you need? Provide only its name; do not send data content.");
  });

  it("leaves unknown assistant or user prose untouched", () => {
    const unknown = "Tôi cần giúp với bảng công việc chung của nhóm.";
    expect(localizeKnownPolicyCopy(unknown, "en")).toBe(unknown);
    expect(localizeKnownPolicyCopy(unknown, "en", true)).toBe(unknown);
  });
});

describe("support division labels", () => {
  it("localizes display labels without changing division values", () => {
    expect(divisionLabel("IT", "en")).toBe("IT");
    expect(divisionLabel("COMMERCIAL", "en")).toBe("Commercial");
    expect(divisionLabel("HR", "en")).toBe("Human Resources");
    expect(divisionLabel("HR", "vi")).toBe("Ban HR");
  });
});
