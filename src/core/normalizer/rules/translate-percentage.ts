import { AnimationTarget } from '../../animate'
import { NormalizerRule, matchedIndexes } from '../normalizer'

/**
 * Resolve percentage components of the individual `translate` property to
 * pixels when the matching endpoint component is already in pixels.
 *
 * Unlike ordinary lengths, percentages remain percentages in the computed
 * value of the individual `translate` property. Evaluating the same value as
 * a transform function makes the browser resolve it against the element's
 * transform reference box and serialize the result as a matrix, whose
 * translation components are pixel values.
 */
export const translatePercentageRule: NormalizerRule = (el, key, target, counterpart) => {
  if (key !== 'translate' || !isSimpleTranslate(target)) {
    return target
  }

  const indexes = matchedIndexes(target, counterpart, (t, c) => t.unit === '%' && c.unit === 'px')

  if (indexes.length === 0) {
    return target
  }

  const translation = probeTranslateMatrix(el, target.values, target.units)
  if (translation === undefined) {
    return target
  }

  const values = [...target.values]
  const units = [...target.units]
  for (const index of indexes) {
    values[index] = translation[index]!
    units[index] = 'px'
  }

  return {
    ...target,
    values,
    units,
  }
}

/**
 * The generic style parser treats every number as an animation slot. Restrict
 * this rule to the plain one-to-three-component grammar so an expression such
 * as `calc(50% + 10px)` is not incorrectly treated as two translate axes.
 */
function isSimpleTranslate(value: { values: number[]; wraps: string[] }): boolean {
  return (
    value.values.length >= 1 &&
    value.values.length <= 3 &&
    value.wraps.every((wrap) => /^\s*$/.test(wrap))
  )
}

/**
 * Get actual computed value of translate style with px unit.
 * values and units must be the same length array and their lengths must be
 * between one to three.
 */
function probeTranslateMatrix(
  el: AnimationTarget,
  values: number[],
  units: string[],
): [number, number, number] | undefined {
  const components = values.map((value, index) => `${value}${units[index] ?? ''}`)
  const transform =
    components.length === 3
      ? `translate3d(${components.join(', ')})`
      : `translate(${components.join(', ')})`

  const style = el.style
  const originalValue = style.getPropertyValue('transform')
  const originalPriority = style.getPropertyPriority('transform')

  try {
    // Clear first so an invalid probe cannot silently leave the old inline
    // transform in place and make us read an unrelated matrix.
    style.removeProperty('transform')
    style.setProperty('transform', transform, 'important')

    // Since we clear the old value above, we check empty string
    // to check the transform value is invalid,
    if (style.getPropertyValue('transform') === '') {
      return undefined
    }

    return parseMatrixTranslation(getComputedStyle(el).transform)
  } finally {
    if (originalValue === '') {
      style.removeProperty('transform')
    } else {
      style.setProperty('transform', originalValue, originalPriority)
    }
  }
}

function parseMatrixTranslation(value: string): [number, number, number] | undefined {
  const matrix3d = /^matrix3d\((.*)\)$/.exec(value.trim())
  if (matrix3d) {
    const entries = parseMatrixEntries(matrix3d[1]!, 16)
    return entries === undefined ? undefined : [entries[12]!, entries[13]!, entries[14]!]
  }

  const matrix = /^matrix\((.*)\)$/.exec(value.trim())
  if (matrix) {
    const entries = parseMatrixEntries(matrix[1]!, 6)
    return entries === undefined ? undefined : [entries[4]!, entries[5]!, 0]
  }

  return undefined
}

function parseMatrixEntries(value: string, expectedLength: number): number[] | undefined {
  const entries = value.split(',').map((part) => Number(part.trim()))
  return entries.length === expectedLength && entries.every(Number.isFinite) ? entries : undefined
}
