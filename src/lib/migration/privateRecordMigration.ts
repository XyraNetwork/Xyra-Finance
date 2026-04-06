/**
 * Sprint 2 — private-record migration (skeleton).
 *
 * Today, the dApp derives UX partly from many per-tx `UserActivity` receipts plus public `user_scaled_*` mappings.
 * Future sprints can consolidate into a single `PositionNote` and optional on-chain commitment.
 *
 * Enable the Flash-tab UI panel with: NEXT_PUBLIC_SHOW_SPRINT2_MIGRATION_UI=true
 */

export const POSITION_NOTE_SCHEMA_VERSION_V2 = 2;

export type MigrationRecordSummary = {
  programId: string;
  userActivityLikeCount: number;
  positionNoteLikeCount: number;
};

function recordNameOf(r: Record<string, unknown>): string {
  const n =
    (r.recordName as string) ||
    (r.type as string) ||
    (r.recordType as string) ||
    (r.name as string) ||
    '';
  return String(n);
}

/** Heuristic counts from wallet record metadata (decrypted shape varies by adapter). */
export function summarizeLendingRecordsForMigration(
  programId: string,
  records: unknown[] | null | undefined,
): MigrationRecordSummary {
  let userActivityLikeCount = 0;
  let positionNoteLikeCount = 0;
  if (!Array.isArray(records)) {
    return { programId, userActivityLikeCount, positionNoteLikeCount };
  }
  for (const raw of records) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const pid = (r.program_id as string) || (r.programId as string) || '';
    if (pid !== programId) continue;
    const name = recordNameOf(r);
    if (name.includes('UserActivity')) userActivityLikeCount += 1;
    if (name.includes('PositionNote')) positionNoteLikeCount += 1;
  }
  return { programId, userActivityLikeCount, positionNoteLikeCount };
}

export function describeOnChainSchemaVersion(v: number | null | undefined): string {
  if (v == null) return 'Unknown (RPC or key derivation failed).';
  if (v === 0) return 'Not migrated (0) — safe to mint PositionNote once per address.';
  if (v === POSITION_NOTE_SCHEMA_VERSION_V2) return `Migrated flag v${POSITION_NOTE_SCHEMA_VERSION_V2} set on-chain.`;
  return `On-chain schema value ${v} (non-standard for Sprint 2).`;
}
