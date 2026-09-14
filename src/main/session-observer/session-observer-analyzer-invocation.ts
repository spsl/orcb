import { planAgentBinary } from '../../shared/commit-message-plan'
import type {
  SessionObserverAnalysisConfig,
  SessionObserverAnalyzerAgent
} from '../../shared/session-observer-analysis'

export type SessionObserverAnalyzerInvocationPaths = {
  schemaPath: string
  outputPath: string
}

export type SessionObserverAnalyzerInvocation = {
  program: string
  args: string[]
  /** Codex writes the validated object here; other adapters return stdout. */
  outputPath?: string
}

function defaultBinary(agent: SessionObserverAnalyzerAgent): string {
  switch (agent) {
    case 'claude':
      return 'claude'
    case 'pi':
      return 'pi'
    case 'codex':
      return 'codex'
  }
}

function resolveCommand(
  agent: SessionObserverAnalyzerAgent,
  commandOverride: string | undefined
): { program: string; prefixArgs: string[] } {
  const planned = planAgentBinary(
    defaultBinary(agent),
    commandOverride,
    process.platform === 'win32' ? 'literal' : 'escape'
  )
  if (!planned.ok) {
    throw new Error(planned.error)
  }
  return { program: planned.binary, prefixArgs: planned.prefixArgs }
}

export function buildSessionObserverAnalyzerInvocation(args: {
  config: SessionObserverAnalysisConfig
  commandOverride?: string
  paths: SessionObserverAnalyzerInvocationPaths
  schema: Record<string, unknown>
}): SessionObserverAnalyzerInvocation {
  const { config, paths, schema } = args
  const command = resolveCommand(config.agent, args.commandOverride)
  const thinkingArgs = config.thinkingLevel ? effortArgs(config.agent, config.thinkingLevel) : []

  switch (config.agent) {
    case 'claude':
      return {
        program: command.program,
        args: [
          ...command.prefixArgs,
          '-p',
          '--output-format',
          'json',
          '--json-schema',
          JSON.stringify(schema),
          '--model',
          config.model,
          '--permission-mode',
          'plan',
          '--tools',
          '',
          '--no-session-persistence',
          '--disable-slash-commands',
          ...thinkingArgs
        ]
      }
    case 'pi':
      return {
        program: command.program,
        args: [
          ...command.prefixArgs,
          '--print',
          '--mode',
          'text',
          '--no-session',
          '--no-tools',
          '--no-skills',
          '--no-context-files',
          '--model',
          config.model,
          ...thinkingArgs
        ]
      }
    case 'codex':
      return {
        program: command.program,
        args: [
          ...command.prefixArgs,
          'exec',
          '--ephemeral',
          '--skip-git-repo-check',
          '--color',
          'never',
          '-s',
          'read-only',
          '--model',
          config.model,
          ...thinkingArgs,
          '--output-schema',
          paths.schemaPath,
          '--output-last-message',
          paths.outputPath,
          '-'
        ],
        outputPath: paths.outputPath
      }
  }
}

function effortArgs(
  agent: SessionObserverAnalyzerAgent,
  level: NonNullable<SessionObserverAnalysisConfig['thinkingLevel']>
): string[] {
  switch (agent) {
    case 'claude':
      return ['--effort', level]
    case 'pi':
      return ['--thinking', level]
    case 'codex':
      return ['-c', `model_reasoning_effort=${level}`]
  }
}
