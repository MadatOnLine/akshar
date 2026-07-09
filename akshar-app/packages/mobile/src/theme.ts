/**
 * Akshar Design System — Unified Dark Cyberpunk Theme
 *
 * Single source of truth for all visual tokens.
 * Every screen and component must import from here.
 */

export const colors = {
  // Backgrounds
  background: '#0c1018',
  surface: '#1c2433',
  surfaceDark: '#0e131d',
  surfaceLight: '#243044',

  // Brand / Primary
  primary: '#6d8cff',
  primaryDim: 'rgba(109,140,255,0.15)',
  primaryGlow: 'rgba(109,140,255,0.35)',

  // Semantic
  success: '#43d17a',
  successDim: 'rgba(67,209,122,0.15)',
  error: '#ff6b6b',
  errorDim: 'rgba(255,107,107,0.15)',
  warning: '#ffc66b',
  warningDim: 'rgba(255,198,107,0.15)',

  // Text
  text: '#e8edf6',
  textSecondary: '#8b97ad',
  textMuted: '#566178',

  // Borders
  border: '#283347',
  borderLight: '#1e2a3a',

  // Misc
  overlay: 'rgba(0,0,0,0.65)',
  white: '#ffffff',
  black: '#000000',

  // Trust Tiers
  trustColony: '#43d17a',
  trustDrone: '#6d8cff',
  trustLarva: '#ffc66b',
  trustSuspect: '#ff6b6b',

  // Message Bubbles
  bubbleSent: '#1a2d4a',
  bubbleReceived: '#1c2433',
  bubbleSentBorder: '#2a4060',
  bubbleReceivedBorder: '#283347',
} as const;

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodySmall: { fontSize: 13, fontWeight: '400' as const },
  caption: { fontSize: 11, fontWeight: '500' as const, letterSpacing: 0.5 },
  label: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.3 },
  button: { fontSize: 15, fontWeight: '600' as const, letterSpacing: 0.3 },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  }),
} as const;
