import { afterEach, describe, expect, test, vitest } from 'vite-plus/test'
import type { MockInstance } from 'vite-plus/test'

import { normalizeAnimationStyles } from '../../src/core/normalizer'
import { sv } from '../../src/core/spring-value'

function el(): HTMLElement {
  return document.createElement('div')
}

const activeSpies: MockInstance[] = []

afterEach(() => {
  while (activeSpies.length) {
    activeSpies.pop()!.mockRestore()
  }
})

/**
 * Spy on `getComputedStyle` so that, for the given `target`, properties
 * listed in `overrides` report the overridden value. Custom property
 * overrides are served through `getPropertyValue`, others through direct
 * property access.
 *
 * With `ifInlineCleared: true`, an override applies only while the inline
 * style for that property is cleared. Other properties (and other elements)
 * pass through to the real implementation. The spy is auto-restored in afterEach.
 */
function mockComputedStyles(
  target: HTMLElement,
  overrides: Record<string, string>,
  options: { ifInlineCleared?: boolean } = {},
): void {
  const real = globalThis.getComputedStyle

  const readInline = (key: string): string =>
    key.startsWith('--')
      ? target.style.getPropertyValue(key)
      : (((target.style as any)[key] ?? '') as string)

  const overrideFor = (key: string): string | undefined => {
    if (!(key in overrides)) {
      return undefined
    }

    if (options.ifInlineCleared && readInline(key) !== '') {
      return undefined
    }

    return overrides[key]
  }

  const spy = vitest
    .spyOn(globalThis, 'getComputedStyle')
    .mockImplementation((elt: Element, pseudo?: string | null) => {
      const cs = real(elt, pseudo)
      if (elt !== target) {
        return cs
      }

      return new Proxy(cs, {
        get(t, prop, receiver) {
          if (prop === 'getPropertyValue') {
            return (name: string) => {
              if (name.startsWith('--')) {
                const override = overrideFor(name)
                if (override !== undefined) {
                  return override
                }
              }
              return t.getPropertyValue(name)
            }
          }

          if (typeof prop === 'string' && !prop.startsWith('--')) {
            const override = overrideFor(prop)
            if (override !== undefined) {
              return override
            }
          }

          return Reflect.get(t, prop, receiver)
        },
      }) as CSSStyleDeclaration
    })

  activeSpies.push(spy)
}

describe('normalizeAnimationStyles', () => {
  test('parses raw string and number entries into numeric pairs', () => {
    const result = normalizeAnimationStyles(el(), { width: '10px' }, { width: '50px' })
    expect(result).toEqual({
      width: [
        { values: [10], units: ['px'], wraps: ['', ''] },
        { values: [50], units: ['px'], wraps: ['', ''] },
      ],
    })
  })

  test('snapshots SpringStyleValue entries through their target values', () => {
    const result = normalizeAnimationStyles(el(), { '--x': sv`${10}px` }, { '--x': sv`${20}px` })
    expect(result).toEqual({
      '--x': [
        { values: [10], units: ['px'], wraps: ['', ''] },
        { values: [20], units: ['px'], wraps: ['', ''] },
      ],
    })
  })

  describe('missing entry resolution', () => {
    test('drops keys that are null or undefined on both sides', () => {
      const result = normalizeAnimationStyles(el(), { width: null }, { width: undefined })
      expect(result).toEqual({})
    })

    test('resolves entries missing on one side from computed style and restores inline overrides', () => {
      const target = el()
      target.style.setProperty('--from-only', '40px')
      target.style.setProperty('--to-only', '60px')

      mockComputedStyles(
        target,
        {
          '--from-only': '5px',
          '--to-only': '7px',
        },
        { ifInlineCleared: true },
      )

      const result = normalizeAnimationStyles(
        target,
        { '--to-only': '60px' },
        { '--from-only': '40px' },
      )

      expect(result['--from-only']?.[0]?.values).toEqual([5])
      expect(result['--from-only']?.[1]?.values).toEqual([40])
      expect(result['--to-only']?.[0]?.values).toEqual([60])
      expect(result['--to-only']?.[1]?.values).toEqual([7])

      // Inline overrides are restored after resolution.
      expect(target.style.getPropertyValue('--from-only')).toBe('40px')
      expect(target.style.getPropertyValue('--to-only')).toBe('60px')
    })

    test('treats null / undefined entries as missing and resolves them from computed style', () => {
      const target = el()
      target.style.setProperty('--from-only', '40px')
      target.style.setProperty('--to-only', '60px')

      mockComputedStyles(
        target,
        {
          '--from-only': '5px',
          '--to-only': '7px',
        },
        { ifInlineCleared: true },
      )

      const result = normalizeAnimationStyles(
        target,
        { '--to-only': '60px', '--from-only': null },
        { '--from-only': '40px', '--to-only': undefined },
      )

      expect(result['--from-only']?.[0]?.values).toEqual([5])
      expect(result['--from-only']?.[1]?.values).toEqual([40])
      expect(result['--to-only']?.[0]?.values).toEqual([60])
      expect(result['--to-only']?.[1]?.values).toEqual([7])

      // Inline overrides are restored after resolution.
      expect(target.style.getPropertyValue('--from-only')).toBe('40px')
      expect(target.style.getPropertyValue('--to-only')).toBe('60px')
    })
  })

  describe('zero value unit resolution', () => {
    test('completes a zero value unit from its counterpart', () => {
      const result = normalizeAnimationStyles(el(), { '--x': '100%' }, { '--x': 0 })
      expect(result['--x']?.[0]?.units).toEqual(['%'])
      expect(result['--x']?.[1]?.units).toEqual(['%'])
      expect(result['--x']?.[1]?.values).toEqual([0])
    })
  })

  describe('mismatch resolution', () => {
    test('resolves a non-px `from` to px when `to` is px', () => {
      const target = el()
      mockComputedStyles(target, { width: '160px' })

      const result = normalizeAnimationStyles(target, { width: '10rem' }, { width: '300px' })

      expect(result).toEqual({
        width: [
          { values: [160], units: ['px'], wraps: ['', ''] },
          { values: [300], units: ['px'], wraps: ['', ''] },
        ],
      })
    })

    test('resolves a non-px `to` to px when `from` is px', () => {
      const target = el()
      mockComputedStyles(target, { width: '160px' })

      const result = normalizeAnimationStyles(target, { width: '300px' }, { width: '10rem' })

      expect(result).toEqual({
        width: [
          { values: [300], units: ['px'], wraps: ['', ''] },
          { values: [160], units: ['px'], wraps: ['', ''] },
        ],
      })
    })

    test('resolves only the mixed-unit slot in a multi-slot value', () => {
      const target = el()
      mockComputedStyles(target, { padding: '10px 16px' })

      const result = normalizeAnimationStyles(
        target,
        { padding: '10px 1rem' },
        { padding: '20px 30px' },
      )

      expect(result['padding']?.[0]?.values).toEqual([10, 16])
      expect(result['padding']?.[0]?.units).toEqual(['px', 'px'])
      expect(result['padding']?.[1]?.values).toEqual([20, 30])
    })

    test('skips resolution when computed expands to a different wraps structure', () => {
      const target = el()
      mockComputedStyles(target, { transform: 'matrix(1, 0, 0, 1, 16, 0)' })

      const result = normalizeAnimationStyles(
        target,
        { transform: 'translate(1rem)' },
        { transform: 'translate(100px)' },
      )

      expect(result['transform']?.[0]?.values).toEqual([1])
      expect(result['transform']?.[0]?.units).toEqual(['rem'])
      expect(result['transform']?.[1]?.values).toEqual([100])
    })

    test('skips resolution for custom properties (computed echoes the inline unit)', () => {
      const result = normalizeAnimationStyles(el(), { '--x': '1rem' }, { '--x': '100px' })

      expect(result['--x']?.[0]?.values).toEqual([1])
      expect(result['--x']?.[0]?.units).toEqual(['rem'])
      expect(result['--x']?.[1]?.values).toEqual([100])
    })

    test('leaves matching-unit and both-non-px pairs untouched', () => {
      // getComputedStyle must not be invoked when there's nothing to resolve
      // (no missing keys, no probe needed).
      const spy = vitest.spyOn(globalThis, 'getComputedStyle')
      activeSpies.push(spy)

      const result = normalizeAnimationStyles(
        el(),
        { width: '10px', height: '1em' },
        { width: '50px', height: '5em' },
      )

      expect(spy).not.toHaveBeenCalled()
      expect(result['width']?.[0]?.values).toEqual([10])
      expect(result['width']?.[1]?.values).toEqual([50])
      expect(result['height']?.[0]?.units).toEqual(['em'])
      expect(result['height']?.[1]?.units).toEqual(['em'])
    })

    test('restores a pre-existing inline value after probing', () => {
      const target = el()
      target.style.width = '50px'

      mockComputedStyles(target, { width: '160px' })

      normalizeAnimationStyles(target, { width: '10rem' }, { width: '300px' })

      expect(target.style.width).toBe('50px')
    })

    test('clears the inline value after probing when it was empty before', () => {
      const target = el()

      mockComputedStyles(target, { transform: 'matrix(1, 0, 0, 1, 16, 0)' })

      normalizeAnimationStyles(
        target,
        { transform: 'translate(1rem)' },
        { transform: 'translate(100px)' },
      )

      // Skipped path also restores: empty inline stays empty.
      expect(target.style.transform).toBe('')
    })
  })
})
