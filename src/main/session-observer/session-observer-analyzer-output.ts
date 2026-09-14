import {
  SESSION_OBSERVER_ANALYSIS_STATUSES,
  type SessionObserverAnalysis
} from '../../shared/session-observer'
import { stripAnsiEscapeSequences } from '../../shared/ansi-escape-sequences'

export const MAX_ANALYSIS_TEXT_LENGTH = 4_000
export const MAX_ANALYSIS_LIST_ITEMS = 20

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function text(
  record: Record<string, unknown>,
  key: string,
  maxLength = MAX_ANALYSIS_TEXT_LENGTH
): string {
  const value = record[key]
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new Error(`分析结果字段 ${key} 无效`)
  }
  return value
}

function textList(record: Record<string, unknown>, key: string): string[] {
  const value = record[key]
  if (
    !Array.isArray(value) ||
    value.length > MAX_ANALYSIS_LIST_ITEMS ||
    value.some((item) => typeof item !== 'string' || item.length > MAX_ANALYSIS_TEXT_LENGTH)
  ) {
    throw new Error(`分析结果字段 ${key} 无效`)
  }
  return value
}

export function parseSessionObserverAnalysis(value: unknown): SessionObserverAnalysis {
  const record = asRecord(value)
  if (!record) {
    throw new Error('分析结果不是对象')
  }
  const status = record.status
  if (
    typeof status !== 'string' ||
    !SESSION_OBSERVER_ANALYSIS_STATUSES.includes(
      status as (typeof SESSION_OBSERVER_ANALYSIS_STATUSES)[number]
    )
  ) {
    throw new Error('分析结果状态无效')
  }
  const confidence = record.confidence
  if (
    typeof confidence !== 'number' ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1
  ) {
    throw new Error('分析结果置信度无效')
  }
  if (typeof record.needsUserAttention !== 'boolean') {
    throw new Error('分析结果人工介入字段无效')
  }
  return {
    summary: text(record, 'summary', 2_000),
    goal: text(record, 'goal'),
    status: status as SessionObserverAnalysis['status'],
    progress: textList(record, 'progress'),
    completed: textList(record, 'completed'),
    nextSteps: textList(record, 'nextSteps'),
    blockers: textList(record, 'blockers'),
    needsUserAttention: record.needsUserAttention,
    confidence
  }
}

function stripAnsi(value: string): string {
  return stripAnsiEscapeSequences(value)
}

/** Finds complete JSON objects in logs or fenced markdown without trusting text around them. */
function parseJsonCandidates(value: string): unknown[] {
  const textValue = stripAnsi(value).trim()
  const candidates: unknown[] = []
  try {
    candidates.push(JSON.parse(textValue))
  } catch {
    // A number of CLIs prepend progress lines; the balanced scan below handles those.
  }

  for (let start = 0; start < textValue.length; start += 1) {
    if (textValue[start] !== '{' && textValue[start] !== '[') {
      continue
    }
    const end = findJsonEnd(textValue, start)
    if (end === -1) {
      continue
    }
    try {
      candidates.push(JSON.parse(textValue.slice(start, end + 1)))
    } catch {
      // Keep scanning; a malformed log fragment may contain a valid later object.
    }
    start = end
  }
  return candidates
}

function findJsonEnd(value: string, start: number): number {
  const stack: string[] = []
  let quote = false
  let escaped = false
  for (let index = start; index < value.length; index += 1) {
    const character = value[index]
    if (quote) {
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === '"') {
        quote = false
      }
      continue
    }
    if (character === '"') {
      quote = true
      continue
    }
    if (character === '{' || character === '[') {
      stack.push(character)
      continue
    }
    if (character !== '}' && character !== ']') {
      continue
    }
    const expected = character === '}' ? '{' : '['
    if (stack.pop() !== expected) {
      return -1
    }
    if (stack.length === 0) {
      return index
    }
  }
  return -1
}

function findAnalysis(value: unknown, depth = 0): SessionObserverAnalysis | null {
  if (depth > 4) {
    return null
  }
  try {
    return parseSessionObserverAnalysis(value)
  } catch {
    // Envelopes from Claude/Pi put the final message under one of these keys.
  }
  if (typeof value === 'string') {
    for (const candidate of parseJsonCandidates(value)) {
      const analysis = findAnalysis(candidate, depth + 1)
      if (analysis) {
        return analysis
      }
    }
    return null
  }
  const record = asRecord(value)
  if (!record) {
    return null
  }
  for (const key of ['structured_output', 'structuredOutput', 'result', 'output', 'text']) {
    if (!(key in record)) {
      continue
    }
    const analysis = findAnalysis(record[key], depth + 1)
    if (analysis) {
      return analysis
    }
  }
  const message = asRecord(record.message)
  if (message) {
    const analysis = findAnalysis(message.content, depth + 1)
    if (analysis) {
      return analysis
    }
  }
  if (Array.isArray(record.content)) {
    for (const item of record.content) {
      const analysis = findAnalysis(item, depth + 1)
      if (analysis) {
        return analysis
      }
    }
  }
  return null
}

export function parseSessionObserverAnalysisOutput(stdout: string): SessionObserverAnalysis {
  for (const candidate of parseJsonCandidates(stdout)) {
    const analysis = findAnalysis(candidate)
    if (analysis) {
      return analysis
    }
  }
  throw new Error('分析器未返回符合格式的 JSON 结果')
}
