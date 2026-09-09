# Utility_Events.ts — 주석 아카이브

> 원본 스크립트: `Utility_Events.ts`
> 걷어낸 주석 12건 / 1,085 B 절감 (3,371 B → 2,286 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## `export type SubscribedFunction<T> = (data: T) => void;`

> 원본 L3

Function bonded to subscribed event

## `export class Subscription implements EventSubscription {`

> 원본 L6

 stores subscription of event allowing the ability to disconnect from said event

## `export class EventPublisher<T> {`

> 원본 L25

#region Event Publishers

## `private _publishList: SubscribedFunction<T>[] | null = null;`

> 원본 L29

cached snapshot for publish(); rebuilt only when the subscriber set changes.
publish() runs on hot paths (every cell change during a drag), so allocating
a fresh array per call caused avoidable GC pressure.

## `public subscribe(func: SubscribedFunction<T>): Subscription {`

> 원본 L36

 stores bonded function and returns subscription instance: allows disconnection from event

## `return new Subscription({`

> 원본 L43

removes subscribed function when disconnect is called on the returned subscription

## `public publish(data: T): void {`

> 원본 L52

 Iterates through bonded subscribed functions and calls them

## `let subscribedFunctions = this._publishList;`

> 원본 L56

snapshot semantics are preserved: a function that unsubscribes or subscribes
during publish invalidates the cache, but this call keeps iterating the
snapshot it started with - exactly what the per-call Array.from used to do.

## `export class SubscriptionBag implements EventSubscription {`

> 원본 L70

#endregion

## `export class SubscriptionBag implements EventSubscription {`

> 원본 L72

#region Subscriptions
 Used to store multiple instances of subscribed events and allows disconnection from all events at once

## `this._subs.splice(0, this._subs.length);`

> 원본 L98

remove all the elements from the array

## `(파일 끝)`

> 원본 L103

#endregion

