import type { Repo } from './repo-types'
import { getRepoSshConnectionId } from './execution-host'

/**
 * The question is "does an SSH target hold this row's files", not "what may this client dial", so
 * it resolves the execution host instead of reading the raw `connectionId` field. SSH ownership has
 * two spellings and the raw read is wrong in both directions:
 *
 *   - a row carrying only `executionHostId: 'ssh:<target>'` reads as local;
 *   - a row that declares itself `local` while a stale `connectionId` survives reads as remote.
 *
 * `runtime:<env>` keeps its nested SSH target, while a runtime host with no nested target is a full
 * ORCB install and stays false — as do WSL and local. Callers routing a client-local PTY want
 * `getSshTargetIdForExecutionHost` instead;
 * callers that already hold a resolved launch connection should read that, not re-derive here.
 */
export function repoIsRemote(repo: Pick<Repo, 'connectionId' | 'executionHostId'>): boolean {
  return getRepoSshConnectionId(repo) !== null
}
