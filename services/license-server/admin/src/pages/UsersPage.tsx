import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Drawer,
  Group,
  Menu,
  Modal,
  MultiSelect,
  NumberInput,
  Paper,
  Radio,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  TagsInput,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconDeviceDesktop,
  IconDots,
  IconGift,
  IconPackage,
  IconPencil,
  IconPlayerPause,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { apiRequest, getErrorMessage } from '../api';
import {
  accessSourceLabels,
  deviceStatusLabels,
  formatDate,
  formatDateTime,
  formatUsageDuration,
  packageGrantSourceLabels,
  packageGrantStatusLabels,
} from '../presentation';
import type {
  DeviceRecord,
  AuthorizedDeviceFilter,
  LicenseRecord,
  OverviewData,
  PackageGrantBatchPreview,
  PackageGrantBatchRecord,
  PackageGrantRecord,
  PackageGrantSource,
} from '../types';

interface UsersPageProps {
  token: string;
  overview: OverviewData;
  onChanged(): Promise<void>;
}

interface ProfileValues {
  customerName: string;
  customerEmail: string;
  customerNote: string;
  tags: string[];
  reason: string;
}

interface GrantPackageValues {
  planId: string;
  source: PackageGrantSource;
  reason: string;
}

interface RebindDeviceValues {
  machineFingerprint: string;
  reason: string;
}

interface WithdrawPackageValues {
  reason: string;
}

interface BatchGrantValues {
  planId: string;
  source: PackageGrantSource;
  duplicatePolicy: 'append' | 'skip_existing';
  reason: string;
}

interface DeviceFilters {
  accessMode: string;
  currentPlanId: string;
  tags: string[];
  deviceStatus: string;
  activity: string;
  platform: string;
  arch: string;
  appVersion: string;
  ownedPlanId: string;
  missingPlanId: string;
  minForegroundMinutes: number | string;
  maxForegroundMinutes: number | string;
  minLaunchCount: number | string;
  maxLaunchCount: number | string;
}

const EMPTY_DEVICE_FILTERS: DeviceFilters = {
  accessMode: 'all',
  currentPlanId: 'all',
  tags: [],
  deviceStatus: 'all',
  activity: 'all',
  platform: 'all',
  arch: 'all',
  appVersion: 'all',
  ownedPlanId: 'all',
  missingPlanId: 'all',
  minForegroundMinutes: '',
  maxForegroundMinutes: '',
  minLaunchCount: '',
  maxLaunchCount: '',
};

function createOperationKey(): string {
  return `admin:${crypto.randomUUID()}`;
}

function toOptionalNumber(value: number | string): number | undefined {
  return value === '' ? undefined : Number(value);
}

function licenseStatusColor(status: LicenseRecord['status']): string {
  if (status === 'active') return 'teal';
  if (status === 'suspended') return 'orange';
  if (status === 'revoked') return 'red';
  return 'gray';
}

function deviceStatusColor(device: DeviceRecord): string {
  if (device.status === 'pending') return 'violet';
  if (device.status === 'revoked') return 'red';
  if (device.online) return 'teal';
  return 'gray';
}

function packageStatusColor(status: PackageGrantRecord['status']): string {
  if (status === 'active') return 'teal';
  if (status === 'queued') return 'violet';
  if (status === 'withdrawn') return 'red';
  return 'gray';
}

function packageSchedule(packageGrant: PackageGrantRecord): string {
  if (packageGrant.status === 'withdrawn') return `撤回于 ${formatDateTime(packageGrant.withdrawnAt)}`;
  if (packageGrant.startsAt === undefined) return '等待全局权益结束后生效';
  if (packageGrant.status === 'queued') {
    return `${formatDateTime(packageGrant.startsAt)} 开始 · ${formatDate(packageGrant.expiresAt)} 到期`;
  }
  if (packageGrant.status === 'active') return `使用至 ${formatDate(packageGrant.expiresAt)}`;
  return `${formatDate(packageGrant.startsAt)} 至 ${formatDate(packageGrant.expiresAt)}`;
}

function validateDeviceId(value: string): string | null {
  return /^[a-f0-9]{64}$/i.test(value.trim()) ? null : '请输入软件显示的 64 位设备 ID';
}

export function UsersPage({ token, overview, onChanged }: UsersPageProps) {
  const activePlans = overview.plans.filter((plan) => plan.status === 'active');
  const firstPlan = activePlans[0];
  const devicesByLicenseId = useMemo(
    () => new Map(overview.devices.map((device) => [device.licenseId, device])),
    [overview.devices],
  );
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>('all');
  const [filters, setFilters] = useState<DeviceFilters>(EMPTY_DEVICE_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedLicenseIds, setSelectedLicenseIds] = useState<Set<string>>(new Set());
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchScope, setBatchScope] = useState<'selected' | 'filter'>('selected');
  const [batchOperationKey, setBatchOperationKey] = useState(createOperationKey);
  const [batchPreview, setBatchPreview] = useState<PackageGrantBatchPreview>();
  const [withdrawingBatch, setWithdrawingBatch] = useState<PackageGrantBatchRecord>();
  const [editingUser, setEditingUser] = useState<LicenseRecord>();
  const [grantingUser, setGrantingUser] = useState<LicenseRecord>();
  const [rebindingUser, setRebindingUser] = useState<LicenseRecord>();
  const [managedUserId, setManagedUserId] = useState<string>();
  const [withdrawing, setWithdrawing] = useState<{ licenseId: string; packageGrant: PackageGrantRecord }>();
  const [submitting, setSubmitting] = useState(false);

  const managedUser = managedUserId === undefined
    ? undefined
    : overview.licenses.find((license) => license.id === managedUserId);
  const profileForm = useForm<ProfileValues>({
    initialValues: { customerName: '', customerEmail: '', customerNote: '', tags: [], reason: '' },
    validate: {
      customerName: (value) => value.trim() ? null : '请输入设备备注名',
      customerEmail: (value) => value && !/^\S+@\S+\.\S+$/.test(value) ? '邮箱格式不正确' : null,
    },
  });
  const grantForm = useForm<GrantPackageValues>({
    initialValues: { planId: firstPlan?.id ?? '', source: 'complimentary', reason: '' },
    validate: {
      planId: (value) => value ? null : '请选择套餐包',
    },
  });
  const rebindForm = useForm<RebindDeviceValues>({
    initialValues: { machineFingerprint: '', reason: '' },
    validate: {
      machineFingerprint: validateDeviceId,
    },
  });
  const withdrawForm = useForm<WithdrawPackageValues>({
    initialValues: { reason: '' },
  });
  const batchGrantForm = useForm<BatchGrantValues>({
    initialValues: {
      planId: firstPlan?.id ?? '',
      source: 'complimentary',
      duplicatePolicy: 'skip_existing',
      reason: '',
    },
    validate: {
      planId: (value) => value ? null : '请选择套餐包',
    },
  });
  const batchWithdrawForm = useForm<WithdrawPackageValues>({
    initialValues: { reason: '' },
  });

  const authorizedDeviceFilter = useMemo<AuthorizedDeviceFilter>(() => {
    const minForegroundMinutes = toOptionalNumber(filters.minForegroundMinutes);
    const maxForegroundMinutes = toOptionalNumber(filters.maxForegroundMinutes);
    const minLaunchCount = toOptionalNumber(filters.minLaunchCount);
    const maxLaunchCount = toOptionalNumber(filters.maxLaunchCount);
    return {
      ...(search.trim() ? { query: search.trim() } : {}),
      ...(statusFilter === null || statusFilter === 'all' ? {} : {
        licenseStatuses: [statusFilter as LicenseRecord['status']],
      }),
      ...(filters.accessMode === 'all' ? {} : {
        accessModes: [filters.accessMode as LicenseRecord['accessMode']],
      }),
      ...(filters.currentPlanId === 'all' ? {} : { currentPlanIds: [filters.currentPlanId] }),
      ...(filters.tags.length === 0 ? {} : { tags: filters.tags, tagMatch: 'all' as const }),
      ...(filters.deviceStatus === 'all' ? {} : {
        deviceStatuses: [filters.deviceStatus as DeviceRecord['status']],
      }),
      ...(filters.platform === 'all' ? {} : { platforms: [filters.platform] }),
      ...(filters.arch === 'all' ? {} : { archs: [filters.arch] }),
      ...(filters.appVersion === 'all' ? {} : { appVersions: [filters.appVersion] }),
      ...(filters.ownedPlanId === 'all' ? {} : { ownedPlanIds: [filters.ownedPlanId] }),
      ...(filters.missingPlanId === 'all' ? {} : { missingPlanIds: [filters.missingPlanId] }),
      ...(filters.activity === 'online' ? { online: true }
        : filters.activity === 'offline' ? { online: false }
          : filters.activity === 'foreground' ? { foregroundNow: true }
            : filters.activity === 'activeToday' ? { activeToday: true }
              : filters.activity === 'inactiveToday' ? { activeToday: false }
                : {}),
      ...(minForegroundMinutes === undefined ? {} : {
        minTodayForegroundSeconds: minForegroundMinutes * 60,
      }),
      ...(maxForegroundMinutes === undefined ? {} : {
        maxTodayForegroundSeconds: maxForegroundMinutes * 60,
      }),
      ...(minLaunchCount === undefined ? {} : { minTodayLaunchCount: minLaunchCount }),
      ...(maxLaunchCount === undefined ? {} : { maxTodayLaunchCount: maxLaunchCount }),
    };
  }, [filters, search, statusFilter]);

  const filteredUsers = useMemo(() => overview.licenses.filter((license) => {
    const device = devicesByLicenseId.get(license.id);
    const filter = authorizedDeviceFilter;
    if (filter.licenseStatuses?.includes(license.status) === false) return false;
    if (filter.deviceStatuses && (!device || !filter.deviceStatuses.includes(device.status))) return false;
    if (filter.accessModes?.includes(license.accessMode) === false) return false;
    if (filter.currentPlanIds && (!license.planId || !filter.currentPlanIds.includes(license.planId))) return false;
    if (filter.online !== undefined && (device?.online ?? false) !== filter.online) return false;
    if (filter.foregroundNow !== undefined && (device?.foreground ?? false) !== filter.foregroundNow) return false;
    const activeToday = (device?.todayForegroundSeconds ?? 0) > 0 || (device?.todayLaunchCount ?? 0) > 0;
    if (filter.activeToday !== undefined && activeToday !== filter.activeToday) return false;
    if (filter.platforms && (!device || !filter.platforms.includes(device.platform))) return false;
    if (filter.archs && (!device || !filter.archs.includes(device.arch))) return false;
    if (filter.appVersions && (!device || !filter.appVersions.includes(device.appVersion))) return false;
    if (filter.tags && !filter.tags.every((tag) => license.tags.includes(tag))) return false;
    const activePackages = license.packages.filter(
      (packageGrant) => packageGrant.status === 'active' || packageGrant.status === 'queued',
    );
    if (filter.ownedPlanIds && !filter.ownedPlanIds.some(
      (planId) => activePackages.some((packageGrant) => packageGrant.planId === planId),
    )) return false;
    if (filter.missingPlanIds && !filter.missingPlanIds.every(
      (planId) => activePackages.every((packageGrant) => packageGrant.planId !== planId),
    )) return false;
    const foregroundSeconds = device?.todayForegroundSeconds ?? 0;
    const launchCount = device?.todayLaunchCount ?? 0;
    if (filter.minTodayForegroundSeconds !== undefined
      && foregroundSeconds < filter.minTodayForegroundSeconds) return false;
    if (filter.maxTodayForegroundSeconds !== undefined
      && foregroundSeconds > filter.maxTodayForegroundSeconds) return false;
    if (filter.minTodayLaunchCount !== undefined && launchCount < filter.minTodayLaunchCount) return false;
    if (filter.maxTodayLaunchCount !== undefined && launchCount > filter.maxTodayLaunchCount) return false;
    const keyword = filter.query?.toLowerCase();
    if (keyword) {
      const searchableValues = [
        license.customerName,
        license.customerEmail,
        license.customerNote,
        license.plan,
        ...license.tags,
        device?.machineFingerprintHint,
        device?.deviceName,
        device?.platform,
        device?.arch,
        device?.appVersion,
        ...license.packages.map((packageGrant) => packageGrant.planName),
      ];
      if (!searchableValues.some((value) => value?.toLowerCase().includes(keyword))) return false;
    }
    return true;
  }), [authorizedDeviceFilter, devicesByLicenseId, overview.licenses]);

  const filteredLicenseIds = filteredUsers.map((license) => license.id);
  const allFilteredSelected = filteredLicenseIds.length > 0
    && filteredLicenseIds.every((licenseId) => selectedLicenseIds.has(licenseId));
  const someFilteredSelected = filteredLicenseIds.some((licenseId) => selectedLicenseIds.has(licenseId));
  const distinctDeviceValues = (key: 'platform' | 'arch' | 'appVersion') => (
    [...new Set(overview.devices.map((device) => device[key]))]
      .sort()
      .map((value) => ({ value, label: value }))
  );

  const openProfile = (license: LicenseRecord) => {
    profileForm.setValues({
      customerName: license.customerName,
      customerEmail: license.customerEmail ?? '',
      customerNote: license.customerNote ?? '',
      tags: license.tags,
      reason: '',
    });
    setEditingUser(license);
  };

  const openGrant = (license: LicenseRecord) => {
    grantForm.setValues({ planId: firstPlan?.id ?? '', source: 'complimentary', reason: '' });
    setGrantingUser(license);
  };

  const openRebind = (license: LicenseRecord) => {
    rebindForm.setValues({ machineFingerprint: '', reason: '' });
    setRebindingUser(license);
  };

  const updateProfile = async (values: ProfileValues) => {
    if (!editingUser) return;
    setSubmitting(true);
    try {
      await apiRequest(`/v1/admin/authorized-devices/${encodeURIComponent(editingUser.id)}/profile`, {
        method: 'PUT',
        token,
        body: JSON.stringify({
          customerName: values.customerName.trim(),
          customerEmail: values.customerEmail.trim() || null,
          customerNote: values.customerNote.trim() || null,
          tags: values.tags,
          reason: values.reason.trim(),
        }),
      });
      notifications.show({ color: 'teal', message: '授权设备备注已更新' });
      setEditingUser(undefined);
      await onChanged();
    } catch (error: unknown) {
      notifications.show({ color: 'red', message: getErrorMessage(error, '更新设备备注失败') });
    } finally {
      setSubmitting(false);
    }
  };

  const grantPackage = async (values: GrantPackageValues) => {
    if (!grantingUser) return;
    setSubmitting(true);
    try {
      await apiRequest(`/v1/admin/authorized-devices/${encodeURIComponent(grantingUser.id)}/packages`, {
        method: 'POST',
        token,
        body: JSON.stringify(values),
      });
      notifications.show({ color: 'teal', message: '套餐包已发放并加入设备队列' });
      setGrantingUser(undefined);
      await onChanged();
    } catch (error: unknown) {
      notifications.show({ color: 'red', message: getErrorMessage(error, '发放套餐包失败') });
    } finally {
      setSubmitting(false);
    }
  };

  const rebindDevice = async (values: RebindDeviceValues) => {
    if (!rebindingUser) return;
    setSubmitting(true);
    try {
      await apiRequest(`/v1/admin/authorized-devices/${encodeURIComponent(rebindingUser.id)}/device`, {
        method: 'PUT',
        token,
        body: JSON.stringify({
          machineFingerprint: values.machineFingerprint.trim().toLowerCase(),
          reason: values.reason.trim(),
        }),
      });
      notifications.show({ color: 'teal', message: '绑定设备已更换，等待新设备连接' });
      setRebindingUser(undefined);
      await onChanged();
    } catch (error: unknown) {
      notifications.show({ color: 'red', message: getErrorMessage(error, '更换绑定设备失败') });
    } finally {
      setSubmitting(false);
    }
  };

  const withdrawPackage = async (values: WithdrawPackageValues) => {
    if (!withdrawing) return;
    setSubmitting(true);
    try {
      await apiRequest(
        `/v1/admin/authorized-devices/${encodeURIComponent(withdrawing.licenseId)}/packages/${encodeURIComponent(withdrawing.packageGrant.id)}/withdraw`,
        { method: 'POST', token, body: JSON.stringify(values) },
      );
      notifications.show({ color: 'teal', message: '套餐包已撤回，后续套餐已重新衔接' });
      setWithdrawing(undefined);
      withdrawForm.reset();
      await onChanged();
    } catch (error: unknown) {
      notifications.show({ color: 'red', message: getErrorMessage(error, '撤回套餐包失败') });
    } finally {
      setSubmitting(false);
    }
  };

  const openBatchGrant = () => {
    const hasSelection = selectedLicenseIds.size > 0;
    setBatchScope(hasSelection ? 'selected' : 'filter');
    setBatchOperationKey(createOperationKey());
    setBatchPreview(undefined);
    batchGrantForm.setValues({
      planId: firstPlan?.id ?? '',
      source: 'complimentary',
      duplicatePolicy: 'skip_existing',
      reason: '',
    });
    setBatchOpen(true);
  };

  const getBatchRequest = (values: BatchGrantValues) => ({
    operationKey: batchOperationKey,
    selection: batchScope === 'selected'
      ? { mode: 'selected' as const, licenseIds: [...selectedLicenseIds] }
      : { mode: 'filter' as const, filter: authorizedDeviceFilter },
    planId: values.planId,
    source: values.source,
    duplicatePolicy: values.duplicatePolicy,
    reason: values.reason.trim(),
  });

  const previewBatchGrant = async () => {
    const validation = batchGrantForm.validate();
    if (validation.hasErrors) return;
    if (batchScope === 'selected' && selectedLicenseIds.size === 0) {
      notifications.show({ color: 'orange', message: '请先勾选要发放套餐的授权设备' });
      return;
    }
    setSubmitting(true);
    try {
      const preview = await apiRequest<PackageGrantBatchPreview>('/v1/admin/package-grant-batches/preview', {
        method: 'POST',
        token,
        body: JSON.stringify(getBatchRequest(batchGrantForm.getValues())),
      });
      setBatchPreview(preview);
    } catch (error: unknown) {
      notifications.show({ color: 'red', message: getErrorMessage(error, '预览批量发放失败') });
    } finally {
      setSubmitting(false);
    }
  };

  const grantPackageBatch = async (values: BatchGrantValues) => {
    if (batchScope === 'selected' && selectedLicenseIds.size === 0) return;
    setSubmitting(true);
    try {
      const requestBody = getBatchRequest(values);
      const preview = await apiRequest<PackageGrantBatchPreview>('/v1/admin/package-grant-batches/preview', {
        method: 'POST', token, body: JSON.stringify(requestBody),
      });
      setBatchPreview(preview);
      if (preview.exceedsLimit) {
        notifications.show({ color: 'orange', message: '单次最多发放 500 台设备，请继续缩小筛选范围' });
        return;
      }
      if (preview.grantCount === 0) {
        notifications.show({ color: 'orange', message: '当前范围没有可发放的授权设备' });
        return;
      }
      const result = await apiRequest<{ alreadyApplied: boolean; batch: PackageGrantBatchRecord }>(
        '/v1/admin/package-grant-batches',
        { method: 'POST', token, body: JSON.stringify(requestBody) },
      );
      notifications.show({
        color: 'teal',
        message: result.alreadyApplied
          ? '这次批量操作已经执行过，没有重复发放'
          : `已给 ${result.batch.grantedCount} 台设备发放套餐包`,
      });
      setBatchOpen(false);
      setSelectedLicenseIds(new Set());
      await onChanged();
    } catch (error: unknown) {
      notifications.show({ color: 'red', message: getErrorMessage(error, '批量发放套餐包失败') });
    } finally {
      setSubmitting(false);
    }
  };

  const withdrawPackageBatch = async (values: WithdrawPackageValues) => {
    if (!withdrawingBatch) return;
    setSubmitting(true);
    try {
      const result = await apiRequest<{ withdrawnCount: number; skippedCount: number }>(
        `/v1/admin/package-grant-batches/${encodeURIComponent(withdrawingBatch.id)}/withdraw`,
        { method: 'POST', token, body: JSON.stringify({ reason: values.reason.trim() }) },
      );
      notifications.show({
        color: 'teal',
        message: `已撤回 ${result.withdrawnCount} 份未结束的套餐包，跳过 ${result.skippedCount} 份历史记录`,
      });
      setWithdrawingBatch(undefined);
      batchWithdrawForm.reset();
      await onChanged();
    } catch (error: unknown) {
      notifications.show({ color: 'red', message: getErrorMessage(error, '整批撤回失败') });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleFilteredSelection = () => {
    setSelectedLicenseIds((current) => {
      const next = new Set(current);
      if (allFilteredSelected) filteredLicenseIds.forEach((licenseId) => next.delete(licenseId));
      else filteredLicenseIds.forEach((licenseId) => next.add(licenseId));
      return next;
    });
  };

  const advancedFilterCount = [
    filters.accessMode,
    filters.currentPlanId,
    filters.deviceStatus,
    filters.activity,
    filters.platform,
    filters.arch,
    filters.appVersion,
    filters.ownedPlanId,
    filters.missingPlanId,
  ].filter((value) => value !== 'all').length
    + filters.tags.length
    + [
      filters.minForegroundMinutes,
      filters.maxForegroundMinutes,
      filters.minLaunchCount,
      filters.maxLaunchCount,
    ].filter((value) => value !== '').length;

  const changeStatus = (license: LicenseRecord, status: LicenseRecord['status']) => {
    const actionLabel = status === 'active' ? '恢复' : status === 'suspended' ? '暂停' : '撤销';
    modals.openConfirmModal({
      title: `${actionLabel} ${license.customerName} 的使用权限？`,
      children: (
        <Text size="sm" c="dimmed">
          {status === 'revoked'
            ? '撤销后，这台设备上的会话会立即失效；套餐包历史仍然保留。'
            : '此次变更会立即生效，并记录到操作日志。'}
        </Text>
      ),
      labels: { confirm: actionLabel, cancel: '取消' },
      confirmProps: { color: status === 'revoked' ? 'red' : 'violet' },
      onConfirm: async () => {
        try {
          await apiRequest(`/v1/admin/authorized-devices/${encodeURIComponent(license.id)}/status`, {
            method: 'POST',
            token,
            body: JSON.stringify({ status, reason: `管理员在后台${actionLabel}授权设备使用权限` }),
          });
          notifications.show({ color: 'teal', message: `已${actionLabel}授权设备使用权限` });
          await onChanged();
        } catch (error: unknown) {
          notifications.show({ color: 'red', message: getErrorMessage(error, '更新设备状态失败') });
        }
      },
    });
  };

  const rows = filteredUsers.map((license) => {
    const device = devicesByLicenseId.get(license.id);
    return (
      <Table.Tr key={license.id}>
        <Table.Td>
          <Checkbox
            aria-label={`选择 ${license.customerName}`}
            checked={selectedLicenseIds.has(license.id)}
            onChange={(event) => setSelectedLicenseIds((current) => {
              const next = new Set(current);
              if (event.currentTarget.checked) next.add(license.id);
              else next.delete(license.id);
              return next;
            })}
          />
        </Table.Td>
        <Table.Td>
          <div className="primary-cell">
            <Text size="sm" fw={600} truncate>{license.customerName}</Text>
            <Text size="xs" c="dimmed" truncate>
              {license.customerNote || license.customerEmail || '未填写运营备注'}
            </Text>
            {license.tags.length > 0 ? (
              <Group gap={4} mt={5} wrap="wrap">
                {license.tags.slice(0, 3).map((tag) => <Badge key={tag} size="xs" variant="outline" color="gray">{tag}</Badge>)}
                {license.tags.length > 3 ? <Badge size="xs" variant="light" color="gray">+{license.tags.length - 3}</Badge> : null}
              </Group>
            ) : null}
          </div>
        </Table.Td>
        <Table.Td>
          {device ? (
            <Group gap="sm" wrap="nowrap">
              <IconDeviceDesktop size={18} color="var(--mantine-color-dimmed)" />
              <div className="primary-cell">
                <Group gap={6} wrap="nowrap">
                  <Text size="sm" fw={550}>{device.machineFingerprintHint}</Text>
                  <Badge size="xs" color={deviceStatusColor(device)} variant="light">
                    {device.online ? '在线' : deviceStatusLabels[device.status]}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed" truncate>{device.deviceName}</Text>
              </div>
            </Group>
          ) : <Text size="sm" c="dimmed">暂无绑定设备</Text>}
        </Table.Td>
        <Table.Td>
          <Group gap={6} wrap="nowrap">
            <Text size="sm" fw={550}>{license.plan}</Text>
            {license.accessMode === 'default' ? <Badge size="xs" variant="outline" color="violet">全员默认</Badge> : null}
          </Group>
          <Text size="xs" c="dimmed">
            {license.accessMode === 'none' ? '尚未发放可用套餐' : accessSourceLabels[license.accessSource]}
            {' · '}
            {license.queuedPackageCount > 0 ? `${license.queuedPackageCount} 个待生效` : '没有待生效套餐'}
          </Text>
        </Table.Td>
        <Table.Td><Text size="sm" className="nowrap">{formatDate(license.expiresAt)}</Text></Table.Td>
        <Table.Td>
          <Text size="sm">{formatUsageDuration(device?.todayForegroundSeconds ?? 0)}</Text>
          <Text size="xs" c="dimmed">今日打开 {device?.todayLaunchCount ?? 0} 次</Text>
        </Table.Td>
        <Table.Td><Text size="sm" c="dimmed" className="nowrap">{license.lastActivityAt ? formatDateTime(license.lastActivityAt) : '从未使用'}</Text></Table.Td>
        <Table.Td><Badge color={licenseStatusColor(license.status)} variant="light">{license.accessMode === 'none' ? '待发套餐' : license.status === 'active' ? '使用中' : license.status === 'expired' ? '已到期' : license.status === 'suspended' ? '已暂停' : '已撤销'}</Badge></Table.Td>
        <Table.Td className="table-action-column">
          <Menu position="bottom-end" width={220} shadow="md">
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" aria-label={`管理 ${license.customerName}`}><IconDots size={18} /></ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconPencil size={16} />} onClick={() => openProfile(license)}>编辑基础资料</Menu.Item>
              <Menu.Item leftSection={<IconGift size={16} />} onClick={() => openGrant(license)}>发放套餐包</Menu.Item>
              <Menu.Item leftSection={<IconPackage size={16} />} onClick={() => setManagedUserId(license.id)}>管理套餐包</Menu.Item>
              <Menu.Item leftSection={<IconDeviceDesktop size={16} />} onClick={() => openRebind(license)}>更换绑定设备</Menu.Item>
              <Menu.Divider />
              {license.status === 'active' ? (
                <Menu.Item leftSection={<IconPlayerPause size={16} />} onClick={() => changeStatus(license, 'suspended')}>暂停使用</Menu.Item>
              ) : license.status === 'suspended' || license.status === 'revoked' ? (
                <Menu.Item leftSection={<IconCheck size={16} />} onClick={() => changeStatus(license, 'active')}>恢复使用</Menu.Item>
              ) : null}
              {license.status !== 'revoked' ? (
                <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={() => changeStatus(license, 'revoked')}>撤销使用权限</Menu.Item>
              ) : null}
            </Menu.Dropdown>
          </Menu>
        </Table.Td>
      </Table.Tr>
    );
  });

  return (
    <>
      <Paper withBorder className="surface table-surface">
        <div className="table-toolbar">
          <Group justify="space-between" align="flex-end" wrap="wrap">
            <Group align="flex-end" wrap="wrap">
              <TextInput
                label="搜索授权设备"
                placeholder="备注名、标签、套餐或设备尾号"
                leftSection={<IconSearch size={16} />}
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                className="search-control"
              />
              <Select
                label="状态"
                value={statusFilter}
                onChange={setStatusFilter}
                allowDeselect={false}
                data={[
                  { value: 'all', label: '全部状态' },
                  { value: 'active', label: '使用中' },
                  { value: 'expired', label: '已到期' },
                  { value: 'suspended', label: '已暂停' },
                  { value: 'revoked', label: '已撤销' },
                ]}
              />
              <MultiSelect
                label="标签"
                placeholder="全部标签"
                data={overview.availableTags}
                value={filters.tags}
                onChange={(tags) => setFilters((current) => ({ ...current, tags }))}
                searchable
                clearable
                w={220}
              />
            </Group>
            <Group gap="sm">
              <Button variant="default" onClick={() => setFiltersOpen(true)}>
                更多筛选{advancedFilterCount > 0 ? ` (${advancedFilterCount})` : ''}
              </Button>
              <Button
                variant="light"
                leftSection={<IconGift size={17} />}
                onClick={openBatchGrant}
                disabled={selectedLicenseIds.size === 0 && filteredUsers.length === 0}
              >
                {selectedLicenseIds.size > 0 ? `批量发放 (${selectedLicenseIds.size})` : '按筛选批量发放'}
              </Button>
            </Group>
          </Group>
          {advancedFilterCount > 0 || selectedLicenseIds.size > 0 ? (
            <Group justify="space-between" mt="md">
              <Text size="xs" c="dimmed">
                当前筛出 {filteredUsers.length} 台；已勾选 {selectedLicenseIds.size} 台。批量操作会在提交前由服务器重新核对范围。
              </Text>
              <Group gap="xs">
                {selectedLicenseIds.size > 0 ? (
                  <Button size="compact-xs" variant="subtle" color="gray" onClick={() => setSelectedLicenseIds(new Set())}>清除勾选</Button>
                ) : null}
                {advancedFilterCount > 0 ? (
                  <Button size="compact-xs" variant="subtle" color="gray" onClick={() => setFilters(EMPTY_DEVICE_FILTERS)}>重置筛选</Button>
                ) : null}
              </Group>
            </Group>
          ) : null}
        </div>
        <ScrollArea>
          <Table verticalSpacing="sm" horizontalSpacing="lg" highlightOnHover miw={1350}>
            <Table.Thead><Table.Tr>
              <Table.Th w={44}>
                <Checkbox
                  aria-label="选择当前筛选结果"
                  checked={allFilteredSelected}
                  indeterminate={!allFilteredSelected && someFilteredSelected}
                  onChange={toggleFilteredSelection}
                />
              </Table.Th>
              <Table.Th>授权设备</Table.Th><Table.Th>设备 ID</Table.Th><Table.Th>当前套餐</Table.Th>
              <Table.Th>可使用至</Table.Th><Table.Th>今日使用</Table.Th><Table.Th>最近使用</Table.Th>
              <Table.Th>状态</Table.Th><Table.Th className="table-action-column">操作</Table.Th>
            </Table.Tr></Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
          </Table>
        </ScrollArea>
        <Group justify="space-between" className="table-footer">
          <Text size="xs" c="dimmed">共 {filteredUsers.length} 台授权设备，每个设备 ID 只对应一份授权档案</Text>
          {filteredUsers.length === 0 ? <Text size="xs" c="dimmed">暂无符合条件的授权设备</Text> : null}
        </Group>
      </Paper>

      <Paper withBorder className="surface batch-history-surface">
        <Group justify="space-between" p="lg">
          <div>
            <Text fw={650}>批量发放记录</Text>
            <Text size="sm" c="dimmed">每次批量操作都保留完整范围和结果，可整批撤回仍在生效或排队的套餐。</Text>
          </div>
          <Badge variant="light" color="gray">最近 {Math.min(overview.packageGrantBatches.length, 10)} 批</Badge>
        </Group>
        {overview.packageGrantBatches.length === 0 ? (
          <Text size="sm" c="dimmed" px="lg" pb="lg">还没有批量发放记录。</Text>
        ) : (
          <div className="batch-history-list">
            {overview.packageGrantBatches.slice(0, 10).map((batch) => (
              <div key={batch.id} className="batch-history-row">
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <div className="primary-cell">
                    <Group gap={8} wrap="wrap">
                      <Text size="sm" fw={650}>{batch.planName}</Text>
                      <Badge size="xs" color={batch.withdrawnAt ? 'red' : 'teal'} variant="light">
                        {batch.withdrawnAt ? '已整批撤回' : '批量发放完成'}
                      </Badge>
                      <Badge size="xs" color="gray" variant="outline">
                        {batch.selection.mode === 'selected' ? '按勾选发放' : '按筛选发放'}
                      </Badge>
                    </Group>
                    <Text size="xs" c="dimmed" mt={5}>
                      {formatDateTime(batch.createdAt)} · {packageGrantSourceLabels[batch.source]} · {batch.reason}
                    </Text>
                    <Text size="xs" c="dimmed" mt={3}>
                      命中 {batch.matchedCount} 台，发放 {batch.grantedCount} 份，跳过重复 {batch.skippedDuplicateCount} 份，队列受限 {batch.skippedBlockedCount} 份
                    </Text>
                  </div>
                  <Group gap="sm" wrap="nowrap">
                    <Text size="xs" c="dimmed" className="nowrap">当前未结束 {batch.activeCount} 份</Text>
                    {batch.activeCount > 0 && batch.withdrawnAt === undefined ? (
                      <Button
                        color="red"
                        variant="subtle"
                        size="compact-sm"
                        onClick={() => {
                          batchWithdrawForm.reset();
                          setWithdrawingBatch(batch);
                        }}
                      >
                        整批撤回
                      </Button>
                    ) : null}
                  </Group>
                </Group>
              </div>
            ))}
          </div>
        )}
      </Paper>

      <Drawer opened={filtersOpen} onClose={() => setFiltersOpen(false)} title="多维筛选" position="right" size={680}>
        <Text size="sm" c="dimmed" mb="lg">
          表格筛选和“按筛选批量发放”使用同一组条件；提交前服务器会再次计算真实命中范围。
        </Text>
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Select
              label="当前权益类型"
              allowDeselect={false}
              value={filters.accessMode}
              onChange={(value) => setFilters((current) => ({ ...current, accessMode: value ?? 'all' }))}
              data={[
                { value: 'all', label: '全部类型' },
                { value: 'package', label: '单独套餐包' },
                { value: 'default', label: '全局权益' },
                { value: 'trial', label: '新设备试用' },
                { value: 'legacy', label: '历史授权' },
                { value: 'none', label: '没有可用权益' },
              ]}
            />
            <Select
              label="当前套餐"
              searchable
              allowDeselect={false}
              value={filters.currentPlanId}
              onChange={(value) => setFilters((current) => ({ ...current, currentPlanId: value ?? 'all' }))}
              data={[
                { value: 'all', label: '全部套餐' },
                ...overview.plans.map((plan) => ({ value: plan.id, label: plan.name })),
              ]}
            />
            <Select
              label="绑定设备状态"
              allowDeselect={false}
              value={filters.deviceStatus}
              onChange={(value) => setFilters((current) => ({ ...current, deviceStatus: value ?? 'all' }))}
              data={[
                { value: 'all', label: '全部状态' },
                { value: 'pending', label: '等待重新连接' },
                { value: 'active', label: '已激活' },
                { value: 'deactivated', label: '已停用' },
                { value: 'revoked', label: '已撤销' },
              ]}
            />
            <Select
              label="实时与今日活跃"
              allowDeselect={false}
              value={filters.activity}
              onChange={(value) => setFilters((current) => ({ ...current, activity: value ?? 'all' }))}
              data={[
                { value: 'all', label: '全部活跃情况' },
                { value: 'online', label: '当前在线' },
                { value: 'offline', label: '当前离线' },
                { value: 'foreground', label: '当前在前台' },
                { value: 'activeToday', label: '今天使用过' },
                { value: 'inactiveToday', label: '今天未使用' },
              ]}
            />
            <Select
              label="系统平台"
              searchable
              allowDeselect={false}
              value={filters.platform}
              onChange={(value) => setFilters((current) => ({ ...current, platform: value ?? 'all' }))}
              data={[{ value: 'all', label: '全部平台' }, ...distinctDeviceValues('platform')]}
            />
            <Select
              label="CPU 架构"
              searchable
              allowDeselect={false}
              value={filters.arch}
              onChange={(value) => setFilters((current) => ({ ...current, arch: value ?? 'all' }))}
              data={[{ value: 'all', label: '全部架构' }, ...distinctDeviceValues('arch')]}
            />
            <Select
              label="客户端版本"
              searchable
              allowDeselect={false}
              value={filters.appVersion}
              onChange={(value) => setFilters((current) => ({ ...current, appVersion: value ?? 'all' }))}
              data={[{ value: 'all', label: '全部版本' }, ...distinctDeviceValues('appVersion')]}
            />
            <Select
              label="拥有某套餐包"
              searchable
              allowDeselect={false}
              value={filters.ownedPlanId}
              onChange={(value) => setFilters((current) => ({ ...current, ownedPlanId: value ?? 'all' }))}
              data={[
                { value: 'all', label: '不限' },
                ...overview.plans.map((plan) => ({ value: plan.id, label: plan.name })),
              ]}
            />
            <Select
              label="缺少某套餐包"
              searchable
              allowDeselect={false}
              value={filters.missingPlanId}
              onChange={(value) => setFilters((current) => ({ ...current, missingPlanId: value ?? 'all' }))}
              data={[
                { value: 'all', label: '不限' },
                ...overview.plans.map((plan) => ({ value: plan.id, label: plan.name })),
              ]}
            />
            <NumberInput
              label="今日前台时长下限（分钟）"
              min={0}
              max={1440}
              allowDecimal={false}
              value={filters.minForegroundMinutes}
              onChange={(value) => setFilters((current) => ({ ...current, minForegroundMinutes: value }))}
            />
            <NumberInput
              label="今日前台时长上限（分钟）"
              min={0}
              max={1440}
              allowDecimal={false}
              value={filters.maxForegroundMinutes}
              onChange={(value) => setFilters((current) => ({ ...current, maxForegroundMinutes: value }))}
            />
            <NumberInput
              label="今日打开次数下限"
              min={0}
              max={86400}
              allowDecimal={false}
              value={filters.minLaunchCount}
              onChange={(value) => setFilters((current) => ({ ...current, minLaunchCount: value }))}
            />
            <NumberInput
              label="今日打开次数上限"
              min={0}
              max={86400}
              allowDecimal={false}
              value={filters.maxLaunchCount}
              onChange={(value) => setFilters((current) => ({ ...current, maxLaunchCount: value }))}
            />
          </SimpleGrid>
          <Group justify="space-between">
            <Button variant="subtle" color="gray" onClick={() => setFilters(EMPTY_DEVICE_FILTERS)}>清空所有条件</Button>
            <Button onClick={() => setFiltersOpen(false)}>查看 {filteredUsers.length} 台结果</Button>
          </Group>
        </Stack>
      </Drawer>

      <Modal opened={batchOpen} onClose={() => setBatchOpen(false)} title="批量发放套餐包" centered size="lg">
        <form onSubmit={batchGrantForm.onSubmit(grantPackageBatch)}>
          <Stack gap="md">
            <Radio.Group
              label="发放范围"
              value={batchScope}
              onChange={(value) => {
                setBatchScope(value as 'selected' | 'filter');
                setBatchPreview(undefined);
              }}
            >
              <Group mt="xs">
                <Radio value="selected" disabled={selectedLicenseIds.size === 0} label={`已勾选 ${selectedLicenseIds.size} 台`} />
                <Radio value="filter" label={`当前筛选结果 ${filteredUsers.length} 台`} />
              </Group>
            </Radio.Group>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Select
                label="套餐包"
                data={activePlans.map((plan) => ({ value: plan.id, label: plan.name }))}
                {...batchGrantForm.getInputProps('planId')}
              />
              <Select
                label="发放类型"
                allowDeselect={false}
                data={[
                  { value: 'complimentary', label: '运营赠送' },
                  { value: 'paid', label: '已确认购买' },
                ]}
                {...batchGrantForm.getInputProps('source')}
              />
            </SimpleGrid>
            <Select
              label="遇到已有同套餐时"
              allowDeselect={false}
              data={[
                { value: 'skip_existing', label: '跳过，避免重复发放（推荐）' },
                { value: 'append', label: '仍然追加一份套餐包' },
              ]}
              {...batchGrantForm.getInputProps('duplicatePolicy')}
            />
            <Textarea
              label="批量发放原因（选填）"
              placeholder="例如：给 QQ 群内测成员赠送 30 天"
              rows={3}
              {...batchGrantForm.getInputProps('reason')}
            />
            {batchPreview ? (
              <Paper withBorder p="md" className="summary-strip">
                <Group justify="space-between" wrap="wrap">
                  <div><Text size="xs" c="dimmed">命中范围</Text><Text fw={700}>{batchPreview.matchedCount} 台</Text></div>
                  <div><Text size="xs" c="dimmed">实际发放</Text><Text fw={700} c="teal">{batchPreview.grantCount} 份</Text></div>
                  <div><Text size="xs" c="dimmed">跳过重复</Text><Text fw={700}>{batchPreview.skippedDuplicateCount} 份</Text></div>
                  <div><Text size="xs" c="dimmed">队列受限</Text><Text fw={700}>{batchPreview.skippedBlockedCount} 份</Text></div>
                </Group>
                {batchPreview.sample.length > 0 ? (
                  <Text size="xs" c="dimmed" mt="md">
                    示例：{batchPreview.sample.map((item) => item.customerName).join('、')}
                    {batchPreview.matchedCount > batchPreview.sample.length ? ' 等' : ''}
                  </Text>
                ) : null}
              </Paper>
            ) : (
              <Text size="xs" c="dimmed">先预览可核对服务器真实命中数量；确认发放时还会再核对一次。</Text>
            )}
            <Group justify="space-between" mt="sm">
              <Button type="button" variant="default" loading={submitting} onClick={previewBatchGrant}>预览影响范围</Button>
              <Group>
                <Button type="button" variant="subtle" color="gray" onClick={() => setBatchOpen(false)}>取消</Button>
                <Button type="submit" loading={submitting} disabled={activePlans.length === 0}>确认批量发放</Button>
              </Group>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Drawer opened={editingUser !== undefined} onClose={() => setEditingUser(undefined)} title="编辑基础资料" position="right" size={500}>
        <Text size="sm" c="dimmed" mb="lg">这里只修改备注名、联系方式和运营备注，不会改变设备 ID 或套餐包。</Text>
        <form onSubmit={profileForm.onSubmit(updateProfile)}>
          <Stack gap="md">
            <TextInput label="设备备注名" {...profileForm.getInputProps('customerName')} />
            <TextInput label="联系方式" placeholder="可留空" {...profileForm.getInputProps('customerEmail')} />
            <Textarea label="运营备注" placeholder="可留空" rows={3} {...profileForm.getInputProps('customerNote')} />
            <TagsInput
              label="运营标签"
              description="标签可以用于多维筛选和批量发放。"
              placeholder="输入标签后按回车"
              data={overview.availableTags}
              maxTags={20}
              {...profileForm.getInputProps('tags')}
            />
            <Textarea label="修改原因（选填）" placeholder="例如：补充社群备注信息" rows={3} {...profileForm.getInputProps('reason')} />
            <Button type="submit" mt="sm" loading={submitting}>保存设备备注</Button>
          </Stack>
        </form>
      </Drawer>

      <Drawer opened={grantingUser !== undefined} onClose={() => setGrantingUser(undefined)} title="发放套餐包" position="right" size={540}>
        {grantingUser ? (
          <Paper withBorder p="md" mb="lg" className="summary-strip">
            <Group justify="space-between"><Text size="sm" c="dimmed">发放给</Text><Text size="sm" fw={600}>{grantingUser.customerName}</Text></Group>
            <Group justify="space-between" mt={8}><Text size="sm" c="dimmed">当前套餐</Text><Text size="sm" fw={600}>{grantingUser.plan}</Text></Group>
            <Group justify="space-between" mt={8}><Text size="sm" c="dimmed">当前截止日</Text><Text size="sm" fw={600}>{formatDate(grantingUser.expiresAt)}</Text></Group>
          </Paper>
        ) : null}
        <Text size="sm" c="dimmed" mb="lg">
          新套餐包会排在当前套餐后面自动生效。全局权益没有截止时间时，套餐包会先等待，不会提前消耗。
        </Text>
        <form onSubmit={grantForm.onSubmit(grantPackage)}>
          <Stack gap="md">
            <Select
              label="套餐包"
              placeholder="选择已创建的套餐"
              data={activePlans.map((plan) => ({ value: plan.id, label: plan.name }))}
              {...grantForm.getInputProps('planId')}
            />
            <Select
              label="发放类型"
              allowDeselect={false}
              data={[
                { value: 'complimentary', label: '运营赠送' },
                { value: 'paid', label: '已确认购买' },
              ]}
              {...grantForm.getInputProps('source')}
            />
            <Textarea label="发放原因（选填）" placeholder="例如：周年活动赠送 30 天套餐" rows={3} {...grantForm.getInputProps('reason')} />
            <Button type="submit" mt="sm" loading={submitting} disabled={activePlans.length === 0}>确认发放</Button>
          </Stack>
        </form>
      </Drawer>

      <Drawer opened={rebindingUser !== undefined} onClose={() => setRebindingUser(undefined)} title="更换绑定设备" position="right" size={520}>
        <Text size="sm" c="dimmed" mb="lg">
          更换后，旧设备的当前会话会立即失效，新设备首次连接时会完成绑定。套餐包和运营备注不会变化。
        </Text>
        <form onSubmit={rebindForm.onSubmit(rebindDevice)}>
          <Stack gap="md">
            <TextInput
              label="新的设备 ID"
              placeholder="粘贴新设备显示的 64 位 ID"
              {...rebindForm.getInputProps('machineFingerprint')}
            />
            <Textarea label="更换原因（选填）" placeholder="例如：原电脑损坏，需要迁移授权" rows={3} {...rebindForm.getInputProps('reason')} />
            <Button type="submit" mt="sm" loading={submitting}>确认更换设备</Button>
          </Stack>
        </form>
      </Drawer>

      <Drawer opened={managedUser !== undefined} onClose={() => setManagedUserId(undefined)} title="管理套餐包" position="right" size={620}>
        {managedUser ? (
          <Stack gap="lg">
            <div>
              <Text fw={650}>{managedUser.customerName}</Text>
              <Text size="sm" c="dimmed">套餐按发放顺序自动接续；撤回不会删除历史记录。</Text>
            </div>
            {managedUser.accessMode === 'default' ? (
              <Paper withBorder p="md" className="summary-strip">
                <Group justify="space-between" wrap="nowrap">
                  <div>
                    <Text size="sm" fw={600}>当前使用全局权益</Text>
                    <Text size="xs" c="dimmed" mt={3}>{managedUser.plan}</Text>
                  </div>
                  <Badge color="violet" variant="light">{formatDate(managedUser.expiresAt)}</Badge>
                </Group>
              </Paper>
            ) : null}
            {managedUser.packages.length === 0 ? (
              <Paper withBorder p="xl" className="empty-package-state">
                <Text ta="center" fw={600}>还没有单独发放的套餐包</Text>
                <Text ta="center" size="sm" c="dimmed" mt={4}>可以关闭此面板后，从设备操作菜单发放套餐包。</Text>
              </Paper>
            ) : (
              <div className="package-list">
                {managedUser.packages.map((packageGrant) => (
                  <div key={packageGrant.id} className="package-row">
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <div className="primary-cell">
                        <Group gap={8} wrap="nowrap">
                          <Text size="sm" fw={650}>{packageGrant.planName}</Text>
                          <Badge color={packageStatusColor(packageGrant.status)} variant="light" size="sm">{packageGrantStatusLabels[packageGrant.status]}</Badge>
                        </Group>
                        <Text size="xs" c="dimmed" mt={5}>{packageSchedule(packageGrant)}</Text>
                        <Text size="xs" c="dimmed" mt={3}>{packageGrantSourceLabels[packageGrant.source]} · {packageGrant.reason}</Text>
                        {packageGrant.withdrawalReason ? <Text size="xs" c="red" mt={3}>撤回原因：{packageGrant.withdrawalReason}</Text> : null}
                      </div>
                      {packageGrant.status === 'active' || packageGrant.status === 'queued' ? (
                        <Button
                          color="red"
                          variant="subtle"
                          size="compact-sm"
                          onClick={() => {
                            withdrawForm.reset();
                            setWithdrawing({ licenseId: managedUser.id, packageGrant });
                          }}
                        >
                          撤回
                        </Button>
                      ) : null}
                    </Group>
                  </div>
                ))}
              </div>
            )}
          </Stack>
        ) : null}
      </Drawer>

      <Modal opened={withdrawing !== undefined} onClose={() => setWithdrawing(undefined)} title="撤回套餐包" centered>
        <form onSubmit={withdrawForm.onSubmit(withdrawPackage)}>
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              {withdrawing?.packageGrant.status === 'active'
                ? '这是当前正在使用的套餐。撤回后会立即停止，并让下一份套餐接续。'
                : '撤回后，这份套餐不会再生效，后续套餐会自动往前衔接。'}
            </Text>
            <Textarea label="撤回原因（选填）" placeholder="例如：套餐发放错误" rows={3} {...withdrawForm.getInputProps('reason')} />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setWithdrawing(undefined)}>取消</Button>
              <Button color="red" type="submit" loading={submitting}>确认撤回</Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={withdrawingBatch !== undefined}
        onClose={() => setWithdrawingBatch(undefined)}
        title="整批撤回套餐包"
        centered
      >
        <form onSubmit={batchWithdrawForm.onSubmit(withdrawPackageBatch)}>
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              将撤回“{withdrawingBatch?.planName}”这一批中仍在生效或排队的套餐包；已经自然结束的历史记录不会改变。
              撤回后每台设备的后续套餐会自动重新衔接。
            </Text>
            <Textarea
              label="整批撤回原因（选填）"
              placeholder="例如：筛选条件设置错误，需要重新发放"
              rows={3}
              {...batchWithdrawForm.getInputProps('reason')}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setWithdrawingBatch(undefined)}>取消</Button>
              <Button color="red" type="submit" loading={submitting}>确认整批撤回</Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
