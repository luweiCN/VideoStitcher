export type AdminRole = 'owner' | 'operator';
export type AdminStatus = 'active' | 'disabled';
export type LicenseStatus = 'active' | 'suspended' | 'revoked' | 'expired';
export type DeviceStatus = 'pending' | 'active' | 'deactivated' | 'revoked';
export type AccessSource = 'none' | 'trial' | 'complimentary' | 'paid' | 'legacy';
export type BillingCycle = 'monthly' | 'quarterly' | 'yearly' | 'perpetual' | 'custom';
export type AccessMode = 'package' | 'default' | 'trial' | 'legacy' | 'none';
export type PackageGrantSource = 'complimentary' | 'paid' | 'legacy';
export type PackageGrantStatus = 'queued' | 'active' | 'completed' | 'withdrawn';
export type RedemptionBatchStatus = 'active' | 'disabled';

export interface AdminAccount {
  id: string;
  username: string;
  displayName: string;
  role: AdminRole;
  status: AdminStatus;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface AdminSession {
  token: string;
  expiresAt: string;
  admin: AdminAccount;
}

export interface LicenseRecord {
  id: string;
  customerName: string;
  customerEmail?: string;
  customerNote?: string;
  tags: string[];
  planId?: string;
  plan: string;
  billingCycle: BillingCycle;
  accessSource: AccessSource;
  accessMode: AccessMode;
  status: LicenseStatus;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  activeDeviceCount: number;
  onlineDeviceCount: number;
  lastHeartbeatAt?: string;
  lastActivityAt?: string;
  packages: PackageGrantRecord[];
  queuedPackageCount: number;
}

export interface DeviceRecord {
  id: string;
  licenseId: string;
  machineFingerprintHint: string;
  deviceName: string;
  platform: string;
  arch: string;
  appVersion: string;
  status: DeviceStatus;
  activatedAt: string;
  lastHeartbeatAt?: string;
  lastActivityAt?: string;
  updatedAt: string;
  online: boolean;
  foreground: boolean;
  todayForegroundSeconds: number;
  todayLaunchCount: number;
  dailyUsage?: DailyUsageRecord[];
}

export interface DailyUsageRecord {
  date: string;
  foregroundSeconds: number;
  launchCount: number;
}

export type PlanTerm =
  | { unit: 'day'; value: number }
  | { unit: 'month'; value: number }
  | { unit: 'perpetual' };

export interface PlanRecord {
  id: string;
  code: string;
  name: string;
  description?: string;
  status: 'active' | 'archived';
  term: PlanTerm;
  defaultMaxDevices: number;
  isPublic: boolean;
  recommended: boolean;
  priceLabel?: string;
  purchaseUrl?: string;
  externalSku?: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export interface PackageGrantRecord {
  id: string;
  licenseId: string;
  planId: string;
  planCode: string;
  planName: string;
  term: PlanTerm;
  maxDevices: number;
  source: PackageGrantSource;
  reason: string;
  assignedAt: string;
  assignedBy: string;
  batchGrantId?: string;
  waitsForDefault: boolean;
  startsAt?: string;
  expiresAt?: string;
  withdrawnAt?: string;
  withdrawnBy?: string;
  withdrawalReason?: string;
  status: PackageGrantStatus;
}

export type PackageGrantBatchDuplicatePolicy = 'append' | 'skip_existing';

export interface AuthorizedDeviceFilter {
  query?: string;
  licenseStatuses?: LicenseStatus[];
  deviceStatuses?: DeviceStatus[];
  accessModes?: AccessMode[];
  accessSources?: AccessSource[];
  currentPlanIds?: string[];
  ownedPlanIds?: string[];
  missingPlanIds?: string[];
  tags?: string[];
  tagMatch?: 'any' | 'all';
  online?: boolean;
  foregroundNow?: boolean;
  activeToday?: boolean;
  platforms?: string[];
  archs?: string[];
  appVersions?: string[];
  minTodayForegroundSeconds?: number;
  maxTodayForegroundSeconds?: number;
  minTodayLaunchCount?: number;
  maxTodayLaunchCount?: number;
}

export type PackageGrantBatchSelection =
  | { mode: 'selected'; licenseIds: string[] }
  | { mode: 'filter'; filter: AuthorizedDeviceFilter; excludedLicenseIds?: string[] };

export interface PackageGrantBatchRecord {
  id: string;
  operationKey: string;
  selection: PackageGrantBatchSelection;
  planId: string;
  planCode: string;
  planName: string;
  term: PlanTerm;
  source: PackageGrantSource;
  duplicatePolicy: PackageGrantBatchDuplicatePolicy;
  reason: string;
  matchedCount: number;
  grantedCount: number;
  skippedDuplicateCount: number;
  skippedBlockedCount: number;
  createdAt: string;
  createdBy: string;
  withdrawnAt?: string;
  withdrawnBy?: string;
  withdrawalReason?: string;
  activeCount: number;
  completedCount: number;
  withdrawnCount: number;
}

export interface PackageGrantBatchPreview {
  matchedCount: number;
  grantCount: number;
  skippedDuplicateCount: number;
  skippedBlockedCount: number;
  exceedsLimit: boolean;
  sample: Array<{
    licenseId: string;
    customerName: string;
    currentPlan: string;
    status: LicenseStatus;
    tags: string[];
  }>;
}

export interface DefaultAccessRecord {
  planId: string;
  status: 'active' | 'disabled';
  endsAt?: string;
  reason: string;
  updatedAt: string;
  updatedBy: string;
  revision: number;
  planName: string;
  planTerm: PlanTerm;
  effective: boolean;
}

export interface NewDeviceDefaultAccessRecord {
  planId: string;
  status: 'active' | 'disabled';
  reason: string;
  updatedAt: string;
  updatedBy: string;
  revision: number;
  planName: string;
  planTerm: PlanTerm;
  effective: boolean;
}

export interface RedemptionBatchRecord {
  id: string;
  name: string;
  planId: string;
  planCode: string;
  planName: string;
  term: PlanTerm;
  source: PackageGrantSource;
  salesChannel?: string;
  reason: string;
  status: RedemptionBatchStatus;
  quantity: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  disabledAt?: string;
  disabledBy?: string;
  disabledReason?: string;
  redeemedCount: number;
  availableCount: number;
}

export interface RedemptionCodeInventoryRecord {
  id: string;
  code?: string;
  codeHint: string;
  status: 'available' | 'redeemed';
  createdAt: string;
  redeemedAt?: string;
}

export interface RedemptionCodeInventory {
  batch: RedemptionBatchRecord;
  codes: RedemptionCodeInventoryRecord[];
}

export interface AuditEvent {
  id: string;
  occurredAt: string;
  actorType: 'admin' | 'device' | 'system';
  actorId: string;
  action: string;
  targetType: 'license' | 'device' | 'plan' | 'package_grant' | 'package_grant_batch' | 'redemption_batch' | 'redemption_code' | 'default_access' | 'admin' | 'system';
  targetId: string;
  reason?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface OverviewData {
  generatedAt: string;
  licenses: LicenseRecord[];
  devices: DeviceRecord[];
  plans: PlanRecord[];
  redemptionBatches: RedemptionBatchRecord[];
  packageGrantBatches: PackageGrantBatchRecord[];
  availableTags: string[];
  defaultAccess?: DefaultAccessRecord;
  newDeviceDefaultAccess?: NewDeviceDefaultAccessRecord;
  metrics: {
    totalEntitlements: number;
    activeEntitlements: number;
    trialEntitlements: number;
    complimentaryEntitlements: number;
    paidEntitlements: number;
    activeDevices: number;
    onlineDevices: number;
    todayForegroundSeconds: number;
  };
}

export interface ReleaseDownload {
  name: string;
  size: number;
  url: string;
  platform: 'windows' | 'macos';
  arch: 'x64' | 'arm64';
}

export interface DesktopReleaseRecord {
  version: string;
  releaseDate: string;
  releaseNotes: string;
  supportsManagedRollback: boolean;
  totalSizeBytes: number;
  manifests: { windows: string; macos: string };
  downloads: ReleaseDownload[];
}

export interface DesktopReleaseCatalog {
  schemaVersion: 1;
  currentVersion: string;
  updatedAt: string;
  releases: DesktopReleaseRecord[];
}

export interface ReleaseOperation {
  requestId: string;
  kind: 'publish' | 'set-current';
  version?: string;
  status: 'waiting' | 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | 'neutral' | 'startup_failure' | 'stale';
  url?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ReleaseDashboardBase {
  tosCurrentSwitchEnabled: boolean;
  tosCurrentVersion?: string;
  tosCurrentVersionUpdatedAt?: string;
  catalog?: DesktopReleaseCatalog;
  operations: ReleaseOperation[];
}

export type ReleaseDashboard = ReleaseDashboardBase & (
  | {
      github: { status: 'connected' };
      sourceVersion: string;
      sourceVersionPublished: boolean;
    }
  | {
      github: {
        status: 'unavailable';
        code: string;
        message: string;
      };
    }
);

export type PageKey = 'overview' | 'devices' | 'usage' | 'plans' | 'codes' | 'releases' | 'admins';
