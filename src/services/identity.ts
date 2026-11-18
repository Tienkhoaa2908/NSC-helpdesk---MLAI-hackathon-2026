import { randomUUID } from "node:crypto";
import type { ClientSession, Db } from "mongodb";
import type { IdentityAudit } from "@/domain/identity";

/** Shared audit writer used by the active demo-authority endpoints. */
export async function identityAudit(
  db: Db,
  session: ClientSession,
  actor: string,
  action: string,
  subject: string,
  reason: string,
  version?: number,
) {
  await db.collection<IdentityAudit>("identity_audit").insertOne({
    id: randomUUID(),
    at: new Date().toISOString(),
    actor,
    action,
    subject,
    reason,
    version,
  }, { session });
}
