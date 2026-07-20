import {
  Badge,
  Group,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import {
  IconActivity,
  IconClockHour4,
  IconDeviceDesktopAnalytics,
  IconPlayerPlay,
  IconSearch,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { formatRelativeTime, formatUsageDuration } from '../presentation';
import type { DailyUsageRecord, DeviceRecord, OverviewData } from '../types';

interface UsagePageProps {
  overview: OverviewData;
}

const chinaDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function safeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

function getRecentDateKeys(days: number): string[] {
  const now = Date.now();
  return Array.from({ length: days }, (_, index) => (
    chinaDateFormatter.format(new Date(now - (days - index - 1) * 24 * 60 * 60 * 1000))
  ));
}

function usageForDate(dailyUsage: DailyUsageRecord[] | undefined, date: string): DailyUsageRecord {
  const usage = dailyUsage?.find((item) => item.date === date);
  return {
    date,
    foregroundSeconds: safeCount(usage?.foregroundSeconds),
    launchCount: safeCount(usage?.launchCount),
  };
}

function UsageBars({ device, dateKeys }: { device: DeviceRecord; dateKeys: string[] }) {
  const values = dateKeys.map((date) => usageForDate(device.dailyUsage, date).foregroundSeconds);
  const maximum = Math.max(1, ...values);
  const total = values.reduce((sum, value) => sum + value, 0);
  return (
    <Group gap="sm" wrap="nowrap">
      <div
        className="usage-bars"
        role="img"
        aria-label={`近 7 天前台使用 ${formatUsageDuration(total)}`}
      >
        {values.map((value, index) => (
          <span
            key={dateKeys[index]}
            className="usage-bar-track"
            title={`${dateKeys[index]}：${formatUsageDuration(value)}`}
          >
            <span
              className="usage-bar-value"
              style={{ height: value === 0 ? 2 : Math.max(5, Math.round((value / maximum) * 30)) }}
            />
          </span>
        ))}
      </div>
      <Text size="xs" c="dimmed" className="nowrap">{formatUsageDuration(total)}</Text>
    </Group>
  );
}

export function UsagePage({ overview }: UsagePageProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>('all');
  const dateKeys = useMemo(() => getRecentDateKeys(7), []);
  const todayKey = dateKeys.at(-1) ?? chinaDateFormatter.format(new Date());
  const licensesById = useMemo(
    () => new Map(overview.licenses.map((license) => [license.id, license])),
    [overview.licenses],
  );
  const normalizedSearch = search.trim().toLowerCase();
  const filteredDevices = overview.devices.filter((device) => {
    const license = licensesById.get(device.licenseId);
    const today = usageForDate(device.dailyUsage, todayKey);
    const activeToday = today.foregroundSeconds > 0 || today.launchCount > 0;
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'online' && device.online)
      || (statusFilter === 'active-today' && activeToday)
      || (statusFilter === 'inactive-today' && !activeToday);
    if (!matchesStatus) return false;
    if (!normalizedSearch) return true;
    return [
      license?.customerName,
      license?.customerNote,
      device.machineFingerprintHint,
      device.deviceName,
      device.appVersion,
    ].some((value) => value?.toLowerCase().includes(normalizedSearch));
  });
  const todayLaunchCount = overview.devices.reduce(
    (sum, device) => sum + safeCount(device.todayLaunchCount),
    0,
  );
  const activeTodayCount = overview.devices.filter((device) => (
    safeCount(device.todayForegroundSeconds) > 0 || safeCount(device.todayLaunchCount) > 0
  )).length;
  const metrics = [
    {
      label: '今日前台使用',
      value: formatUsageDuration(overview.metrics.todayForegroundSeconds),
      icon: IconClockHour4,
    },
    { label: '今日启动次数', value: todayLaunchCount, icon: IconPlayerPlay },
    { label: '今日活跃设备', value: activeTodayCount, icon: IconActivity },
    { label: '当前在线设备', value: safeCount(overview.metrics.onlineDevices), icon: IconDeviceDesktopAnalytics },
  ];

  return (
    <Stack gap="lg">
      <Paper withBorder className="metrics-surface">
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing={0}>
          {metrics.map((metric) => (
            <Group key={metric.label} className="metric-block" wrap="nowrap">
              <ThemeIcon color="violet" variant="light" radius="md" size={42}>
                <metric.icon size={20} stroke={1.8} />
              </ThemeIcon>
              <div>
                <Text fz={24} fw={680} lh={1.1}>{metric.value}</Text>
                <Text size="xs" c="dimmed" mt={4}>{metric.label}</Text>
              </div>
            </Group>
          ))}
        </SimpleGrid>
      </Paper>

      <Paper withBorder className="surface table-surface">
        <Group justify="space-between" align="flex-end" wrap="nowrap" className="table-toolbar">
          <TextInput
            label="搜索授权设备"
            placeholder="备注名、设备尾号或客户端版本"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            className="search-control"
          />
          <Select
            label="使用状态"
            value={statusFilter}
            onChange={setStatusFilter}
            allowDeselect={false}
            data={[
              { value: 'all', label: '全部设备' },
              { value: 'online', label: '当前在线' },
              { value: 'active-today', label: '今日使用过' },
              { value: 'inactive-today', label: '今日未使用' },
            ]}
          />
        </Group>
        <ScrollArea>
          <Table verticalSpacing="sm" horizontalSpacing="lg" highlightOnHover miw={1180}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>授权设备</Table.Th>
                <Table.Th>在线状态</Table.Th>
                <Table.Th>当前套餐</Table.Th>
                <Table.Th>今日前台</Table.Th>
                <Table.Th>今日启动</Table.Th>
                <Table.Th>近 7 天前台</Table.Th>
                <Table.Th>最近使用</Table.Th>
                <Table.Th>客户端</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredDevices.map((device) => {
                const license = licensesById.get(device.licenseId);
                return (
                  <Table.Tr key={device.id}>
                    <Table.Td>
                      <Text size="sm" fw={600}>{license?.customerName ?? device.deviceName}</Text>
                      <Text size="xs" c="dimmed">设备 ID 尾号 {device.machineFingerprintHint}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={device.online ? 'teal' : 'gray'} variant="light">
                        {device.online ? '在线' : '离线'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{license?.plan ?? '尚未建档'}</Text>
                    </Table.Td>
                    <Table.Td><Text size="sm">{formatUsageDuration(device.todayForegroundSeconds)}</Text></Table.Td>
                    <Table.Td><Text size="sm">{safeCount(device.todayLaunchCount)} 次</Text></Table.Td>
                    <Table.Td><UsageBars device={device} dateKeys={dateKeys} /></Table.Td>
                    <Table.Td><Text size="sm" c="dimmed" className="nowrap">{formatRelativeTime(device.lastActivityAt)}</Text></Table.Td>
                    <Table.Td>
                      <Text size="sm">v{device.appVersion}</Text>
                      <Text size="xs" c="dimmed">{device.platform} · {device.arch}</Text>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea>
        <Group justify="space-between" className="table-footer">
          <Text size="xs" c="dimmed">当前显示 {filteredDevices.length} 台设备，使用时长按北京时间统计</Text>
          {filteredDevices.length === 0 ? <Text size="xs" c="dimmed">暂无符合条件的使用记录</Text> : null}
        </Group>
      </Paper>
    </Stack>
  );
}
