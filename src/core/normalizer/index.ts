import { AnimateValue, AnimationTarget } from '../animate'
import { snapshotSpringStyle } from '../spring-value'
import { ParsedStyleValue, parseStyleValue } from '../style'
import { clearStyle, mapValues, readStyle, writeStyle, zip } from '../utils'
import { NormalizerContext, NormalizerRule } from './normalizer'
import { mismatchGeneralRule } from './rules/mismatch-general'
import { zeroValueRule } from './rules/zero-value'

const allRules = [zeroValueRule, mismatchGeneralRule]

/**
 * Convert raw user-provided `from` / `to` styles into pairs of numeric style
 * values that are processible in a spring animation:
 *
 * 1. Fill entries that are missing on one side by reading the element's
 *    computed style with the inline override temporarily cleared.
 * 2. Parse each entry into a numeric `ParsedStyleValue`. User-provided
 *    spring style values are snapshotted through their `target` values.
 * 3. Apply conversion rules (see ./rules/) so that each slot has a numeric
 *    value with the same unit between `from` and `to`.
 *
 * A key is included in the result when it is present (non-null) on at least
 * one side. For a side that is present in the raw input, the returned
 * `ParsedStyleValue` keeps the slot count and order that the input parses
 * to — callers rely on this to associate normalized slots with user-provided
 * spring values by index.
 *
 * @param el DOM element that will be animated
 * @param rawFrom raw `from` style for each css property
 * @param rawTo raw `to` style for each css property
 * @returns normalized style pairs
 */
export function normalizeAnimationStyles(
  el: AnimationTarget,
  rawFrom: Record<string, AnimateValue | null | undefined>,
  rawTo: Record<string, AnimateValue | null | undefined>,
): Record<string, [ParsedStyleValue, ParsedStyleValue]> {
  const fromInput = resolveMissingEntries(el, rawFrom, rawTo)
  const toInput = resolveMissingEntries(el, rawTo, rawFrom)

  const parsedFromTo = mapValues(toInput, (to, key): [ParsedStyleValue, ParsedStyleValue] => {
    return [parseAnimateValue(fromInput[key]!), parseAnimateValue(to)]
  })

  return mapValues(parsedFromTo, ([from, to], key): [ParsedStyleValue, ParsedStyleValue] => {
    return allRules.reduce(
      ([accFrom, accTo], rule): [ParsedStyleValue, ParsedStyleValue] => [
        normalizeWithRule(el, accFrom, accTo, key, rule),
        normalizeWithRule(el, accTo, accFrom, key, rule),
      ],
      [from, to],
    )
  })
}

function parseAnimateValue(value: AnimateValue): ParsedStyleValue {
  return typeof value === 'object' ? snapshotSpringStyle(value) : parseStyleValue(String(value))
}

/**
 * Fill in entries that are missing from `target` compared with `counterpart`
 * by reading the element's computed style with the inline override for that
 * property temporarily cleared, then restored.
 *
 * A key is treated as "missing" when it is absent from the object OR present
 * with a `null` / `undefined` value.
 */
function resolveMissingEntries(
  el: AnimationTarget,
  target: Record<string, AnimateValue | null | undefined>,
  counterpart: Record<string, AnimateValue | null | undefined>,
): Record<string, AnimateValue> {
  const input: Record<string, AnimateValue> = {}
  for (const [key, value] of Object.entries(target)) {
    if (value != null) {
      input[key] = value
    }
  }

  const missingKeys = Object.keys(counterpart).filter(
    (k) => counterpart[k] != null && target[k] == null,
  )
  if (missingKeys.length === 0) {
    return input
  }

  withClearedInlineStyles(el, missingKeys, (computed) => {
    for (const key of missingKeys) {
      input[key] = readStyle(computed, key)
    }
  })

  return input
}

/**
 * Temporarily clear the inline styles for `keys` on `target`, run `callback`,
 * then restore the original inline values. The callback receives the live
 * `CSSStyleDeclaration` so it can read computed values that no longer reflect
 * the inline overrides.
 */
function withClearedInlineStyles(
  target: AnimationTarget,
  keys: string[],
  callback: (computed: CSSStyleDeclaration) => void,
): void {
  const savedInline = keys.map((k) => [k, readStyle(target.style, k)] as const)

  for (const key of keys) {
    clearStyle(target, key)
  }

  callback(getComputedStyle(target))

  for (const [key, value] of savedInline) {
    if (value !== '') {
      writeStyle(target, key, value)
    }
  }
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
