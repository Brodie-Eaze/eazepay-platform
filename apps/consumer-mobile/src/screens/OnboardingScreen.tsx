import { SafeAreaView, Text, StyleSheet, Pressable } from 'react-native';
import { lightColors, spacing, fontSizes } from '@eazepay/ui/tokens';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types.js';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

export default function OnboardingScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={s.safe}>
      <Text style={s.h1}>Quick KYC</Text>
      <Text style={s.body}>
        Before your first application, we'll verify your identity. We use a third-party provider
        (Persona / Socure) — your image and SSN go directly to them, never to us.
      </Text>
      <Text style={s.helper}>(KYC capture flow lands when the IDV SDK is wired.)</Text>
      <Pressable style={s.btn} onPress={() => navigation.replace('Home')}>
        <Text style={s.btnText}>Skip for now (dev)</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: lightColors.bgDefault, padding: spacing.xxl },
  h1: {
    fontSize: fontSizes.h2,
    fontWeight: '700',
    color: lightColors.textPrimary,
    marginTop: spacing.giant,
    marginBottom: spacing.lg,
  },
  body: {
    color: lightColors.textSecondary,
    fontSize: fontSizes.bodyLg,
    lineHeight: 26,
    marginBottom: spacing.lg,
  },
  helper: { color: lightColors.textMuted, marginBottom: spacing.xl },
  btn: {
    backgroundColor: lightColors.accentDefault,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: lightColors.textOnAccent, fontWeight: '600', fontSize: fontSizes.body },
});
