/**
 * Seed data for the Onboarding Command Centre.
 *
 * Each `OnboardingBusiness` row represents a merchant the EazePay
 * ops team is shepherding through the configuration funnel — from
 * invite → KYB → integration onboarding (Highsale + MyCAMP + EZ Check
 * + Processing + DialerPay) → approval → live.
 *
 * The shape here matches what an operator needs to drive every
 * action surfaced on `/onboarding-pipeline/[id]`: status tracker,
 * KYB results, integration progress, document requests, comms
 * timeline (push / email / SMS), internal notes, and a hash-chained
 * activity log.
 */
import type { BrandCode } from '@eazepay/shared-types';

export type OnboardingStatus =
  | 'invited' // invite link sent, no activity yet
  | 'started' // business clicked invite, filling out wizard
  | 'kyb_running' // KYB checks in progress
  | 'docs_pending' // waiting on documents we requested
  | 'info_pending' // waiting on info we requested
  | 'review' // ready for ops review
  | 'approved' // approved, partner is live
  | 'declined'; // declined, communicated to applicant

export type CheckState = 'pending' | 'running' | 'pass' | 'fail' | 'review';

export interface OnboardingBusiness {
  id: string;
  legalName: string;
  dba?: string;
  ein: string;
  industry: string;
  state: string;
  /** Brands the business is configuring (1+). */
  brands: BrandCode[];
  primaryContact: { name: string; email: string; phone: string };
  status: OnboardingStatus;
  invitedAt: string;
  invitedBy: string;
  lastActivityAt: string;
  ownerName: string;

  /** Required KYB / sanctions / BOI checks. */
  kyb: {
    irsTinMatch: CheckState;
    secretaryOfState: CheckState;
    ofacScreen: CheckState;
    pepScreen: CheckState;
    fincenBoi: CheckState;
    adverseMedia: CheckState;
  };

  /** Integration onboarding state per provider. */
  integrations: {
    highsale: 'not_started' | 'in_progress' | 'completed' | 'blocked';
    mycamp: 'not_started' | 'in_progress' | 'completed' | 'blocked';
    ezCheck: 'not_started' | 'in_progress' | 'completed' | 'blocked';
    processing: 'not_started' | 'in_progress' | 'completed' | 'blocked';
    dialerPay: 'not_started' | 'in_progress' | 'completed' | 'blocked';
  };

  docs: Array<{
    id: string;
    name: string;
    required: boolean;
    status: 'requested' | 'received' | 'approved' | 'rejected';
    requestedAt: string;
    note?: string;
  }>;

  comms: Array<{
    id: string;
    at: string;
    channel: 'push' | 'email' | 'sms';
    direction: 'outbound' | 'inbound';
    subject?: string;
    body: string;
    sentBy?: string;
    status: 'sent' | 'delivered' | 'opened' | 'failed';
  }>;

  notes: Array<{
    id: string;
    at: string;
    author: string;
    body: string;
  }>;

  timeline: Array<{
    id: string;
    at: string;
    type: 'event' | 'system' | 'human';
    body: string;
    actor: string;
  }>;
}

/**
 * STATIC_NOW is a frozen "current moment" used as the baseline for
 * every seed timestamp. Keeping it static (not Date.now()) means the
 * server-rendered HTML and the client-hydrated HTML produce identical
 * ISO strings, avoiding React hydration mismatches in the activity
 * timeline + `Nh ago` labels.
 */
const STATIC_NOW = Date.parse('2026-05-14T19:00:00.000Z');

const iso = (daysAgo: number, hoursAgo = 0, minutesAgo = 0) =>
  new Date(
    STATIC_NOW - daysAgo * 86_400_000 - hoursAgo * 3_600_000 - minutesAgo * 60_000,
  ).toISOString();

export const ONBOARDING_BUSINESSES: OnboardingBusiness[] = [
  {
    id: 'biz_atlas_dental',
    legalName: 'Atlas Dental Group, LLC',
    dba: 'Atlas Dental',
    ein: '83-4881192',
    industry: 'Dental — Cosmetic + general',
    state: 'TX',
    brands: ['medpay'],
    primaryContact: {
      name: 'Dr. Lena Park',
      email: 'lena@atlasdental.com',
      phone: '+1 (512) 555-0142',
    },
    ownerName: 'Lena Park',
    status: 'docs_pending',
    invitedAt: iso(11),
    invitedBy: 'Cole Ramirez',
    lastActivityAt: iso(0, 2, 14),
    kyb: {
      irsTinMatch: 'pass',
      secretaryOfState: 'pass',
      ofacScreen: 'pass',
      pepScreen: 'pass',
      fincenBoi: 'review',
      adverseMedia: 'pass',
    },
    integrations: {
      highsale: 'completed',
      mycamp: 'in_progress',
      ezCheck: 'in_progress',
      processing: 'not_started',
      dialerPay: 'not_started',
    },
    docs: [
      {
        id: 'doc_01',
        name: 'Voided check (settlement account)',
        required: true,
        status: 'requested',
        requestedAt: iso(2, 4),
        note: 'Plaid Auth failed micro-deposit verification — falling back to voided cheque.',
      },
      {
        id: 'doc_02',
        name: 'Operating agreement (signed)',
        required: true,
        status: 'received',
        requestedAt: iso(7),
      },
      {
        id: 'doc_03',
        name: 'BO ID — Dr. Lena Park',
        required: true,
        status: 'approved',
        requestedAt: iso(9),
      },
    ],
    comms: [
      {
        id: 'c_01',
        at: iso(11),
        channel: 'email',
        direction: 'outbound',
        subject: 'Welcome to EazePay — let’s get Atlas Dental live',
        body: 'Hi Lena, your invite is ready. Click the link to configure your account.',
        sentBy: 'cole@eaze.test',
        status: 'opened',
      },
      {
        id: 'c_02',
        at: iso(7, 4),
        channel: 'email',
        direction: 'outbound',
        subject: 'KYB checks complete — one more doc',
        body: 'All KYB pulls cleared. We need a voided cheque to finish settlement bank verification.',
        sentBy: 'cole@eaze.test',
        status: 'opened',
      },
      {
        id: 'c_03',
        at: iso(2, 4),
        channel: 'push',
        direction: 'outbound',
        body: 'Action needed: upload a voided cheque so we can finalise your settlement account.',
        sentBy: 'system',
        status: 'delivered',
      },
      {
        id: 'c_04',
        at: iso(0, 2, 14),
        channel: 'sms',
        direction: 'inbound',
        body: 'On it — sending today.',
        status: 'delivered',
      },
    ],
    notes: [
      {
        id: 'n_01',
        at: iso(9),
        author: 'Cole Ramirez',
        body: 'Dr. Park is rolling out at 3 dental offices once approved. Push to fast-track.',
      },
    ],
    timeline: [
      { id: 't_01', at: iso(11), type: 'system', body: 'Invite sent', actor: 'system' },
      { id: 't_02', at: iso(10, 22), type: 'event', body: 'Wizard started', actor: 'business' },
      { id: 't_03', at: iso(9), type: 'event', body: 'KYB submitted', actor: 'business' },
      { id: 't_04', at: iso(8, 12), type: 'system', body: 'KYB completed — pass', actor: 'system' },
      { id: 't_05', at: iso(7, 4), type: 'human', body: 'Doc request sent (voided cheque)', actor: 'cole@eaze.test' },
      { id: 't_06', at: iso(2, 4), type: 'system', body: 'Push notification sent — voided cheque reminder', actor: 'system' },
      { id: 't_07', at: iso(0, 2, 14), type: 'event', body: 'SMS reply received', actor: 'business' },
    ],
  },
  {
    id: 'biz_pacific_solar',
    legalName: 'Pacific Solar Co.',
    dba: 'PacSolar',
    ein: '47-3829104',
    industry: 'Home improvement — Solar + battery',
    state: 'CA',
    brands: ['tradepay'],
    primaryContact: {
      name: 'Michael Tran',
      email: 'mtran@pacsolar.com',
      phone: '+1 (415) 555-0119',
    },
    ownerName: 'Michael Tran',
    status: 'review',
    invitedAt: iso(18),
    invitedBy: 'Maya Patel',
    lastActivityAt: iso(1),
    kyb: {
      irsTinMatch: 'pass',
      secretaryOfState: 'pass',
      ofacScreen: 'pass',
      pepScreen: 'pass',
      fincenBoi: 'pass',
      adverseMedia: 'pass',
    },
    integrations: {
      highsale: 'completed',
      mycamp: 'completed',
      ezCheck: 'completed',
      processing: 'completed',
      dialerPay: 'in_progress',
    },
    docs: [
      { id: 'd1', name: 'C-46 Solar Contractor License', required: true, status: 'approved', requestedAt: iso(16) },
      { id: 'd2', name: 'Insurance certificate ($2M GL)', required: true, status: 'approved', requestedAt: iso(15) },
      { id: 'd3', name: 'BO IDs (×2)', required: true, status: 'approved', requestedAt: iso(15) },
    ],
    comms: [
      {
        id: 'c_p1',
        at: iso(18),
        channel: 'email',
        direction: 'outbound',
        subject: 'Welcome to EazePay TradePay',
        body: 'Hi Michael, your invite is ready.',
        sentBy: 'maya@eaze.test',
        status: 'opened',
      },
      {
        id: 'c_p2',
        at: iso(1),
        channel: 'email',
        direction: 'outbound',
        subject: 'Final review',
        body: 'All checks pass. Sending for ops review.',
        sentBy: 'system',
        status: 'opened',
      },
    ],
    notes: [
      {
        id: 'n_p1',
        at: iso(2),
        author: 'Maya Patel',
        body: 'High-quality applicant. 8,200 homeowners financed. Strong references. Approve.',
      },
    ],
    timeline: [
      { id: 'tp1', at: iso(18), type: 'system', body: 'Invite sent', actor: 'system' },
      { id: 'tp2', at: iso(16), type: 'event', body: 'KYB submitted', actor: 'business' },
      { id: 'tp3', at: iso(14), type: 'system', body: 'KYB completed — pass', actor: 'system' },
      { id: 'tp4', at: iso(10), type: 'event', body: 'Highsale onboarding complete', actor: 'business' },
      { id: 'tp5', at: iso(8), type: 'event', body: 'MyCAMP onboarding complete', actor: 'business' },
      { id: 'tp6', at: iso(5), type: 'event', body: 'EZ Check onboarding complete', actor: 'business' },
      { id: 'tp7', at: iso(2), type: 'event', body: 'Processing onboarding complete', actor: 'business' },
      { id: 'tp8', at: iso(1), type: 'system', body: 'Routed for ops review', actor: 'system' },
    ],
  },
  {
    id: 'biz_evergreen_career',
    legalName: 'Evergreen Career Coaching, Inc.',
    ein: '92-1108472',
    industry: 'Coaching — Career + bootcamp',
    state: 'WA',
    brands: ['coachpay'],
    primaryContact: {
      name: 'Quinn Riley',
      email: 'quinn@evergreencareer.com',
      phone: '+1 (206) 555-0177',
    },
    ownerName: 'Quinn Riley',
    status: 'kyb_running',
    invitedAt: iso(2),
    invitedBy: 'Cole Ramirez',
    lastActivityAt: iso(0, 5),
    kyb: {
      irsTinMatch: 'pass',
      secretaryOfState: 'running',
      ofacScreen: 'pass',
      pepScreen: 'pass',
      fincenBoi: 'pending',
      adverseMedia: 'pending',
    },
    integrations: {
      highsale: 'not_started',
      mycamp: 'not_started',
      ezCheck: 'not_started',
      processing: 'not_started',
      dialerPay: 'not_started',
    },
    docs: [],
    comms: [
      {
        id: 'c_e1',
        at: iso(2),
        channel: 'email',
        direction: 'outbound',
        subject: 'Welcome to EazePay CoachPay',
        body: 'Hi Quinn, your invite is ready.',
        sentBy: 'cole@eaze.test',
        status: 'opened',
      },
    ],
    notes: [],
    timeline: [
      { id: 'te1', at: iso(2), type: 'system', body: 'Invite sent', actor: 'system' },
      { id: 'te2', at: iso(1, 14), type: 'event', body: 'Wizard started', actor: 'business' },
      { id: 'te3', at: iso(0, 5), type: 'system', body: 'KYB pulls initiated', actor: 'system' },
    ],
  },
  {
    id: 'biz_summit_orthodontics',
    legalName: 'Summit Orthodontics PLLC',
    dba: 'Summit Ortho',
    ein: '47-9928177',
    industry: 'Dental — Orthodontics',
    state: 'CO',
    brands: ['medpay'],
    primaryContact: {
      name: 'Dr. Tarun Singh',
      email: 'tarun@summitortho.com',
      phone: '+1 (303) 555-0124',
    },
    ownerName: 'Tarun Singh',
    status: 'info_pending',
    invitedAt: iso(6),
    invitedBy: 'Maya Patel',
    lastActivityAt: iso(0, 1, 30),
    kyb: {
      irsTinMatch: 'pass',
      secretaryOfState: 'pass',
      ofacScreen: 'pass',
      pepScreen: 'pass',
      fincenBoi: 'pass',
      adverseMedia: 'review',
    },
    integrations: {
      highsale: 'in_progress',
      mycamp: 'not_started',
      ezCheck: 'not_started',
      processing: 'not_started',
      dialerPay: 'not_started',
    },
    docs: [
      { id: 'ds1', name: 'BO ID — Dr. Singh', required: true, status: 'received', requestedAt: iso(5) },
    ],
    comms: [
      {
        id: 'c_s1',
        at: iso(0, 6),
        channel: 'email',
        direction: 'outbound',
        subject: 'One additional clarification',
        body: 'Hi Tarun — adverse media flagged a 2023 article. Can you confirm the entity referenced is not yours?',
        sentBy: 'maya@eaze.test',
        status: 'delivered',
      },
    ],
    notes: [],
    timeline: [
      { id: 'ts1', at: iso(6), type: 'system', body: 'Invite sent', actor: 'system' },
      { id: 'ts2', at: iso(5), type: 'event', body: 'KYB submitted', actor: 'business' },
      { id: 'ts3', at: iso(0, 6), type: 'human', body: 'Info request sent — adverse media clarification', actor: 'maya@eaze.test' },
    ],
  },
  {
    id: 'biz_iron_horse_hvac',
    legalName: 'Iron Horse HVAC, LLC',
    ein: '85-2204819',
    industry: 'Home improvement — HVAC',
    state: 'NV',
    brands: ['tradepay'],
    primaryContact: {
      name: 'Devin Cho',
      email: 'devin@ironhorsehvac.com',
      phone: '+1 (702) 555-0188',
    },
    ownerName: 'Devin Cho',
    status: 'started',
    invitedAt: iso(0, 14),
    invitedBy: 'Cole Ramirez',
    lastActivityAt: iso(0, 0, 22),
    kyb: {
      irsTinMatch: 'pending',
      secretaryOfState: 'pending',
      ofacScreen: 'pending',
      pepScreen: 'pending',
      fincenBoi: 'pending',
      adverseMedia: 'pending',
    },
    integrations: {
      highsale: 'not_started',
      mycamp: 'not_started',
      ezCheck: 'not_started',
      processing: 'not_started',
      dialerPay: 'not_started',
    },
    docs: [],
    comms: [
      {
        id: 'c_i1',
        at: iso(0, 14),
        channel: 'email',
        direction: 'outbound',
        subject: 'Welcome to EazePay TradePay',
        body: 'Hi Devin, your invite is ready.',
        sentBy: 'cole@eaze.test',
        status: 'opened',
      },
    ],
    notes: [],
    timeline: [
      { id: 'ti1', at: iso(0, 14), type: 'system', body: 'Invite sent', actor: 'system' },
      { id: 'ti2', at: iso(0, 0, 22), type: 'event', body: 'Wizard started', actor: 'business' },
    ],
  },
  {
    id: 'biz_riverstone_med',
    legalName: 'Riverstone Medical Group',
    ein: '38-4188291',
    industry: 'Medical — Multispecialty',
    state: 'IL',
    brands: ['medpay'],
    primaryContact: {
      name: 'Lila Park',
      email: 'lila@riverstonemed.com',
      phone: '+1 (312) 555-0119',
    },
    ownerName: 'Lila Park',
    status: 'approved',
    invitedAt: iso(42),
    invitedBy: 'Cole Ramirez',
    lastActivityAt: iso(28),
    kyb: {
      irsTinMatch: 'pass',
      secretaryOfState: 'pass',
      ofacScreen: 'pass',
      pepScreen: 'pass',
      fincenBoi: 'pass',
      adverseMedia: 'pass',
    },
    integrations: {
      highsale: 'completed',
      mycamp: 'completed',
      ezCheck: 'completed',
      processing: 'completed',
      dialerPay: 'completed',
    },
    docs: [],
    comms: [],
    notes: [],
    timeline: [
      { id: 'tr1', at: iso(42), type: 'system', body: 'Invite sent', actor: 'system' },
      { id: 'tr2', at: iso(35), type: 'system', body: 'KYB completed', actor: 'system' },
      { id: 'tr3', at: iso(30), type: 'human', body: 'Approved', actor: 'cole@eaze.test' },
      { id: 'tr4', at: iso(28), type: 'event', body: 'First application submitted', actor: 'business' },
    ],
  },
];

export const STATUS_LABEL: Record<OnboardingStatus, string> = {
  invited: 'Invited',
  started: 'Started',
  kyb_running: 'KYB running',
  docs_pending: 'Docs pending',
  info_pending: 'Info pending',
  review: 'Ready for review',
  approved: 'Approved · live',
  declined: 'Declined',
};

export const KYB_LABEL: Record<keyof OnboardingBusiness['kyb'], string> = {
  irsTinMatch: 'IRS TIN match',
  secretaryOfState: 'Secretary of State',
  ofacScreen: 'OFAC + sanctions',
  pepScreen: 'PEP screen',
  fincenBoi: 'FinCEN BOI',
  adverseMedia: 'Adverse media',
};

export const INTEGRATION_LABEL: Record<keyof OnboardingBusiness['integrations'], string> = {
  highsale: 'Highsale',
  mycamp: 'MyCAMP',
  ezCheck: 'EZ Check',
  processing: 'Processing',
  dialerPay: 'DialerPay',
};

export const integrationStateLabel = (s: OnboardingBusiness['integrations'][keyof OnboardingBusiness['integrations']]) =>
  s === 'completed'
    ? 'Completed'
    : s === 'in_progress'
      ? 'In progress'
      : s === 'blocked'
        ? 'Blocked'
        : 'Not started';

export const checkLabel = (s: CheckState) =>
  s === 'pass' ? 'Pass' : s === 'fail' ? 'Fail' : s === 'running' ? 'Running' : s === 'review' ? 'Review' : 'Pending';

export const findBusiness = (id: string) =>
  ONBOARDING_BUSINESSES.find((b) => b.id === id);

/**
 * Compute a "Xh ago"-style label relative to the frozen STATIC_NOW
 * baseline. Identical output on server + client, no hydration drift.
 */
export const seedAgo = (isoString: string): string => {
  const mins = Math.floor((STATIC_NOW - new Date(isoString).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};
