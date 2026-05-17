export interface OtpDeliveryInput {
  channel: 'sms' | 'email';
  to: string; // email or E.164 phone
  code: string; // plaintext code; never logged in production adapters
  purpose: 'register_verify' | 'login_mfa' | 'step_up' | 'password_reset';
  ttlSeconds: number;
}

export interface NotificationGateway {
  deliverOtp(input: OtpDeliveryInput): Promise<void>;
}

export const NOTIFICATION_GATEWAY = Symbol('NOTIFICATION_GATEWAY');
