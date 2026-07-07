import { describe, expect, test } from 'vite-plus/test'

import { interpolateParsedStyle, joinStyleValues, parseStyleValue } from '../../src/core/style'

describe('parseStyleValue', () => {
  test('parse number with unit', () => {
    const parsed = parseStyleValue('100px')
    expect(parsed).toEqual({
      values: [100],
      units: ['px'],
      wraps: ['', ''],
    })
  })

  test('parse % unit', () => {
    const parsed = parseStyleValue('100%')
    expect(parsed).toEqual({
      values: [100],
      units: ['%'],
      wraps: ['', ''],
    })
  })

  test('parse translate', () => {
    const parsed = parseStyleValue('translate(100px, 200%)')
    expect(parsed).toEqual({
      values: [100, 200],
      units: ['px', '%'],
      wraps: ['translate(', ', ', ')'],
    })
  })

  test('parse scale', () => {
    const parsed = parseStyleValue('scale(100, 200)')
    expect(parsed).toEqual({
      values: [100, 200],
      units: ['', ''],
      wraps: ['scale(', ', ', ')'],
    })
  })

  test('parse rotate', () => {
    const parsed = parseStyleValue('rotate(90deg)')
    expect(parsed).toEqual({
      values: [90],
      units: ['deg'],
      wraps: ['rotate(', ')'],
    })
  })

  test('no interesting token', () => {
    const parsed = parseStyleValue('blue, cyan')
    expect(parsed).toEqual({
      values: [],
      units: [],
      wraps: ['blue, cyan'],
    })
  })

  describe('color parser', () => {
    test('parse color', () => {
      const parsed = parseStyleValue('rgb(255, 204, 0)')
      expect(parsed).toEqual({
        values: [255, 204, 0],
        units: ['', '', ''],
        wraps: ['rgb(', ', ', ', ', ')'],
      })
    })

    test('parse hex color', () => {
      const parsed = parseStyleValue('#fc0')
      expect(parsed).toEqual({
        values: [0xff, 0xcc, 0],
        units: ['', '', ''],
        wraps: ['rgb(', ', ', ', ', ')'],
      })
    })

    test('parse rgba hex color', () => {
      const parsed = parseStyleValue('#fc0a')
      expect(parsed).toEqual({
        values: [0xff, 0xcc, 0, 0xaa / 0xff],
        units: ['', '', '', ''],
        wraps: ['rgba(', ', ', ', ', ', ', ')'],
      })
    })

    test('parse double hex color', () => {
      const parsed = parseStyleValue('#faca0a')
      expect(parsed).toEqual({
        values: [0xfa, 0xca, 0x0a],
        units: ['', '', ''],
        wraps: ['rgb(', ', ', ', ', ')'],
      })
    })

    test('multiple colors', () => {
      const parsed = parseStyleValue('#fc0, #ffcc00')
      expect(parsed).toEqual({
        values: [255, 204, 0, 255, 204, 0],
        units: ['', '', '', '', '', ''],
        wraps: ['rgb(', ', ', ', ', '), rgb(', ', ', ', ', ')'],
      })
    })
  })

  describe('number parser', () => {
    test('integer', () => {
      const parsed = parseStyleValue('100')
      expect(parsed).toEqual({
        values: [100],
        units: [''],
        wraps: ['', ''],
      })
    })

    test('zero', () => {
      const parsed = parseStyleValue('0')
      expect(parsed).toEqual({
        values: [0],
        units: [''],
        wraps: ['', ''],
      })
    })

    test('float', () => {
      const parsed = parseStyleValue('100.5')
      expect(parsed).toEqual({
        values: [100.5],
        units: [''],
        wraps: ['', ''],
      })
    })

    test('float without zero', () => {
      const parsed = parseStyleValue('.5')
      expect(parsed).toEqual({
        values: [0.5],
        units: [''],
        wraps: ['', ''],
      })
    })

    test('with plus sign', () => {
      const parsed = parseStyleValue('+100')
      expect(parsed).toEqual({
        values: [100],
        units: [''],
        wraps: ['', ''],
      })
    })

    test('with minus sign', () => {
      const parsed = parseStyleValue('-100')
      expect(parsed).toEqual({
        values: [-100],
        units: [''],
        wraps: ['', ''],
      })
    })

    test('exponential', () => {
      const parsed = parseStyleValue('10e3')
      expect(parsed).toEqual({
        values: [10000],
        units: [''],
        wraps: ['', ''],
      })
    })

    test('floating exponential', () => {
      const parsed = parseStyleValue('-3.4e-2')
      expect(parsed).toEqual({
        values: [-0.034],
        units: [''],
        wraps: ['', ''],
      })
    })
  })
})

describe('joinStyleValues', () => {
  test('empty input returns empty StyleValue', () => {
    expect(joinStyleValues<number>([])).toEqual({
      wraps: [''],
      units: [],
      values: [],
    })
  })

  test('single part is returned as-is', () => {
    const part = {
      wraps: ['translate(', 'px)'],
      units: ['px'],
      values: [10],
    }
    expect(joinStyleValues([part])).toEqual(part)
  })

  test('parts without values fold into a single wrap', () => {
    const a = { wraps: ['hello '], units: [], values: [] }
    const b = { wraps: ['world'], units: [], values: [] }
    expect(joinStyleValues<number>([a, b])).toEqual({
      wraps: ['hello world'],
      units: [],
      values: [],
    })
  })

  test('joins multiple parts preserving order', () => {
    const parts = [
      { wraps: ['a', 'b'], units: ['px'], values: [1] },
      { wraps: ['c', 'd'], units: ['%'], values: [2] },
      { wraps: ['e', 'f'], units: ['deg'], values: [3] },
    ]
    expect(joinStyleValues(parts)).toEqual({
      wraps: ['a', 'bc', 'de', 'f'],
      units: ['px', '%', 'deg'],
      values: [1, 2, 3],
    })
  })

  test('handles empty wrap string at part boundary', () => {
    const a = { wraps: ['', ''], units: ['px'], values: [1] }
    const b = { wraps: ['', ''], units: ['px'], values: [2] }
    expect(joinStyleValues([a, b])).toEqual({
      wraps: ['', '', ''],
      units: ['px', 'px'],
      values: [1, 2],
    })
  })
})

describe('stringifyInterpolatedStyle', () => {
  test('generate with specified numbers', () => {
    const actual = interpolateParsedStyle(
      {
        units: ['px', '%'],
        wraps: ['translate(', ', ', ')'],
      },
      [100, 200],
    )
    expect(actual).toBe('translate(100px, 200%)')
  })

  test('generate with specified expressions', () => {
    const actual = interpolateParsedStyle(
      {
        units: ['px', '%'],
        wraps: ['translate(', ', ', ')'],
      },
      ['100 * exp(3)', '100 * exp(4)'],
    )
    expect(actual).toBe('translate(calc(1px * (100 * exp(3))), calc(1% * (100 * exp(4))))')
  })
})
