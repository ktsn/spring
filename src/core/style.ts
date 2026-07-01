export interface StyleTemplate {
  units: string[]
  wraps: string[]
}

export interface StyleValue<T> extends StyleTemplate {
  values: T[]
}

export type ParsedStyleValue = StyleValue<number>

type Token = CharToken | NumberToken | HexColorToken

interface CharToken {
  type: 'char'
  value: string
}

interface NumberToken {
  type: 'number'
  value: number
  unit: string
}

interface HexColorToken {
  type: 'hexColor'
  red: number
  green: number
  blue: number
  alpha: number | undefined
}

// Matches one of:
//   1. Hex color (#rgb, #rgba, #rrggbb, #rrggbbaa) — longer alternatives first
//   2. Number (with optional sign, fractional, exponent) plus optional unit
//   3. Any single character
const tokenRe =
  /(#(?:[0-9a-fA-F]{2}){3,4}|#[0-9a-fA-F]{3,4})|([+-]?(?:(?:0|[1-9]\d*)(?:\.\d+)?|\.\d+)(?:[eE][+-]?(?:0|[1-9]\d*))?)([a-z%]+)?|([\s\S])/g

const leadingUnitRe = /^[a-z%]+/

export function parseLeadingUnit(text: string): { unit: string; rest: string } {
  const m = text.match(leadingUnitRe)
  if (!m) {
    return { unit: '', rest: text }
  }
  return { unit: m[0], rest: text.slice(m[0].length) }
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  tokenRe.lastIndex = 0

  let m: RegExpExecArray | null
  while ((m = tokenRe.exec(input)) !== null) {
    if (m[1] !== undefined) {
      const hex = m[1].slice(1)
      const double = hex.length >= 6
      const step = double ? 2 : 1
      const parts: number[] = []

      for (let i = 0; i < hex.length; i += step) {
        const seg = hex.slice(i, i + step)
        parts.push(parseInt(double ? seg : seg + seg, 16))
      }

      tokens.push({
        type: 'hexColor',
        red: parts[0]!,
        green: parts[1]!,
        blue: parts[2]!,
        alpha: parts[3] === undefined ? undefined : parts[3] / 0xff,
      })
    } else if (m[2] !== undefined) {
      tokens.push({
        type: 'number',
        value: Number(m[2]),
        unit: m[3] ?? '',
      })
    } else {
      tokens.push({ type: 'char', value: m[4]! })
    }
  }

  return tokens
}

export function parseStyleValue(value: string): ParsedStyleValue {
  const tokens: Token[] = [...tokenize(value), { type: 'char', value: '' }]

  return tokens.reduce<ParsedStyleValue>(
    (acc, token, i) => {
      const last = tokens[i - 1]
      const continuousWrap = last?.type === 'char' || last?.type === 'hexColor'

      if (token.type === 'char') {
        if (continuousWrap) {
          acc.wraps[acc.wraps.length - 1] += token.value
        } else {
          acc.wraps.push(token.value)
        }
        return acc
      }

      if (token.type === 'number') {
        if (!continuousWrap) {
          acc.wraps.push('')
        }
        acc.values.push(token.value)
        acc.units.push(token.unit)
        return acc
      }

      const prefix = token.alpha === undefined ? 'rgb(' : 'rgba('
      if (continuousWrap) {
        acc.wraps[acc.wraps.length - 1] += prefix
      } else {
        acc.wraps.push(prefix)
      }

      acc.values.push(token.red, token.green, token.blue)
      acc.units.push('', '', '')
      acc.wraps.push(', ', ', ')

      if (token.alpha !== undefined) {
        acc.values.push(token.alpha)
        acc.units.push('')
        acc.wraps.push(', ')
      }

      acc.wraps.push(')')

      return acc
    },
    {
      values: [],
      units: [],
      wraps: [],
    },
  )
}

export function interpolateParsedStyle(
  template: StyleTemplate,
  values: (string | number)[],
): string {
  return template.wraps.reduce((acc, wrap, i) => {
    const unit = template.units[i] ?? ''

    const value =
      values[i] === undefined
        ? ''
        : typeof values[i] === 'number'
          ? `${values[i]}${unit}`
          : `calc(1${unit} * (${values[i]}))`

    return acc + wrap + value
  }, '')
}

/**
 * Concatenate multiple StyleValues into one, folding the trailing wrap of each
 * element with the leading wrap of the next so the boundary becomes a single
 * wrap segment.
 */
export function joinStyleValues<T>(parts: StyleValue<T>[]): StyleValue<T> {
  const wraps: string[] = ['']
  const units: string[] = []
  const values: T[] = []

  for (const part of parts) {
    wraps[wraps.length - 1] += part.wraps[0] ?? ''
    for (let i = 1; i < part.wraps.length; i++) {
      wraps.push(part.wraps[i]!)
    }
    units.push(...part.units)
    values.push(...part.values)
  }

  return { wraps, units, values }
}
