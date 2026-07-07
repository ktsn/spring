import { AnimationTarget } from '../animate'
import { ParsedStyleValue } from '../style'
import { clearStyle, readStyle, writeStyle } from '../utils'

/**
 * A normalizer rule. Receives the whole target style value and its
 * counterpart (`to` when the target is `from`, and vice versa) and returns
 * the normalized target. Must return the input `target` as-is when no
 * conversion applies.
 *
 * @param el animated element
 * @param key style property name that the target belongs to
 * @param target style value that may be converted
 * @param counterpart the other side of the from/to pair
 */
export type NormalizerRule = (
  el: AnimationTarget,
  key: string,
  target: ParsedStyleValue,
  counterpart: ParsedStyleValue,
) => ParsedStyleValue

export interface ValueWithUnit {
  value: number
  unit: string
}

/**
 * Collect the slot indexes where the predicate returns true for the
 * value/unit pairs of target and counterpart. Iterates up to the shorter
 * slot count of the two.
 */
export function matchedIndexes(
  target: ParsedStyleValue,
  counterpart: ParsedStyleValue,
  predicate: (target: ValueWithUnit, counterpart: ValueWithUnit) => boolean,
): number[] {
  const length = Math.min(target.values.length, counterpart.values.length)

  const indexes: number[] = []
  for (let i = 0; i < length; i++) {
    const targetPair = { value: target.values[i]!, unit: target.units[i]! }
    const counterpartPair = { value: counterpart.values[i]!, unit: counterpart.units[i]! }
    if (predicate(targetPair, counterpartPair)) {
      indexes.push(i)
    }
  }

  return indexes
}

/**
 * Write `value` to the element's inline style for `key`, read the computed
 * style for the same property, then restore the original inline value.
 */
export function probeComputedValue(el: AnimationTarget, key: string, value: string): string {
  const original = readStyle(el.style, key)
  writeStyle(el, key, value)

  const computed = readStyle(getComputedStyle(el), key)

  if (original === '') {
    clearStyle(el, key)
  } else {
    writeStyle(el, key, original)
  }

  return computed
}
