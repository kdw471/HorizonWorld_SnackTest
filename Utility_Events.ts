import type { EventSubscription } from 'horizon/core';

// Function bonded to subscribed event
export type SubscribedFunction<T> = (data: T) => void;

/** stores subscription of event allowing the ability to disconnect from said event */
export class Subscription implements EventSubscription {
	private _sub: EventSubscription | null;

	public get isValid(): boolean { return this._sub !== null; }

	constructor(sub: EventSubscription | null = null) {
		this._sub = sub;
	}

	public disconnect(): boolean {
		if (this._sub === null) { return false; }

		this._sub.disconnect();
		this._sub = null;
		return true;
	}
}

//#region Event Publishers
export class EventPublisher<T> {
	private _counter: bigint = BigInt(0);
	private _subscribedFunctions: Map<bigint, SubscribedFunction<T>> = new Map<bigint, SubscribedFunction<T>>();
	// cached snapshot for publish(); rebuilt only when the subscriber set changes.
	// publish() runs on hot paths (every cell change during a drag), so allocating
	// a fresh array per call caused avoidable GC pressure.
	private _publishList: SubscribedFunction<T>[] | null = null;

	public get hasSubscriptions(): boolean { return this._subscribedFunctions.size > 0; }

	/** stores bonded function and returns subscription instance: allows disconnection from event */
	public subscribe(func: SubscribedFunction<T>): Subscription {
		const counterCopy = this._counter;
		this._subscribedFunctions.set(counterCopy, func);
		this._counter += BigInt(1);
		this._publishList = null;

		// removes subscribed function when disconnect is called on the returned subscription
		return new Subscription({
			disconnect: () => {
				this._subscribedFunctions.delete(counterCopy);
				this._publishList = null;
			},
		});
	}

	/** Iterates through bonded subscribed functions and calls them */
	public publish(data: T): void {
		if (this._subscribedFunctions.size <= 0) { return; }

		// snapshot semantics are preserved: a function that unsubscribes or subscribes
		// during publish invalidates the cache, but this call keeps iterating the
		// snapshot it started with - exactly what the per-call Array.from used to do.
		let subscribedFunctions = this._publishList;
		if (subscribedFunctions === null) {
			subscribedFunctions = Array.from(this._subscribedFunctions.values());
			this._publishList = subscribedFunctions;
		}
		for (let i = 0; i < subscribedFunctions.length; i++) {
			const func = subscribedFunctions[i];
			func(data);
		}
	}
}
//#endregion

//#region Subscriptions
/** Used to store multiple instances of subscribed events and allows disconnection from all events at once */
export class SubscriptionBag implements EventSubscription {
	private _subs: EventSubscription[];

	public get isValid(): boolean { return this._subs.length > 0; }

	constructor(...subs: EventSubscription[]) {
		this._subs = subs;
	}

	public add(sub: EventSubscription): void {
		this._subs.push(sub);
	}

	public addRange(...subs: EventSubscription[]): void {
		this._subs.push(...subs);
	}

	public disconnect(): boolean {
		if (this._subs.length <= 0) { return false; }

		for (const sub of this._subs) {
			sub.disconnect();
		}

		// remove all the elements from the array
		this._subs.splice(0, this._subs.length);
		return true;
	}
}
//#endregion