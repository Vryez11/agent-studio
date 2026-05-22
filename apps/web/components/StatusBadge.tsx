import type { RunStatus, StageStatus } from '@agent-studio/shared';

export function StatusBadge({
  status,
}: {
  status: RunStatus | StageStatus;
}) {
  return <span className={`badge ${status}`}>{status}</span>;
}
