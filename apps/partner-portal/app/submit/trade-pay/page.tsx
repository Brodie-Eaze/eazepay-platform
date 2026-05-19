import { SubmitApplicationPage } from '../../../components/SubmitApplicationPage';

export default function SubmitTradePay() {
  return (
    <SubmitApplicationPage
      config={{
        eyebrow: 'TRADE PAY',
        title: 'Submit Trade Pay Application',
        description:
          'Trade & contractor financing for home improvement, HVAC, plumbing, and skilled trade services.',
        applyHref: '/apply/tradepay',
        linkUrl: '/apply/tradepay',
      }}
    />
  );
}
