import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCw, Settings2 } from 'lucide-react'
import {
  DEFAULT_SESSION_OBSERVER_ANALYSIS_CONFIG,
  getDefaultSessionObserverAnalysisConfig,
  getSessionObserverAnalyzerAgentOptions,
  getSessionObserverAnalyzerModelOptions,
  getSessionObserverThinkingLevelOptions,
  normalizeSessionObserverAnalysisConfig,
  type SessionObserverAnalysisConfig,
  type SessionObserverAnalyzerAgent
} from '../../../../shared/session-observer-analysis'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

const AUTO_THINKING_VALUE = '__observer_auto__'
const MODEL_LIST_ID = 'session-observer-analysis-models'

function configFromSettings(
  settings: ReturnType<typeof useAppStore.getState>['settings']
): SessionObserverAnalysisConfig {
  return normalizeSessionObserverAnalysisConfig(
    settings?.sessionObserverAnalysis,
    DEFAULT_SESSION_OBSERVER_ANALYSIS_CONFIG
  )
}

/** Inline settings for the analyzer used by subsequent observer runs. */
export function SessionObserverAnalyzerSettings(): React.JSX.Element {
  const settings = useAppStore((state) => state.settings)
  const updateSettingsOrThrow = useAppStore((state) => state.updateSettingsOrThrow)
  const config = configFromSettings(settings)
  const [modelDraft, setModelDraft] = useState(config.model)
  const [modelDirty, setModelDirty] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const writeQueue = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    if (!modelDirty) {
      setModelDraft(config.model)
    }
  }, [config.model, modelDirty])

  const modelOptions = getSessionObserverAnalyzerModelOptions(config.agent)
  const thinkingOptions = useMemo(
    () => getSessionObserverThinkingLevelOptions(config.agent, modelDraft.trim() || config.model),
    [config.agent, config.model, modelDraft]
  )

  const writeConfig = (patch: Partial<SessionObserverAnalysisConfig>): void => {
    writeQueue.current = writeQueue.current
      .catch(() => undefined)
      .then(async () => {
        const current = configFromSettings(useAppStore.getState().settings)
        const next = normalizeSessionObserverAnalysisConfig({ ...current, ...patch }, current)
        setSaveError(null)
        await updateSettingsOrThrow({ sessionObserverAnalysis: next })
      })
      .catch((error: unknown) => {
        setSaveError(error instanceof Error ? error.message : '分析配置保存失败')
      })
  }

  const handleAgentChange = (value: string): void => {
    const agent = value as SessionObserverAnalyzerAgent
    const next = getDefaultSessionObserverAnalysisConfig(agent)
    setModelDraft(next.model)
    setModelDirty(false)
    writeConfig(next)
  }

  const handleModelBlur = (): void => {
    const model = modelDraft.trim()
    if (!model) {
      setModelDraft(config.model)
      setModelDirty(false)
      return
    }
    setModelDirty(false)
    writeConfig({ model })
  }

  const handleModelKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.currentTarget.blur()
    }
  }

  const handleThinkingChange = (value: string): void => {
    writeConfig({
      thinkingLevel:
        value === AUTO_THINKING_VALUE
          ? null
          : (value as SessionObserverAnalysisConfig['thinkingLevel'])
    })
  }

  const selectedThinking =
    config.thinkingLevel && thinkingOptions.some((option) => option.id === config.thinkingLevel)
      ? config.thinkingLevel
      : AUTO_THINKING_VALUE

  return (
    <section
      aria-label="分析配置"
      className="shrink-0 border-b border-border bg-muted/20 px-4 py-2.5"
    >
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <div className="mr-1 flex items-center gap-1.5 self-center text-xs font-medium">
          <Settings2 className="size-3.5 text-muted-foreground" />
          分析配置
        </div>
        <div className="grid gap-1">
          <Label
            htmlFor="session-observer-analysis-agent"
            className="text-[11px] text-muted-foreground"
          >
            Agent
          </Label>
          <Select value={config.agent} onValueChange={handleAgentChange}>
            <SelectTrigger id="session-observer-analysis-agent" size="sm" className="w-[132px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getSessionObserverAnalyzerAgentOptions().map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid min-w-[220px] flex-1 gap-1 sm:max-w-[360px]">
          <Label
            htmlFor="session-observer-analysis-model"
            className="text-[11px] text-muted-foreground"
          >
            模型
          </Label>
          <Input
            id="session-observer-analysis-model"
            list={MODEL_LIST_ID}
            value={modelDraft}
            className="h-8 font-mono text-xs"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            onChange={(event) => {
              setModelDraft(event.target.value)
              setModelDirty(true)
            }}
            onBlur={handleModelBlur}
            onKeyDown={handleModelKeyDown}
          />
          <datalist id={MODEL_LIST_ID}>
            {modelOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </datalist>
        </div>
        <div className="grid gap-1">
          <Label
            htmlFor="session-observer-analysis-thinking"
            className="text-[11px] text-muted-foreground"
          >
            思考等级
          </Label>
          <Select value={selectedThinking} onValueChange={handleThinkingChange}>
            <SelectTrigger id="session-observer-analysis-thinking" size="sm" className="w-[132px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AUTO_THINKING_VALUE}>自动</SelectItem>
              {thinkingOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="恢复默认分析配置"
          title="恢复默认分析配置"
          onClick={() => {
            setModelDraft(DEFAULT_SESSION_OBSERVER_ANALYSIS_CONFIG.model)
            setModelDirty(false)
            writeConfig({ ...DEFAULT_SESSION_OBSERVER_ANALYSIS_CONFIG })
          }}
        >
          <RotateCw />
        </Button>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        配置会用于后续自动分析和“重新分析”；正在执行的分析继续使用启动时的配置。
      </p>
      {saveError ? (
        <p role="alert" className="mt-1 text-[11px] text-destructive">
          {saveError}
        </p>
      ) : null}
    </section>
  )
}
