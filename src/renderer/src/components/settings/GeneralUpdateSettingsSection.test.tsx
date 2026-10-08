// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '../../store'
import { GeneralUpdateSettingsSection } from './GeneralUpdateSettingsSection'

vi.mock('./GeneralRemoteServerUpdates', () => ({ GeneralRemoteServerUpdates: () => null }))
vi.mock('./ReleaseChannelSection', () => ({ ReleaseChannelSection: () => null }))

const quitAndInstall = vi.fn()

beforeEach(() => {
  quitAndInstall.mockReset().mockResolvedValue(undefined)
  useAppStore.setState({
    updateStatus: { state: 'available', version: '1.4.200', changelog: null }
  })
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      updater: {
        check: vi.fn(),
        download: vi.fn(),
        quitAndInstall,
        getVersion: vi.fn().mockResolvedValue('1.4.199')
      }
    }
  })
})

afterEach(() => {
  cleanup()
  useAppStore.setState({ updateStatus: { state: 'idle' } })
})

it('hides application update controls for the local distribution', () => {
  render(<GeneralUpdateSettingsSection />)

  expect(screen.queryByRole('button', { name: 'Download Update (1.4.200)' })).toBeNull()
  expect(screen.queryByText(/Check for Updates/)).toBeNull()
})

it('hides installation retry for the local distribution when a staged update is blocked', () => {
  useAppStore.setState({
    updateStatus: {
      state: 'error',
      version: '1.4.200',
      message: 'Close the other Orca instances before installing this update.',
      retryAction: 'install'
    }
  })
  render(<GeneralUpdateSettingsSection />)

  expect(screen.queryByRole('button', { name: 'Try Again' })).toBeNull()
  expect(quitAndInstall).not.toHaveBeenCalled()
})

it.each([undefined, false] as const)(
  'does not offer install retry without an install action or when retry is refused (%s)',
  (retryable) => {
    useAppStore.setState({
      updateStatus: {
        state: 'error',
        version: '1.4.200',
        message: 'Update failed.',
        ...(retryable === false ? { retryAction: 'install', retryable } : {})
      }
    })
    render(<GeneralUpdateSettingsSection />)

    expect(screen.queryByRole('button', { name: 'Try Again' })).toBeNull()
    expect(quitAndInstall).not.toHaveBeenCalled()
  }
)
