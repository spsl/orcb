import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { prependOrcaCliDirToChildPath } from './orca-cli-child-path'

const USER_DATA = '/data/orca'
const RESOURCES = '/app/Resources'

describe('prependOrcaCliDirToChildPath', () => {
  it('leads packaged Linux PATH with the bundled ORCB CLI dir', () => {
    const env: Record<string, string> = { PATH: '/usr/local/bin:/usr/bin' }
    prependOrcaCliDirToChildPath(env, {
      isPackaged: true,
      userDataPath: USER_DATA,
      resourcesPath: RESOURCES,
      platform: 'linux'
    })
    expect(env.PATH).toBe(`${join(RESOURCES, 'bin')}:/usr/local/bin:/usr/bin`)
  })

  it('promotes an already-present bundled CLI dir instead of duplicating it', () => {
    const bundledCliDir = join(RESOURCES, 'bin')
    const env: Record<string, string> = { PATH: `/usr/bin:${bundledCliDir}::/bin` }
    prependOrcaCliDirToChildPath(env, {
      isPackaged: true,
      userDataPath: USER_DATA,
      resourcesPath: RESOURCES,
      platform: 'linux'
    })
    expect(env.PATH).toBe(`${bundledCliDir}:/usr/bin:/bin`)
  })

  it('leaves packaged Linux PATH untouched with no resources root', () => {
    const env: Record<string, string> = { PATH: '/usr/bin' }
    prependOrcaCliDirToChildPath(env, {
      isPackaged: true,
      userDataPath: USER_DATA,
      resourcesPath: null,
      platform: 'linux'
    })
    expect(env.PATH).toBe('/usr/bin')
  })

  it('leads packaged macOS PATH with the bundled CLI dir', () => {
    const env: Record<string, string> = { PATH: '/usr/bin' }
    prependOrcaCliDirToChildPath(env, {
      isPackaged: true,
      userDataPath: USER_DATA,
      resourcesPath: RESOURCES,
      platform: 'darwin'
    })
    expect(env.PATH).toBe(`${join(RESOURCES, 'bin')}:/usr/bin`)
  })

  it('leads packaged Windows PATH with the bundled CLI dir under the env block spelling', () => {
    const env: Record<string, string> = { Path: 'C:\\Windows\\System32' }
    prependOrcaCliDirToChildPath(env, {
      isPackaged: true,
      userDataPath: USER_DATA,
      resourcesPath: RESOURCES,
      platform: 'win32'
    })
    expect(env.Path).toBe(`${join(RESOURCES, 'bin')};C:\\Windows\\System32`)
    expect(env.PATH).toBeUndefined()
  })

  it('leaves a packaged darwin/win32 PATH alone with no resources root', () => {
    const env: Record<string, string> = { PATH: '/usr/bin' }
    prependOrcaCliDirToChildPath(env, {
      isPackaged: true,
      userDataPath: USER_DATA,
      resourcesPath: null,
      platform: 'darwin'
    })
    expect(env.PATH).toBe('/usr/bin')
  })

  it.each<[NodeJS.Platform, string]>([
    ['linux', ':'],
    ['darwin', ':'],
    ['win32', ';']
  ])('leads an unpackaged %s PATH with the dev launcher dir', (platform, pathDelimiter) => {
    const env: Record<string, string> = { PATH: '/usr/bin' }
    prependOrcaCliDirToChildPath(env, {
      isPackaged: false,
      userDataPath: USER_DATA,
      resourcesPath: RESOURCES,
      platform
    })
    expect(env.PATH).toBe(`${join(USER_DATA, 'cli', 'bin')}${pathDelimiter}/usr/bin`)
  })

  it('writes no trailing delimiter when nothing was inherited', () => {
    const env: Record<string, string> = { PATH: '' }
    const inheritedPath = process.env.PATH
    delete process.env.PATH
    try {
      prependOrcaCliDirToChildPath(env, {
        isPackaged: false,
        userDataPath: USER_DATA,
        platform: 'linux'
      })
    } finally {
      if (inheritedPath !== undefined) {
        process.env.PATH = inheritedPath
      }
    }
    // Why: an empty trailing segment resolves as `.` in some shells.
    expect(env.PATH).toBe(join(USER_DATA, 'cli', 'bin'))
  })
})
