import { AsyncLocalStorage } from "node:async_hooks";
import type { Filter } from "mongodb";

export type DemoVerifyGrant = {
  runId: string;
  cases: Array<{ caseId: string; requestId: string }>;
};

export type SupportRequestScope =
  | { mode: "all" }
  | { mode: "verify-only"; grants: DemoVerifyGrant[] };

const scopeStorage = new AsyncLocalStorage<SupportRequestScope>();

export function withSupportRequestScope<T>(
  scope: SupportRequestScope,
  work: () => Promise<T>,
): Promise<T> {
  return scopeStorage.run(scope, work);
}

export function currentSupportRequestScope(): SupportRequestScope {
  return scopeStorage.getStore() ?? { mode: "all" };
}

export function isVerifyOnlySupportScope() {
  return currentSupportRequestScope().mode === "verify-only";
}

export function supportRequestIsInScope(row: {
  id: string;
  input: { verifyRunId?: string; verifyCaseId?: string };
}): boolean {
  const scope = currentSupportRequestScope();
  if (scope.mode === "all") return true;
  return scope.grants.some((grant) =>
    grant.runId === row.input.verifyRunId &&
    grant.cases.some((item) => item.caseId === row.input.verifyCaseId && item.requestId === row.id),
  );
}

export function supportRequestIdIsInScope(id: string): boolean {
  const scope = currentSupportRequestScope();
  if (scope.mode === "all") return true;
  return scope.grants.some((grant) => grant.cases.some((item) => item.requestId === id));
}

export function supportRequestScopeFilter<T>(): Filter<T> {
  const scope = currentSupportRequestScope();
  if (scope.mode === "all") return {};
  if (!scope.grants.length) return { _id: { $in: [] } } as unknown as Filter<T>;
  return {
    $or: scope.grants.map((grant) => ({
      "data.input.verifyRunId": grant.runId,
      $or: grant.cases.map((item) => ({
        _id: item.requestId,
        "data.input.verifyCaseId": item.caseId,
      })),
    })),
  } as unknown as Filter<T>;
}

export function constrainSupportRequestFilter<T>(
  filter: Filter<T>,
): Filter<T> {
  const scopeFilter = supportRequestScopeFilter<T>();
  if (!Object.keys(scopeFilter).length) return filter;
  if (!Object.keys(filter).length) return scopeFilter;
  return { $and: [scopeFilter, filter] } as Filter<T>;
}

export function resetSupportRequestScopeForTest() {
  if (process.env.NODE_ENV !== "test") throw new Error("TEST_ONLY");
  scopeStorage.disable();
}
