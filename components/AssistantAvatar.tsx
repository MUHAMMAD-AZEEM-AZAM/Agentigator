import React, { useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  type SharedValue
} from 'react-native-reanimated'

const AnimatedPath = Animated.createAnimatedComponent(Path)

type AgentState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'processing'
  | 'speaking'

type AssistantAvatarProps = {
  state: AgentState
  size?: number
}

/* ---------- Wave generator ---------- */

function createWaveCircle(
  cx: number,
  cy: number,
  radius: number,
  amplitude: number,
  waves: number,
  phase: number
) {
  'worklet'

  const steps = 240
  let d = ''

  for (let i = 0; i <= steps; i++) {

    const angle = (i / steps) * Math.PI * 2
    const wave = Math.sin(angle * waves + phase) * amplitude

    const r = radius + wave

    const x = cx + Math.cos(angle) * r
    const y = cy + Math.sin(angle) * r

    if (i === 0) d += `M ${x} ${y}`
    else d += ` L ${x} ${y}`
  }

  return d + ' Z'
}

/* ---------- Wave Ring ---------- */

const WaveRing = ({
  size,
  color,
  duration,
  reverse,
  scaleX,
  scaleY,
  stateScale,
  amplitude,
  energy,
  waves,
  strokeWidth,
  flickerStrength
}: {
  size: number
  color: string
  duration: number
  reverse?: boolean
  scaleX: number
  scaleY: number
  stateScale: SharedValue<number>
  amplitude: number
  energy: SharedValue<number>
  waves: number
  strokeWidth: number
  flickerStrength: number
}) => {

  const phase = useSharedValue(0)
  const flicker = useSharedValue(0)

  const padding = 25
  const canvas = size + padding * 2
  const center = canvas / 2
  const radius = size / 2 - strokeWidth

  useEffect(() => {

    phase.value = withRepeat(
      withTiming(reverse ? -Math.PI * 2 : Math.PI * 2, {
        duration,
        easing: Easing.linear
      }),
      -1,
      false
    )

  }, [duration, reverse])

  useEffect(() => {
    flicker.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 650, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    )
  }, [])

  const animatedProps = useAnimatedProps(() => {
    const intensity = 1 + energy.value * 0.18 + flicker.value * flickerStrength
    const amp = amplitude * intensity
    return {
      d: createWaveCircle(center, center, radius, amp, waves, phase.value)
    }
  })

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: stateScale.value },
      { scaleX },
      { scaleY }
    ]
  }))

  return (
    <Animated.View style={[styles.absoluteCenter, animatedStyle]}>

      <Svg width={canvas} height={canvas}>

        {/* outer glow */}
        <AnimatedPath
          animatedProps={animatedProps}
          stroke={color}
          strokeWidth={strokeWidth * 8}
          opacity={0.05}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* inner glow */}
        <AnimatedPath
          animatedProps={animatedProps}
          stroke={color}
          strokeWidth={strokeWidth * 4}
          opacity={0.12}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* crisp core */}
        <AnimatedPath
          animatedProps={animatedProps}
          stroke={color}
          strokeWidth={strokeWidth * 1.6}
          opacity={0.95}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

      </Svg>

    </Animated.View>
  )
}

/* ---------- Avatar ---------- */

export function AssistantAvatar({ state, size = 160 }: AssistantAvatarProps) {

  const scale = useSharedValue(1)
  const energy = useSharedValue(0.25)

  useEffect(() => {

    switch (state) {

      case 'idle':
        // Very slow subtle breathing -- like a small ember
        scale.value = withSequence(
          withTiming(0.85, { duration: 800, easing: Easing.out(Easing.ease) }),
          withRepeat(
            withSequence(
              withTiming(0.9, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
              withTiming(0.85, { duration: 3000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
          )
        )
        energy.value = withTiming(0.22, { duration: 600, easing: Easing.inOut(Easing.ease) })
        break

      case 'connecting':
        // Slow steady pulse -- warming up
        scale.value = withRepeat(
          withSequence(
            withTiming(0.95, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
            withTiming(0.85, { duration: 1500, easing: Easing.inOut(Easing.sin) })
          ),
          -1,
          true
        )
        energy.value = withTiming(0.35, { duration: 600, easing: Easing.inOut(Easing.ease) })
        break

      case 'listening':
        // Expand smoothly and hold -- like a flame growing to receive warmth
        scale.value = withSequence(
          withTiming(1.2, { duration: 800, easing: Easing.out(Easing.ease) }),
          withRepeat(
            withSequence(
              withTiming(1.25, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
              withTiming(1.18, { duration: 2000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
          )
        )
        energy.value = withTiming(0.62, { duration: 600, easing: Easing.inOut(Easing.ease) })
        break

      case 'processing':
        // Medium size, gentle pulse -- thinking
        scale.value = withRepeat(
          withSequence(
            withTiming(1.0, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
            withTiming(0.92, { duration: 1200, easing: Easing.inOut(Easing.sin) })
          ),
          -1,
          true
        )
        energy.value = withTiming(0.46, { duration: 600, easing: Easing.inOut(Easing.ease) })
        break

      case 'speaking':
        // Expand large and hold -- slow burning flame, not frantic
        scale.value = withSequence(
          withTiming(1.4, { duration: 600, easing: Easing.out(Easing.ease) }),
          withRepeat(
            withSequence(
              withTiming(1.45, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
              withTiming(1.35, { duration: 1500, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
          )
        )
        energy.value = withTiming(0.82, { duration: 600, easing: Easing.inOut(Easing.ease) })
        break
    }

  }, [state])

  return (
    <View style={[styles.container, { width: size, height: size }]}>

      {/* main violet ring */}
      <WaveRing
        size={size}
        color="#7c3aed"
        duration={15000}
        scaleX={1}
        scaleY={1}
        amplitude={4.2}
        waves={5}
        strokeWidth={4.4}
        flickerStrength={0.04}
        stateScale={scale}
        energy={energy}
      />

      {/* inner lavender shimmer */}
      <WaveRing
        size={size * 0.98}
        color="#e9d5ff"
        duration={9000}
        reverse
        scaleX={1}
        scaleY={1}
        amplitude={3.2}
        waves={6}
        strokeWidth={3}
        flickerStrength={0.06}
        stateScale={scale}
        energy={energy}
      />

    </View>
  )
}

const styles = StyleSheet.create({

  container: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent'
  },

  absoluteCenter: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center'
  }

})
