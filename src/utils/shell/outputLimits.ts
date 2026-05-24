import { validateBoundedIntEnvVar } from '../envValidation.js'

export const SHELL_MAX_OUTPUT_UPPER_LIMIT = 150_000
export const SHELL_MAX_OUTPUT_DEFAULT = 30_000

export function getMaxOutputLength(): number {
  const result = validateBoundedIntEnvVar(
    'SHELL_MAX_OUTPUT_LENGTH',
    process.env.SHELL_MAX_OUTPUT_LENGTH ?? process.env.BASH_MAX_OUTPUT_LENGTH,
    SHELL_MAX_OUTPUT_DEFAULT,
    SHELL_MAX_OUTPUT_UPPER_LIMIT,
  )
  return result.effective
}
