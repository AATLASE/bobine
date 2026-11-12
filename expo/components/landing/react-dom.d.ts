// react-dom ships with Expo web but the project has no @types/react-dom.
// The landing page only needs flushSync (to commit a vote inside a View Transition).
declare module "react-dom" {
  export function flushSync<R>(fn: () => R): R;
}
