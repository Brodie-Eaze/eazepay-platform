import { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { lightColors, spacing, fontSizes } from '@eazepay/ui/tokens';
import type { Offer } from '@eazepay/api-client';
import { ApiError } from '@eazepay/api-client';
import { useAuthStore } from '../state/auth.store.js';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types.js';

type Props = NativeStackScreenProps<RootStackParamList, 'Offers'>;

export default function OffersScreen({ route, navigation }: Props) {
  const { applicationId } = route.params;
  const client = useAuthStore((s) => s.client);
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [status, setStatus] = useState<string>('submitted');

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (!client || cancelled) return;
      try {
        const app = await client.getApplication(applicationId);
        setStatus(app.status);
        if (app.status === 'offers_presented') {
          const list = await client.listOffers(applicationId);
          if (!cancelled) {
            setOffers(list);
            setLoading(false);
          }
          return;
        }
        if (app.status === 'declined') {
          if (!cancelled) {
            setOffers([]);
            setLoading(false);
          }
          return;
        }
      } catch {
        // ignore; keep polling
      }
      if (!cancelled) setTimeout(tick, 2000);
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [client, applicationId]);

  const accept = async (offerId: string) => {
    if (!client) return;
    try {
      await client.acceptOffer(applicationId, offerId);
      navigation.replace('AcceptedOffer', { applicationId });
    } catch (err) {
      Alert.alert(
        'Could not accept offer',
        err instanceof ApiError ? (err.problem.detail ?? err.problem.title) : String(err),
      );
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[s.safe, s.center]}>
        <ActivityIndicator size="large" color={lightColors.accentDefault} />
        <Text style={s.loadingText}>We're matching you with lenders…</Text>
      </SafeAreaView>
    );
  }

  if (status === 'declined') {
    return (
      <SafeAreaView style={[s.safe, s.center]}>
        <Text style={s.declineH}>We weren't able to approve this application</Text>
        <Text style={s.declineBody}>
          We've sent you an Adverse Action Notice with the specific reasons and your rights. Check
          your email or your in-app inbox.
        </Text>
        <Pressable style={s.btn} onPress={() => navigation.popToTop()}>
          <Text style={s.btnText}>Back to home</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.h2}>Your offers</Text>
        <Text style={s.helper}>
          Sorted by lowest total cost. The lender of record is shown on each card.
        </Text>
        {offers.map((o) => (
          <View key={o.id} style={s.offer}>
            <View style={s.offerRow}>
              <Text style={s.offerAmount}>${(Number(o.amountCents) / 100).toFixed(2)}</Text>
              <Text style={s.offerApr}>{(o.aprBps / 100).toFixed(2)}% APR</Text>
            </View>
            <Text style={s.offerTotal}>
              Total to repay: ${(Number(o.totalRepayableCents) / 100).toFixed(2)} over{' '}
              {o.termMonths} months
            </Text>
            <Text style={s.offerLender}>Lender: {o.lenderOfRecord}</Text>
            <Pressable style={s.btn} onPress={() => accept(o.id)}>
              <Text style={s.btnText}>Accept this offer</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: lightColors.bgDefault },
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  body: { padding: spacing.xxl, gap: spacing.lg },
  h2: { fontSize: fontSizes.h3, fontWeight: '700', color: lightColors.textPrimary },
  helper: { color: lightColors.textSecondary, marginBottom: spacing.lg },
  loadingText: { marginTop: spacing.lg, color: lightColors.textSecondary },
  offer: {
    padding: spacing.xl,
    borderRadius: 16,
    backgroundColor: lightColors.bgElevated,
    borderWidth: 1,
    borderColor: lightColors.borderDefault,
    marginBottom: spacing.md,
  },
  offerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.xs,
  },
  offerAmount: { fontSize: fontSizes.h4, fontWeight: '700', color: lightColors.textPrimary },
  offerApr: { fontSize: fontSizes.bodyLg, fontWeight: '600', color: lightColors.accentDefault },
  offerTotal: { color: lightColors.textSecondary, marginBottom: spacing.xs },
  offerLender: {
    color: lightColors.textMuted,
    fontSize: fontSizes.bodySm,
    marginBottom: spacing.lg,
  },
  btn: {
    backgroundColor: lightColors.accentDefault,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: lightColors.textOnAccent, fontWeight: '600', fontSize: fontSizes.body },
  declineH: {
    fontSize: fontSizes.h4,
    fontWeight: '700',
    color: lightColors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  declineBody: {
    color: lightColors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
});
