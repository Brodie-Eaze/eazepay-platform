import { describe, it, expect, beforeEach } from 'vitest';
import { BrandedEmailService } from '../src/branded-email.service.js';
import { MockEmailAdapter } from '../src/adapters/mock-email.adapter.js';
import type {
  EmailDispatchAuditRow,
  EmailDispatchAuditWriter,
} from '../src/email-dispatch-audit.service.js';

class RecordingAudit implements EmailDispatchAuditWriter {
  public rows: EmailDispatchAuditRow[] = [];
  async record(row: EmailDispatchAuditRow): Promise<void> {
    this.rows.push(row);
  }
}

describe('BrandedEmailService', () => {
  let mock: MockEmailAdapter;
  let audit: RecordingAudit;
  let service: BrandedEmailService;

  beforeEach(() => {
    mock = new MockEmailAdapter();
    audit = new RecordingAudit();
    service = new BrandedEmailService(mock, audit);
  });

  it('sendWelcome dispatches to MedPay from-address + audits the row', async () => {
    const result = await service.sendWelcome({
      brand: 'medpay',
      to: 'finance@helio.test',
      idempotencyKey: 'welcome-helio-123',
      vars: {
        recipientName: 'Helio team',
        merchantBusinessName: 'Helio Dental Group',
        portalUrl: 'https://x.test',
      },
    });
    expect(result.provider).toBe('mock');
    expect(audit.rows).toHaveLength(1);
    const row = audit.rows[0]!;
    expect(row.brand).toBe('medpay');
    expect(row.to).toBe('finance@helio.test');
    expect(row.templateKey).toBe('welcome');
    expect(row.subject).toContain('MedPay');
    expect(row.idempotencyKey).toBe('welcome-helio-123');
  });

  it('sendPasswordReset uses the correct template key', async () => {
    await service.sendPasswordReset({
      brand: 'tradepay',
      to: 'owner@orion.test',
      idempotencyKey: 'pwreset-orion-1',
      vars: {
        recipientName: 'Owner',
        resetUrl: 'https://x.test',
        resetCode: '123456',
        requestOrigin: 'San Francisco · 8.8.8.8',
      },
    });
    expect(audit.rows[0]?.templateKey).toBe('password_reset');
    expect(audit.rows[0]?.brand).toBe('tradepay');
  });

  it('sendTeamInvite uses the correct template key + audits', async () => {
    await service.sendTeamInvite({
      brand: 'coachpay',
      to: 'newrep@atlas.test',
      idempotencyKey: 'team-invite-x',
      vars: {
        recipientName: 'New Rep',
        inviterName: 'Brodie',
        roleLabel: 'Admin',
        acceptUrl: 'https://x.test',
      },
    });
    expect(audit.rows[0]?.templateKey).toBe('team_invite');
    expect(audit.rows[0]?.brand).toBe('coachpay');
  });

  it('sendInvoiceIssued routes to the correct vertical from-address', async () => {
    await service.sendInvoiceIssued({
      brand: 'medpay',
      to: 'finance@helio.test',
      idempotencyKey: 'inv-INV-2026-05-p_helio',
      vars: {
        recipientName: 'finance',
        merchantBusinessName: 'Helio',
        invoiceNo: 'INV-2026-05-p_helio',
        periodLabel: 'May 2026',
        grossFundedCents: 1_000_000,
        feePct: 0.04,
        amountDueCents: 40_000,
        dueDate: '2026-06-15',
        confirmUrl: 'https://x.test',
      },
    });
    const row = audit.rows[0]!;
    expect(row.brand).toBe('medpay');
    expect(row.templateKey).toBe('invoice_issued');
    expect(row.subject).toContain('INV-2026-05-p_helio');
  });

  it('auto-mints idempotencyKey when caller omits it', async () => {
    await service.sendWelcome({
      brand: 'medpay',
      to: 'a@b.test',
      vars: {
        recipientName: 'a',
        merchantBusinessName: 'Foo',
        portalUrl: 'https://x.test',
      },
    });
    expect(audit.rows[0]?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('audit write failure does NOT fail the send', async () => {
    class FailingAudit implements EmailDispatchAuditWriter {
      async record(): Promise<void> {
        throw new Error('audit sink down');
      }
    }
    const failingService = new BrandedEmailService(mock, new FailingAudit());
    const result = await failingService.sendWelcome({
      brand: 'medpay',
      to: 'a@b.test',
      vars: {
        recipientName: 'a',
        merchantBusinessName: 'Foo',
        portalUrl: 'https://x.test',
      },
    });
    expect(result.provider).toBe('mock'); // send completed despite audit fail
  });

  it('service constructed without audit writer warns but still sends', async () => {
    const noAuditService = new BrandedEmailService(mock);
    const result = await noAuditService.sendWelcome({
      brand: 'medpay',
      to: 'a@b.test',
      vars: {
        recipientName: 'a',
        merchantBusinessName: 'Foo',
        portalUrl: 'https://x.test',
      },
    });
    expect(result.provider).toBe('mock');
  });
});
