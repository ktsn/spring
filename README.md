# @ktsn/spring

English | [日本語](./README.ja.md)

An intuitive and predictable spring animation library powered by CSS Transition. It is inspired by [Animate with springs](https://developer.apple.com/videos/play/wwdc2023/10158/) of WWDC 2023. The features of this library are:

- Implementing spring animation with CSS Transition
- Animation options are intuitive and predictable
  - `bounce`: Bounciness of an animation
  - `duration`: Perceptive animation duration
- Graceful degradation with `requestAnimationFrame` for browsers that do not support the features used in the library

## Getting Started

There is a Vue binding of the library. Install it with npm (or yarn, pnpm):

```sh
$ npm install @ktsn/spring
```

When you use `<script setup>` in a single file component, you can use `spring` higher-order component as below:

```vue
<script setup>
import { ref } from 'vue'
import { spring } from '@ktsn/spring'

const moved = ref(false)
</script>

<template>
  <button type="button" class="button" @click="moved = !moved">Toggle</button>

  <!-- render <div> element animating with style specified on :spring-style -->
  <spring.div
    class="rectangle"
    :spring-style="{
      translate: moved ? '100px' : '0px',
    }"
    :duration="600"
    :bounce="0.3"
  ></spring.div>
</template>
```

The property name after `spring.` is the tag name to be rendered. For example, `<spring.div>` renders `<div>` element. The element has the style specified on `:spring-style` prop. Spring animation will be triggered when the value of `:spring-style` prop is changed.

## Bounce and Duration

`bounce` and `duration` options are used to specify the bounciness and perceptive duration of an animation.

**bounce**<br>
Bounciness of an animation. The value is between -1 and 1. The default value is 0.

**duration**<br>
Perceptive duration (ms) of an animation. The default value is 1000.

## Behavior on `disabled`

`<spring>` component accepts a `disabled` option. While `disabled` is `true`, style changes update the value immediately without triggering a new animation. Disabling does **not** stop an animation that is already running — the in-flight animation is left to complete on its own. To stop a running animation, assign the style value explicitly, which immediately snaps the value while `disabled`.

When animation later resumes, the spring's initial velocity is carried over automatically from the takeover point. If you drive the element manually (e.g. by dragging) while `disabled`, the spring picks up momentum from the recent style updates. See the [Swipe](./demo/swipe/) demo: while the user drags, `disabled` is `true`, and on release the spring fires with the inferred drag velocity. Momentum is likewise preserved when you teleport an element mid-animation, as in the [Picker](./demo/picker/) demo where scrolling the wheel wraps the picker around while keeping its rotation momentum.

## Spring Style Caveats

All numbers in a style value must have the same unit and must be appeared in the same order. For example, the following `:spring-style` value is invalid and will not work as expected:

```vue
<template>
  <!-- ❌ this example will not work as expected -->
  <spring.div
    :spring-style="{ transform: flag ? 'translate(100px, 100px)' : 'scale(2)' }"
  ></spring.div>
</template>
```

This is because the library parses the numbers in the style value, then calculate the animation for each number in the style value. The library cannot understand the meaning of `translate`, `scale` nor predict the difference between `100%` and `100px`. To fix the above example, you need to specify both `translate` and `scale` in the same order and always use the same unit:

```vue
<template>
  <!-- ✅ all numbers in the :spring-style have the same unit and are in the same order -->
  <spring.div
    :spring-style="{
      transform: flag ? 'scale(1) translate(100px, 100px)' : 'scale(2) translate(0, 0)',
    }"
  ></spring.div>
</template>
```

## Style Value Normalization

Before starting an animation, the library normalizes the `from` and `to` styles of each property so that both sides become interpolatable numbers. The following resolutions are applied to the input styles.

### Missing Entry Resolution

When a property is specified on only one side, the other side is resolved from the element's computed style. The inline style for that property is temporarily cleared during the resolution, so the value declared in style sheets is used rather than the inline value set by a previous animation.

```ts
// `from` is not specified: the animation starts from the current computed width.
animate(el, [{ width: '300px' }])
```

An entry whose value is explicitly `null` (or `undefined`) is also treated as missing:

```ts
// `height` in `from` is null: `width` starts from 100px while `height`
// starts from the current computed height.
animate(el, [
  { width: '100px', height: null },
  { width: '300px', height: '50px' },
])
```

### Keyword Resolution

When a value is solely one of the sizing keywords `auto`, `min-content`, `max-content`, `fit-content` or `stretch`, the library temporarily writes the keyword to the element and reads the computed style back to resolve it into concrete px values.

```vue
<template>
  <!-- Springs between the natural width and 100px -->
  <spring.div :spring-style="{ width: expanded ? 'auto' : '100px' }"></spring.div>
</template>
```

Keywords may also appear on both sides:

```ts
animate(el, [{ width: 'min-content' }, { width: 'max-content' }])
```

The resolved value is accepted only when all of its numbers are in px. When the browser does not resolve the keyword into px — for example, the element is not rendered, or the computed style keeps the keyword as is like `min-width` — the value stays non-numeric and the property snaps to the `to` style without animation.

### Unit Mismatch Resolution

When the units of `from` and `to` do not match and one side is px, the other side is converted to px by temporarily writing it to the element and reading the computed style back.

```ts
// 10rem is converted to px (e.g. 160px), then animated toward 300px.
animate(el, [{ width: '10rem' }, { width: '300px' }])
```

The conversion only happens toward px. A mismatched pair without a px side is left as is and the numbers are interpolated in the `to` side's unit, which is usually not what you want (see [Spring Style Caveats](#spring-style-caveats)).

## `springValue` and `springComputed`

`springValue` holds a number that lives inside an animating style. Assigning to its `target` automatically triggers an animation toward that value. Combined with the `sv` tagged template, it can be embedded inside a CSS value.

```vue
<script setup>
import { spring, springValue, sv } from '@ktsn/spring'

const x = springValue(0)
const y = springValue(0)

function move() {
  // Assign the animation destination to `target`
  x.target = 200
  y.target = 100
}
</script>

<template>
  <button @click="move">Move</button>

  <!-- Embed spring values into the CSS value via `sv` -->
  <spring.div :spring-style="{ translate: sv`${x}px ${y}px` }" :duration="600" :bounce="0.3" />
</template>
```

You can also build CSS values with regular template literals over a Vue `ref` and the animation will still run. Using `springValue` instead lets you read the live value and velocity during the animation.

```ts
const x = springValue(0)

// Snapshot the live value and velocity at the time of the call (not reactive).
x.current()
x.velocity()
```

`springComputed` is the spring value counterpart of Vue's `computed`. Like `computed`, it derives a spring value from other reactive sources.

```vue
<script setup>
import { ref } from 'vue'
import { spring, springComputed, sv } from '@ktsn/spring'

const offset = ref(0)

// Derive spring values from offset. `target` is read-only.
const x = springComputed(() => offset.value)
const y = springComputed(() => offset.value * 2)

function move() {
  offset.value = offset.value === 0 ? 100 : 0
}
</script>

<template>
  <button @click="move">Move</button>

  <spring.div :spring-style="{ translate: sv`${x}px ${y}px` }" :duration="600" :bounce="0.3" />
</template>
```

## How It Works

The library sets spring animation expression in an animating CSS value including a custom property that representing elapsed time (let's say `--t` here). Then register `--t` by using [`CSS.registerProperty`](https://developer.mozilla.org/en-US/docs/Web/API/CSS/registerProperty_static) to be able to apply CSS Transition on it. The pseudo code of the spring animation expression looks like below:

```js
// Register --t
CSS.registerProperty({
  name: '--t',
  syntax: '<number>',
  inherits: false,
  initialValue: 0,
})

// Set initial state
el.style.setProperty('--t', 0)

// Set spring animatioin expression including --t
el.style.translate = 'calc(P * (A * var(--t) + B) * exp(-C * var(--t)) - Q)'

// Re-render
requestAnimationFrame(() => {
  // Trigger animation
  el.style.setProperty('--t', 1)
  el.style.transition = '--t 1000ms linear'
})
```

The library also provides a graceful degradation for browsers that do not support `CSS.registerProperty` and `exp()` function of CSS. In this case, the library will use `requestAnimationFrame` to animate the style value instead of CSS Transition.

## API Reference

### `<spring>` component

It renders a native HTML element as same tag name as the property name (e.g. `<spring.div>` renders `<div>` element).

**Props**

- `spring-style`: Style object to be animated
- `bounce`
- `duration`
- `disabled`

**Events**

- `spring-finish`: Emitted when the animation completes visually (just after duration passes).
- `spring-settle`: Emitted when the animation has fully settled (velocity decayed to zero).

Events fire per animation cycle on the latest cycle only. If `spring-style` is updated mid-animation, the previous cycle is interrupted and its events are suppressed. Events are also suppressed while `disabled` is set.

```vue
<script setup>
import { spring } from '@ktsn/spring'

const position = ref(0)

function onFinish() {
  // ...
}
</script>

<template>
  <spring.div
    :spring-style="{
      translate: `${position.value}px`,
    }"
    :duration="600"
    :bounce="0.3"
    @spring-finish="onFinish"
  ></spring.div>
</template>
```

### `<SpringTransition>` component

`<SpringTransition>` is a spring animation version of Vue's [`<Transition>` component](https://vuejs.org/guide/built-ins/transition.html). It triggers animation from `enter-from` style to `spring-style` on entering and from `spring-style` to `leave-to` on leaving.

**Props**

- `spring-style`: Default style of a child element.
- `enter-from`: Style of a child element before entering.
- `leave-to`: Style of a child element after leaving. Fallback to `enter-from` style if not specified.
- `bounce`
- `duration`

- Inherited props from Vue's `<Transition>` component:
  - `name`
  - `mode`
  - `enterFromClass`
  - `enterActiveClass`
  - `enterToClass`
  - `leaveFromClass`
  - `leaveActiveClass`
  - `leaveToClass`

**Events**

- `before-enter`
- `after-enter`
- `enter-cancelled`
- `before-leave`
- `after-leave`
- `leave-cancelled`

```vue
<script setup>
import { ref } from 'vue'
import { SpringTransition } from '@ktsn/spring'

const isShow = ref(false)
</script>

<template>
  <button type="button" class="button" @click="isShow = !isShow">Toggle</button>

  <!-- Trigger spring animation for the child element -->
  <SpringTransition
    :spring-style="{
      translate: '0',
    }"
    :enter-from="{
      translate: '-100px',
    }"
    :leave-to="{
      translate: '100px',
    }"
    :duration="600"
    :bounce="0"
  >
    <!-- .rectangle element will be animated when v-show value is changed -->
    <div v-show="isShow" class="rectangle"></div>
  </SpringTransition>
</template>
```

### `<SpringTransitionGroup>` component

`<SpringTransitionGroup>` is a spring animation version of Vue's [`<TransitionGroup>` component](https://vuejs.org/guide/built-ins/transition-group.html). It can have `spring-style`, `enter-from` and `leave-to` props as same as `<SpringTransition>`.

**Props**

- `spring-style`: Default style of a child element.
- `enter-from`: Style of a child element before entering.
- `leave-to`: Style of a child element after leaving. Fallback to `enter-from` style if not specified.
- `bounce`
- `duration`

- Inherited props from Vue's `<TransitionGroup>` component:
  - `tag`
  - `name`
  - `enterFromClass`
  - `enterActiveClass`
  - `enterToClass`
  - `leaveFromClass`
  - `leaveActiveClass`
  - `leaveToClass`

**Events**

- `before-enter`
- `after-enter`
- `enter-cancelled`
- `before-leave`
- `after-leave`
- `leave-cancelled`

```vue
<script setup>
import { SpringTransitionGroup } from '@ktsn/spring'

const list = ref([
  // ...
])
</script>

<template>
  <!-- Trigger spring animation for the child elements -->
  <SpringTransitionGroup
    tag="ul"
    :spring-style="{
      opacity: 1,
    }"
    :enter-from="{
      opacity: 0,
    }"
    :leave-to="{
      opacity: 0,
    }"
    :duration="800"
    :bounce="0"
  >
    <!-- List items must have key prop -->
    <li v-for="item of list" :key="item.id">
      <!-- ... -->
    </li>
  </SpringTransitionGroup>
</template>
```

### `springValue(initial)`

Creates a reactive holder for a single animated number. Pair with `<spring>` element via the `sv` tagged template.

**Returns** an object with:

- `target` (number, reactive read/write) — animation destination. Assigning to it triggers an animation when bound to a `<spring>` element. Applied immediately while the bound element has `disabled: true`.
- `current(): number` — non-reactive snapshot of the live animating value. While bound, reads through the spring element's value; otherwise returns `target`.
- `velocity(): number` — non-reactive snapshot of the live velocity. While bound, reads the animation velocity; otherwise returns `0`.

```ts
import { springValue } from '@ktsn/spring'

const x = springValue(0)
x.target = 100 // trigger animation when bound
console.log(x.current(), x.velocity())
```

### `springComputed(getter)`

The `computed` version of `springValue`. Like Vue's `computed`, it takes a getter that returns a number and produces a spring value. The shape is identical to a `springValue` except `target` is read-only and is automatically derived from the getter's reactive dependencies.

### `sv` tagged template

A tagged template that builds a `:spring-style` value by embedding `springValue` / `springComputed` instances into a CSS expression.

### `v-spring-style` and `v-spring-options` directivies

`v-spring-style` directive is used to specify the style to be animated. `v-spring-options` directive is used to specify the options of the animation.

It is expected to be used out of `<script setup>` where `<spring>` component is not able to be used.

You can register the directives by using plugin object exported as `springDirectives`:

```js
import { createApp } from 'vue'
import App from './App.vue'
import { springDirectives } from '@ktsn/spring'

createApp(App).use(springDirectives).mount('#app')
```

Then you can use the directives in a template:

```vue
<template>
  <div
    v-spring-style="{
      translate: `${position}px`,
    }"
    v-spring-options="{
      duration: 600,
      bounce: 0.3,
    }"
  ></div>
</template>
```

### `springCSS` utility

A utility function that generates a CSS transition string with spring animation easing. This allows you to use spring animations with native CSS transitions.

**Parameters**

- `duration`: Duration in milliseconds (required)
- `bounce`: Bounciness (-1 to 1, default: 0)

**Return value**

Returns a CSS transition value string that can be used in the `transition` CSS property.

```js
import { springCSS } from '@ktsn/spring'

// Generate spring transition CSS
const transition = springCSS(400, 0.1)

// Use with DOM element directly
const element = document.querySelector('.my-element')
element.style.transition = `transform ${springCSS(600, 0.3)}`
element.style.transform = 'translateX(100px)'

// Use for multiple properties
element.style.transition = `
  transform ${springCSS(600, 0.3)},
  opacity ${springCSS(400, 0)}
`
element.style.transform = 'translateX(100px)'
element.style.opacity = '0.5'
```

### `springGenerator` utility

A utility function that creates a spring iterator for manual animation control. It yields animation values based on elapsed time, useful for custom animation loops or non-DOM animations.

**Parameters**

- `from`: Starting value (required)
- `to`: Target value (required)
- `bounce`: Bounciness (-1 to 1, default: 0)
- `duration`: Duration in milliseconds (default: 1000)
- `velocity`: Initial velocity in units per second (default: 0)

**Return value**

Returns a `SpringGenerator` object with a `next(elapsedMs)` method that returns `{ value: number, done: boolean }`.

```ts
import { springGenerator } from '@ktsn/spring'

// Create a spring iterator
const iter = springGenerator({
  from: 0,
  to: 100,
  bounce: 0.2,
  duration: 500,
})

// Get values at specific times
let result = iter.next(0) // { value: 0, done: false }
result = iter.next(100) // { value: ~80, done: false }
result = iter.next(1200) // { value: 100, done: true }
```

```ts
import { springGenerator } from '@ktsn/spring'

// Example: Custom animation loop
const iter = springGenerator({ from: 0, to: 100, duration: 600 })
const startTime = performance.now()

function animate(now: number) {
  const elapsed = now - startTime
  const { value, done } = iter.next(elapsed)

  // Use the value for custom rendering
  console.log(value)

  if (!done) {
    requestAnimationFrame(animate)
  }
}

requestAnimationFrame(animate)
```

### `animate(target, [from, to], options)`

A low-level function that imperatively animates style properties on a DOM element with spring physics. Useful when you want spring animation outside of Vue components.

**Parameters**

- `target`: An `HTMLElement` or `SVGElement` to animate.
- `fromTo`: A `[from, to]` tuple of style objects, or a `[to]` single-element tuple. Each style object maps CSS property names to a `number`, a `string`, or a value built from `sv` over `springValue` / `springComputed`. Entries may also be `null` or `undefined`, which is treated the same as omitting the key — see below.
- `options`: Spring options (optional)
  - `duration`: Duration in milliseconds (default: 1000)
  - `bounce`: Bounciness (-1 to 1, default: 0)

**Return value**

Returns an `AnimateContext` with:

- `finished` (boolean): becomes `true` once the animation visually completes (after `duration` ms).
- `settled` (boolean): becomes `true` once the spring has fully decayed.
- `finishingPromise` (`Promise<void>`): resolves when `finished` flips to `true`.
- `settlingPromise` (`Promise<void>`): resolves when `settled` flips to `true`.
- `stop()`: cancels the animation immediately and commits the current value.
- `stoppedDuration` (`number | undefined`): the elapsed time at the moment `stop()` was called, or `undefined` if not stopped.

```ts
import { animate } from '@ktsn/spring'

const el = document.querySelector('.rectangle') as HTMLElement

const ctx = animate(el, [{ translate: '0px 0px' }, { translate: '300px 300px' }], {
  duration: 1000,
  bounce: 0,
})

ctx.settlingPromise.then(() => {
  // the spring has fully settled
})
```

If a key is missing from either side (or its value is `null` / `undefined`), `animate()` fills it in by reading the element's computed style with the inline override for that property temporarily cleared. The `[to]` single-element form is shorthand for `[{}, to]` — every entry of `from` is resolved this way:

```ts
import { animate } from '@ktsn/spring'

// `from` is fully implicit. The element's current visual state (without
// any inline override on `translate`) is used as the starting point.
animate(el, [{ translate: '300px 300px' }], { duration: 600 })

// Only one side of a key may be missing too — the missing side is
// resolved from computed style independently.
animate(el, [{ opacity: 0 }, { opacity: 1, translate: '100px 0px' }], {
  duration: 600,
})
```

When a slot in `from` or `to` is built from `springValue` via `sv`, the spring value's `current()` and `velocity()` reflect the live animation while it runs:

```ts
import { animate, springValue, sv } from '@ktsn/spring'

const x = springValue(0)

animate(el, [{ translate: sv`${x}px` }, { translate: '100px' }], {
  duration: 600,
})

// x.current() / x.velocity() now reflect the live animation
```
