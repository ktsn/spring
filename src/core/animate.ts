import { normalizeAnimationStyles } from './normalizer/'
import {
  generateSpringExpressionStyle,
  createSpring,
  springSettlingDuration,
  springEasingFn,
  Spring,
} from './spring'
import {
  SpringComputed,
  SpringStyleValue,
  attachSpringValue,
  createSpringValue,
} from './spring-value'
import { ParsedStyleValue, StyleTemplate, interpolateParsedStyle } from './style'
import { registerPropertyIfNeeded, t, wait } from './time'
import {
  isCssLinearTimingFunctionSupported,
  isCssMathAnimationSupported,
  isWebAnimationsApiSupported,
  mapValues,
  writeStyle,
  zip,
} from './utils'

export type AnimationTarget = HTMLElement | SVGElement

export type AnimateValue = number | string | SpringStyleValue

export interface SpringOptions {
  duration?: number
  bounce?: number
}

export interface AnimateContext {
  finished: boolean
  settled: boolean

  finishingPromise: Promise<void>
  settlingPromise: Promise<void>

  stop: () => void
  stoppedDuration: number | undefined
}

/**
 * A single numeric slot of an animated property: the normalized endpoint
 * values, the initial velocity and the live spring values that follow this
 * slot's animation.
 */
interface AnimatedSlot {
  from: number
  to: number
  velocity: number

  /**
   * The live value this slot renders through — the user-provided `to`-side
   * SpringValue, or a constant wrapper around the normalized `to` value.
   */
  springValue: SpringComputed

  /**
   * A distinct SpringValue the user passed to `from`. It is attached to the
   * same animation as `springValue` so both follow the same motion.
   */
  fromSpringValue: SpringComputed | undefined
}

/**
 * Everything needed to animate one CSS property.
 */
type PropertyAnimation = PropertyAnimationAnimatable | PropertyAnimationNonAnimatable

interface PropertyAnimationAnimatable {
  animatable: true

  /**
   * Wraps and resolved units of the `to` side. Drives all interpolation,
   * and `units[i]` is the unit slot `i` is actually rendered in.
   */
  template: StyleTemplate

  /** Static `from` string for the starting keyframe. */
  fromString: string

  slots: AnimatedSlot[]
}

/**
 * The `from` and `to` structures don't match, so the property cannot
 * be animated and snaps to the static `to` string instead.
 */
interface PropertyAnimationNonAnimatable {
  animatable: false
  value: string
}

export function animate<
  From extends Record<string, AnimateValue | null | undefined>,
  To extends Record<string, AnimateValue | null | undefined>,
>(target: AnimationTarget, fromTo: [To] | [From, To], options: SpringOptions = {}): AnimateContext {
  const [rawFrom, rawTo] = fromTo.length === 1 ? [{} as From, fromTo[0]] : fromTo

  const normalizedFromTo = normalizeAnimationStyles(target, rawFrom, rawTo)

  const props: Record<string, PropertyAnimation> = mapValues(normalizedFromTo, ([from, to], key) =>
    buildPropertyAnimation(from, to, rawFrom[key], rawTo[key]),
  )

  const duration = options.duration ?? 1000
  const bounce = options.bounce ?? 0

  const spring = createSpring({
    bounce,
    duration,
  })

  const settlingDurationList = Object.values(props).flatMap((prop) => {
    if (!prop.animatable) {
      return []
    }

    return prop.slots.map(({ from, to, velocity }) => {
      return springSettlingDuration(spring, {
        from,
        to,
        initialVelocity: velocity,
      })
    })
  })

  const settlingDuration = settlingDurationList.length === 0 ? 0 : Math.max(...settlingDurationList)

  const startTime = performance.now()

  const animations: Animation[] = []

  const ctx = createContext({
    target,
    props,
    startTime,
    duration,
    settlingDuration,
    animations,
  })

  // Attach animation info to every slot's spring values.
  for (const prop of Object.values(props)) {
    if (!prop.animatable) {
      continue
    }

    prop.slots.forEach((slot, slotIndex) => {
      const attachment = {
        spring,
        from: slot.from,
        to: slot.to,
        initialVelocity: slot.velocity,
        startTime,
        duration,
        ctx,
        unit: prop.template.units[slotIndex] ?? '',
      }
      attachSpringValue(slot.springValue, attachment)
      if (slot.fromSpringValue) {
        attachSpringValue(slot.fromSpringValue, attachment)
      }
    })
  }

  const waapi = isWebAnimationsApiSupported()

  if (waapi && isCssLinearTimingFunctionSupported() && canUseLinearTimingFunction(props)) {
    animations.push(
      ...animateWithPerPropertyEasing({
        target,
        spring,
        props,
        settlingDuration,
      }),
    )
  } else if (waapi && isCssMathAnimationSupported()) {
    animations.push(
      ...animateWithProxyTimeVariable({
        target,
        spring,
        props,
        duration,
        settlingDuration,
      }),
    )
  } else {
    // Graceful degradation for environments without WAAPI / linear() / CSS math.
    animateWithRaf({
      target,
      props,
      ctx,
    })
  }

  return ctx
}

/**
 * Combine a normalized `[from, to]` pair with the raw user input for the same
 * key into a `PropertyAnimation`. The raw values provide the user-passed
 * SpringValues (to attach and to read initial velocities from); slots without
 * one get a constant wrapper around the normalized value.
 *
 * Relies on `normalizeAnimationStyles` keeping the slot count and order of
 * each provided side, so raw SpringValues can be associated by index.
 */
function buildPropertyAnimation(
  from: ParsedStyleValue,
  to: ParsedStyleValue,
  rawFrom: AnimateValue | null | undefined,
  rawTo: AnimateValue | null | undefined,
): PropertyAnimation {
  if (from.values.length !== to.values.length) {
    return {
      animatable: false,
      value: interpolateParsedStyle(to, to.values),
    }
  }

  const fromSprings = userSpringSlots(rawFrom)
  const toSprings = userSpringSlots(rawTo)

  const slots = zip(from.values, to.values).map(([fromValue, toValue], i): AnimatedSlot => {
    const fromSpring = fromSprings?.[i]
    const toSpring = toSprings?.[i]
    const springValue = toSpring ?? createSpringValue(() => toValue)

    // Choose initial velocity prioritized by follows:
    // 1. user-provided `from` SpringValue's velocity
    // 2. user-provided `to` SpringValue's velocity
    const velocity = fromSpring?.velocity() ?? toSpring?.velocity() ?? 0

    return {
      from: fromValue,
      to: toValue,
      velocity,
      springValue,
      fromSpringValue: fromSpring === springValue ? undefined : fromSpring,
    }
  })

  return {
    animatable: true,
    template: {
      wraps: to.wraps,
      units: to.units,
    },
    fromString: interpolateParsedStyle(from, from.values),
    slots,
  }
}

function userSpringSlots(raw: AnimateValue | null | undefined): SpringComputed[] | undefined {
  return raw !== null && typeof raw === 'object' ? raw.values : undefined
}

/**
 * Check if the animation can be done with linear() timing function.
 * The animation can be done with linear() timing function if:
 * - All the velocities in the same property are zero or
 * - Only one value will be animated in the same property.
 */
function canUseLinearTimingFunction(props: Record<string, PropertyAnimation>): boolean {
  return Object.values(props).every((prop) => {
    if (!prop.animatable) {
      return true
    }

    if (prop.slots.every((slot) => slot.velocity === 0)) {
      return true
    }

    return prop.slots.filter((slot) => slot.from !== slot.to).length <= 1
  })
}

function animateWithPerPropertyEasing({
  target,
  spring,
  props,
  settlingDuration,
}: {
  target: AnimationTarget
  spring: Spring
  props: Record<string, PropertyAnimation>
  settlingDuration: number
}): Animation[] {
  const animations: Animation[] = []

  for (const [key, prop] of Object.entries(props)) {
    if (!prop.animatable) {
      writeStyle(target, key, prop.value)
      continue
    }

    const toStr = interpolateParsedStyle(
      prop.template,
      prop.slots.map((slot) => slot.to),
    )

    const normalizedVelocity = prop.slots.reduce<number | undefined>(
      (acc, { from, to, velocity }) => {
        if (acc !== undefined) {
          return acc
        }

        if (from === to) {
          return undefined
        }

        return velocity / (to - from)
      },
      undefined,
    )

    const easing = springEasingFn({
      spring,
      settlingDuration,
      normalizedVelocity: normalizedVelocity ?? 0,
    })

    const a = target.animate([keyframeFor(key, prop.fromString), keyframeFor(key, toStr)], {
      duration: settlingDuration,
      easing,
      fill: 'forwards',
    })
    animations.push(a)
  }

  return animations
}

function animateWithProxyTimeVariable({
  target,
  spring,
  props,
  duration,
  settlingDuration,
}: {
  target: AnimationTarget
  spring: Spring
  props: Record<string, PropertyAnimation>
  duration: number
  settlingDuration: number
}): Animation[] {
  registerPropertyIfNeeded()

  for (const [key, prop] of Object.entries(props)) {
    if (!prop.animatable) {
      writeStyle(target, key, prop.value)
      continue
    }

    const exprValues = prop.slots.map(({ from, to, velocity }) =>
      generateSpringExpressionStyle(spring, {
        from,
        to,
        initialVelocity: velocity,
      }),
    )
    writeStyle(target, key, interpolateParsedStyle(prop.template, exprValues))
  }

  target.style.setProperty(t, '0')

  const a = target.animate([{ [t]: '0' }, { [t]: String(settlingDuration / duration) }], {
    duration: settlingDuration,
    easing: 'linear',
    fill: 'forwards',
  })
  return [a]
}

function animateWithRaf({
  target,
  props,
  ctx,
}: {
  target: AnimationTarget
  props: Record<string, PropertyAnimation>
  ctx: AnimateContext
}): void {
  // Non-animatable properties snap once, outside the render loop.
  for (const key in props) {
    const prop = props[key]!
    if (!prop.animatable) {
      writeStyle(target, key, prop.value)
    }
  }

  function render(): void {
    if (ctx.settled) {
      return
    }

    for (const key in props) {
      const prop = props[key]!
      if (!prop.animatable) {
        continue
      }

      const realValue = prop.slots.map((slot) => slot.springValue.current())
      writeStyle(target, key, interpolateParsedStyle(prop.template, realValue))
    }

    requestAnimationFrame(render)
  }

  render()
}

function createContext({
  target,
  props,
  startTime,
  duration,
  settlingDuration,
  animations,
}: {
  target: AnimationTarget
  props: Record<string, PropertyAnimation>
  startTime: number
  duration: number
  settlingDuration: number
  animations: Animation[]
}): AnimateContext {
  const forceResolve: { fn: (() => void)[] } = { fn: [] }

  function stop() {
    if (ctx.settled) {
      return
    }
    ctx.finished = ctx.settled = true
    ctx.stoppedDuration = performance.now() - startTime
    cancelAnimations()
    setRealStyle()
    forceResolve.fn.forEach((fn) => fn())
  }

  function cancelAnimations() {
    for (const a of animations) {
      try {
        a.cancel()
      } catch {
        // ignore — already cancelled or implementation-specific quirk
      }
    }
  }

  function setRealStyle() {
    for (const key in props) {
      const prop = props[key]!
      if (!prop.animatable) {
        writeStyle(target, key, prop.value)
        continue
      }

      const realValue = prop.slots.map((slot) => slot.springValue.current())
      writeStyle(target, key, interpolateParsedStyle(prop.template, realValue))
    }
    target.style.removeProperty(t)
  }

  const ctx: AnimateContext = {
    finishingPromise: wait(duration + 1, forceResolve).then(() => {
      ctx.finished = true
    }),

    settlingPromise: wait(settlingDuration + 1, forceResolve).then(() => {
      ctx.finished = ctx.settled = true

      if (ctx.stoppedDuration === undefined) {
        cancelAnimations()
        setRealStyle()
      }
    }),

    finished: false,
    settled: false,

    stop,
    stoppedDuration: undefined,
  }

  return ctx
}

function keyframeFor(key: string, value: string): Keyframe {
  return { [key]: value } as Keyframe
}
