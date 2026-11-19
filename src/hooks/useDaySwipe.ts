import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  GestureResponderHandlers,
  PanResponder,
  PanResponderGestureState,
  useWindowDimensions,
} from "react-native";
import { DAY_SWIPE, DaySwipeStep, dragStep, isDaySwipe, swipeDayStep } from "../lib/daySwipe";

interface DaySwipeOptions {
  // Whether the day may turn this way; a day out of reach only stretches a little and springs back.
  canStep: (step: DaySwipeStep) => boolean;
  // Turns the shown day; called once the old day has slid out.
  onStep: (step: DaySwipeStep) => void;
}

export interface DaySwipe {
  // Spread on every piece of the shown day's content, so a swipe can start on any of them.
  panHandlers: GestureResponderHandlers;
  // One shared slide and fade, so all those pieces move together like a single page.
  slideStyle: {
    opacity: Animated.AnimatedInterpolation<number>;
    transform: { translateX: Animated.Value }[];
  };
  // True while a finger drags the day sideways; the list pauses its vertical scrolling meanwhile.
  swiping: boolean;
}

// Eases the page to `toValue`; every slide runs on the native driver, like the rest of the app's motion.
function slideTo(offset: Animated.Value, toValue: number, duration: number) {
  return Animated.timing(offset, { toValue, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true });
}

// Swiping the shown day sideways turns to the next or previous day like a page: the day follows the finger,
// slides out, and the new day slides in once it is on screen. Rules for what counts live in `src/lib/daySwipe.ts`.
export function useDaySwipe(dayKey: string, { canStep, onStep }: DaySwipeOptions): DaySwipe {
  const { width } = useWindowDimensions();
  const offset = useRef(new Animated.Value(0)).current;
  const [swiping, setSwiping] = useState(false);
  // The responder is made once and reads the newest callbacks and width from here.
  const latest = useRef({ canStep, onStep, width });
  latest.current = { canStep, onStep, width };
  // While the old day slides out new swipes are ignored, so its day change can't be lost halfway;
  // the new day's slide in can be caught by the next swipe, for turning several days quickly.
  const turning = useRef(false);
  // The step whose new day still has to slide in, once that day has rendered.
  const pendingEnter = useRef<DaySwipeStep | null>(null);

  // Runs after the new day's rows are committed but before they are drawn, so the old day never flashes back.
  useLayoutEffect(() => {
    const step = pendingEnter.current;
    if (step === null) return;
    pendingEnter.current = null;
    turning.current = false;
    offset.setValue(step * latest.current.width * DAY_SWIPE.enterRatio);
    slideTo(offset, 0, DAY_SWIPE.enterMs).start();
  }, [dayKey, offset]);

  const panHandlers = useMemo(() => {
    const springBack = () => Animated.spring(offset, { toValue: 0, bounciness: 4, useNativeDriver: true }).start();

    // The old day leaves the way the finger went; the layout effect above brings the new one in.
    const turnPage = (step: DaySwipeStep) => {
      turning.current = true;
      slideTo(offset, -step * latest.current.width, DAY_SWIPE.exitMs).start(() => {
        pendingEnter.current = step;
        latest.current.onStep(step);
      });
    };

    // Toward a day out of reach the page only stretches a little, so the edge is felt before it springs back.
    const followFinger = (dx: number) =>
      offset.setValue(latest.current.canStep(dragStep(dx)) ? dx : dx * DAY_SWIPE.edgeResistance);

    const release = (gesture: PanResponderGestureState) => {
      setSwiping(false);
      const step = swipeDayStep(gesture.dx, gesture.vx, latest.current.width);
      if (step === 0 || !latest.current.canStep(step)) springBack();
      else turnPage(step);
    };

    return PanResponder.create({
      // Asked on the way down, before the task row or link under the finger, so a sideways drag that started
      // on something tappable still turns the day instead of ending as a tap.
      onMoveShouldSetPanResponderCapture: (_event, gesture) => !turning.current && isDaySwipe(gesture.dx, gesture.dy),
      onPanResponderGrant: () => {
        offset.stopAnimation();
        setSwiping(true);
      },
      onPanResponderMove: (_event, gesture) => followFinger(gesture.dx),
      onPanResponderRelease: (_event, gesture) => release(gesture),
      // Taken away mid-drag (a call, a system gesture): the day stays and the list settles back.
      onPanResponderTerminate: () => {
        setSwiping(false);
        springBack();
      },
      // Once the day follows the finger, the list's scrolling can't take the touch back.
      onPanResponderTerminationRequest: () => false,
    }).panHandlers;
  }, [offset]);

  const slideStyle = useMemo(
    () => ({
      opacity: offset.interpolate({
        inputRange: [-width, 0, width],
        outputRange: [DAY_SWIPE.edgeOpacity, 1, DAY_SWIPE.edgeOpacity],
        extrapolate: "clamp",
      }),
      transform: [{ translateX: offset }],
    }),
    [offset, width]
  );

  return { panHandlers, slideStyle, swiping };
}
