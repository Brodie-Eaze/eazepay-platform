import { View, Text, StyleSheet, Pressable, SafeAreaView } from 'react-native';
import { lightColors, spacing, fontSizes } from '@eazepay/ui/tokens';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types.js';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export default function WelcomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.body}>
        <Text style={s.h1}>EazePay</Text>
        <Text style={s.tagline}>
          Apply for finance in minutes. Compare real offers. Repay with one tap.
        </Text>
      </View>
      <View style={s.actions}>
        <Pressable
          style={[s.btn, s.primary]}
          onPress={() => navigation.navigate('Register')}
          accessibilityRole="button"
        >
          <Text style={s.primaryText}>Get started</Text>
        </Pressable>
        <Pressable
          style={[s.btn, s.secondary]}
          onPress={() => navigation.navigate('Login')}
          accessibilityRole="button"
        >
          <Text style={s.secondaryText}>I already have an account</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: lightColors.bgDefault,
    padding: spacing.xxl,
    justifyContent: 'space-between',
  },
  body: { marginTop: spacing.giant },
  h1: {
    fontSize: fontSizes.h1,
    fontWeight: '700',
    color: lightColors.textPrimary,
    marginBottom: spacing.lg,
  },
  tagline: { fontSize: fontSizes.bodyLg, color: lightColors.textSecondary, lineHeight: 26 },
  actions: { gap: spacing.md, marginBottom: spacing.xxl },
  btn: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: lightColors.accentDefault },
  primaryText: { color: lightColors.textOnAccent, fontSize: fontSizes.body, fontWeight: '600' },
  secondary: {
    backgroundColor: lightColors.bgElevated,
    borderWidth: 1,
    borderColor: lightColors.borderDefault,
  },
  secondaryText: { color: lightColors.textPrimary, fontSize: fontSizes.body, fontWeight: '600' },
});
