/**
 * Minimal React typings.
 * The build environment had no npm registry access, so @types/react could not be
 * installed. These declarations cover the APIs this app uses. After a normal
 * `npm install` with @types/react available, delete this file.
 */
declare module 'react' {
  export type ReactNode = any;
  export type Key = string | number;
  export type SetStateAction<S> = S | ((prev: S) => S);
  export type Dispatch<A> = (value: A) => void;
  export interface RefObject<T> { current: T }
  export interface Context<T> { Provider: (p: { value: T; children?: ReactNode }) => any }
  export function useState<S>(initial: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useState<S = undefined>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>];
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useLayoutEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useRef<T>(initial: T): RefObject<T>;
  export function useRef<T>(initial: T | null): RefObject<T | null>;
  export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
  export function useCallback<T extends (...args: any[]) => any>(fn: T, deps: readonly unknown[]): T;
  export function useContext<T>(ctx: Context<T>): T;
  export function createContext<T>(defaultValue: T): Context<T>;
  export function useId(): string;
  export function lazy<T extends (p: any) => any>(load: () => Promise<{ default: T }>): T;
  export const Suspense: (p: { fallback?: ReactNode; children?: ReactNode }) => any;
  export const Fragment: (p: { children?: ReactNode }) => any;
  export const StrictMode: (p: { children?: ReactNode }) => any;
  const React: { Fragment: typeof Fragment };
  export default React;
}

declare module 'react-dom/client' {
  export function createRoot(el: Element): { render(node: any): void };
}

declare module 'react/jsx-runtime' {
  export namespace JSX {
    type Element = any;
    interface ElementClass { render(): any }
    interface ElementChildrenAttribute { children: {} }
    interface IntrinsicAttributes { key?: string | number | null }
    interface IntrinsicElements { [tag: string]: any }
  }
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare module '*.css';
