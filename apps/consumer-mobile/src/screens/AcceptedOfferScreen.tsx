import { SafeAreaView, View, Text, Pressable, StyleSheet } from 'react-native';
import { lightColors, spacing, fontSizes } from '@eazepay/ui/tokens';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types.js';

type Props = NativeStackScreenProps<RootStackParamList, 'AcceptedOffer'>;

export default function AcceptedOfferScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.body}>
        <Text style={s.h1}>You're all set</Text>
        <Text style={s.body1}>
          Your loan agreement is signed. Funds are on the way; we'll notify you the moment they
          settle. Your repayment schedule will appear in the app once funding completes.
        </Text>
      </View>
      <Pressable style={s.btn} onPress={() => navigation.popToTop()}>
        <Text style={s.btnText}>Back to home</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: lightColors.bgDefault, padding: spacing.xxl, justifyContent: 'space-between' },
  body: { marginTop: spacing.giant },
  h1: { fontSize: fontSizes.h2, fontWeight: '700', color: lightColors.textPrimary, marginBottom: spacing.lg },
  body1: { color: lightColors.textSecondary, fontSize: fontSizes.bodyLg, lineHeight: 26 },
  btn: { backgroundColor: lightColors.accentDefault, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xxl },
  btnText: { color: lightColors.textOnAccent, fontWeight: '600', fontSize: fontSizes.body },
});
