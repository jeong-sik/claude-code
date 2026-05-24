import { SandboxManager } from '../../utils/sandbox/sandbox-adapter.js'

type SandboxInput = {
  command?: string
  dangerouslyDisableSandbox?: boolean
}

/**
 * Determine whether a shell command should run inside the sandbox.
 *
 * TODO: Integrate with ShellCommandTool's gate-based risk classification.
 */
export function shouldUseSandbox(input: Partial<SandboxInput>): boolean {
  if (!SandboxManager.isSandboxingEnabled()) {
    return false
  }

  if (
    input.dangerouslyDisableSandbox &&
    SandboxManager.areUnsandboxedCommandsAllowed()
  ) {
    return false
  }

  if (!input.command) {
    return false
  }

  return true
}
