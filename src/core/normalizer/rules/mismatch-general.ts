import { interpolateParsedStyle, ParsedStyleValue, parseStyleValue } from '../../style'
import { clearStyle, readStyle, writeStyle, zip } from '../../utils'
import { NormalizerRule } from '../normalizer'

/**
 * Read real computed style from animation target when input units are mismatched.
 * Use the numeric value from real style if it has the same structure and unit
 * with the counterpart.
 */
export const mismatchGeneralRule: NormalizerRule<ParsedStyleValue | undefined> = {
  check: ({ target, counterpart }) => target.unit !== counterpart.unit && counterpart.unit === 'px',

  prepare: (el, key, style) => {
    const original = readStyle(el.style, key)
    writeStyle(el, key, interpolateParsedStyle(style, style.values))

    const computedStr = readStyle(getComputedStyle(el), key)
    const computed = parseStyleValue(computedStr)

    if (original === '') {
      clearStyle(el, key)
    } else {
      writeStyle(el, key, original)
    }

    // Compare the structures between computed style and target style value.
    // Do not accept computed style if the structures are mismatched.
    if (computed.values.length !== style.values.length) return undefined
    if (computed.wraps.length !== style.wraps.length) return undefined
    const sameWraps = zip(computed.wraps, style.wraps).every(([rw, sw]) => rw === sw)
    if (!sameWraps) {
      return undefined
    }

    return computed
  },

  normalize: ({ target, index }, passed) => {
    if (!passed) {
      return target
    }

    // Do not use computed style if the target slot's unit matches with counterpart.
    if (passed.units[index] !== 'px') {
      return target
    }

    return {
      value: passed.values[index]!,
      unit: passed.units[index]!,
    }
  },
}
