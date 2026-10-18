
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Animated, Easing, Platform } from 'react-native';
import { SvgXml, SvgUri } from 'react-native-svg';
import { buildMascotSvg, DEFAULT_MASCOT } from '../libs/mascot';
import { normalizeMascot } from '../libs/normalizeMascot';
import { uniqueSvgIds } from '../libs/uniqueSvgIds';

const NATIVE = Platform.OS !== 'web';

let instanceCounter = 0;

export default function Mascot({ config, uri, size = 120, animated = true }) {
  const [blink, setBlink] = useState(false);
  const [gaze, setGaze] = useState(0);

  const uid = useRef(`m${++instanceCounter}`).current;

  const y = useRef(new Animated.Value(0)).current;
  const sy = useRef(new Animated.Value(1)).current;
  const sx = useRef(new Animated.Value(1)).current;
  const rot = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  const key = JSON.stringify(config ?? null);

  const safe = useMemo(() => normalizeMascot(config), [key]);

  useEffect(() => {
    if (!animated) return;
    if (first.current) {
      first.current = false;
      return;
    }
    pop.setValue(0.86);
    Animated.spring(pop, { toValue: 1, friction: 3.2, tension: 210, useNativeDriver: NATIVE }).start();
  }, [key, animated]);

  useEffect(() => {
    if (!animated) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
        Animated.timing(breathe, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      breathe.setValue(0);
    };
  }, [animated]);

  useEffect(() => {
    if (!animated) return;
    const lift = size * 0.14;
    const t = (v, to, duration, easing) =>
      Animated.timing(v, { toValue: to, duration, easing, useNativeDriver: NATIVE });
    const sp = (v) => Animated.spring(v, { toValue: 1, friction: 3, tension: 200, useNativeDriver: NATIVE });
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1800),
        Animated.parallel([t(sy, 0.88, 130, Easing.out(Easing.quad)), t(sx, 1.1, 130, Easing.out(Easing.quad))]),
        Animated.parallel([
          t(y, -lift, 270, Easing.out(Easing.cubic)),
          t(sy, 1.1, 270, Easing.out(Easing.quad)),
          t(sx, 0.94, 270, Easing.out(Easing.quad)),
        ]),
        Animated.parallel([
          t(y, 0, 240, Easing.in(Easing.cubic)),
          t(sy, 1, 240, Easing.in(Easing.quad)),
          t(sx, 1, 240, Easing.in(Easing.quad)),
        ]),
        Animated.parallel([t(sy, 0.85, 80, Easing.out(Easing.quad)), t(sx, 1.12, 80, Easing.out(Easing.quad))]),
        Animated.parallel([sp(sy), sp(sx)]),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      y.setValue(0);
      sy.setValue(1);
      sx.setValue(1);
    };
  }, [animated, size]);

  useEffect(() => {
    if (!animated) return;
    const r = (to, d) =>
      Animated.timing(rot, { toValue: to, duration: d, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE });
    const loop = Animated.loop(
      Animated.sequence([Animated.delay(3300), r(-7, 190), r(6, 240), r(-3, 200), r(0, 200)])
    );
    loop.start();
    return () => {
      loop.stop();
      rot.setValue(0);
    };
  }, [animated]);

  useEffect(() => {
    if (!animated || uri) return;
    let alive = true;
    let timer;
    const wait = (ms, fn) => {
      timer = setTimeout(() => alive && fn(), ms);
    };
    const doBlink = (twice) => {
      setBlink(true);
      wait(120, () => {
        setBlink(false);
        if (twice) wait(110, () => doBlink(false));
        else schedule();
      });
    };
    const schedule = () => wait(1800 + Math.random() * 2600, () => doBlink(Math.random() < 0.25));
    schedule();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [animated, uri]);

  useEffect(() => {
    if (!animated || uri) return;
    let alive = true;
    let timer;
    const schedule = () => {
      timer = setTimeout(() => {
        if (!alive) return;
        setGaze((Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 4));
        timer = setTimeout(() => {
          if (!alive) return;
          setGaze(0);
          schedule();
        }, 1000);
      }, 3000 + Math.random() * 3000);
    };
    schedule();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [animated, uri]);

  const xml = useMemo(() => {
    if (uri) return null;
    const cfg = { ...safe, blink: animated && blink, gaze: animated ? gaze : 0 };
    try {
      return uniqueSvgIds(buildMascotSvg(cfg, size), uid);
    } catch (e) {
      console.log('mascot build failed', e, config);
      return uniqueSvgIds(buildMascotSvg({ ...DEFAULT_MASCOT, blink: false, gaze: 0 }, size), uid);
    }
  }, [safe, blink, gaze, size, animated, uri]);

  const art = uri ? (
    <SvgUri uri={uri} width={size} height={size} />
  ) : (
    <SvgXml xml={xml} width={size} height={size} />
  );

  if (!animated) {
    return <View style={{ width: size, height: size }}>{art}</View>;
  }

  const lift = size * 0.14;
  const pivot = size * 0.36;

  const rotate = rot.interpolate({ inputRange: [-10, 10], outputRange: ['-10deg', '10deg'] });
  const bY = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });
  const bX = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] });
  const shadowScale = y.interpolate({ inputRange: [-lift, 0], outputRange: [0.65, 1], extrapolate: 'clamp' });
  const shadowOpacity = y.interpolate({ inputRange: [-lift, 0], outputRange: [0.05, 0.16], extrapolate: 'clamp' });

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: size * 0.24,
          width: size * 0.52,
          top: size * 0.87,
          height: size * 0.06,
          borderRadius: size,
          backgroundColor: '#000000',
          opacity: shadowOpacity,
          transform: [{ scaleX: shadowScale }],
        }}
      />
      <Animated.View
        style={{
          transform: [
            { scale: pop },
            { translateY: y },
            { translateY: pivot },
            { rotate },
            { translateY: -pivot },
          ],
        }}
      >
        <Animated.View
          style={{ transform: [{ translateY: pivot }, { scaleY: sy }, { scaleX: sx }, { translateY: -pivot }] }}
        >
          <Animated.View
            style={{ transform: [{ translateY: pivot }, { scaleY: bY }, { scaleX: bX }, { translateY: -pivot }] }}
          >
            {art}
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}