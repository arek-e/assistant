"use client";

import { useCallback, useSyncExternalStore } from "react";

const BREAKPOINTS = {
  "2xl": 1536,
  "3xl": 1600,
  "4xl": 2000,
  lg: 1024,
  md: 800,
  sm: 640,
  xl: 1280
} as const;

type Breakpoint = keyof typeof BREAKPOINTS;

type BreakpointQuery = Breakpoint | `max-${Breakpoint}` | `${Breakpoint}:max-${Breakpoint}`;

const DEFAULT_QUERY = "(min-width: 0px)";

function resolveMin(value: Breakpoint | number): string {
  const px = typeof value === "number" ? value : BREAKPOINTS[value];
  return `(min-width: ${px}px)`;
}

function resolveMax(value: Breakpoint | number): string {
  const px = typeof value === "number" ? value : BREAKPOINTS[value];
  return `(max-width: ${px - 1}px)`;
}

function resolvePointer(pointer: MediaQueryInput["pointer"]): string | null {
  if (!pointer) return null;
  return `(pointer: ${pointer})`;
}

function parseInputQuery(query: MediaQueryInput): string {
  const parts = [
    query.min == null ? null : resolveMin(query.min),
    query.max == null ? null : resolveMax(query.max),
    resolvePointer(query.pointer)
  ].filter((part): part is string => Boolean(part));

  return parts.join(" and ") || DEFAULT_QUERY;
}

function getBreakpoint(value: string): Breakpoint | null {
  return value in BREAKPOINTS ? (value as Breakpoint) : null;
}

function parseSegment(segment: string): string | null {
  if (segment.startsWith("max-")) {
    const breakpoint = getBreakpoint(segment.slice(4));
    return breakpoint ? resolveMax(breakpoint) : null;
  }

  const breakpoint = getBreakpoint(segment);
  return breakpoint ? resolveMin(breakpoint) : null;
}

function parseStringQuery(query: string): string {
  if (query.startsWith("(")) return query;

  const parts = query
    .split(":")
    .map(parseSegment)
    .filter((part): part is string => Boolean(part));

  return parts.join(" and ") || query;
}

function parseQuery(query: BreakpointQuery | MediaQueryInput | (string & {})): string {
  return typeof query === "string" ? parseStringQuery(query) : parseInputQuery(query);
}

function getServerSnapshot(): boolean {
  return false;
}

export interface MediaQueryInput {
  min?: Breakpoint | number;
  max?: Breakpoint | number;
  /** Touch-like input (finger). Use "fine" for mouse/trackpad. */
  pointer?: "coarse" | "fine";
}

export function useMediaQuery(query: BreakpointQuery | MediaQueryInput | (string & {})): boolean {
  const mediaQuery = parseQuery(query);

  const subscribe = useCallback(
    (callback: () => void) => {
      if (typeof window === "undefined") return () => {};
      const mql = window.matchMedia(mediaQuery);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    [mediaQuery]
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(mediaQuery).matches;
  }, [mediaQuery]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useIsMobile(): boolean {
  return useMediaQuery("max-md");
}
