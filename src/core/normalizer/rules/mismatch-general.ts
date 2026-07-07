import { interpolateParsedStyle, parseStyleValue } from '../../style'
import { zip } from '../../utils'
import { matchedIndexes, NormalizerRule, probeComputedValue } from '../normalizer'

/**
 * Read real computed style from animation target when input units are mismatched.
 * Use the numeric value from real style if it has the same structure and unit
 * with the counterpart.
 */
export const mismatchGeneralRule: NormalizerRule = (el, key, target, counterpart) => {
  const indexes = matchedIndexes(
    target,
    counterpart,
    (t, c) => t.unit !== c.unit && c.unit === 'px',
  )

  if (indexes.length === 0) {
    return target
  }

  const computedStr = probeComputedValue(el, key, interpolateParsedStyle(target, target.values))
  const computed = parseStyleValue(computedStr)

  // Compare the structures between computed style and target style value.
  // Do not accept computed style if the structures are mismatched.
  if (computed.values.length !== target.values.length) return target
  if (computed.wraps.length !== target.wraps.length) return target
  const sameWraps = zip(computed.wraps, target.wraps).every(([cw, tw]) => cw === tw)
  if (!sameWraps) {
    return target
  }

  const values = [...target.values]
  const units = [...target.units]
  for (const i of indexes) {
    // Do not use computed style if the computed slot's unit does not match
    // with counterpart.
    if (computed.units[i] !== 'px') {
      continue
    }
    values[i] = computed.values[i]!
    units[i] = computed.units[i]!
  }

  return {
    ...target,
    values,
    units,
  }
}
