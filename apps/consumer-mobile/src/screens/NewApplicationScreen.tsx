import { useState } from 'react';
import { SafeAreaView, ScrollView, Text, TextInput, Pressable, StyleSheet, View, Alert } from 'react-native';
import { lightColors, spacing, fontSizes } from '@eazepay/ui/tokens';
import { ApiError } from '@eazepay/api-client';
import { useAuthStore } from '../state/auth.store.js';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types.js';

type Category = 'auto' | 'home_improvement' | 'medical' | 'retail' | 'personal' | 'consolidation';
const CATEGORIES: Category[] = ['personal', 'auto', 'home_improvement', 'medical', 'retail', 'consolidation'];

type Props = NativeStackScreenProps<RootStackParamList, 'NewApplication'>;

export default function NewApplicationScreen({ navigation }: Props) {
  const client = useAuthStore((s) => s.client);
  const [category, setCategory] = useState<Category>('personal');
  const [amount, setAmount] = useState('5000');
  const [term, setTerm] = useState('24');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!client) return;
    setSubmitting(true);
    try {
      const dollars = Number(amount.replace(/,/g, ''));
      if (!Number.isFinite(dollars) || dollars <= 0) {
        throw new Error('Enter a valid amount');
      }
      const cents = Math.round(dollars * 100);
      const created = await client.createApplication({
        category,
        requestedAmountCents: String(cents),
        termMonths: Number(term),
      });
      const submitted = await client.submitApplication(created.id);
      navigation.replace('Offers', { applicationId: submitted.id });
    } catch (err) {
      Alert.alert('Could not start application', err instanceof ApiError ? err.problem.detail ?? err.problem.title : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.h2}>What is the loan for?</Text>
        <View style={s.chips}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c}
              style={[s.chip, category === c && s.chipSelected]}
              onPress={() => setCategory(c)}
              accessibilityRole="button"
              accessibilityState={{ selected: category === c }}
            >
              <Text style={[s.chipText, category === c && s.chipTextSelected]}>{c.replace('_', ' ')}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.h3}>How much?</Text>
        <View style={s.amountRow}>
          <Text style={s.amountPrefix}>$</Text>
          <TextInput style={s.amountInput} keyboardType="number-pad" value={amount} onChangeText={setAmount} accessibilityLabel="Amount" />
        </View>
        <Text style={s.h3}>Term</Text>
        <View style={s.chips}>
          {['12', '24', '36', '48', '60'].map((t) => (
            <Pressable key={t} style={[s.chip, term === t && s.chipSelected]} onPress={() => setTerm(t)}>
              <Text style={[s.chipText, term === t && s.chipTextSelected]}>{t} months</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={[s.btn, submitting && s.disabled]} onPress={submit} disabled={submitting}>
          <Text style={s.btnText}>{submitting ? 'Submitting…' : 'Submit application'}</Text>
        </Pressable>
        <Text style={s.disclosure}>
          By submitting, you authorise EazePay to evaluate your application and obtain consumer
          reports. We never share information with parties outside the offer flow.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: lightColors.bgDefault },
  body: { padding: spacing.xxl, gap: spacing.lg },
  h2: { fontSize: fontSizes.h3, fontWeight: '700', color: lightColors.textPrimary },
  h3: { fontSize: fontSizes.h6, fontWeight: '700', color: lightColors.textPrimary, marginTop: spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: 999, backgroundColor: lightColors.bgElevated, borderWidth: 1, borderColor: lightColors.borderDefault },
  chipSelected: { backgroundColor: lightColors.accentDefault, borderColor: lightColors.accentDefault },
  chipText: { color: lightColors.textPrimary, textTransform: 'capitalize' },
  chipTextSelected: { color: lightColors.textOnAccent, fontWeight: '600' },
  amountRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: lightColors.borderDefault, borderRadius: 12, paddingHorizontal: spacing.lg, height: 64 },
  amountPrefix: { fontSize: fontSizes.h4, color: lightColors.textMuted, marginRight: spacing.xs },
  amountInput: { flex: 1, fontSize: fontSizes.h4, color: lightColors.textPrimary, fontWeight: '600' },
  btn: { backgroundColor: lightColors.accentDefault, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  btnText: { color: lightColors.textOnAccent, fontWeight: '600', fontSize: fontSizes.body },
  disabled: { opacity: 0.6 },
  disclosure: { color: lightColors.textMuted, fontSize: fontSizes.caption, lineHeight: 18, marginTop: spacing.lg },
});
