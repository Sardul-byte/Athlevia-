/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useCustomTheme } from '@/lib/theme-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  const { themeName } = useCustomTheme();
  const scheme = useColorScheme();

  if (themeName === 'light' || themeName === 'dark') {
    const theme = scheme === 'unspecified' ? 'light' : scheme;
    return Colors[theme];
  }

  return Colors[themeName];
}
