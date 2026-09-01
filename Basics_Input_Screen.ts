import { Component, InteractionInfo, PlayerControls } from 'horizon/core';
import { type LongTapEventData, type PanEventData, type PinchEventData, type SwipeEventData, type TapEventData, type TouchEventData, Gestures } from 'horizon/mobile_gestures';
import { EventPublisher, SubscriptionBag } from 'Utility_Events';

export const onTouchStart: EventPublisher<InteractionInfo> = new EventPublisher();
export const onTouchEnd: EventPublisher<InteractionInfo> = new EventPublisher();
export const onTouchMove: EventPublisher<InteractionInfo> = new EventPublisher();

export const onTap: EventPublisher<TapEventData> = new EventPublisher();
export const onLongTap: EventPublisher<LongTapEventData> = new EventPublisher();
export const onSwipe: EventPublisher<SwipeEventData> = new EventPublisher();
export const onPan: EventPublisher<PanEventData> = new EventPublisher();
export const onPinch: EventPublisher<PinchEventData> = new EventPublisher();

export class InputScreenListener extends Component<typeof InputScreenListener> {
	private _gestures: Gestures | null = null;
	private _subscriptions: SubscriptionBag | null = null;

	start(): void {
		this._gestures = new Gestures(this);
		this.connectEvents();
	}

	private connectEvents(): void {
		if (this._subscriptions !== null || this._gestures === null) { return; }

		this._subscriptions = new SubscriptionBag(
			this.connectLocalBroadcastEvent(PlayerControls.onFocusedInteractionInputStarted, this.inputStarted.bind(this)),
			this.connectLocalBroadcastEvent(PlayerControls.onFocusedInteractionInputMoved, this.inputUpdated.bind(this)),
			this.connectLocalBroadcastEvent(PlayerControls.onFocusedInteractionInputEnded, this.inputEnded.bind(this)),
			this._gestures.onTap.connectLocalEvent(this.onTapCalled.bind(this)),
			this._gestures.onLongTap.connectLocalEvent(this.onLongTapCalled.bind(this)),
			this._gestures.onSwipe.connectLocalEvent(this.onSwipeCalled.bind(this)),
			this._gestures.onPan.connectLocalEvent(this.onPanCalled.bind(this)),
			this._gestures.onPinch.connectLocalEvent(this.onPinchCalled.bind(this)),
		);
	}
	
	private inputStarted(data: { interactionInfo: InteractionInfo[] }): void {
		onTouchStart.publish(data.interactionInfo[0]);
	}

	private inputUpdated(data: { interactionInfo: InteractionInfo[] }): void {
		onTouchMove.publish(data.interactionInfo[0]);
	}

	private inputEnded(data: { interactionInfo: InteractionInfo[] }): void {
		onTouchEnd.publish(data.interactionInfo[0]);
	}

	private onTapCalled(data: TapEventData): void {
		onTap.publish(data);
	}

	private onLongTapCalled(data: LongTapEventData): void {
		onLongTap.publish(data);
	}

	private onSwipeCalled(data: SwipeEventData): void {
		onSwipe.publish(data);
	}

	private onPanCalled(data: PanEventData): void {
		onPan.publish(data);
	}

	private onPinchCalled(data: PinchEventData): void {
		onPinch.publish(data);
	}
}
Component.register(InputScreenListener);