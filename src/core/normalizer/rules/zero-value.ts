import { matchedIndexes, NormalizerRule } from '../normalizer'

/**
 * Complete a unit with its counterpart when its value is zero.
 */
export const zeroValueRule: NormalizerRule = (_el, _key, target, counterpart) => {
  const indexes = matchedIndexes(target, counterpart, (t) => t.value === 0 && t.unit === '')

  if (indexes.length === 0) {
    return target
  }

  const units = [...target.units]
  for (const i of indexes) {
    units[i] = counterpart.units[i]!
  }

  return {
    ...target,
    units,
  }
}
