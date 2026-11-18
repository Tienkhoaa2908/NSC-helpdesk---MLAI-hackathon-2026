import { z } from "zod";

export const loginIdSchema = z.string().trim().min(3).max(254).transform((value) => value.toLowerCase());

export const accountRequestSchema = z.object({
  fullName: z.string().trim().min(2).max(120).transform((value) => value.normalize("NFC").replace(/\s+/g, " ")),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase())
    .refine((value) => value.endsWith("@gmail.com"), "Chỉ chấp nhận địa chỉ Gmail."),
}).strict();

export const passwordLoginSchema = z.object({
  employeeId: loginIdSchema,
  password: z.string().min(1).max(128),
  next: z.string().max(256).optional(),
}).strict();

export type AccountRole = "requester";
export type AccountStatus = "ACTIVE" | "PENDING_DELIVERY" | "DISABLED";

export type PasswordAccount = {
  id: string;
  loginId: string;
  email: string;
  fullName: string;
  passwordHash: string;
  role: AccountRole;
  kind: "demo" | "employee";
  status: AccountStatus;
  applicationId: string;
  createdAt: string;
  updatedAt: string;
};

export type AccountRequest = {
  id: string;
  fullName: string;
  email: string;
  status: "PENDING" | "APPROVED";
  notificationStatus: "PENDING" | "SENT" | "FAILED";
  approvalTokenHash: string | null;
  approvalExpiresAt: Date;
  processingUntil?: Date;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  accountId?: string;
};
