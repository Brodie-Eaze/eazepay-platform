import { SubmitApplicationPage } from '../../../components/SubmitApplicationPage';

export default function SubmitMedPay() {
  return (
    <SubmitApplicationPage
      config={{
        eyebrow: 'MED PAY',
        title: 'Submit Med Pay Application',
        description:
          'Medical financing for patients seeking healthcare procedures, treatments, and wellness services.',
        applyHref: '/apply/medpay',
        linkUrl: '/apply/medpay',
      }}
    />
  );
}
