import { NormalizerRule } from '../normalizer'

/**
 * Complete a unit with its conterpart when its value is zero.
 */
export const zeroValueRule: NormalizerRule = {
  check: ({ target }) => target.value === 0 && target.unit === '',

  normalize: ({ target, counterpart }) => {
    return {
      value: target.value,
      unit: counterpart.unit,
    }
  },
}
