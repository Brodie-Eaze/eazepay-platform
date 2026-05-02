import { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { lightColors, spacing, fontSizes } from '@eazepay/ui/tokens';
import { useAuthStore } from '../state/auth.store.js';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types.js';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

interface Application {
  id: string;
  status: string;
  category: string;
  requestedAmountCents: string;
  termMonths: number;
}

export default function HomeScreen({ navigation }: Props) {
  const client = useAuthStore((s) => s.client);
  const [apps, setApps] = useState<Application[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!client) return;
    try {
      const r = (await client['request']('GET', '/v1/applications')) as { items?: Application[] } & Application[];
      const items = Array.isArray(r) ? r : (r.items ?? []);
      setApps(items);
    } catch {
      // surface error UX TODO
    }
  };

  useEffect(() => {
    void load();
  }, [client]);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <Text style={s.h1}>Your applications</Text>
        {apps.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>No applications yet</Text>
            <Text style={s.emptyBody}>Start one to see real offers in minutes.</Text>
          </View>
        ) : (
          apps.map((a) => (
            <Pressable
              key={a.id}
              style={s.card}
              onPress={() => navigation.navigate('Offers', { applicationId: a.id })}
            >
              <Text style={s.cardCat}>{a.category.replace('_', ' ')}</Text>
              <Text style={s.cardAmt}>${(Number(a.requestedAmountCents) / 100).toFixed(2)}</Text>
              <Text style={s.cardStatus}>{a.status}</Text>
            </Pressable>
          ))
        )}
      </ScrollView>
      <Pressable style={s.cta} onPress={() => navigation.navigate('NewApplication')}>
        <Text style={s.ctaText}>Start a new application</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: lightColors.bgDefault },
  body: { padding: spacing.xxl, paddingBottom: 100 },
  h1: { fontSize: fontSizes.h3, fontWeight: '700', color: lightColors.textPrimary, marginBottom: spacing.xl },
  empty: { backgroundColor: lightColors.bgElevated, padding: spacing.xxl, borderRadius: 16, alignItems: 'center' },
  emptyTitle: { fontSize: fontSizes.bodyLg, fontWeight: '600', color: lightColors.textPrimary, marginBottom: spacing.xs },
  emptyBody: { color: lightColors.textSecondary, textAlign: 'center' },
  card: { padding: spacing.xl, backgroundColor: lightColors.bgElevated, borderRadius: 16, marginBottom: spacing.md, borderWidth: 1, borderColor: lightColors.borderDefault },
  cardCat: { color: lightColors.textMuted, textTransform: 'capitalize', fontSize: fontSizes.bodySm, marginBottom: spacing.xs },
  cardAmt: { fontSize: fontSizes.h4, fontWeight: '700', color: lightColors.textPrimary, marginBottom: spacing.xs },
  cardStatus: { color: lightColors.accentDefault, textTransform: 'uppercase', fontSize: fontSizes.caption, fontWeight: '600' },
  cta: { position: 'absolute', left: spacing.xxl, right: spacing.xxl, bottom: spacing.xxl, height: 52, borderRadius: 12, backgroundColor: lightColors.accentDefault, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: lightColors.textOnAccent, fontWeight: '600', fontSize: fontSizes.body },
});
