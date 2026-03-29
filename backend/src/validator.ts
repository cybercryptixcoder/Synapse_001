/**
 * Validation layer — sits between Gemini and the canvas.
 * The model is treated as an untrusted external service.
 * Every tool call is checked before it touches state.
 */

type ArgType = 'string' | 'number' | 'boolean';

interface ArgSpec {
  type: ArgType;
  required: boolean;
}

interface ToolSpec {
  args: Record<string, ArgSpec>;
}

// Registry mirrors TOOL_DECLARATIONS in tools.ts.
// Add an entry here every time a new tool is added.
const REGISTRY: Record<string, ToolSpec> = {
  code_viewer_show: {
    args: {
      language: { type: 'string', required: true },
      code: { type: 'string', required: true },
    },
  },
};

export interface ValidatedCall {
  name: string;
  args: Record<string, unknown>;
}

export interface ValidationError {
  reason: string;
}

/**
 * Returns a ValidatedCall if the call is well-formed, or a ValidationError if not.
 */
export function validate(
  name: string,
  args: Record<string, unknown>
): ValidatedCall | ValidationError {
  const spec = REGISTRY[name];

  if (!spec) {
    return { reason: `Unknown tool: "${name}"` };
  }

  for (const [key, argSpec] of Object.entries(spec.args)) {
    if (argSpec.required && !(key in args)) {
      return { reason: `Missing required argument "${key}" for tool "${name}"` };
    }
    if (key in args && typeof args[key] !== argSpec.type) {
      return {
        reason: `Argument "${key}" for tool "${name}" must be ${argSpec.type}, got ${typeof args[key]}`,
      };
    }
  }

  return { name, args };
}

export function isError(result: ValidatedCall | ValidationError): result is ValidationError {
  return 'reason' in result;
}
