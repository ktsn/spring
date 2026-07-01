import { AnimationTarget } from '../animate'
import { ParsedStyleValue } from '../style'
import { mapValues, zip } from '../utils'
import { NormalizerContext, NormalizerRule } from './normalizer'
import { mismatchGeneralRule } from './rules/mismatch-general'
import { zeroValueRule } from './rules/zero-value'

const allRules = [zeroValueRule, mismatchGeneralRule]

/**
 * Convert styles to make them processible in a spring animation.
 * See ./rules/ for defined conversion rules.
 *
 * @param el DOM element that will be animated
 * @param fromTo style pairs for each css property
 * @returns converted style pairs
 */
export function normalizeAnimationStyles(
  el: AnimationTarget,
  fromTo: Record<string, [ParsedStyleValue, ParsedStyleValue]>,
): Record<string, [ParsedStyleValue, ParsedStyleValue]> {
  return mapValues(fromTo, ([from, to], key): [ParsedStyleValue, ParsedStyleValue] => {
    return allRules.reduce(
      ([accFrom, accTo], rule) => [
        normalizeWithRule(el, accFrom, accTo, key, rule),
        normalizeWithRule(el, accTo, accFrom, key, rule),
      ],
      [from, to],
    )
  })
}

function normalizeWithRule(
  el: AnimationTarget,
  target: ParsedStyleValue,
  counterpart: ParsedStyleValue,
  key: string,
  rule: NormalizerRule<any>,
): ParsedStyleValue {
  const contexts = zip(
    zip(target.values, target.units),
    zip(counterpart.values, counterpart.units),
  ).map(([[tv, tu], [cv, cu]], index): NormalizerContext => {
    return {
      target: {
        value: tv,
        unit: tu,
      },
      counterpart: {
        value: cv,
        unit: cu,
      },
      key,
      index,
    }
  })

  const matchedIndexes = new Set<number>()

  for (const ctx of contexts) {
    if (rule.check(ctx)) {
      matchedIndexes.add(ctx.index)
    }
  }

  if (matchedIndexes.size === 0) {
    return target
  }

  const passed = rule.prepare?.(el, key, target)
  const normalized = {
    ...target,
    values: [...target.values],
    units: [...target.units],
  }

  for (const ctx of contexts.filter((c) => matchedIndexes.has(c.index))) {
    const { value, unit } = rule.normalize(ctx, passed)
    normalized.values[ctx.index] = value
    normalized.units[ctx.index] = unit
  }

  return normalized
}
