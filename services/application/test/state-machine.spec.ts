import { describe, expect, it } from 'vitest';
import { applyTransition, isTerminalStatus } from '../src/state-machine.js';

describe('Application state machine', () => {
  it('allows draft → submitted via SUBMIT', () => {
    expect(applyTransition('draft', { type: 'SUBMIT' })).toBe('submitted');
  });

  it('allows submitted → underwriting via BEGIN_UNDERWRITING', () => {
    expect(applyTransition('submitted', { type: 'BEGIN_UNDERWRITING' })).toBe('underwriting');
  });

  it('allows offers_presented → accepted via ACCEPT_OFFER', () => {
    expect(applyTransition('offers_presented', { type: 'ACCEPT_OFFER', offerId: 'x' })).toBe(
      'accepted',
    );
  });

  it('allows accepted → contracted via CONTRACT_SIGNED', () => {
    expect(applyTransition('accepted', { type: 'CONTRACT_SIGNED' })).toBe('contracted');
  });

  it('rejects ACCEPT_OFFER from draft', () => {
    expect(applyTransition('draft', { type: 'ACCEPT_OFFER', offerId: 'x' })).toBeNull();
  });

  it('rejects SUBMIT from active', () => {
    expect(applyTransition('active', { type: 'SUBMIT' })).toBeNull();
  });

  it('marks active / declined / cancelled / expired as terminal', () => {
    expect(isTerminalStatus('active')).toBe(true);
    expect(isTerminalStatus('declined')).toBe(true);
    expect(isTerminalStatus('cancelled')).toBe(true);
    expect(isTerminalStatus('expired')).toBe(true);
  });

  it('marks in-flight states as non-terminal', () => {
    expect(isTerminalStatus('draft')).toBe(false);
    expect(isTerminalStatus('underwriting')).toBe(false);
    expect(isTerminalStatus('offers_presented')).toBe(false);
    expect(isTerminalStatus('contracted')).toBe(false);
  });
});
