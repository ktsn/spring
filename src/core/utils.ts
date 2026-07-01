import type { AnimationTarget } from './animate'

export function writeStyle(target: AnimationTarget, key: string, value: string): void {
  if (key.startsWith('--')) {
    target.style.setProperty(key, value)
  } else {
    target.style[key as any] = value
  }
}

export function clearStyle(target: AnimationTarget, key: string): void {
  if (key.startsWith('--')) {
    target.style.removeProperty(key)
  } else {
    ;(target.style as any)[key] = ''
  }
}

export function readStyle(style: CSSStyleDeclaration, key: string): string {
  if (key.startsWith('--')) {
    return style.getPropertyValue(key)
  }
  return (style as any)[key] ?? ''
}

export function mapValues<T, U>(
  object: T,
  fn: (value: T[keyof T], key: keyof T) => U,
): { [K in keyof T]: U } {
  const result: any = {}
  for (const key in object) {
    result[key] = fn(object[key], key)
  }
  return result
}

export function zip<T, U>(a: readonly T[], b: readonly U[]): [T, U][] {
  const result: [T, U][] = []
  const length = Math.min(a.length, b.length)
  for (let i = 0; i < length; i++) {
    result.push([a[i]!, b[i]!])
  }
  return result
}

export function range(start: number, end: number): number[] {
  const result = []
  for (let i = start; i < end; i++) {
    result.push(i)
  }
  return result
}

export function isWebAnimationsApiSupported(): boolean {
  return typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function'
}

export function isCssLinearTimingFunctionSupported(): boolean {
  return typeof CSS !== 'undefined' && CSS.supports('transition-timing-function', 'linear(0, 1)')
}

export function isCssMathAnimationSupported(): boolean {
  return (
    typeof CSS !== 'undefined' &&
    typeof CSS.registerProperty === 'function' &&
    CSS.supports('width', 'calc(1px * exp(0))')
  )
}

export function forceReflow(): void {
  void document.body.offsetHeight
}
