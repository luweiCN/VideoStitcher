import {
  ACCESS_MODES,
  ADMIN_ROLES,
  ADMIN_STATUSES,
  DEFAULT_ACCESS_STATUSES,
  DEVICE_STATUSES,
  ENTITLEMENT_SOURCES,
  LICENSE_STATUSES,
  MAX_LICENSE_TAG_LENGTH,
  MAX_LICENSE_TAGS,
  PACKAGE_GRANT_BATCH_DUPLICATE_POLICIES,
  PACKAGE_GRANT_SOURCES,
  PLAN_STATUSES,
  PLAN_TERM_UNITS,
  REDEMPTION_BATCH_STATUSES,
  SUBSCRIPTION_BILLING_CYCLES,
  type AuthorizedDeviceFilter,
  type DeviceStatus,
  type DefaultAccessStatus,
  type AdminRole,
  type AdminStatus,
  type EntitlementSource,
  type LicenseStatus,
  type PackageGrantBatchDuplicatePolicy,
  type PackageGrantBatchSelection,
  type PackageGrantSource,
  type PlanStatus,
  type PlanTerm,
  type RedemptionBatchStatus,
  type SubscriptionBillingCycle,
} from './domain.js';

export class ValidationError extends Error {
  public readonly statusCode = 400;
  public readonly code = 'INVALID_REQUEST';
}

export function asObject(value: unknown, fieldName = '请求体'): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError(`${fieldName}必须是对象`);
  }
  return value as Record<string, unknown>;
}

export function asString(
  value: unknown,
  fieldName: string,
  options: { min?: number; max?: number; optional?: boolean } = {},
): string | undefined {
  if (value === undefined && options.optional === true) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName}必须是字符串`);
  }
  const normalized = value.trim();
  const min = options.min ?? 1;
  const max = options.max ?? 200;
  if (normalized.length < min || normalized.length > max) {
    throw new ValidationError(`${fieldName}长度必须在${min}到${max}个字符之间`);
  }
  return normalized;
}

export function asSecretString(
  value: unknown,
  fieldName: string,
  options: { min?: number; max?: number; optional?: boolean } = {},
): string | undefined {
  if (value === undefined && options.optional === true) return undefined;
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName}必须是字符串`);
  }
  const min = options.min ?? 1;
  const max = options.max ?? 200;
  if (value.length < min || value.length > max) {
    throw new ValidationError(`${fieldName}长度必须在${min}到${max}个字符之间`);
  }
  return value;
}

export function asInteger(
  value: unknown,
  fieldName: string,
  options: { min?: number; max?: number } = {},
): number {
  if (!Number.isInteger(value)) {
    throw new ValidationError(`${fieldName}必须是整数`);
  }
  const numberValue = value as number;
  const min = options.min ?? 0;
  const max = options.max ?? Number.MAX_SAFE_INTEGER;
  if (numberValue < min || numberValue > max) {
    throw new ValidationError(`${fieldName}必须在${min}到${max}之间`);
  }
  return numberValue;
}

export function asOptionalInteger(
  value: unknown,
  fieldName: string,
  options: { min?: number; max?: number } = {},
): number | undefined {
  return value === undefined ? undefined : asInteger(value, fieldName, options);
}

export function asBoolean(value: unknown, fieldName: string, defaultValue = false): boolean {
  if (value === undefined) {
    return defaultValue;
  }
  if (typeof value !== 'boolean') {
    throw new ValidationError(`${fieldName}必须是布尔值`);
  }
  return value;
}

export function asOptionalBoolean(value: unknown, fieldName: string): boolean | undefined {
  return value === undefined ? undefined : asBoolean(value, fieldName);
}

function asUniqueStringArray(
  value: unknown,
  fieldName: string,
  options: { minItems?: number; maxItems?: number; minLength?: number; maxLength?: number } = {},
): string[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(`${fieldName}必须是字符串数组`);
  }
  const minItems = options.minItems ?? 0;
  const maxItems = options.maxItems ?? 100;
  if (value.length < minItems || value.length > maxItems) {
    throw new ValidationError(`${fieldName}数量必须在${minItems}到${maxItems}个之间`);
  }
  const normalized = value.map((item, index) => asString(item, `${fieldName}[${index}]`, {
    min: options.minLength ?? 1,
    max: options.maxLength ?? 120,
  }) as string);
  if (new Set(normalized).size !== normalized.length) {
    throw new ValidationError(`${fieldName}不能包含重复项`);
  }
  return normalized;
}

function asEnumArray<T extends string>(
  value: unknown,
  fieldName: string,
  allowedValues: readonly T[],
): T[] {
  const values = asUniqueStringArray(value, fieldName, { maxItems: allowedValues.length });
  if (values.some((item) => !allowedValues.includes(item as T))) {
    throw new ValidationError(`${fieldName}包含不支持的值`);
  }
  return values as T[];
}

export function asLicenseTags(value: unknown, fieldName = 'tags'): string[] {
  return asUniqueStringArray(value, fieldName, {
    maxItems: MAX_LICENSE_TAGS,
    maxLength: MAX_LICENSE_TAG_LENGTH,
  });
}

export function asPackageGrantBatchDuplicatePolicy(
  value: unknown,
  fieldName: string,
): PackageGrantBatchDuplicatePolicy {
  const policy = asString(value, fieldName, { min: 6, max: 20 });
  if (
    policy === undefined
    || !PACKAGE_GRANT_BATCH_DUPLICATE_POLICIES.includes(policy as PackageGrantBatchDuplicatePolicy)
  ) {
    throw new ValidationError(`${fieldName}必须是 append 或 skip_existing`);
  }
  return policy as PackageGrantBatchDuplicatePolicy;
}

function asAuthorizedDeviceFilter(value: unknown, fieldName: string): AuthorizedDeviceFilter {
  const filter = asObject(value, fieldName);
  const result: AuthorizedDeviceFilter = {
    ...(filter.query === undefined ? {} : {
      query: asString(filter.query, `${fieldName}.query`, { min: 1, max: 200 }) as string,
    }),
    ...(filter.licenseStatuses === undefined ? {} : {
      licenseStatuses: asEnumArray(filter.licenseStatuses, `${fieldName}.licenseStatuses`, LICENSE_STATUSES),
    }),
    ...(filter.deviceStatuses === undefined ? {} : {
      deviceStatuses: asEnumArray(filter.deviceStatuses, `${fieldName}.deviceStatuses`, DEVICE_STATUSES),
    }),
    ...(filter.accessModes === undefined ? {} : {
      accessModes: asEnumArray(filter.accessModes, `${fieldName}.accessModes`, ACCESS_MODES),
    }),
    ...(filter.accessSources === undefined ? {} : {
      accessSources: asEnumArray(filter.accessSources, `${fieldName}.accessSources`, ENTITLEMENT_SOURCES),
    }),
    ...(filter.currentPlanIds === undefined ? {} : {
      currentPlanIds: asUniqueStringArray(filter.currentPlanIds, `${fieldName}.currentPlanIds`),
    }),
    ...(filter.ownedPlanIds === undefined ? {} : {
      ownedPlanIds: asUniqueStringArray(filter.ownedPlanIds, `${fieldName}.ownedPlanIds`),
    }),
    ...(filter.missingPlanIds === undefined ? {} : {
      missingPlanIds: asUniqueStringArray(filter.missingPlanIds, `${fieldName}.missingPlanIds`),
    }),
    ...(filter.tags === undefined ? {} : {
      tags: asLicenseTags(filter.tags, `${fieldName}.tags`),
    }),
    ...(filter.platforms === undefined ? {} : {
      platforms: asUniqueStringArray(filter.platforms, `${fieldName}.platforms`, { maxItems: 50, maxLength: 32 }),
    }),
    ...(filter.archs === undefined ? {} : {
      archs: asUniqueStringArray(filter.archs, `${fieldName}.archs`, { maxItems: 50, maxLength: 32 }),
    }),
    ...(filter.appVersions === undefined ? {} : {
      appVersions: asUniqueStringArray(filter.appVersions, `${fieldName}.appVersions`, { maxItems: 100, maxLength: 40 }),
    }),
  };

  for (const key of ['online', 'foregroundNow', 'activeToday'] as const) {
    const parsed = asOptionalBoolean(filter[key], `${fieldName}.${key}`);
    if (parsed !== undefined) result[key] = parsed;
  }
  if (filter.tagMatch !== undefined) {
    const tagMatch = asString(filter.tagMatch, `${fieldName}.tagMatch`, { min: 3, max: 3 });
    if (tagMatch !== 'any' && tagMatch !== 'all') {
      throw new ValidationError(`${fieldName}.tagMatch 必须是 any 或 all`);
    }
    result.tagMatch = tagMatch;
  }
  for (const key of [
    'createdFrom',
    'createdTo',
    'lastActivityFrom',
    'lastActivityTo',
    'expiresFrom',
    'expiresTo',
  ] as const) {
    const parsed = asIsoDate(filter[key], `${fieldName}.${key}`);
    if (parsed !== undefined) result[key] = parsed;
  }
  for (const key of [
    'minTodayForegroundSeconds',
    'maxTodayForegroundSeconds',
    'minTodayLaunchCount',
    'maxTodayLaunchCount',
  ] as const) {
    const parsed = asOptionalInteger(filter[key], `${fieldName}.${key}`, { min: 0, max: 86_400 });
    if (parsed !== undefined) result[key] = parsed;
  }

  const assertOrdered = (
    lower: number | string | undefined,
    upper: number | string | undefined,
    rangeName: string,
  ): void => {
    if (lower !== undefined && upper !== undefined && lower > upper) {
      throw new ValidationError(`${rangeName}的起始值不能大于结束值`);
    }
  };
  assertOrdered(result.createdFrom, result.createdTo, `${fieldName}.created`);
  assertOrdered(result.lastActivityFrom, result.lastActivityTo, `${fieldName}.lastActivity`);
  assertOrdered(result.expiresFrom, result.expiresTo, `${fieldName}.expires`);
  assertOrdered(
    result.minTodayForegroundSeconds,
    result.maxTodayForegroundSeconds,
    `${fieldName}.todayForegroundSeconds`,
  );
  assertOrdered(result.minTodayLaunchCount, result.maxTodayLaunchCount, `${fieldName}.todayLaunchCount`);
  return result;
}

export function asPackageGrantBatchSelection(
  value: unknown,
  fieldName = 'selection',
): PackageGrantBatchSelection {
  const selection = asObject(value, fieldName);
  const mode = asString(selection.mode, `${fieldName}.mode`, { min: 6, max: 8 });
  if (mode === 'selected') {
    return {
      mode,
      licenseIds: asUniqueStringArray(selection.licenseIds, `${fieldName}.licenseIds`, {
        minItems: 1,
        maxItems: 500,
      }),
    };
  }
  if (mode === 'filter') {
    return {
      mode,
      filter: asAuthorizedDeviceFilter(selection.filter, `${fieldName}.filter`),
      ...(selection.excludedLicenseIds === undefined ? {} : {
        excludedLicenseIds: asUniqueStringArray(
          selection.excludedLicenseIds,
          `${fieldName}.excludedLicenseIds`,
          { maxItems: 500 },
        ),
      }),
    };
  }
  throw new ValidationError(`${fieldName}.mode 必须是 selected 或 filter`);
}

export function asIsoDate(value: unknown, fieldName: string, optional = true): string | undefined {
  if ((value === undefined || value === null || value === '') && optional) {
    return undefined;
  }
  const dateValue = asString(value, fieldName, { min: 10, max: 40 });
  if (dateValue === undefined || Number.isNaN(Date.parse(dateValue))) {
    throw new ValidationError(`${fieldName}必须是有效的 ISO 日期`);
  }
  return new Date(dateValue).toISOString();
}

export function asLicenseStatus(value: unknown, fieldName: string): LicenseStatus {
  const status = asString(value, fieldName, { min: 6, max: 12 });
  if (status === undefined || !LICENSE_STATUSES.includes(status as LicenseStatus)) {
    throw new ValidationError(`${fieldName}不是支持的授权状态`);
  }
  return status as LicenseStatus;
}

export function asDeviceStatus(value: unknown, fieldName: string): DeviceStatus {
  const status = asString(value, fieldName, { min: 6, max: 12 });
  if (status === undefined || !DEVICE_STATUSES.includes(status as DeviceStatus)) {
    throw new ValidationError(`${fieldName}不是支持的设备状态`);
  }
  return status as DeviceStatus;
}

export function asAdminRole(value: unknown, fieldName: string): AdminRole {
  const role = asString(value, fieldName, { min: 5, max: 8 });
  if (role === undefined || !ADMIN_ROLES.includes(role as AdminRole)) {
    throw new ValidationError(`${fieldName}不是支持的管理员角色`);
  }
  return role as AdminRole;
}

export function asAdminStatus(value: unknown, fieldName: string): AdminStatus {
  const status = asString(value, fieldName, { min: 6, max: 8 });
  if (status === undefined || !ADMIN_STATUSES.includes(status as AdminStatus)) {
    throw new ValidationError(`${fieldName}不是支持的管理员状态`);
  }
  return status as AdminStatus;
}

export function asEntitlementSource(value: unknown, fieldName: string): EntitlementSource {
  const source = asString(value, fieldName, { min: 4, max: 20 });
  if (source === undefined || !ENTITLEMENT_SOURCES.includes(source as EntitlementSource)) {
    throw new ValidationError(`${fieldName}不是支持的套餐包来源`);
  }
  return source as EntitlementSource;
}

export function asPackageGrantSource(value: unknown, fieldName: string): PackageGrantSource {
  const source = asString(value, fieldName, { min: 4, max: 20 });
  if (source === undefined || !PACKAGE_GRANT_SOURCES.includes(source as PackageGrantSource)) {
    throw new ValidationError(`${fieldName}必须是 complimentary、paid 或 legacy`);
  }
  return source as PackageGrantSource;
}

export function asDefaultAccessStatus(value: unknown, fieldName: string): DefaultAccessStatus {
  const status = asString(value, fieldName, { min: 6, max: 8 });
  if (status === undefined || !DEFAULT_ACCESS_STATUSES.includes(status as DefaultAccessStatus)) {
    throw new ValidationError(`${fieldName}必须是 active 或 disabled`);
  }
  return status as DefaultAccessStatus;
}

export function asRedemptionBatchStatus(value: unknown, fieldName: string): RedemptionBatchStatus {
  const status = asString(value, fieldName, { min: 6, max: 8 });
  if (status === undefined || !REDEMPTION_BATCH_STATUSES.includes(status as RedemptionBatchStatus)) {
    throw new ValidationError(`${fieldName}必须是 active 或 disabled`);
  }
  return status as RedemptionBatchStatus;
}

export function asPlanStatus(value: unknown, fieldName: string): PlanStatus {
  const status = asString(value, fieldName, { min: 6, max: 8 });
  if (status === undefined || !PLAN_STATUSES.includes(status as PlanStatus)) {
    throw new ValidationError(`${fieldName}不是支持的套餐状态`);
  }
  return status as PlanStatus;
}

export function asPlanTerm(value: unknown, fieldName: string): PlanTerm {
  const term = asObject(value, fieldName);
  const unit = asString(term.unit, `${fieldName}.unit`, { min: 3, max: 9 });
  if (unit === undefined || !PLAN_TERM_UNITS.includes(unit as PlanTerm['unit'])) {
    throw new ValidationError(`${fieldName}.unit 必须是 day、month 或 perpetual`);
  }
  if (unit === 'perpetual') return { unit };
  if (unit !== 'day' && unit !== 'month') {
    throw new ValidationError(`${fieldName}.unit 必须是 day、month 或 perpetual`);
  }
  return {
    unit,
    value: asInteger(term.value, `${fieldName}.value`, { min: 1, max: 1200 }),
  };
}

export function asNullableString(
  value: unknown,
  fieldName: string,
  options: { min?: number; max?: number } = {},
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return asString(value, fieldName, options);
}

export function asHttpsUrl(value: unknown, fieldName: string): string {
  const normalized = asString(value, fieldName, { min: 8, max: 500 }) as string;
  try {
    const url = new URL(normalized);
    if (url.protocol !== 'https:') throw new Error('协议错误');
    return url.toString();
  } catch {
    throw new ValidationError(`${fieldName}必须是 HTTPS 地址`);
  }
}

export function asSubscriptionBillingCycle(value: unknown, fieldName: string): SubscriptionBillingCycle {
  const billingCycle = asString(value, fieldName, { min: 6, max: 9 });
  if (
    billingCycle === undefined
    || !SUBSCRIPTION_BILLING_CYCLES.includes(billingCycle as SubscriptionBillingCycle)
  ) {
    throw new ValidationError(`${fieldName}必须是 monthly、quarterly 或 yearly`);
  }
  return billingCycle as SubscriptionBillingCycle;
}

export function asCreatableBillingCycle(
  value: unknown,
  fieldName: string,
): SubscriptionBillingCycle | 'perpetual' {
  if (value === 'perpetual') {
    return value;
  }
  return asSubscriptionBillingCycle(value, fieldName);
}
