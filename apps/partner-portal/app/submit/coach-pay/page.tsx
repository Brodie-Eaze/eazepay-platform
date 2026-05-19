import { SubmitApplicationPage } from '../../../components/SubmitApplicationPage';

export default function SubmitCoachPay() {
  return (
    <SubmitApplicationPage
      config={{
        eyebrow: 'EAZE PAY',
        title: 'Submit EAZE Pay Application',
        description:
          'Coaching & consulting financing for clients seeking professional development and business coaching services.',
        applyHref: '/apply/coachpay',
        linkUrl: '/apply/coachpay',
      }}
    />
  );
}
