# File: `tests/hyper/logging.ts`

## Purpose
Shared helper for writing hyper integration trace artifacts to disk.

## Exports
- `writeHyperLog(...)`: writes `.txt` logs under `logs/hyper/<group>/<run-id>/`
- `buildRunId(prefix)`: deterministic timestamped run id
- `toPrettyJson(value)`: readable JSON serializer for log artifacts

## Log Groups
- `pipeline-seam`
- `full-system`
- `reply-evolution`
- `query-system`
- `serendipity`
- `reflection-live`
- `reflection-seeded-history`
