import { describe, expect, it } from 'vitest'
import type { SessionObserverSessionView } from '../../../../shared/session-observer'
import {
  buildSessionObserverProjectFilter,
  filterSessionObserverSessionsByProject,
  retainAvailableSessionObserverProjectSelection
} from './session-observer-project-filter'

function session(
  id: string,
  worktreeId: string | null,
  updatedAt: number,
  worktreePath?: string | null
): SessionObserverSessionView {
  return {
    id,
    paneKey: id,
    tabId: 'tab-1',
    worktreeId,
    worktreePath,
    agentType: 'codex',
    model: null,
    lifecycleState: 'working',
    prompt: null,
    latestOutput: null,
    title: null,
    turns: [],
    analysisState: 'awaiting_output',
    analysis: null,
    analysisError: null,
    manualStatusOverride: null,
    updatedAt,
    completedAt: null,
    ptyId: null,
    live: false,
    terminalState: 'unknown',
    modelStatus: 'unclear',
    effectiveStatus: 'unclear'
  }
}

describe('session observer project filter', () => {
  it('uses the repository display name and groups its worktrees by stable repo id', () => {
    const sessions = [
      session('one', 'repo-orca::/workspace/orca', 1),
      session('two', 'repo-orca::/workspace/orca-feature', 2)
    ]
    const filter = buildSessionObserverProjectFilter(sessions, [
      { id: 'repo-orca', displayName: 'Orca', path: '/workspace/orca' }
    ])

    expect(filter.options).toEqual([
      { key: 'repo:repo-orca', label: 'Orca', count: 2, latestUpdatedAt: 2 }
    ])
    expect(filter.projectKeyBySessionId.get('one')).toBe('repo:repo-orca')
    expect(filter.projectKeyBySessionId.get('two')).toBe('repo:repo-orca')
  })

  it('falls back to the workspace directory and isolates unknown sessions', () => {
    const sessions = [
      session('known', 'repo-pending::/workspaces/service-api', 1),
      session('unknown', null, 2)
    ]
    const filter = buildSessionObserverProjectFilter(sessions, [])

    expect(filter.options).toEqual(
      expect.arrayContaining([
        { key: 'repo:repo-pending', label: 'service-api', count: 1, latestUpdatedAt: 1 },
        { key: 'unknown', label: '未知项目', count: 1, latestUpdatedAt: 2 }
      ])
    )
  })

  it('adds paths only when display names collide', () => {
    const filter = buildSessionObserverProjectFilter(
      [
        session('local', 'repo-local::/work/orca', 1),
        session('remote', 'repo-remote::/srv/orca', 1)
      ],
      [
        { id: 'repo-local', displayName: 'orca', path: '/work/orca' },
        { id: 'repo-remote', displayName: 'orca', path: '/srv/orca' }
      ]
    )

    expect(filter.options.map(({ label }) => label)).toEqual([
      'orca · /srv/orca',
      'orca · /work/orca'
    ])
  })

  it('sorts active projects by minute buckets then by name', () => {
    const minute = 60_000
    const filter = buildSessionObserverProjectFilter(
      [
        session('zulu', 'repo-zulu::/work/zulu', minute * 10 + 14_000),
        session('alpha', 'repo-alpha::/work/alpha', minute * 10 + 35_000),
        session('new', 'repo-new::/work/new', minute * 11)
      ],
      [
        { id: 'repo-zulu', displayName: 'Zulu', path: '/work/zulu' },
        { id: 'repo-alpha', displayName: 'Alpha', path: '/work/alpha' },
        { id: 'repo-new', displayName: 'New', path: '/work/new' }
      ]
    )

    expect(filter.options.map(({ label }) => label)).toEqual(['New', 'Alpha', 'Zulu'])
  })

  it('filters multiple projects and drops only selections no longer present', () => {
    const sessions = [
      session('one', 'repo-one::/work/one', 1),
      session('two', 'repo-two::/work/two', 2)
    ]
    const filter = buildSessionObserverProjectFilter(sessions, [])
    const selected = new Set(['repo:repo-one', 'unknown'] as const)

    expect(
      filterSessionObserverSessionsByProject(sessions, filter.projectKeyBySessionId, selected).map(
        ({ id }) => id
      )
    ).toEqual(['one'])
    expect(retainAvailableSessionObserverProjectSelection(selected, filter.options)).toEqual(
      new Set(['repo:repo-one'])
    )
  })
})
