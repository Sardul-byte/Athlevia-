import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  type TextInputProps,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type LabeledInputProps = TextInputProps & { label: string };

export function LabeledInput({ label, style, ...rest }: LabeledInputProps) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.field}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.backgroundElement },
          style,
        ]}
        {...rest}
      />
    </ThemedView>
  );
}

type PrimaryButtonProps = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export function PrimaryButton({ title, onPress, loading, disabled }: PrimaryButtonProps) {
  const theme = useTheme();
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.tint, opacity: pressed || inactive ? 0.7 : 1 },
      ]}>
      {loading ? (
        <ActivityIndicator color="#ffffff" />
      ) : (
        <ThemedText type="smallBold" style={styles.buttonLabel}>
          {title}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.one,
    alignSelf: 'stretch',
  },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
    fontSize: 16,
  },
  button: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  buttonLabel: {
    color: '#ffffff',
  },
});
