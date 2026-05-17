import { describe, it, expect } from 'vitest';
import { resolveBrandContext } from '../src/brand-context.js';
import { renderWelcomeEmail } from '../src/templates/welcome.js';
import { renderPasswordResetEmail } from '../src/templates/password-reset.js';
import { renderTeamInviteEmail } from '../src/templates/team-invite.js';
import { renderInvoiceIssuedEmail } from '../src/templates/invoice-issued.js';

describe('templates', () => {
  describe('renderWelcomeEmail', () => {
    it('embeds brand wordmark + portal link + recipient name', () => {
      const ctx = resolveBrandContext('medpay');
      const { subject, email } = renderWelcomeEmail(ctx, {
        recipientName: 'Helio team',
        merchantBusinessName: 'Helio Dental Group',
        portalUrl: 'https://medpay.example.com/welcome?token=abc',
      });
      expect(subject).toContain('MedPay');
      expect(email.html).toContain('MedPay');
      expect(email.html).toContain('Helio team');
      expect(email.html).toContain('Helio Dental Group');
      expect(email.html).toContain('https://medpay.example.com/welcome?token=abc');
      expect(email.html).toContain(ctx.accentHex);
      expect(email.text).toContain('Helio Dental Group');
      expect(email.text).toContain('24 hours');
    });

    it('escapes HTML in recipient + merchant fields', () => {
      const ctx = resolveBrandContext('medpay');
      const { email } = renderWelcomeEmail(ctx, {
        recipientName: '<script>alert(1)</script>',
        merchantBusinessName: 'Evil & Co',
        portalUrl: 'https://x.test',
      });
      expect(email.html).not.toContain('<script>alert(1)</script>');
      expect(email.html).toContain('&lt;script&gt;');
      expect(email.html).toContain('Evil &amp; Co');
    });
  });

  describe('renderPasswordResetEmail', () => {
    it('embeds OTP + reset link + origin', () => {
      const ctx = resolveBrandContext('tradepay');
      const { subject, email } = renderPasswordResetEmail(ctx, {
        recipientName: 'orion',
        resetUrl: 'https://tradepay.example.com/reset?challenge=abc',
        resetCode: '482919',
        requestOrigin: '8.8.8.8',
      });
      expect(subject).toContain('TradePay');
      expect(email.html).toContain('482919');
      expect(email.html).toContain('https://tradepay.example.com/reset?challenge=abc');
      expect(email.html).toContain('8.8.8.8');
      expect(email.html).toContain('30 minutes');
      expect(email.text).toContain('482919');
    });

    it('preheader mentions expiry to discourage late clicks', () => {
      const ctx = resolveBrandContext('coachpay');
      const { email } = renderPasswordResetEmail(ctx, {
        recipientName: 'kindred',
        resetUrl: 'https://coachpay.example.com/reset',
        resetCode: '000000',
        requestOrigin: '127.0.0.1',
      });
      // The preheader span has the expiry copy.
      expect(email.html).toContain('expires in 30 minutes');
    });
  });

  describe('renderTeamInviteEmail', () => {
    it('shows inviter name + role + accept url', () => {
      const ctx = resolveBrandContext('medpay');
      const { subject, email } = renderTeamInviteEmail(ctx, {
        recipientName: 'sarah@helio.test',
        inviterName: 'Brodie',
        roleLabel: 'Underwriter',
        acceptUrl: 'https://medpay.example.com/accept?token=xyz',
      });
      expect(subject).toContain('Brodie');
      expect(subject).toContain('MedPay');
      expect(email.html).toContain('Brodie');
      expect(email.html).toContain('Underwriter');
      expect(email.html).toContain('https://medpay.example.com/accept?token=xyz');
      expect(email.html).toContain('7 days');
    });

    it('includes optional inviter note in italic block', () => {
      const ctx = resolveBrandContext('medpay');
      const { email } = renderTeamInviteEmail(ctx, {
        recipientName: 'a',
        inviterName: 'b',
        roleLabel: 'Admin',
        acceptUrl: 'https://x.test',
        inviterNote: 'See you Monday',
      });
      expect(email.html).toContain('See you Monday');
      expect(email.text).toContain('See you Monday');
    });

    it('omits the note block when no inviterNote supplied', () => {
      const ctx = resolveBrandContext('medpay');
      const { email } = renderTeamInviteEmail(ctx, {
        recipientName: 'a',
        inviterName: 'b',
        roleLabel: 'Admin',
        acceptUrl: 'https://x.test',
      });
      expect(email.text).not.toContain('Note from');
    });
  });

  describe('renderInvoiceIssuedEmail', () => {
    it('renders amount, period, due date, confirm + pay links', () => {
      const ctx = resolveBrandContext('medpay');
      const { subject, email } = renderInvoiceIssuedEmail(ctx, {
        recipientName: 'finance',
        merchantBusinessName: 'Helio Dental Group',
        invoiceNo: 'INV-2026-05-p_helio',
        periodLabel: 'May 2026',
        grossFundedCents: 12_300_000,
        feePct: 0.0399,
        amountDueCents: 490_770,
        dueDate: '2026-06-15',
        confirmUrl: 'https://medpay.example.com/confirm/token',
        payUrl: 'https://pay.example.com/abc',
      });
      expect(subject).toContain('INV-2026-05-p_helio');
      expect(subject).toContain('$4,907.70');
      expect(subject).toContain('2026-06-15');
      expect(email.html).toContain('$4,907.70');
      expect(email.html).toContain('$123,000.00');
      expect(email.html).toContain('3.99%');
      expect(email.html).toContain('May 2026');
      expect(email.html).toContain('https://medpay.example.com/confirm/token');
      expect(email.html).toContain('https://pay.example.com/abc');
    });

    it('hides pay button when no payUrl supplied', () => {
      const ctx = resolveBrandContext('medpay');
      const { email } = renderInvoiceIssuedEmail(ctx, {
        recipientName: 'finance',
        merchantBusinessName: 'Helio',
        invoiceNo: 'INV-x',
        periodLabel: 'May 2026',
        grossFundedCents: 1_000_000,
        feePct: 0.04,
        amountDueCents: 40_000,
        dueDate: '2026-06-15',
        confirmUrl: 'https://x.test/confirm',
      });
      expect(email.html).not.toContain('Pay now');
      expect(email.html).toContain('pay link isn');
      expect(email.text).not.toContain('Pay now:');
    });
  });
});
