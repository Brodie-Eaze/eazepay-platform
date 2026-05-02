import { useState } from 'react';
import { SafeAreaView, View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { lightColors, spacing, fontSizes } from '@eazepay/ui/tokens';
import { ApiError } from '@eazepay/api-client';
import { useAuthStore } from '../state/auth.store.js';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types.js';

type Props = NativeStackScreenProps<RootStackParamList, 'VerifyOtp'>;

export default function VerifyOtpScreen({ route, navigation }: Props) {
  const { challengeId, next } = route.params;
  const client = useAuthStore((s) => s.client);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!client) return;
    setSubmitting(true);
    try {
      await client.verifyOtp({ challengeId, code });
      setAuthenticated();
      navigation.reset({ index: 0, routes: [{ name: next }] });
    } catch (err) {
      Alert.alert(
        'Verification failed',
        err instanceof ApiError ? err.problem.detail ?? err.problem.title : String(err),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <Text style={s.h2}>Enter the 6-digit code</Text>
      <Text style={s.helper}>Check your email for the verification code we sent you.</Text>
      <TextInput
        style={s.code}
        keyboardType="number-pad"
        maxLength={6}
        value={code}
        onChangeText={setCode}
        accessibilityLabel="Verification code"
      />
      <Pressable style={[s.btn, submitting && s.disabled]} onPress={submit} disabled={submitting}>
        <Text style={s.btnText}>{submitting ? 'Verifying…' : 'Verify'}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: lightColors.bgDefault, padding: spacing.xxl },
  h2: { fontSize: fontSizes.h3, fontWeight: '700', color: lightColors.textPrimary, marginTop: spacing.xxl },
  helper: { color: lightColors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.xl },
  code: {
    height: 64,
    borderWidth: 1,
    borderColor: lightColors.borderDefault,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    fontSize: 28,
    letterSpacing: 8,
    color: lightColors.textPrimary,
    textAlign: 'center',
  },
  btn: { backgroundColor: lightColors.accentDefault, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xl },
  btnText: { color: lightColors.textOnAccent, fontWeight: '600', fontSize: fontSizes.body },
  disabled: { opacity: 0.6 },
});
