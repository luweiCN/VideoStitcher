export interface PublicLicensePlan {
  id: string;
  code: string;
  name: string;
  description?: string;
  term:
    | { unit: 'day'; value: number }
    | { unit: 'month'; value: number }
    | { unit: 'perpetual' };
  isPublic: boolean;
  recommended: boolean;
  priceLabel?: string;
  purchaseUrl?: string;
}

export interface PublicLicensePlanResult {
  success: boolean;
  plans: PublicLicensePlan[];
  error?: string;
}

export type LicenseAccessSource = 'trial' | 'complimentary' | 'paid' | 'legacy' | 'development';
export type LicenseAccessMode = 'package' | 'default' | 'trial' | 'legacy' | 'none';
export type LicenseAccessStatus = 'active' | 'suspended' | 'revoked' | 'expired';
export type LicensePackageStatus = 'queued' | 'active' | 'completed' | 'withdrawn';

export interface LicensePackageSummary {
  id: string;
  planId: string;
  planName: string;
  term: PublicLicensePlan['term'];
  source: Exclude<LicenseAccessSource, 'trial'>;
  reason?: string;
  assignedAt: string;
  waitsForDefault: boolean;
  status: LicensePackageStatus;
  startsAt?: string;
  expiresAt?: string;
  withdrawnAt?: string;
}

export interface LicensePackageCenter {
  authorized: boolean;
  deviceLabel: string;
  access: {
    mode: LicenseAccessMode;
    planId?: string;
    planName: string;
    source: LicenseAccessSource;
    status: LicenseAccessStatus;
    expiresAt?: string;
  };
  packages: LicensePackageSummary[];
  queuedPackageCount: number;
  device: {
    id: string;
    machineFingerprintHint: string;
    deviceName: string;
    platform: string;
    arch: string;
    appVersion: string;
    status: string;
  };
}

export type LicensePackageCenterResult =
  | { success: true; center: LicensePackageCenter }
  | { success: false; error: string };

export type RedeemLicensePackageCodeResult =
  | {
    success: true;
    center: LicensePackageCenter;
    alreadyRedeemed: boolean;
  }
  | { success: false; error: string };
