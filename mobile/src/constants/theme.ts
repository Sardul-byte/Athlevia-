/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    tint: '#0D9488',
    tintSoft: '#CCFBF1',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    tint: '#2DD4BF',
    tintSoft: '#134E4A',
  },
  cyberpunk: {
    text: '#0FF0FC',
    background: '#1A002C',
    backgroundElement: '#2D004D',
    backgroundSelected: '#440073',
    textSecondary: '#FF007F',
    tint: '#FF007F',
    tintSoft: '#2D004D',
  },
  emerald: {
    text: '#ECFDF5',
    background: '#022C22',
    backgroundElement: '#064E3B',
    backgroundSelected: '#0F766E',
    textSecondary: '#A7F3D0',
    tint: '#10B981',
    tintSoft: '#042F2E',
  },
  rosegold: {
    text: '#FFF5F5',
    background: '#2D1B1B',
    backgroundElement: '#4A2828',
    backgroundSelected: '#6E3B3B',
    textSecondary: '#FFD3D3',
    tint: '#FCA5A5',
    tintSoft: '#3F1A1A',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
/** On web the tab bar floats over the top of the page instead. */
export const TopTabInset = Platform.select({ web: 76 }) ?? 0;
export const MaxContentWidth = 800;
