import type { SessionObserverSessionView } from '../../../../shared/session-observer'
import { normalizeRuntimePathSeparators } from '../../../../shared/cross-platform-path'
import type { Repo } from '../../../../shared/repo-types'
import { splitWorktreeIdForFilesystem } from '../../../../shared/worktree/id'

export const UNKNOWN_SESSION_OBSERVER_PROJECT_KEY = 'unknown' as const

export type SessionObserverProjectKey =
  | `repo:${string}`
  | typeof UNKNOWN_SESSION_OBSERVER_PROJECT_KEY

export type SessionObserverProjectFilterOption = {
  key: SessionObserverProjectKey
  label: string
  count: number
  latestUpdatedAt: number
}

export type SessionObserverProjectFilter = {
  options: readonly SessionObserverProjectFilterOption[]
  projectKeyBySessionId: ReadonlyMap<string, SessionObserverProjectKey>
}

type ProjectRepo = Pick<Repo, 'id' | 'displayName' | 'path'>

type ProjectAccumulator = {
  key: SessionObserverProjectKey
  repo: ProjectRepo | null
  fallbackPath: string | null
  count: number
  latestUpdatedAt: number
}

function basename(pathValue: string | null | undefined): string | null {
  if (!pathValue?.trim()) {
    return null
  }
  return (
    normalizeRuntimePathSeparators(pathValue.trim())
      .replace(/\/+$/, '')
      .split('/')
      .findLast(Boolean)
      ?.trim() || null
  )
}

function sessionWorktreePath(session: SessionObserverSessionView): string | null {
  const reportedPath = session.worktreePath?.trim()
  return (
    reportedPath ||
    splitWorktreeIdForFilesystem(session.worktreeId ?? '')?.worktreePath.trim() ||
    null
  )
}

function projectIdentity(
  session: SessionObserverSessionView,
  reposById: ReadonlyMap<string, ProjectRepo>
): { key: SessionObserverProjectKey; repo: ProjectRepo | null; fallbackPath: string | null } {
  const parsed = session.worktreeId ? splitWorktreeIdForFilesystem(session.worktreeId) : null
  const repoId = parsed?.repoId.trim()
  const fallbackPath = sessionWorktreePath(session)
  if (!repoId || (!reposById.has(repoId) && !basename(fallbackPath))) {
    return { key: UNKNOWN_SESSION_OBSERVER_PROJECT_KEY, repo: null, fallbackPath: null }
  }
  return { key: `repo:${repoId}`, repo: reposById.get(repoId) ?? null, fallbackPath }
}

function projectBaseLabel(project: ProjectAccumulator): string {
  if (project.key === UNKNOWN_SESSION_OBSERVER_PROJECT_KEY) {
    return '未知项目'
  }
  return project.repo?.displayName.trim() || basename(project.fallbackPath) || '未知项目'
}

function projectPathLabel(project: ProjectAccumulator): string | null {
  return project.repo?.path.trim() || project.fallbackPath
}

function minuteBucket(timestamp: number): number {
  return Math.floor(timestamp / 60_000)
}

/** Builds stable, renderer-local project filters from the latest full session snapshot. */
export function buildSessionObserverProjectFilter(
  sessions: readonly SessionObserverSessionView[],
  repos: readonly ProjectRepo[]
): SessionObserverProjectFilter {
  const reposById = new Map(repos.map((repo) => [repo.id, repo]))
  const projectsByKey = new Map<SessionObserverProjectKey, ProjectAccumulator>()
  const projectKeyBySessionId = new Map<string, SessionObserverProjectKey>()

  for (const session of sessions) {
    const identity = projectIdentity(session, reposById)
    projectKeyBySessionId.set(session.id, identity.key)
    const current = projectsByKey.get(identity.key)
    if (current) {
      current.count += 1
      current.latestUpdatedAt = Math.max(current.latestUpdatedAt, session.updatedAt)
      current.fallbackPath ||= identity.fallbackPath
      continue
    }
    projectsByKey.set(identity.key, {
      ...identity,
      count: 1,
      latestUpdatedAt: session.updatedAt
    })
  }

  const baseLabels = new Map(
    Array.from(projectsByKey.values(), (project) => [project.key, projectBaseLabel(project)])
  )
  const baseLabelCounts = new Map<string, number>()
  for (const label of baseLabels.values()) {
    baseLabelCounts.set(label, (baseLabelCounts.get(label) ?? 0) + 1)
  }

  const options = Array.from(projectsByKey.values(), (project) => {
    const baseLabel = baseLabels.get(project.key) ?? '未知项目'
    const pathLabel = projectPathLabel(project)
    return {
      key: project.key,
      label:
        (baseLabelCounts.get(baseLabel) ?? 0) > 1 && pathLabel
          ? `${baseLabel} · ${pathLabel}`
          : baseLabel,
      count: project.count,
      latestUpdatedAt: project.latestUpdatedAt
    }
  }).sort((left, right) => {
    const updatedAtDifference =
      minuteBucket(right.latestUpdatedAt) - minuteBucket(left.latestUpdatedAt)
    return (
      updatedAtDifference ||
      left.label.localeCompare(right.label, 'zh-CN') ||
      left.key.localeCompare(right.key, 'zh-CN')
    )
  })

  return { options, projectKeyBySessionId }
}

export function filterSessionObserverSessionsByProject(
  sessions: readonly SessionObserverSessionView[],
  projectKeyBySessionId: ReadonlyMap<string, SessionObserverProjectKey>,
  selectedProjectKeys: ReadonlySet<SessionObserverProjectKey>
): readonly SessionObserverSessionView[] {
  if (selectedProjectKeys.size === 0) {
    return sessions
  }
  return sessions.filter((session) =>
    selectedProjectKeys.has(projectKeyBySessionId.get(session.id)!)
  )
}

export function retainAvailableSessionObserverProjectSelection(
  selectedProjectKeys: ReadonlySet<SessionObserverProjectKey>,
  options: readonly SessionObserverProjectFilterOption[]
): Set<SessionObserverProjectKey> {
  const availableKeys = new Set(options.map((option) => option.key))
  return new Set(Array.from(selectedProjectKeys).filter((key) => availableKeys.has(key)))
}
