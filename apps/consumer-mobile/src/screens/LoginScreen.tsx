import { useState } from 'react';
import { SafeAreaView, View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { lightColors, spacing, fontSizes } from '@eazepay/ui/tokens';
import { ApiError } from '@eazepay/api-client';
import { useAuthStore } from '../state/auth.store.js';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types.js';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const client = useAuthStore((s) => s.client);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!client) return;
    setSubmitting(true);
    try {
      const r = await client.login({ identifier, password });
      if (r.mfaRequired && r.challenge) {
        navigation.navigate('VerifyOtp', {
          challengeId: r.challenge.challengeId,
          next: 'Home',
        });
      }
    } catch (err) {
      Alert.alert(
        'Login failed',
        err instanceof ApiError ? err.problem.detail ?? err.problem.title : String(err),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <Text style={s.h2}>Sign in</Text>
      <View style={s.field}>
        <Text style={s.label}>Email or phone</Text>
        <TextInput style={s.input} autoCapitalize="none" value={identifier} onChangeText={setIdentifier} />
      </View>
      <View style={s.field}>
        <Text style={s.label}>Password</Text>
        <TextInput style={s.input} secureTextEntry value={password} onChangeText={setPassword} />
      </View>
      <Pressable style={[s.btn, submitting && s.disabled]} onPress={submit} disabled={submitting}>
        <Text style={s.btnText}>{submitting ? 'Signing in…' : 'Sign in'}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: lightColors.bgDefault, padding: spacing.xxl },
  h2: { fontSize: fontSizes.h3, fontWeight: '700', color: lightColors.textPrimary, marginTop: spacing.xxl, marginBottom: spacing.xl },
  field: { marginBottom: spacing.lg },
  label: { color: lightColors.textPrimary, fontSize: fontSizes.bodySm, fontWeight: '600', marginBottom: spacing.xs },
  input: { height: 48, borderWidth: 1, borderColor: lightColors.borderDefault, borderRadius: 12, paddingHorizontal: spacing.lg, fontSize: fontSizes.body, color: lightColors.textPrimary },
  btn: { backgroundColor: lightColors.accentDefault, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xl },
  btnText: { color: lightColors.textOnAccent, fontWeight: '600', fontSize: fontSizes.body },
  disabled: { opacity: 0.6 },
});
