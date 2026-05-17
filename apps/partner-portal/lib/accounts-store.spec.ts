import { describe, it, expect, beforeEach } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  createInvitedAccount,
  setAccountPassword,
  findAccountByEmail,
  getAccount,
  authenticate,
  _resetAccountsForTest,
} from './accounts-store';

const baseInvite = {
  email: 'owner@acme.test',
  displayName: 'Acme Owner',
  brand: 'medpay' as const,
  partnerId: 'p_helio',
  role: 'Owner' as const,
};

describe('accounts-store', () => {
  beforeEach(async () => {
    await _resetAccountsForTest();
  });

  describe('hashPassword + verifyPassword', () => {
    it('round-trips a password', () => {
      const { hash, salt } = hashPassword('Correct Horse Battery 9!');
      expect(hash.length).toBeGreaterThan(0);
      expect(salt.length).toBeGreaterThan(0);
      expect(verifyPassword('Correct Horse Battery 9!', hash, salt)).toBe(true);
    });

    it('rejects a wrong password', () => {
      const { hash, salt } = hashPassword('Correct Horse Battery 9!');
      expect(verifyPassword('wrong-password', hash, salt)).toBe(false);
    });

    it('produces a different salt on each call', () => {
      const a = hashPassword('same-input');
      const b = hashPassword('same-input');
      expect(a.salt).not.toBe(b.salt);
      expect(a.hash).not.toBe(b.hash);
    });

    it('returns false on malformed hash without throwing', () => {
      expect(verifyPassword('whatever', 'not-hex', 'salt')).toBe(false);
    });

    it('NFKC-normalises input so visually-identical chars compare equal', () => {
      // Compose-form e + acute vs decomposed e + combining acute.
      const composed = 'é';
      const decomposed = 'é';
      const { hash, salt } = hashPassword(composed + 'rest');
      expect(verifyPassword(decomposed + 'rest', hash, salt)).toBe(true);
    });
  });

  describe('createInvitedAccount', () => {
    it('creates an invited account with the right shape', async () => {
      const { userId, created } = await createInvitedAccount(baseInvite);
      expect(created).toBe(true);
      const rec = await getAccount(userId);
      expect(rec?.status).toBe('invited');
      expect(rec?.passwordHash).toBeNull();
      expect(rec?.passwordSalt).toBeNull();
      expect(rec?.email).toBe('owner@acme.test');
      expect(rec?.brand).toBe('medpay');
      expect(rec?.role).toBe('Owner');
    });

    it('is idempotent on email+brand (returns existing without clobber)', async () => {
      const first = await createInvitedAccount(baseInvite);
      expect(first.created).toBe(true);
      // Mutate display name + role on a retry — must NOT overwrite.
      const second = await createInvitedAccount({
        ...baseInvite,
        displayName: 'Different Name',
        role: 'Admin',
      });
      expect(second.created).toBe(false);
      expect(second.userId).toBe(first.userId);
      const rec = await getAccount(first.userId);
      expect(rec?.displayName).toBe('Acme Owner');
      expect(rec?.role).toBe('Owner');
    });

    it('allows same email across distinct brands (one account per brand)', async () => {
      const med = await createInvitedAccount(baseInvite);
      const trade = await createInvitedAccount({
        ...baseInvite,
        brand: 'tradepay',
        partnerId: 'p_orion',
      });
      expect(med.userId).not.toBe(trade.userId);
      expect((await getAccount(med.userId))?.brand).toBe('medpay');
      expect((await getAccount(trade.userId))?.brand).toBe('tradepay');
    });

    it('lowercases + trims the email at insert', async () => {
      const { userId } = await createInvitedAccount({
        ...baseInvite,
        email: '  OWNER@Acme.TEST  ',
      });
      const rec = await getAccount(userId);
      expect(rec?.email).toBe('owner@acme.test');
    });
  });

  describe('setAccountPassword', () => {
    it('transitions invited → active and stores a verifiable hash', async () => {
      const { userId } = await createInvitedAccount(baseInvite);
      const updated = await setAccountPassword({ userId, newPassword: 'Sup3rSecret!Pass1' });
      expect(updated?.status).toBe('active');
      expect(updated?.passwordHash).not.toBeNull();
      expect(updated?.passwordSalt).not.toBeNull();
      expect(updated?.passwordChangedAt).not.toBeNull();
      expect(
        verifyPassword('Sup3rSecret!Pass1', updated!.passwordHash!, updated!.passwordSalt!),
      ).toBe(true);
    });

    it('returns null for an unknown userId', async () => {
      const result = await setAccountPassword({
        userId: 'does-not-exist',
        newPassword: 'whatever-pw-1234',
      });
      expect(result).toBeNull();
    });

    it('refuses to set a password on a suspended account', async () => {
      const { userId } = await createInvitedAccount(baseInvite);
      const rec = await getAccount(userId);
      rec!.status = 'suspended';
      const result = await setAccountPassword({ userId, newPassword: 'NewPassword!1' });
      expect(result).toBeNull();
    });
  });

  describe('findAccountByEmail', () => {
    it('finds by case-insensitive email scoped to brand', async () => {
      await createInvitedAccount(baseInvite);
      const found = await findAccountByEmail('OWNER@acme.test', 'medpay');
      expect(found?.email).toBe('owner@acme.test');
    });

    it('returns null when email matches but brand does not', async () => {
      await createInvitedAccount(baseInvite);
      const found = await findAccountByEmail('owner@acme.test', 'tradepay');
      expect(found).toBeNull();
    });
  });

  describe('authenticate', () => {
    it('returns the account on correct email + password', async () => {
      const { userId } = await createInvitedAccount(baseInvite);
      await setAccountPassword({ userId, newPassword: 'GoodPassword!9' });
      const ok = await authenticate({
        email: 'owner@acme.test',
        password: 'GoodPassword!9',
        brand: 'medpay',
      });
      expect(ok?.userId).toBe(userId);
      expect(ok?.lastSignInAt).not.toBeNull();
    });

    it('returns null on wrong password', async () => {
      const { userId } = await createInvitedAccount(baseInvite);
      await setAccountPassword({ userId, newPassword: 'GoodPassword!9' });
      const result = await authenticate({
        email: 'owner@acme.test',
        password: 'WrongPassword!9',
        brand: 'medpay',
      });
      expect(result).toBeNull();
    });

    it('returns null when the account is still invited (no password yet)', async () => {
      await createInvitedAccount(baseInvite);
      const result = await authenticate({
        email: 'owner@acme.test',
        password: 'anything',
        brand: 'medpay',
      });
      expect(result).toBeNull();
    });

    it('returns null on cross-brand sign-in (medpay password tried against tradepay)', async () => {
      const { userId } = await createInvitedAccount(baseInvite);
      await setAccountPassword({ userId, newPassword: 'GoodPassword!9' });
      const result = await authenticate({
        email: 'owner@acme.test',
        password: 'GoodPassword!9',
        brand: 'tradepay',
      });
      expect(result).toBeNull();
    });

    it('runs constant-time on a miss (no obvious sub-10ms shortcut)', async () => {
      // Sanity check that the no-account path still does the scrypt
      // work — we measure that the miss takes at least a few ms (very
      // loose bound to avoid flake on CI). Real protection is in the
      // implementation; this test guards against accidental
      // short-circuit regressions.
      const t0 = process.hrtime.bigint();
      const result = await authenticate({
        email: 'no-such-account@nowhere.test',
        password: 'anything',
        brand: 'medpay',
      });
      const t1 = process.hrtime.bigint();
      expect(result).toBeNull();
      const elapsedMs = Number(t1 - t0) / 1_000_000;
      expect(elapsedMs).toBeGreaterThan(5);
    });

    it('rejects a suspended account even with correct credentials', async () => {
      const { userId } = await createInvitedAccount(baseInvite);
      await setAccountPassword({ userId, newPassword: 'GoodPassword!9' });
      const rec = await getAccount(userId);
      rec!.status = 'suspended';
      const result = await authenticate({
        email: 'owner@acme.test',
        password: 'GoodPassword!9',
        brand: 'medpay',
      });
      expect(result).toBeNull();
    });
  });
});
