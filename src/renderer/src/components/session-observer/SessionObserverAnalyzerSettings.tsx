import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCw } from 'lucide-react'
import {
  DEFAULT_SESSION_OBSERVER_ANALYSIS_CONFIG,
  getDefaultSessionObserverAnalysisConfig,
  getSessionObserverAnalyzerAgentOptions,
  getSessionObserverAnalyzerModelOptions,
  getSessionObserverThinkingLevelOptions,
  MAX_SESSION_OBSERVER_SYSTEM_PROMPT_LENGTH,
  normalizeSessionObserverAnalysisConfig,
  type SessionObserverAnalysisConfig,
  type SessionObserverAnalyzerAgent
} from '../../../../shared/session-observer-analysis'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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

/** Settings form for the analyzer used by subsequent observer runs. */
export function SessionObserverAnalyzerSettings(): React.JSX.Element {
  const settings = useAppStore((state) => state.settings)
  const updateSettingsOrThrow = useAppStore((state) => state.updateSettingsOrThrow)
  const config = configFromSettings(settings)
  const [modelDraft, setModelDraft] = useState(config.model)
  const [modelDirty, setModelDirty] = useState(false)
  const [systemPromptDraft, setSystemPromptDraft] = useState(config.systemPrompt ?? '')
  const [systemPromptDirty, setSystemPromptDirty] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const writeQueue = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    if (!modelDirty) {
      setModelDraft(config.model)
    }
  }, [config.model, modelDirty])

  useEffect(() => {
    if (!systemPromptDirty) {
      setSystemPromptDraft(config.systemPrompt ?? '')
    }
  }, [config.systemPrompt, systemPromptDirty])

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
    writeConfig({ agent: next.agent, model: next.model, thinkingLevel: next.thinkingLevel })
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

  const handleSystemPromptBlur = (): void => {
    setSystemPromptDirty(false)
    writeConfig({ systemPrompt: systemPromptDraft.trim() || null })
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
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
            setSystemPromptDraft('')
            setSystemPromptDirty(false)
            writeConfig({ ...DEFAULT_SESSION_OBSERVER_ANALYSIS_CONFIG })
          }}
        >
          <RotateCw />
        </Button>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="session-observer-analysis-system-prompt">自定义分析提示词</Label>
        <Textarea
          id="session-observer-analysis-system-prompt"
          value={systemPromptDraft}
          maxLength={MAX_SESSION_OBSERVER_SYSTEM_PROMPT_LENGTH}
          rows={5}
          placeholder="留空使用内置提示词；这里只覆盖业务分析指令，安全、只读和 JSON 输出约束仍会保留。"
          onChange={(event) => {
            setSystemPromptDraft(event.target.value)
            setSystemPromptDirty(true)
          }}
          onBlur={handleSystemPromptBlur}
        />
        <p className="text-[11px] text-muted-foreground">
          自定义内容会用于后续分析；正在执行的分析继续使用启动时的配置。
        </p>
      </div>
      {saveError ? (
        <p role="alert" className="text-[11px] text-destructive">
          {saveError}
        </p>
      ) : null}
    </div>
  )
}
