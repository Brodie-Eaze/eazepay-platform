export type RootStackParamList = {
  Welcome: undefined;
  Register: undefined;
  Login: undefined;
  VerifyOtp: { challengeId: string; next: 'Onboarding' | 'Home' };
  Onboarding: undefined;
  Home: undefined;
  NewApplication: undefined;
  Offers: { applicationId: string };
  AcceptedOffer: { applicationId: string };
};
