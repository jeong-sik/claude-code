/**
 * ShellCommandTool — Shell IR 기반 고급 셸 실행 도구.
 *
 * Exports for the ShellCommandTool module.
 */

export { ShellCommandTool } from './ShellCommandTool.js'
export type {
  ShellCommandToolInput,
  ShellCommandToolOutput,
} from './ShellCommandTool.js'
export { parseToShellIr } from './parser.js'
export { getBaseCommand, getAllBaseCommands } from './ir-helpers.js'
export { classifyShellIr, isReadOperation, isDestructive } from './risk.js'
export { evaluateGate } from './gate.js'
export { SHELL_COMMAND_TOOL_NAME } from './toolName.js'
export type {
  RiskClass,
  ShellIrMode,
  ShellIr,
  ShellIrSimple,
  ShellIrPipeline,
  ShellIrRedirect,
  ShellIrParseResult,
  ShellIrParseError,
  ShellIrParseResponse,
  ShellIrGateVerdict,
} from './types.js'
