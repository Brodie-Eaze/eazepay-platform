/**
 * Shared state types + constants for the Welcome wizard. Co-located
 * so every step component can read/write the same shape without
 * importing from page.tsx (which would create a server/client mix).
 */

export type Industry = 'coaching' | 'trades' | 'medical' | 'other';

export type StepKey =
  | 'industry'
  | 'business_info'
  | 'business_details'
  | 'financial_profile'
  | 'review';

export interface BeneficialOwner {
  firstName: string;
  lastName: string;
  title: string;
  /** Whole-number percent 0..100. We store as string so the input is
   *  controllable; validation parses to Number at submit time. */
  ownershipPercentage: string;
  email: string;
  phone: string;
  isControlPerson: boolean;
}

export interface OnboardingState {
  industry: Industry | '';
  // Business info
  legalName: string;
  dba: string;
  ein: string;
  website: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  // Business details
  yearsInBusiness: string;
  employeeCount: string;
  owners: BeneficialOwner[];
  // Financial profile
  bankName: string;
  routingNumber: string;
  accountNumber: string;
  accountType: 'checking' | 'savings';
  avgMonthlyVolume: string; // dollars, free-form
  avgTicket: string;
  hasProcessingHistory: boolean;
  // Review / agreements
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
  signedAgreement: boolean;
}

export const INDUSTRIES: Array<{
  code: Industry;
  title: string;
  description: string;
  /** Brand we'll map the merchant onto. */
  brand: 'coachpay' | 'tradepay' | 'medpay' | 'direct';
}> = [
  {
    code: 'coaching',
    title: 'Coaching & Consulting',
    description: 'Life coaches, business consultants, executive coaches, and mentoring practices.',
    brand: 'coachpay',
  },
  {
    code: 'trades',
    title: 'Contractors & Trades',
    description: 'Home improvement, HVAC, roofing, plumbing, electrical, and general contracting.',
    brand: 'tradepay',
  },
  {
    code: 'medical',
    title: 'Medical & Dental',
    description: 'Dental clinics, med spas, cosmetic surgery, veterinary, and healthcare practices.',
    brand: 'medpay',
  },
  {
    code: 'other',
    title: 'Other Industry',
    description: 'Retail, ecommerce, professional services, or another industry not listed above.',
    brand: 'direct',
  },
];

export const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
] as const;

export const EMPTY_STATE: OnboardingState = {
  industry: '',
  legalName: '',
  dba: '',
  ein: '',
  website: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  zip: '',
  yearsInBusiness: '',
  employeeCount: '',
  owners: [
    {
      firstName: '',
      lastName: '',
      title: 'Owner',
      ownershipPercentage: '100',
      email: '',
      phone: '',
      isControlPerson: true,
    },
  ],
  bankName: '',
  routingNumber: '',
  accountNumber: '',
  accountType: 'checking',
  avgMonthlyVolume: '',
  avgTicket: '',
  hasProcessingHistory: false,
  acceptedTerms: false,
  acceptedPrivacy: false,
  signedAgreement: false,
};

/** Shared props passed to every step component. */
export interface StepProps {
  state: OnboardingState;
  setState: React.Dispatch<React.SetStateAction<OnboardingState>>;
  errors: Record<string, string>;
}

/** Re-usable form-field wrapper so every input renders identically. */
