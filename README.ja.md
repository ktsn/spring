# @ktsn/spring

[English](./README.md) | 日本語

直感的で動作の予測がしやすい CSS トランジションベースのスプリングアニメーションライブラリです。WWDC 2023 の [Animate with springs](https://developer.apple.com/videos/play/wwdc2023/10158/) にインスパイアされて開発されています。このライブラリの特徴は以下の通りです。

- CSS トランジションを使ったスプリングアニメーションの実装
- オプションが直感的で動作を予測しやすい
  - `bounce`: アニメーションのバウンス度合い
  - `duration`: アニメーションの長さ
- ライブラリで使っている機能をサポートしていないブラウザに対しては `requestAnimationFrame` を使ったグレースフルデグラデーションでアニメーションを実行

## Getting Started

Vue 用のバインディングがあります。npm (または yarn, pnpm) でインストールします。

```sh
$ npm install @ktsn/spring
```

`<script setup>` を使っているシングルファイルコンポーネントでは以下のように `spring` コンポーネントを使うことができます。

```vue
<script setup>
import { ref } from 'vue'
import { spring } from '@ktsn/spring'

const moved = ref(false)
</script>

<template>
  <button type="button" class="button" @click="moved = !moved">Toggle</button>

  <!-- :spring-style で指定されたスタイルに応じてアニメーションする <div> 要素を描画 -->
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

`spring.` の後のプロパティ名が描画される要素名になります。例えば、`<spring.div>` は `<div>` 要素を描画します。要素は `:spring-style` プロパティで指定されたスタイルを持ちます。`:spring-style` プロパティの値が変更されるとスプリングアニメーションが実行されます。

## Bounce と Duration

`bounce` と `duration` オプションはバウンスの度合いとアニメーションの長さを指定するために使われます。

**bounce**<br>
アニメーションのバウンス度合いを指定します。値は -1 から 1 の間で指定します。デフォルト値は 0 です。

**duration**<br>
アニメーションの長さ（ミリ秒）を指定します。デフォルト値は 1000 です。

## `disabled` 時の挙動

`<spring>` コンポーネントには `disabled` オプションを指定できます。`disabled` が `true` の間は、スタイル変更でアニメーションを発火させずに値だけを即座に更新します。`disabled` にしても実行中のアニメーションは**停止しません**。進行中のアニメーションはそのまま最後まで進みます。実行中のアニメーションを止めたい場合は、スタイル値を明示的に代入してください。`disabled` 中はその値へ即座にスナップします。

アニメーションが再開する際の初速は、以前の速度から自動的に引き継がれます。`disabled` 中に要素をドラッグなどで手動で動かした場合は、直近のスタイル更新から速度が推定され、離した瞬間にその勢いを引き継いだスプリングアニメーションになります。[Swipe](./demo/swipe/) デモがその例です。アニメーション中に要素をワープさせる場合も同様に勢いが保たれます。[Picker](./demo/picker/) デモでは、ホイールでピッカーを反対側へワープさせつつ回転の勢いを維持しています。

## スタイル指定時の注意点

スタイルに含まれる数値はすべて同じ単位で、同じ順番で現れる必要があります。例えば、以下のような `:spring-style` の値は正しく動作しません。

```vue
<template>
  <!-- ❌ この例は正しく動きません -->
  <spring.div
    :spring-style="{ transform: flag ? 'translate(100px, 100px)' : 'scale(2)' }"
  ></spring.div>
</template>
```

これはライブラリがスタイル内の数値をパースして、それぞれの数値ごとにアニメーションを計算しているためです。ライブラリは `translate` や `scale` の意味を解釈しませんし、`100%` と `100px` の違いも予測できません。上記の例を正しく動作させるには、`:spring-style` に含まれる数値がすべて同じ単位、同じ順番で現れるようにする必要があります。

```vue
<template>
  <!-- ✅ :spring-style のすべての数値が同じ単位、同じ順番で現れている -->
  <spring.div
    :spring-style="{
      transform: flag ? 'scale(1) translate(100px, 100px)' : 'scale(2) translate(0, 0)',
    }"
  ></spring.div>
</template>
```

## スタイル値の正規化

このライブラリは、アニメーションを開始する前に各プロパティの `from` と `to` のスタイルを補間可能な数値になるように正規化します。入力されたスタイルには以下の解決処理が適用されます。

### 欠損エントリの解決

プロパティが片側にしか指定されていない場合、もう片側は要素の computed style から解決されます。解決中はそのプロパティのインラインスタイルが一時的にクリアされるため、以前のアニメーションが設定したインライン値ではなく、スタイルシートで宣言された値が使われます。

```ts
// `from` が未指定: 現在の computed style の width からアニメーションが開始される
animate(el, [{ width: '300px' }])
```

値が明示的に `null`（または `undefined`）で指定されいるエントリも未指定として扱われます。

```ts
// `from` の `height` が null: `width` は 100px から、`height` は
// 現在の computed style の高さからアニメーションが開始される
animate(el, [
  { width: '100px', height: null },
  { width: '300px', height: '50px' },
])
```

### キーワードの解決

値がサイズ指定キーワード `auto`、`min-content`、`max-content`、`fit-content`、`stretch` のいずれか単体である場合、ライブラリはキーワードを要素に一時的に書き込み、computed style を読み取ることで具体的な px 値に解決します。

```vue
<template>
  <!-- 自然な幅と 100px の間でスプリングアニメーションする -->
  <spring.div :spring-style="{ width: expanded ? 'auto' : '100px' }"></spring.div>
</template>
```

キーワードは両側に指定することもできます。

```ts
animate(el, [{ width: 'min-content' }, { width: 'max-content' }])
```

解決された値は、すべての数値が px である場合にのみ採用されます。ブラウザがキーワードを px に解決しない場合 — 例えば要素がレンダリングされていない場合や、`min-width` のように computed style がキーワードをそのまま返すプロパティの場合 — は値が数値にならないため、そのプロパティはアニメーションせずに `to` のスタイルへ即座に切り替わります。

### 単位不一致の解決

`from` と `to` の単位が一致せず、片側が px の場合、もう片側は要素に一時的に書き込んで computed style を読み取ることで px に変換されます。

```ts
// 10rem は px (例: 160px) に変換されたうえで 300px に向かってアニメーションする
animate(el, [{ width: '10rem' }, { width: '300px' }])
```

変換は px に向かってのみ行われます。px を含まない不一致のペアはそのまま残り、数値は `to` 側の単位で補間されるため、通常は意図した結果になりません（[スタイル指定時の注意点](#スタイル指定時の注意点)を参照）。

## `springValue` と `springComputed`

`springValue` はアニメーションするスタイル内の数値を管理する値で、`target` にセットした値へのアニメーションが自動的に実装されます。`sv` タグ付きテンプレートと組み合わせることで CSS 値の中に埋め込めます。

```vue
<script setup>
import { spring, springValue, sv } from '@ktsn/spring'

const x = springValue(0)
const y = springValue(0)

function move() {
  // アニメーション先の値を `target` に代入する
  x.target = 200
  y.target = 100
}
</script>

<template>
  <button @click="move">Move</button>

  <!-- sv を使って Spring Value を CSS 値に埋め込む -->
  <spring.div :spring-style="{ translate: sv`${x}px ${y}px` }" :duration="600" :bounce="0.3" />
</template>
```

Vue の `ref` を使って通常のテンプレートリテラルで CSS 値を構築してもアニメーションは実行されますが、`springValue` を使うことでアニメーション中の実際の値や速度を取得することができます。

```ts
const x = springValue(0)

// 呼び出した時点のアニメーション中の実際の値と速度を取得する（リアクティブではない）
x.current()
x.velocity()
```

`springComputed` は Vue の `computed` の Spring Value 版です。`computed` と同様に他のリアクティブな値から Spring Value を導出できます。

```vue
<script setup>
import { ref } from 'vue'
import { spring, springComputed, sv } from '@ktsn/spring'

const offset = ref(0)

// offset から派生した Spring Value を作る。target は読み取り専用。
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

このライブラリはアニメーションの対象となるスタイルのプロパティに、経過時間のカスタムプロパティを含む、スプリングアニメーションの数式をセットしています（そのカスタムプロパティを `--t` とします）。そして、[`CSS.registerProperty`](https://developer.mozilla.org/en-US/docs/Web/API/CSS/registerProperty_static) を使って `--t` を登録し、そのプロパティに対して CSS トランジションを適用します。スプリングアニメーションの擬似コードは以下のようになります。

```js
// --t を登録
CSS.registerProperty({
  name: '--t',
  syntax: '<number>',
  inherits: false,
  initialValue: 0,
})

// 初期状態を設定
el.style.setProperty('--t', 0)

// --t を含むスプリングアニメーションの数式をセット
el.style.translate = 'calc(P * (A * var(--t) + B) * exp(-C * var(--t)) - Q)'

// 再描画を実行させる
requestAnimationFrame(() => {
  // アニメーションの開始
  el.style.setProperty('--t', 1)
  el.style.transition = '--t 1000ms linear'
})
```

また、このライブラリは `CSS.registerProperty` や CSS の `exp()` 関数をサポートしていないブラウザに対しては、CSS トランジションを使わず、`requestAnimationFrame` を使ったグレースフルデグラデーションでアニメーションを実行します。

## API リファレンス

### `<spring>` コンポーネント

`<spring>` コンポーネントは、プロパティ名と同じタグ名のネイティブ HTML 要素を描画します（例えば、`<spring.div>` は `<div>` 要素を描画します）。

**プロパティ**

- `spring-style`: アニメーションさせるスタイルオブジェクト
- `bounce`
- `duration`
- `disabled`

**イベント**

- `spring-finish`: アニメーションが視覚的に完了したとき (duration が経過した時) に発火します。
- `spring-settle`: アニメーションが完全に減衰して停止したときに発火します。

イベントはアニメーションサイクル単位で、最新のサイクルに対してのみ発火します。アニメーション中に `spring-style` が再設定されて以前のサイクルが中断された場合、そのサイクルのイベントは発火しません。`disabled` 中も発火しません。

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

### `<SpringTransition>` コンポーネント

`<SpringTransition>` は Vue の [`<Transition>` コンポーネント](https://ja.vuejs.org/guide/built-ins/transition.html)のスプリングアニメーション版です。enter 時には `enter-from` のスタイルから `spring-style` へ、leave 時には `spring-style` から `leave-to` のスタイルへとアニメーションを行います。

**プロパティ**

- `spring-style`: 子要素のデフォルトスタイル
- `enter-from`: enter 前の子要素のスタイル
- `leave-to`: leave 後の子要素のスタイル。指定されていない場合は `enter-from` のスタイルが使われます。
- `bounce`
- `duration`

- Vue の `<Transition>` コンポーネントから引き継いでいる props:
  - `name`
  - `mode`
  - `enterFromClass`
  - `enterActiveClass`
  - `enterToClass`
  - `leaveFromClass`
  - `leaveActiveClass`
  - `leaveToClass`

**イベント**

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

  <!-- 子要素に対してスプリングアニメーションを行う -->
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
    <!-- v-show の値が変わった時に .rectangle 要素がアニメーションする -->
    <div v-show="isShow" class="rectangle"></div>
  </SpringTransition>
</template>
```

### `<SpringTransitionGroup>` コンポーネント

`<SpringTransitionGroup>` は Vue の [`<TransitionGroup>` コンポーネント](https://ja.vuejs.org/guide/built-ins/transition-group.html)のスプリングアニメーション版です。`<SpringTransition>` と同じように `spring-style`、`enter-from`、`leave-to` のスタイルを指定できます。

**Props**

- `spring-style`: 子要素のデフォルトスタイル
- `enter-from`: enter 前の子要素のスタイル
- `leave-to`: leave 後の子要素のスタイル。指定されていない場合は `enter-from` のスタイルが使われます。
- `bounce`
- `duration`

- Vue の `<Transition>` コンポーネントから引き継いでいる props:
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
  <!-- 子要素に対してスプリングアニメーションを行う -->
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
    <!-- リストの項目は key プロパティを指定する必要あり -->
    <li v-for="item of list" :key="item.id">
      <!-- ... -->
    </li>
  </SpringTransitionGroup>
</template>
```

### `springValue(initial)`

単一の数値をアニメーションするためのリアクティブな値オブジェクトを作成します。`sv` タグ付きテンプレートを介して `<spring>` 要素にバインドして使用します。

**戻り値** のオブジェクトの API:

- `target` (number, リアクティブ値、読み書き可) — アニメーションの destination 値。`<spring>` 要素にバインドされている状態で代入するとアニメーションが起動します。バインド先の要素が `disabled: true` の場合は即座にスタイルが反映されます。
- `current(): number` — 呼び出し時点の現在値を返すスナップショットメソッド。バインド中は spring 要素から現在値を読み、未バインド時は `target` の値を返します。
- `velocity(): number` — 呼び出し時点の速度を返すスナップショットメソッド。バインド中はアニメーションの速度を、未バインド時は `0` を返します。

### `springComputed(getter)`

`springValue` の computed 版。Vue の `computed` と同じく値を導出する関数を受け取り、Spring Value を返します。インターフェースは `springValue` の値と同じですが、`target` が読み取り専用になり、getter のリアクティブな依存先から自動的に算出されます。

### `sv` タグ付きテンプレート

`springValue` / `springComputed` の値を埋め込んだ CSS 値を構築し、`:spring-style` 用の値を返すタグ付きテンプレートです。

### `v-spring-style`, `v-spring-options` ディレクティブ

`v-spring-style` ディレクティブはアニメーションさせるスタイルを指定するために使います。`v-spring-options` ディレクティブはアニメーションのオプションを指定するために使います。

`<script setup>` ではない環境（`<spring>` コンポーネントを使えない）で使うことを想定しています。

`springDirectives` としてエクスポートされているプラグインオブジェクトを使ってディレクティブを登録できます。

```js
import { createApp } from 'vue'
import App from './App.vue'
import { springDirectives } from '@ktsn/spring'

createApp(App).use(springDirectives).mount('#app')
```

そして、テンプレートでディレクティブを使えます。

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

### `springCSS` ユーティリティ

スプリングアニメーションのイージングを持つ CSS トランジション文字列を生成するユーティリティ関数です。これにより、ネイティブの CSS トランジションでスプリングアニメーションを使用できます。

**パラメータ**

- `duration`: ミリ秒単位の時間（必須）
- `bounce`: バウンス度合い（-1 から 1、デフォルト: 0）

**戻り値**

`transition` CSS プロパティで使用できる CSS トランジション値の文字列を返します。

```js
import { springCSS } from '@ktsn/spring'

// スプリングトランジション CSS を生成
const transition = springCSS(400, 0.1)

// DOM 要素に直接適用
const element = document.querySelector('.my-element')
element.style.transition = `transform ${springCSS(600, 0.3)}`
element.style.transform = 'translateX(100px)'

// 複数のプロパティで使用
element.style.transition = `
  transform ${springCSS(600, 0.3)},
  opacity ${springCSS(400, 0)}
`
element.style.transform = 'translateX(100px)'
element.style.opacity = '0.5'
```

### `springGenerator` ユーティリティ

スプリングの値を返すジェネレーターを作成するユーティリティ関数です。手動でアニメーションを制御するために使います。経過時間に基づいてアニメーション値を生成し、カスタムアニメーションループや DOM 以外のアニメーションに使用できます。

**パラメータ**

- `from`: 開始値（必須）
- `to`: 目標値（必須）
- `bounce`: バウンス度合い（-1 から 1、デフォルト: 0）
- `duration`: ミリ秒単位の時間（デフォルト: 1000）
- `velocity`: 初期速度（単位/秒、デフォルト: 0）

**戻り値**

`next(elapsedMs)` メソッドを持つ `SpringGenerator` オブジェクトを返します。このメソッドは `{ value: number, done: boolean }` を返します。

```ts
import { springGenerator } from '@ktsn/spring'

// スプリングイテレータを作成
const iter = springGenerator({
  from: 0,
  to: 100,
  bounce: 0.2,
  duration: 500,
})

// 特定の時間での値を取得
let result = iter.next(0) // { value: 0, done: false }
result = iter.next(100) // { value: ~80, done: false }
result = iter.next(1200) // { value: 100, done: true }
```

```ts
import { springGenerator } from '@ktsn/spring'

// 例: カスタムアニメーションループ
const iter = springGenerator({ from: 0, to: 100, duration: 600 })
const startTime = performance.now()

function animate(now: number) {
  const elapsed = now - startTime
  const { value, done } = iter.next(elapsed)

  // 値をカスタムレンダリングに使用
  console.log(value)

  if (!done) {
    requestAnimationFrame(animate)
  }
}

requestAnimationFrame(animate)
```

### `animate(target, [from, to], options)`

DOM 要素のスタイルプロパティをスプリング物理で命令的にアニメーションさせる低レベル関数です。Vue コンポーネントの外でスプリングアニメーションを使いたい時に利用します。

**パラメータ**

- `target`: アニメーション対象の `HTMLElement` または `SVGElement`
- `fromTo`: スタイルオブジェクトの `[from, to]` タプル、または `[to]` の 1 要素タプル。各スタイルオブジェクトは CSS プロパティ名に対して `number`、`string`、または `springValue` / `springComputed` を `sv` で埋め込んだ値をマップします。各エントリは `null` / `undefined` でもよく、その場合はキーが省略されているのと同じ扱いになります（下記参照）。
- `options`: スプリングオプション（省略可）
  - `duration`: ミリ秒単位の時間（デフォルト: 1000）
  - `bounce`: バウンス度合い（-1 から 1、デフォルト: 0）

**戻り値**

以下のプロパティを持つ `AnimateContext` を返します。

- `finished` (boolean): `duration` 経過時にアニメーションが視覚的に完了すると `true` になります。
- `settled` (boolean): スプリングが完全に減衰すると `true` になります。
- `finishingPromise` (`Promise<void>`): `finished` が `true` になった時に resolve されます。
- `settlingPromise` (`Promise<void>`): `settled` が `true` になった時に resolve されます。
- `stop()`: アニメーションを即座にキャンセルし、現在の値を確定します。
- `stoppedDuration` (`number | undefined`): `stop()` が呼ばれた時点の経過時間。停止されていない場合は `undefined`。

```ts
import { animate } from '@ktsn/spring'

const el = document.querySelector('.rectangle') as HTMLElement

const ctx = animate(el, [{ translate: '0px 0px' }, { translate: '300px 300px' }], {
  duration: 1000,
  bounce: 0,
})

ctx.settlingPromise.then(() => {
  // スプリングが完全に減衰した
})
```

`from` または `to` のどちらかにキーが存在しない（あるいは値が `null` / `undefined` の）場合、`animate()` はそのプロパティのインラインスタイルを一時的に外したうえで computed style を読み取り、欠けている側の値として用います。`[to]` の 1 要素形式は `[{}, to]` のショートハンドで、`from` 側のすべてのエントリがこの方法で補完されます。

```ts
import { animate } from '@ktsn/spring'

// `from` は省略。要素の現在の見た目（`translate` のインライン上書きを
// 取り除いた状態）を始点として扱います。
animate(el, [{ translate: '300px 300px' }], { duration: 600 })

// 片方のキーだけが欠けていてもよく、欠けている側はそのキー単位で
// computed style から補完されます。
animate(el, [{ opacity: 0 }, { opacity: 1, translate: '100px 0px' }], {
  duration: 600,
})
```

`from` または `to` のスロットを `sv` で `springValue` から構築すると、そのスプリング値の `current()` と `velocity()` がアニメーション実行中の現在値・速度を返すようになります。

```ts
import { animate, springValue, sv } from '@ktsn/spring'

const x = springValue(0)

animate(el, [{ translate: sv`${x}px` }, { translate: '100px' }], {
  duration: 600,
})

// x.current() / x.velocity() でアニメーション中の値・速度が読める
```
