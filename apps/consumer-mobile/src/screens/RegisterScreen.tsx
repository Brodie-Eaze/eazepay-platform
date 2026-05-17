import { useState } from 'react';
import { SafeAreaView, View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { lightColors, spacing, fontSizes } from '@eazepay/ui/tokens';
import { useAuthStore } from '../state/auth.store.js';
import { ApiError } from '@eazepay/api-client';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types.js';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const client = useAuthStore((s) => s.client);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!client) return;
    setSubmitting(true);
    try {
      const r = await client.register({ email, password });
      navigation.navigate('VerifyOtp', {
        challengeId: r.challenge.challengeId,
        next: 'Onboarding',
      });
    } catch (err) {
      const msg = err instanceof ApiError ? (err.problem.detail ?? err.problem.title) : String(err);
      Alert.alert('Registration failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <Text style={s.h2}>Create your account</Text>
      <Text style={s.helper}>We'll send a 6-digit verification code to your email.</Text>
      <View style={s.field}>
        <Text style={s.label}>Email</Text>
        <TextInput
          style={s.input}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
          accessibilityLabel="Email"
        />
      </View>
      <View style={s.field}>
        <Text style={s.label}>Password</Text>
        <TextInput
          style={s.input}
          secureTextEntry
          autoCapitalize="none"
          textContentType="newPassword"
          value={password}
          onChangeText={setPassword}
          accessibilityLabel="Password"
        />
        <Text style={s.helperSm}>≥12 characters with mixed case, number, symbol.</Text>
      </View>
      <Pressable
        style={[s.btn, submitting && s.disabled]}
        onPress={submit}
        disabled={submitting}
        accessibilityRole="button"
      >
        <Text style={s.btnText}>{submitting ? 'Sending…' : 'Continue'}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: lightColors.bgDefault, padding: spacing.xxl },
  h2: {
    fontSize: fontSizes.h3,
    fontWeight: '700',
    color: lightColors.textPrimary,
    marginTop: spacing.xxl,
  },
  helper: { color: lightColors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.xl },
  helperSm: { color: lightColors.textMuted, fontSize: fontSizes.caption, marginTop: spacing.xs },
  field: { marginBottom: spacing.lg },
  label: {
    color: lightColors.textPrimary,
    fontSize: fontSizes.bodySm,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: lightColors.borderDefault,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    fontSize: fontSizes.body,
    color: lightColors.textPrimary,
  },
  btn: {
    backgroundColor: lightColors.accentDefault,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  btnText: { color: lightColors.textOnAccent, fontWeight: '600', fontSize: fontSizes.body },
  disabled: { opacity: 0.6 },
});
