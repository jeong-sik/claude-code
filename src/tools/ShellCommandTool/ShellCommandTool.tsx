/**
 * ShellCommandTool — Shell IR 기반 고급 셸 실행 도구.
 *
 * BashTool의 typed, risk-classified 상위 호환체.
 * 모든 입력은 tree-sitter 파싱 → Shell IR → RiskClass 분류를 거친다.
 * 출력에 structured metadata(risk_class, stage_words, is_read_operation,
 * is_destructive)를 포함하여 모델이 명령의 위험도를 인지할 수 있게 한다.
 */

import * as React from 'react'
import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import type {
  CanUseToolFn,
  ToolCallProgress,
  ToolUseContext,
  ValidationResult,
} from '../../Tool.js'
import type { AssistantMessage } from '../../types/message.js'
import type { PermissionResult } from '../../utils/permissions/PermissionResult.js'
import { exec } from '../../utils/Shell.js'
import type { ExecResult } from '../../utils/ShellCommand.js'
import { SandboxManager } from '../../utils/sandbox/sandbox-adapter.js'
import { parseToShellIr } from './parser.js'
import { classifyShellIr, isReadOperation, isDestructive } from './risk.js'
import { evaluateGate } from './gate.js'
import type { RiskClass, ShellIrMode } from './types.js'

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const inputSchema = z.strictObject({
  command: z.string().describe('The shell command to execute'),
  timeout: z
    .number()
    .optional()
    .describe('Optional timeout in milliseconds'),
  description: z
    .string()
    .optional()
    .describe(
      'Clear, concise description of what this command does in active voice',
    ),
  mode: z
    .enum(['strict', 'coding'])
    .optional()
    .describe("Parse mode: 'strict' (full security) or 'coding' (allowlisted dev tools)"),
  run_in_background: z
    .boolean()
    .optional()
    .describe('Set to true to run this command in the background'),
})

type InputSchema = typeof inputSchema
export type ShellCommandToolInput = z.infer<InputSchema>

// ---------------------------------------------------------------------------
// Output schema
// ---------------------------------------------------------------------------

const outputSchema = z.object({
  stdout: z.string().describe('The standard output of the command'),
  stderr: z.string().describe('The standard error output'),
  exit_code: z.number().describe('The command exit code'),
  interrupted: z
    .boolean()
    .describe('Whether the command was interrupted'),
  risk_class: z
    .enum([
      'R0_Read',
      'R1_Reversible_mutation',
      'R2_Irreversible',
      'Destructive_protected',
    ])
    .describe('Risk classification of the command'),
  stage_words: z
    .array(z.string())
    .describe('Flattened stage words from all pipeline stages'),
  is_read_operation: z
    .boolean()
    .describe('True if the command is classified as read-only'),
  is_destructive: z
    .boolean()
    .describe('True if the command is destructive'),
})

type OutputSchema = typeof outputSchema
export type ShellCommandToolOutput = z.infer<OutputSchema>

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

const SHELL_COMMAND_TOOL_NAME = 'ShellCommand'

/**
 * Shared parse + classify helper used by isReadOnly, isDestructive,
 * checkPermissions, and call.
 *
 * Returns null when parsing fails (too-complex, parse-unavailable, empty).
 * Callers treat null as "can't classify, defer to conservative default".
 */
async function parseAndClassify(
  command: string,
): Promise<{
  ir: import('./types.js').ShellIr
  riskClass: RiskClass
  stageWords: string[]
  isRead: boolean
  isDestructive: boolean
} | null> {
  const parsed = await parseToShellIr(command)
  if (!parsed.ok) {
    return null
  }
  const { ir, stage_words } = parsed.result
  const riskClass = classifyShellIr(ir)
  return {
    ir,
    riskClass,
    stageWords: stage_words,
    isRead: isReadOperation(riskClass),
    isDestructive: isDestructive(riskClass),
  }
}

export const ShellCommandTool = buildTool({
  name: SHELL_COMMAND_TOOL_NAME,
  searchHint: 'execute shell commands with risk classification',
  maxResultSizeChars: 30_000,
  strict: true,

  async description({ description }) {
    return description || 'Run shell command'
  },

  async prompt() {
    return `You have access to the ShellCommand tool, which executes shell commands with built-in risk classification.

The tool parses every command into a typed Shell IR, classifies it by risk (R0_Read, R1_Reversible_mutation, R2_Irreversible, Destructive_protected), and includes the classification in the output.

Use this tool when you need to run shell commands. Prefer it over Bash for commands where understanding the risk level matters.`
  },

  isConcurrencySafe(input) {
    return this.isReadOnly?.(input) ?? false
  },

  async isReadOnly(input) {
    const classified = await parseAndClassify(input.command)
    return classified?.isRead ?? false
  },

  async isDestructive(input) {
    const classified = await parseAndClassify(input.command)
    return classified?.isDestructive ?? false
  },

  toAutoClassifierInput(input) {
    return input.command
  },

  get inputSchema(): InputSchema {
    return inputSchema
  },

  get outputSchema(): OutputSchema {
    return outputSchema
  },

  userFacingName(input) {
    if (!input?.command) {
      return 'ShellCommand'
    }
    return input.description ?? input.command
  },

  getToolUseSummary(input) {
    if (!input?.command) {
      return null
    }
    return input.description ?? input.command
  },

  getActivityDescription(input) {
    if (!input?.command) {
      return 'Running shell command'
    }
    return `Running ${input.description ?? input.command}`
  },

  async validateInput(
    input: ShellCommandToolInput,
  ): Promise<ValidationResult> {
    if (!input.command || input.command.trim() === '') {
      return {
        result: false,
        message: 'Command cannot be empty',
        errorCode: 1,
      }
    }
    const parsed = await parseToShellIr(input.command)
    if (!parsed.ok) {
      return {
        result: false,
        message: `Command parsing failed: ${parsed.error.kind}${
          'reason' in parsed.error ? ` — ${parsed.error.reason}` : ''
        }`,
        errorCode: 2,
      }
    }
    return { result: true }
  },

  async checkPermissions(
    input: ShellCommandToolInput,
    context: ToolUseContext,
  ): Promise<PermissionResult> {
    const classified = await parseAndClassify(input.command)
    if (!classified) {
      // Parsing failed: fail-safe — ask for permission
      return {
        behavior: 'ask',
        updatedInput: input,
        message:
          'Unable to parse this command for risk classification. Please review before running.',
      }
    }

    const mode: ShellIrMode = input.mode ?? 'strict'
    const isInSandbox = SandboxManager.isSandboxingEnabled()
    const verdict = evaluateGate(classified.riskClass, mode, isInSandbox)

    switch (verdict.behavior) {
      case 'allow':
        return { behavior: 'allow', updatedInput: input }
      case 'deny':
        return {
          behavior: 'deny',
          updatedInput: input,
          message: verdict.reason,
        }
      case 'ask':
        return {
          behavior: 'ask',
          updatedInput: input,
          message:
            verdict.reason ??
            `Risk level: ${classified.riskClass}. Please confirm execution.`,
        }
    }
  },

  async call(
    input: ShellCommandToolInput,
    toolUseContext: ToolUseContext,
    _canUseTool?: CanUseToolFn,
    _parentMessage?: AssistantMessage,
    _onProgress?: ToolCallProgress,
  ): Promise<{ data: ShellCommandToolOutput }> {
    const { command, timeout, run_in_background } = input
    const { abortController } = toolUseContext

    // Parse + classify (call runs after checkPermissions, so this is
    // the second parse — acceptable for correctness; cache could be
    // added later at the Tool interface level).
    const classified = await parseAndClassify(command)
    if (!classified) {
      throw new Error('ShellCommandTool: parseAndClassify failed in call')
    }

    const timeoutMs = timeout ?? 300_000 // 5 minutes default

    // Execute via existing shell infrastructure
    const shellCommand = await exec(command, abortController.signal, 'bash', {
      timeout: timeoutMs,
    })

    const result: ExecResult = await shellCommand.result

    const data: ShellCommandToolOutput = {
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      exit_code: result.code,
      interrupted: result.interrupted,
      risk_class: classified.riskClass,
      stage_words: classified.stageWords,
      is_read_operation: classified.isRead,
      is_destructive: classified.isDestructive,
    }

    return { data }
  },

  mapToolResultToToolResultBlockParam(
    {
      stdout,
      stderr,
      exit_code,
      interrupted,
      risk_class,
      stage_words,
      is_read_operation,
      is_destructive,
    }: ShellCommandToolOutput,
    toolUseID: string,
  ): {
    tool_use_id: string
    type: 'tool_result'
    content: string
    is_error: boolean
  } {
    const parts: string[] = []
    if (stdout) {
      parts.push(stdout)
    }
    if (stderr) {
      parts.push(stderr)
    }
    if (interrupted) {
      parts.push('<error>Command was aborted before completion</error>')
    }
    if (exit_code !== 0 && !interrupted) {
      parts.push(`Exit code ${exit_code}`)
    }

    // Structured metadata appended for model awareness
    parts.push('')
    parts.push(`[risk_class: ${risk_class}]`)
    parts.push(`[is_read: ${is_read_operation}]`)
    parts.push(`[is_destructive: ${is_destructive}]`)
    parts.push(`[stage_words: ${stage_words.join(' ')}]`)

    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: parts.join('\n'),
      is_error: interrupted || exit_code !== 0,
    }
  },

  renderToolUseMessage(
    input: Partial<ShellCommandToolInput>,
    _options: { theme: string; verbose: boolean },
  ): React.ReactNode {
    const command = input.command ?? ''
    const description = input.description
    const display = description ?? command
    return React.createElement(
      'span',
      { className: 'shell-command-tool-use' },
      display,
    )
  },

  renderToolResultMessage(
    {
      stdout,
      stderr,
      exit_code,
      risk_class,
      is_read_operation,
      is_destructive,
    }: ShellCommandToolOutput,
  ): React.ReactNode {
    const lines: string[] = []
    if (stdout) lines.push(stdout)
    if (stderr) lines.push(stderr)
    if (exit_code !== 0) lines.push(`Exit code: ${exit_code}`)
    lines.push(`Risk: ${risk_class}`)
    lines.push(`Read: ${is_read_operation}, Destructive: ${is_destructive}`)

    return React.createElement(
      'pre',
      { className: 'shell-command-result' },
      lines.join('\n'),
    )
  },

  extractSearchText(out: ShellCommandToolOutput): string {
    return out.stderr ? `${out.stdout}\n${out.stderr}` : out.stdout
  },
} satisfies ToolDef<InputSchema, ShellCommandToolOutput>)
