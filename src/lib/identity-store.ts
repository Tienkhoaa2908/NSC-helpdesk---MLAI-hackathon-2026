import { MongoClient, type ClientSession, type Db } from "mongodb";
import { SupportError } from "./support-repository";
import { demoAuthorityValidators } from "./demo-authority-validation";

const runtime = globalThis as typeof globalThis & { identityMongo?: { uri: string; name: string; client: MongoClient }; identityIndexes?: Promise<void> };
const validators = {
  identity_employees: { required: ["id", "fullName", "status", "profileId", "profileVersion", "roles", "applicationId", "createdAt"], properties: { department: { enum: ["it", "engineering", "product", "sales", "marketing", "finance", "human_resources", "operations", "other"] }, googleSub: { bsonType: "string", minLength: 1 }, email: { bsonType: "string", minLength: 3 }, id: { bsonType: "string", pattern: "^[a-z0-9][a-z0-9_-]{0,31}$" }, fullName: { bsonType: "string" }, status: { enum: ["ACTIVE", "DISABLED"] }, profileId: { bsonType: "string" }, profileVersion: { bsonType: "number", minimum: 1 }, roles: { bsonType: "array", items: { enum: ["identity-admin"] }, uniqueItems: true }, applicationId: { bsonType: "string" }, createdAt: { bsonType: "string" } } },
  identity_profiles: { required: ["id", "version", "name", "scopes", "active", "createdAt", "createdBy"], properties: { id: { bsonType: "string" }, version: { bsonType: "number", minimum: 1 }, name: { bsonType: "string" }, scopes: { bsonType: "array", minItems: 1, maxItems: 30, items: { bsonType: "object", required: ["environment", "resource", "operation", "target"], properties: { environment: { enum: ["sandbox", "staging", "production"] }, resource: { enum: ["project", "repository", "logs", "database", "cloud", "configuration", "secrets", "keys", "administration"] }, operation: { enum: ["read", "create", "update", "delete", "execute", "approve", "configure", "export", "rotate", "revoke"] }, target: { bsonType: "string", minLength: 2, maxLength: 120, pattern: "^[a-zA-Z0-9][a-zA-Z0-9_./:-]*$" } }, additionalProperties: false } }, active: { bsonType: "bool" }, createdAt: { bsonType: "string" }, createdBy: { bsonType: "string" } } },
  identity_applications: { required: ["id", "fullName", "applicant", "job", "requestedScopes", "trackingHash", "fingerprint", "status", "version", "createdAt", "updatedAt"], properties: { id: { bsonType: "string" }, fullName: { bsonType: "string" }, applicant: { bsonType: "object", required: ["sub", "email"], properties: { sub: { bsonType: "string", minLength: 1 }, email: { bsonType: "string", minLength: 3 } } }, job: { bsonType: "object" }, requestedScopes: { bsonType: "array", minItems: 1, maxItems: 30 }, trackingHash: { bsonType: "string", pattern: "^[a-f0-9]{64}$" }, fingerprint: { bsonType: "string" }, status: { enum: ["PENDING", "ID_CONFLICT", "APPROVED", "REJECTED"] }, version: { bsonType: "number", minimum: 0 }, createdAt: { bsonType: "string" }, updatedAt: { bsonType: "string" } } },
  identity_audit: { required: ["id", "at", "actor", "action", "subject", "reason"], properties: { id: { bsonType: "string" }, at: { bsonType: "string" }, actor: { bsonType: "string" }, action: { bsonType: "string" }, subject: { bsonType: "string" }, reason: { bsonType: "string" } } },
  identity_oauth_transactions: { required: ["hash", "state", "nonce", "verifier", "returnTo", "appOrigin", "createdAt", "expiresAt"], properties: { hash: { bsonType: "string", pattern: "^[a-f0-9]{64}$" }, state: { bsonType: "string" }, nonce: { bsonType: "string" }, verifier: { bsonType: "string" }, returnTo: { bsonType: "string" }, appOrigin: { bsonType: "string" }, createdAt: { bsonType: "date" }, expiresAt: { bsonType: "date" } } },
  identity_password_accounts: { required: ["id", "loginId", "email", "fullName", "passwordHash", "role", "kind", "status", "applicationId", "createdAt", "updatedAt"], properties: { id: { bsonType: "string" }, loginId: { bsonType: "string", minLength: 3, maxLength: 254, pattern: "^(guest[0-9]{2}|[^\\s@]+@[^\\s@]+\\.[^\\s@]+)$" }, email: { bsonType: "string", minLength: 3, maxLength: 254 }, fullName: { bsonType: "string", minLength: 2, maxLength: 120 }, passwordHash: { bsonType: "string", pattern: "^\\$2[aby]\\$[0-9]{2}\\$[./A-Za-z0-9]{53}$" }, role: { enum: ["requester"] }, kind: { enum: ["demo", "employee"] }, status: { enum: ["ACTIVE", "PENDING_DELIVERY", "DISABLED"] }, applicationId: { bsonType: "string" }, credentialEnvelope: { bsonType: "object", required: ["version", "iv", "ciphertext", "authTag"], properties: { version: { bsonType: "number", enum: [1] }, iv: { bsonType: "string" }, ciphertext: { bsonType: "string" }, authTag: { bsonType: "string" } } }, createdAt: { bsonType: "string" }, updatedAt: { bsonType: "string" } } },
  identity_account_requests: { required: ["id", "fullName", "email", "status", "notificationStatus", "approvalTokenHash", "approvalExpiresAt", "createdAt", "updatedAt"], properties: { id: { bsonType: "string" }, fullName: { bsonType: "string", minLength: 2, maxLength: 120 }, email: { bsonType: "string", minLength: 3, maxLength: 254 }, status: { enum: ["PENDING", "APPROVED"] }, notificationStatus: { enum: ["PENDING", "SENT", "FAILED"] }, approvalTokenHash: { bsonType: ["string", "null"], pattern: "^[a-f0-9]{64}$" }, approvalExpiresAt: { bsonType: "date" }, processingUntil: { bsonType: "date" }, createdAt: { bsonType: "string" }, updatedAt: { bsonType: "string" }, approvedAt: { bsonType: "string" }, accountId: { bsonType: "string" } } },
} as const;
async function initializeIdentity(db: Db) {
  for (const [name, schema] of Object.entries({ ...validators, ...demoAuthorityValidators })) {
    const validator = { $jsonSchema: { bsonType: "object", ...schema } };
    try { await db.createCollection(name, { validator, validationLevel: "strict", validationAction: "error" }); }
    catch (error) {
      if ((error as { code?: number }).code !== 48) throw error;
      // The app user is intentionally limited to readWrite. Updating validators
      // on every cold start would require the broader dbAdmin collMod privilege.
    }
  }
}
export async function identityStore(): Promise<{ db: Db; client: MongoClient }> {
  const uri = process.env.IDENTITY_MONGODB_URI?.trim() || process.env.MONGODB_URI?.trim();
  const name = process.env.IDENTITY_MONGODB_DB?.trim() || process.env.MONGODB_DB?.trim() || "nsclub_support_desk";
  if (!uri) throw new SupportError("IDENTITY_STORAGE_UNAVAILABLE", "Hệ thống tài khoản chưa sẵn sàng. Kiểm tra cấu hình hoặc thử lại sau.", 503);
  try {
    if (!runtime.identityMongo || runtime.identityMongo.uri !== uri || runtime.identityMongo.name !== name) {
      await runtime.identityMongo?.client.close();
      runtime.identityMongo = { uri, name, client: new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 5000, ignoreUndefined: true }) };
      runtime.identityIndexes = undefined;
    }
    const client = runtime.identityMongo.client;
    const db = client.db(name);
    await client.connect();
    await db.command({ ping: 1 });
    runtime.identityIndexes ??= initializeIdentity(db).then(() => Promise.all([
      db.collection("identity_employees").createIndex({ id: 1 }, { unique: true }),
      db.collection("identity_employees").createIndex({ googleSub: 1 }, { unique: true, partialFilterExpression: { googleSub: { $type: "string" } } }),
      db.collection("identity_demo_pool").createIndex({ id: 1 }, { unique: true }),
      db.collection("identity_demo_grants").createIndex({ id: 1 }, { unique: true }),
      db.collection("identity_demo_grants").createIndex({ employeeId: 1, status: 1, expiresAt: 1 }),
      db.collection("identity_profiles").createIndex({ id: 1, version: 1 }, { unique: true }),
      db.collection("identity_applications").createIndex({ id: 1 }, { unique: true }),
      db.collection("identity_applications").createIndex({ status: 1, createdAt: -1 }),
      db.collection("identity_applications").createIndex({ "applicant.sub": 1 }, { unique: true, partialFilterExpression: { "applicant.sub": { $type: "string" }, status: { $in: ["PENDING", "ID_CONFLICT"] } } }),
      db.collection("identity_oauth_transactions").createIndex({ hash: 1 }, { unique: true }),
      db.collection("identity_oauth_transactions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db.collection("identity_audit").createIndex({ subject: 1, at: -1 }),
      db.collection("identity_sessions").createIndex({ hash: 1 }, { unique: true }),
      db.collection("identity_sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db.collection("identity_password_accounts").createIndex({ loginId: 1 }, { unique: true }),
      db.collection("identity_password_accounts").createIndex({ applicationId: 1 }, { unique: true, partialFilterExpression: { kind: "employee" } }),
      db.collection("identity_account_requests").createIndex({ id: 1 }, { unique: true }),
      db.collection("identity_account_requests").createIndex({ email: 1 }, { unique: true, partialFilterExpression: { status: "PENDING" } }),
      db.collection("identity_account_requests").createIndex({ approvalTokenHash: 1 }, { unique: true, partialFilterExpression: { approvalTokenHash: { $type: "string" } } }),
      db.collection("identity_account_requests").createIndex({ status: 1, createdAt: -1 }),
      db.collection("identity_limits").createIndex({ key: 1 }, { unique: true }),
      db.collection("identity_limits").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ])).then(() => undefined).catch((error: unknown) => { runtime.identityIndexes = undefined; throw error; });
    await runtime.identityIndexes;
    return { db, client };
  } catch {
    throw new SupportError("IDENTITY_STORAGE_UNAVAILABLE", "MongoDB của hệ thống ID không khả dụng. Chưa xác nhận lưu; thử lại cùng đơn khi IT khôi phục kết nối.", 503);
  }
}
export async function identityTransaction<T>(work: (db: Db, session: ClientSession) => Promise<T>): Promise<T> {
  const { db, client } = await identityStore();
  const session = client.startSession();
  try {
    return await session.withTransaction(() => work(db, session), { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
  } finally { await session.endSession(); }
}
