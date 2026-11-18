import type { VerifyRun } from "@/domain/verification";
import type { DemoVerifyGrant } from "./support-data-scope";
import { judgePackIds, supportVerifyCases } from "./support-verify";
import { supportDatabase, SupportError } from "./support-repository";
const runtime = globalThis as typeof globalThis & {
  supportVerifyRuns?: Map<string, VerifyRun>;
};
const memory = () =>
  (runtime.supportVerifyRuns ??= new Map<string, VerifyRun>());
export async function insertVerifyRun(run: VerifyRun) {
  const db = supportDatabase();
  if (db) await db.collection<VerifyRun>("v3_verify_runs").insertOne(run);
  else memory().set(run.id, structuredClone(run));
  return run;
}
export async function getVerifyRun(id: string): Promise<VerifyRun> {
  const db = supportDatabase();
  const run = db
    ? await db
        .collection<VerifyRun>("v3_verify_runs")
        .findOne({ id }, { projection: { _id: 0 } })
    : memory().get(id);
  if (!run)
    throw new SupportError("NOT_FOUND", "Không tìm thấy lần kiểm thử.", 404);
  return structuredClone(run);
}
export async function listVerifyRuns() {
  const db = supportDatabase();
  const rows = db
    ? await db
        .collection<VerifyRun>("v3_verify_runs")
        .find({}, { projection: { _id: 0 } })
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray()
    : [...memory().values()]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 20);
  return rows.map((run) => ({
    id: run.id,
    pack: run.pack,
    status: run.status,
    createdAt: run.createdAt,
    completed: run.results.length,
    total: run.cases.length,
    passed: run.results.filter((r) => r.pass).length,
  }));
}

/**
 * Public demo reviewers may inspect only support rows created from the
 * server-owned Verify cases. Match the run's pack and case IDs before
 * granting access to a persisted request ID.
 */
export async function listDemoVerifyGrants(): Promise<DemoVerifyGrant[]> {
  const db = supportDatabase();
  const runs = db
    ? await db
        .collection<VerifyRun>("v3_verify_runs")
        .find({ pack: { $in: [...judgePackIds] } }, { projection: { _id: 0 } })
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray()
    : [...memory().values()]
        .filter((run) => judgePackIds.includes(run.pack))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 20);
  const knownCasesByPack = new Map<string, Set<string>>();
  for (const item of supportVerifyCases) {
    const knownCases = knownCasesByPack.get(item.pack) ?? new Set<string>();
    knownCases.add(item.id);
    knownCasesByPack.set(item.pack, knownCases);
  }
  return runs.map((run) => ({
    runId: run.id,
    cases: run.cases.filter((item) => knownCasesByPack.get(run.pack)?.has(item.caseId)),
  }));
}

export async function updateVerifyRun(
  id: string,
  update: (run: VerifyRun) => void,
) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const run = await getVerifyRun(id),
      version = run.version;
    update(run);
    run.version++;
    run.updatedAt = new Date().toISOString();
    const db = supportDatabase();
    if (db) {
      const result = await db
        .collection<VerifyRun>("v3_verify_runs")
        .replaceOne({ id, version }, run);
      if (!result.matchedCount) continue;
    } else {
      if (memory().get(id)?.version !== version) continue;
      memory().set(id, structuredClone(run));
    }
    return run;
  }
  throw new SupportError(
    "VERSION_CONFLICT",
    "Lần kiểm thử đang cập nhật. Tải lại để tiếp tục.",
    409,
  );
}
