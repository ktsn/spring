import { AnimationTarget } from '../animate'
import { ParsedStyleValue } from '../style'

/**
 * A definition to convert a pair of value and unit to animatable ones.
 * Basically, a NormalizerRule should convert styles to have a numeric value
 * with the same unit between `from` and `to`.
 */
export interface NormalizerRule<T = undefined> {
  /**
   * Returns true if the target value and unit pair needs conversion.
   */
  check: (ctx: NormalizerContext) => boolean

  /**
   * Acquire values from animated element before normalization.
   * The returned value will be passed to `normalized` hook.
   * @param el animated element
   * @param key processing style property key
   * @param style target style value
   */
  prepare?: (el: AnimationTarget, key: string, style: ParsedStyleValue) => T

  /**
   * Actual conversion logic. Must return the converted value and unit pair.
   * @param prepared calculated value in prepare hook if any
   * @returns converted pair
   */
  normalize: (ctx: NormalizerContext, prepared: T) => ValueWithUnit
}

export interface NormalizerContext {
  /**
   * Value and unit pair that may be converted
   */
  target: ValueWithUnit

  /**
   * Another part of value and unit pair. `to` when the targe is `from`.
   * `from` when the target is `to`.
   */
  counterpart: ValueWithUnit

  /**
   * Style property name that the target belongs to.
   */
  key: string

  /**
   * The slot index of target value and unit pair in a style value.
   */
  index: number
}

export interface ValueWithUnit {
  value: number
  unit: string
}
