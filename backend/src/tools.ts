import { Type, Behavior, type FunctionDeclaration } from '@google/genai';

/**
 * All canvas tool declarations sent to Gemini at session setup.
 * All tools are NON_BLOCKING — model does not pause speech while waiting for responses.
 */
export const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  // ------------------------------------------------------------------
  // Code Viewer
  // ------------------------------------------------------------------
  {
    name: 'code_viewer_show',
    description:
      'Display a code snippet on the visual canvas. ' +
      'You MUST call this every time you reference or show a specific piece of code — no exceptions. ' +
      'Call it mid-sentence without announcing it. Keep talking. The canvas updates silently.',
    behavior: Behavior.NON_BLOCKING,
    parameters: {
      type: Type.OBJECT,
      properties: {
        language: {
          type: Type.STRING,
          description: 'Programming language for syntax highlighting, e.g. "python", "javascript".',
        },
        code: {
          type: Type.STRING,
          description: 'The full code snippet to display.',
        },
      },
      required: ['language', 'code'],
    },
  },

  // ------------------------------------------------------------------
  // Call Stack
  // ------------------------------------------------------------------
  {
    name: 'call_stack_show',
    description:
      'Create a call stack visualiser on the canvas. Call this before pushing any frames. ' +
      'Use when explaining recursion, function call chains, or execution order.',
    behavior: Behavior.NON_BLOCKING,
    parameters: {
      type: Type.OBJECT,
      properties: {},
      required: [],
    },
  },
  {
    name: 'call_stack_push',
    description:
      'Push a new frame onto the call stack visualiser. ' +
      'Call this mid-sentence each time a new function call is made in your explanation.',
    behavior: Behavior.NON_BLOCKING,
    parameters: {
      type: Type.OBJECT,
      properties: {
        function_name: {
          type: Type.STRING,
          description: 'Name of the function being called, e.g. "fibonacci(3)".',
        },
        args: {
          type: Type.STRING,
          description: 'Arguments as a short string, e.g. "n=3". Use empty string if none.',
        },
      },
      required: ['function_name', 'args'],
    },
  },
  {
    name: 'call_stack_pop',
    description:
      'Pop the top frame from the call stack visualiser when a function returns. ' +
      'Call this mid-sentence each time a function returns in your explanation.',
    behavior: Behavior.NON_BLOCKING,
    parameters: {
      type: Type.OBJECT,
      properties: {},
      required: [],
    },
  },
  {
    name: 'call_stack_overflow',
    description:
      'Trigger a stack overflow visual state on the call stack — frames pile up with an overflow indicator. ' +
      'Use when explaining what happens with no base case or infinite recursion.',
    behavior: Behavior.NON_BLOCKING,
    parameters: {
      type: Type.OBJECT,
      properties: {},
      required: [],
    },
  },
  {
    name: 'call_stack_remove',
    description: 'Remove the call stack widget from the canvas entirely.',
    behavior: Behavior.NON_BLOCKING,
    parameters: {
      type: Type.OBJECT,
      properties: {},
      required: [],
    },
  },
];
