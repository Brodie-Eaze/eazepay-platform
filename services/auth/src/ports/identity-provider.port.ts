import type { UserId } from '@eazepay/shared-types';

export interface IdentitySignUpInput {
  email?: string;
  phone?: string;
  password: string;
}

export interface IdentitySignUpResult {
  externalId: string; // Cognito sub or local user id; same shape both sides
  userId: UserId;
}

export interface IdentityCheckPasswordInput {
  identifier: string; // email or E.164 phone
  password: string;
}

export interface IdentityProvider {
  /**
   * Create the identity (Cognito user or local row) AND the EazePay User
   * row in the SAME transaction-equivalent. The caller passes a Prisma
   * transaction handle; the adapter is responsible for any external call
   * compensating logic if the local write fails.
   */
  signUp(input: IdentitySignUpInput): Promise<IdentitySignUpResult>;

  /**
   * Verify a password without creating a session. Constant-time on the
   * secret comparison; returns user id on success, throws on mismatch.
   */
  checkPassword(input: IdentityCheckPasswordInput): Promise<UserId>;

  /**
   * Replace the stored password hash for an existing user. Used by the
   * password-reset flow AFTER the OTP challenge has been verified — the
   * port itself does NOT enforce that prerequisite; the calling service
   * (AuthService.resetPassword) is responsible for ordering. Throws
   * NotFound if the userId doesn't exist.
   */
  setPassword(input: { userId: UserId; newPassword: string }): Promise<void>;
}

export const IDENTITY_PROVIDER = Symbol('IDENTITY_PROVIDER');
