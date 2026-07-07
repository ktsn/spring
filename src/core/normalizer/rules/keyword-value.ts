import { parseStyleValue } from '../../style'
import { NormalizerRule, probeComputedValue } from '../normalizer'

/**
 * Keywords that the browser resolves to concrete px lengths when they are
 * written to a rendered element and the computed style is read back.
 */
const resolvableKeywords = new Set(['auto', 'min-content', 'max-content', 'fit-content', 'stretch'])

/**
 * Resolve a style value that is solely a sizing keyword (e.g. `auto`,
 * `min-content`) into concrete numeric values by writing the keyword to the
 * element and reading the computed style. The computed style is accepted
 * only when all of its slots are resolved to px; otherwise the keyword is
 * kept as is. Note that the accepted value may have a different slot count
 * from the original (zero slots) one.
 */
export const keywordValueRule: NormalizerRule = (el, key, target) => {
  if (target.values.length !== 0 || target.wraps.length !== 1) {
    return target
  }

  const keyword = target.wraps[0]!.trim()
  if (!resolvableKeywords.has(keyword)) {
    return target
  }

  const computed = parseStyleValue(probeComputedValue(el, key, keyword))
  const allPx = computed.values.length > 0 && computed.units.every((unit) => unit === 'px')

  return allPx ? computed : target
}
