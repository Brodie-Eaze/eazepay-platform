import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UsBankLenderAdapter } from '../src/adapters/us-bank.adapter.js';
import { EngineTechLenderAdapter } from '../src/adapters/engine-tech.adapter.js';
import { QueenStreetLenderAdapter } from '../src/adapters/queen-street.adapter.js';
import type { LenderEvaluationContext } from '../src/lender.types.js';

const ctx: LenderEvaluationContext = {
  applicationId: 'app-1',
  userId: 'user-1',
  category: 'personal' as never,
  requestedAmountCents: 5_000_000n,
  termMonths: 36,
  residentState: 'CA',
  affordabilityPasses: true,
  riskScore: 720,
};
const ctrl = () => ({ signal: new AbortController().signal });

describe('Scaffold lender adapters — characterisation', () => {
  let saved: NodeJS.ProcessEnv;
  beforeEach(() => {
    saved = { ...process.env };
    delete process.env['US_BANK_BASE_URL'];
    delete process.env['US_BANK_API_KEY'];
    delete process.env['ENGINE_TECH_BASE_URL'];
    delete process.env['ENGINE_TECH_CLIENT_ID'];
    delete process.env['ENGINE_TECH_CLIENT_SECRET'];
    delete process.env['QUEEN_STREET_BASE_URL'];
    delete process.env['QUEEN_STREET_API_TOKEN'];
  });
  afterEach(() => {
    process.env = saved;
  });

  describe('UsBankLenderAdapter', () => {
    const a = new UsBankLenderAdapter();
    it('adapterKey is "us_bank"', () => expect(a.adapterKey).toBe('us_bank'));
    it('isEligible always returns eligible:true so quote() can surface per-lender failure', async () => {
      expect(await a.isEligible(ctx)).toEqual({ eligible: true });
    });
    it('quote throws us_bank_adapter_pending_api_credentials when ENV missing', async () => {
      await expect(a.quote(ctx, ctrl())).rejects.toThrow('us_bank_adapter_pending_api_credentials');
    });
    it('quote throws us_bank_adapter_not_implemented once ENV is set (TODO not yet wired)', async () => {
      process.env['US_BANK_BASE_URL'] = 'https://sandbox.example';
      process.env['US_BANK_API_KEY'] = 'sandbox-key';
      await expect(a.quote(ctx, ctrl())).rejects.toThrow('us_bank_adapter_not_implemented');
    });
  });

  describe('EngineTechLenderAdapter', () => {
    const a = new EngineTechLenderAdapter();
    it('adapterKey is "engine_tech"', () => expect(a.adapterKey).toBe('engine_tech'));
    it('isEligible always returns eligible:true (eligibility deferred to quote)', async () => {
      expect(await a.isEligible(ctx)).toEqual({ eligible: true });
    });
    it('quote throws engine_tech_adapter_pending_api_credentials when ENV missing', async () => {
      await expect(a.quote(ctx, ctrl())).rejects.toThrow(
        'engine_tech_adapter_pending_api_credentials',
      );
    });
    it('quote throws engine_tech_adapter_not_implemented once ENV is set', async () => {
      process.env['ENGINE_TECH_BASE_URL'] = 'https://sandbox.example';
      process.env['ENGINE_TECH_CLIENT_ID'] = 'cid';
      process.env['ENGINE_TECH_CLIENT_SECRET'] = 'csec';
      await expect(a.quote(ctx, ctrl())).rejects.toThrow('engine_tech_adapter_not_implemented');
    });
  });

  describe('QueenStreetLenderAdapter', () => {
    const a = new QueenStreetLenderAdapter();
    it('adapterKey is "queen_street"', () => expect(a.adapterKey).toBe('queen_street'));
    it('quote throws queen_street_adapter_pending_api_credentials when ENV missing', async () => {
      await expect(a.quote(ctx, ctrl())).rejects.toThrow(
        'queen_street_adapter_pending_api_credentials',
      );
    });
    it('quote throws queen_street_adapter_not_implemented once ENV is set', async () => {
      process.env['QUEEN_STREET_BASE_URL'] = 'https://sandbox.example';
      process.env['QUEEN_STREET_API_TOKEN'] = 'tok';
      await expect(a.quote(ctx, ctrl())).rejects.toThrow('queen_street_adapter_not_implemented');
    });
  });
});
