import * as oidc from "openid-client";
import { randomBytes } from "node:crypto";
import { identityAudit, identityHash } from "@/services/identity";
import { identityStore, identityTransaction } from "./identity-store";
import { SupportError } from "./support-repository";

const GOOGLE_ISSUER = "https://accounts.google.com";
const CALLBACK_PATH = "/api/identity/google/callback";
const FLOW_COOKIE = "vng_google_login";
const FLOW_LIFETIME_MS = 10 * 60_000;
type GoogleLoginTransaction = {
  hash: string; state: string; nonce: string; verifier: string; returnTo: string;
  appOrigin: string;
  createdAt: Date; expiresAt: Date;
};
type GoogleConfig = { config: oidc.Configuration; clientId: string; redirectUri: string };
const runtime = globalThis as typeof globalThis & { googleOidc?: { key: string; promise: Promise<GoogleConfig> } };

function configurationValues() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri)
    throw new SupportError("GOOGLE_OAUTH_NOT_CONFIGURED", "Đăng nhập Google chưa được cấu hình. Liên hệ quản trị viên hệ thống.", 503);
  const redirect = URL.parse(redirectUri);
  if (!redirect || redirect.username || redirect.password || redirect.hash || redirect.search || redirect.pathname !== CALLBACK_PATH ||
      (process.env.NODE_ENV === "production" ? redirect.protocol !== "https:" : !["https:", "http:"].includes(redirect.protocol)))
    throw new SupportError("GOOGLE_OAUTH_MISCONFIGURED", "Địa chỉ callback Google không hợp lệ. Liên hệ quản trị viên hệ thống.", 503);
  return { clientId, clientSecret, redirectUri: redirect.toString() };
}

export async function googleOidcConfiguration(): Promise<GoogleConfig> {
  const { clientId, clientSecret, redirectUri } = configurationValues();
  const key = `${clientId}\u0000${clientSecret}\u0000${redirectUri}`;
  if (!runtime.googleOidc || runtime.googleOidc.key !== key) {
    runtime.googleOidc = {
      key,
      promise: oidc.discovery(
        new URL(GOOGLE_ISSUER),
        clientId,
        { client_secret: clientSecret },
        oidc.ClientSecretPost(clientSecret),
        { timeout: 5 },
      ).then((config) => ({ config, clientId, redirectUri })),
    };
  }
  return runtime.googleOidc.promise;
}

export function googleFlowCookieName() { return FLOW_COOKIE; }
export function googleFlowCookie(value: string, clear = false) {
  return `${FLOW_COOKIE}=${value}; HttpOnly; SameSite=Lax; Path=/api/identity/google; Max-Age=${clear ? 0 : 600}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
export function googleFlowId(request: Request) {
  const value = request.headers.get("cookie")?.split(";").map((item) => item.trim())
    .find((item) => item.startsWith(`${FLOW_COOKIE}=`))?.slice(FLOW_COOKIE.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export function safeIdentityReturnTo(value: unknown) {
  return value === "/identity/new" || value === "/identity/review" ? value : "/send-help";
}

export async function startGoogleAuthorization(returnTo: string) {
  const { config, redirectUri } = await googleOidcConfiguration();
  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const verifier = oidc.randomPKCECodeVerifier();
  const challenge = await oidc.calculatePKCECodeChallenge(verifier);
  const flowId = randomBytes(32).toString("hex");
  const now = new Date();
  const transaction: GoogleLoginTransaction = {
    hash: identityHash(flowId), state, nonce, verifier, returnTo: safeIdentityReturnTo(returnTo), appOrigin: new URL(redirectUri).origin,
    createdAt: now, expiresAt: new Date(now.getTime() + FLOW_LIFETIME_MS),
  };
  await identityTransaction(async (db, session) => {
    await db.collection<GoogleLoginTransaction>("identity_oauth_transactions").insertOne(transaction, { session });
    await identityAudit(db, session, "google-oauth", "GOOGLE_LOGIN_STARTED", "google-oauth", "Google authorization code flow started.");
  });
  const authorizationUrl = oidc.buildAuthorizationUrl(config, {
    redirect_uri: redirectUri,
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return { flowId, authorizationUrl: authorizationUrl.toString() };
}

export async function consumeGoogleAuthorization(flowId: string) {
  const { db } = await identityStore();
  const result = await db.collection<GoogleLoginTransaction>("identity_oauth_transactions").findOneAndDelete({
    hash: identityHash(flowId), expiresAt: { $gt: new Date() },
  });
  return result ?? null;
}

export async function exchangeGoogleAuthorizationCode(requestUrl: URL, transaction: GoogleLoginTransaction) {
  const { config, clientId, redirectUri } = await googleOidcConfiguration();
  const callbackUrl = new URL(redirectUri);
  callbackUrl.search = requestUrl.search;
  const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
    pkceCodeVerifier: transaction.verifier,
    expectedState: transaction.state,
    expectedNonce: transaction.nonce,
    idTokenExpected: true,
  });
  const claims = tokens.claims();
  if (!claims) throw new SupportError("GOOGLE_IDENTITY_INVALID", "Google không trả về danh tính đăng nhập.", 401);
  return verifiedGoogleClaims(claims as unknown as Record<string, unknown>, clientId);
}

export type VerifiedGoogleIdentity = { sub: string; email: string; name: string };
export function verifiedGoogleClaims(
  claims: Record<string, unknown>,
  clientId: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): VerifiedGoogleIdentity {
  const audience = typeof claims.aud === "string" ? [claims.aud] : Array.isArray(claims.aud) ? claims.aud : [];
  const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
  const allowedDomain = (process.env.GOOGLE_ALLOWED_DOMAIN?.trim().toLowerCase() || "gmail.com").replace(/^@/, "");
  const emailDomain = email.slice(email.lastIndexOf("@") + 1);
  const domainValid = emailDomain === allowedDomain &&
    (allowedDomain === "gmail.com" || typeof claims.hd === "string" && claims.hd.toLowerCase() === allowedDomain);
  const issuerValid = claims.iss === GOOGLE_ISSUER;
  const timeValid = typeof claims.exp === "number" && claims.exp > nowSeconds &&
    typeof claims.iat === "number" && claims.iat <= nowSeconds + 60 &&
    (claims.nbf === undefined || typeof claims.nbf === "number" && claims.nbf <= nowSeconds + 30);
  const authorizedPartyValid = claims.azp === undefined || claims.azp === clientId;
  if (!issuerValid || !audience.includes(clientId) || !timeValid || !authorizedPartyValid ||
      claims.email_verified !== true || typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !domainValid)
    throw new SupportError("GOOGLE_IDENTITY_INVALID", "Tài khoản Google chưa được xác minh hoặc không thuộc domain được phép.", 401);
  const name = typeof claims.name === "string" && claims.name.trim() ? claims.name.trim().slice(0, 120) : email.split("@")[0];
  return { sub: claims.sub, email, name };
}
