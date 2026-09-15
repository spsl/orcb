import { describe, expect, it, vi } from 'vitest'
import { resolveSessionObserverAnalyzerRunConfig } from './session-observer-analyzer'
import { buildSessionObserverAnalyzerInvocation } from './session-observer-analyzer-invocation'
import type { SessionObserverAnalysisConfig } from '../../shared/session-observer-analysis'

const paths = { schemaPath: '/tmp/schema.json', outputPath: '/tmp/result.json' }
const schema = { type: 'object' }

function invocation(config: SessionObserverAnalysisConfig, commandOverride?: string) {
  return buildSessionObserverAnalyzerInvocation({
    config,
    commandOverride,
    paths,
    schema
  })
}

describe('session observer analyzer invocation', () => {
  it('normalizes the run snapshot before resolving its agent command', () => {
    const command = vi.fn((agent: 'codex' | 'claude' | 'pi') =>
      agent === 'claude' ? 'claude-wrapper' : undefined
    )
    expect(
      resolveSessionObserverAnalyzerRunConfig(
        { agent: 'claude', model: ' sonnet ', thinkingLevel: 'low' },
        command
      )
    ).toEqual({
      agent: 'claude',
      model: 'sonnet',
      thinkingLevel: 'low',
      systemPrompt: null,
      command: 'claude-wrapper'
    })
    expect(command).toHaveBeenCalledWith('claude')
  })

  it('builds a read-only Codex invocation with the selected model and effort', () => {
    const result = invocation({ agent: 'codex', model: 'gpt-5.6-luna', thinkingLevel: 'max' })
    expect(result).toEqual({
      program: 'codex',
      args: [
        'exec',
        '--ephemeral',
        '--skip-git-repo-check',
        '--color',
        'never',
        '-s',
        'read-only',
        '--model',
        'gpt-5.6-luna',
        '-c',
        'model_reasoning_effort=max',
        '--output-schema',
        paths.schemaPath,
        '--output-last-message',
        paths.outputPath,
        '-'
      ],
      outputPath: paths.outputPath
    })
  })

  it('keeps Codex effort optional when automatic selection is requested', () => {
    const result = invocation({ agent: 'codex', model: 'gpt-5.5', thinkingLevel: null })
    expect(result.args).not.toContain('model_reasoning_effort=max')
    expect(result.args).not.toContain('-c')
  })

  it('builds a no-tools Claude JSON invocation', () => {
    const result = invocation({ agent: 'claude', model: 'opus', thinkingLevel: 'high' })
    expect(result.program).toBe('claude')
    expect(result.outputPath).toBeUndefined()
    expect(result.args).toEqual([
      '-p',
      '--output-format',
      'json',
      '--json-schema',
      JSON.stringify(schema),
      '--model',
      'opus',
      '--permission-mode',
      'plan',
      '--tools',
      '',
      '--no-session-persistence',
      '--disable-slash-commands',
      '--effort',
      'high'
    ])
  })

  it('builds a no-tools Pi invocation and omits a null effort', () => {
    const result = invocation({
      agent: 'pi',
      model: 'github-copilot/gpt-5.4-mini',
      thinkingLevel: null
    })
    expect(result).toEqual({
      program: 'pi',
      args: [
        '--print',
        '--mode',
        'text',
        '--no-session',
        '--no-tools',
        '--no-skills',
        '--no-context-files',
        '--model',
        'github-copilot/gpt-5.4-mini'
      ]
    })
  })

  it('tokenizes command overrides before appending adapter arguments', () => {
    const result = invocation(
      { agent: 'claude', model: 'sonnet', thinkingLevel: 'low' },
      'npx --yes claude-wrapper'
    )
    expect(result.program).toBe('npx')
    expect(result.args.slice(0, 3)).toEqual(['--yes', 'claude-wrapper', '-p'])
  })

  it('rejects malformed command overrides before spawning a process', () => {
    expect(() =>
      invocation({ agent: 'codex', model: 'gpt-5.5', thinkingLevel: 'low' }, '"unterminated')
    ).toThrow(/override/i)
  })
})
