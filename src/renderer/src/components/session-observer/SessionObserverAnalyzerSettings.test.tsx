// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_SESSION_OBSERVER_ANALYSIS_CONFIG,
  type SessionObserverAnalysisConfig
} from '../../../../shared/session-observer-analysis'

const mocks = vi.hoisted(() => {
  const state: {
    settings: { sessionObserverAnalysis: SessionObserverAnalysisConfig }
    updateSettingsOrThrow: ReturnType<typeof vi.fn>
  } = {
    settings: {
      sessionObserverAnalysis: {
        agent: 'codex' as const,
        model: 'gpt-5.6-luna',
        thinkingLevel: 'low' as const
      }
    },
    updateSettingsOrThrow:
      vi.fn<
        (updates: { sessionObserverAnalysis: SessionObserverAnalysisConfig }) => Promise<void>
      >()
  }
  const useAppStore = Object.assign(
    (selector: (value: typeof state) => unknown) => selector(state),
    { getState: () => state }
  )
  return { state, useAppStore }
})

vi.mock('@/store', () => ({ useAppStore: mocks.useAppStore }))

import { SessionObserverAnalyzerSettings } from './SessionObserverAnalyzerSettings'

describe('SessionObserverAnalyzerSettings', () => {
  afterEach(() => {
    cleanup()
    mocks.state.settings.sessionObserverAnalysis = { ...DEFAULT_SESSION_OBSERVER_ANALYSIS_CONFIG }
    mocks.state.updateSettingsOrThrow.mockReset()
    mocks.state.updateSettingsOrThrow.mockResolvedValue(undefined)
  })

  it('shows the persisted analyzer profile and model suggestions', () => {
    render(<SessionObserverAnalyzerSettings />)

    expect(screen.getByRole('region', { name: '分析配置' })).toBeInTheDocument()
    expect(screen.getByLabelText('模型')).toHaveValue('gpt-5.6-luna')
    expect(
      screen.getByText('配置会用于后续自动分析和“重新分析”；正在执行的分析继续使用启动时的配置。')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '恢复默认分析配置' })).toBeInTheDocument()
  })

  it('persists a custom model after the input is committed', async () => {
    render(<SessionObserverAnalyzerSettings />)
    const model = screen.getByLabelText('模型')
    fireEvent.change(model, { target: { value: ' account-model ' } })
    fireEvent.blur(model)

    await waitFor(() => expect(mocks.state.updateSettingsOrThrow).toHaveBeenCalledTimes(1))
    expect(mocks.state.updateSettingsOrThrow).toHaveBeenCalledWith({
      sessionObserverAnalysis: {
        agent: 'codex',
        model: 'account-model',
        thinkingLevel: 'low'
      }
    })
  })

  it('restores the historical defaults from the reset action', async () => {
    mocks.state.settings.sessionObserverAnalysis = {
      agent: 'claude',
      model: 'opus',
      thinkingLevel: 'high'
    }
    render(<SessionObserverAnalyzerSettings />)
    fireEvent.click(screen.getByRole('button', { name: '恢复默认分析配置' }))

    await waitFor(() => expect(mocks.state.updateSettingsOrThrow).toHaveBeenCalledTimes(1))
    expect(mocks.state.updateSettingsOrThrow).toHaveBeenCalledWith({
      sessionObserverAnalysis: DEFAULT_SESSION_OBSERVER_ANALYSIS_CONFIG
    })
  })

  it('serializes rapid model writes so the newest value is persisted last', async () => {
    let resolveFirst!: () => void
    mocks.state.updateSettingsOrThrow
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirst = resolve
          })
      )
      .mockResolvedValue(undefined)
    render(<SessionObserverAnalyzerSettings />)
    const model = screen.getByLabelText('模型')

    fireEvent.change(model, { target: { value: 'first-model' } })
    fireEvent.blur(model)
    fireEvent.change(model, { target: { value: 'second-model' } })
    fireEvent.blur(model)

    await waitFor(() => expect(mocks.state.updateSettingsOrThrow).toHaveBeenCalledTimes(1))
    resolveFirst()
    await waitFor(() => expect(mocks.state.updateSettingsOrThrow).toHaveBeenCalledTimes(2))
    expect(mocks.state.updateSettingsOrThrow).toHaveBeenLastCalledWith({
      sessionObserverAnalysis: {
        agent: 'codex',
        model: 'second-model',
        thinkingLevel: 'low'
      }
    })
  })
})
