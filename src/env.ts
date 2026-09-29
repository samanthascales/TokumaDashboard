/** True when built with `npm run build:artifact` for hosting inside a sandboxed frame (no URL routing, printing or downloads). */
export const IS_EMBEDDED = import.meta.env.MODE === 'artifact';
