import { useState } from 'react';
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
  const [isFocused, setIsFocused] = useState(false);

  return (
    <ThemedView style={styles.field}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.labelText}>
        {label}
      </ThemedText>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.backgroundElement,
            borderColor: isFocused ? theme.tint : theme.backgroundSelected,
            borderWidth: 1,
          },
          style,
        ]}
        onFocus={(e) => {
          setIsFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          rest.onBlur?.(e);
        }}
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
        {
          backgroundColor: inactive ? theme.backgroundSelected : theme.tint,
          opacity: pressed && !inactive ? 0.9 : 1,
        },
      ]}>
      {loading ? (
        <ActivityIndicator color={theme.text} />
      ) : (
        <ThemedText
          type="smallBold"
          style={[
            styles.buttonLabel,
            { color: inactive ? theme.textSecondary : '#ffffff' },
          ]}>
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
    backgroundColor: 'transparent',
  },
  labelText: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  input: {
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    fontSize: 15,
  },
  button: {
    borderRadius: 10,
    paddingVertical: Spacing.three - 2,
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  buttonLabel: {
    fontSize: 14,
    letterSpacing: 0.5,
  },
});

