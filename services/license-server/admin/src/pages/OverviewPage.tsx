import {
  Badge,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCheck,
  IconClockHour4,
  IconActivity,
  IconUsers,
} from '@tabler/icons-react';
import { formatDate, formatDateTime, formatUsageDuration, getAuditActionLabel } from '../presentation';
import type { AuditEvent, OverviewData } from '../types';

interface OverviewPageProps {
  overview: OverviewData;
  auditEvents: AuditEvent[];
  onOpenDevices(): void;
}

export function OverviewPage({ overview, auditEvents, onOpenDevices }: OverviewPageProps) {
  const now = Date.now();
  const expiringSoon = overview.licenses
    .filter((license) => license.status === 'active' && license.expiresAt !== undefined)
    .filter((license) => {
      const remaining = new Date(license.expiresAt as string).getTime() - now;
      return remaining >= 0 && remaining <= 14 * 24 * 60 * 60 * 1000;
    })
    .sort((left, right) => (left.expiresAt ?? '').localeCompare(right.expiresAt ?? ''));
  const inactiveDevices = overview.licenses.filter((license) => license.status !== 'active');
  const attentionItems = [
    ...expiringSoon.slice(0, 4).map((license) => ({
      key: `expiring-${license.id}`,
      title: `${license.customerName} 即将到期`,
      description: `${license.plan} · ${formatDate(license.expiresAt)}`,
      color: 'orange',
    })),
    ...inactiveDevices.slice(0, 3).map((license) => ({
      key: `inactive-${license.id}`,
      title: `${license.customerName} 当前不可使用`,
      description: `${license.plan} · 请确认是否需要恢复或发放套餐包`,
      color: 'gray',
    })),
  ];

  const metrics = [
    { label: '当前可用设备', value: overview.metrics.activeEntitlements, icon: IconUsers },
    {
      label: '当前不可用设备',
      value: overview.metrics.totalEntitlements - overview.metrics.activeEntitlements,
      icon: IconClockHour4,
    },
    {
      label: '今日前台使用',
      value: formatUsageDuration(overview.metrics.todayForegroundSeconds),
      icon: IconActivity,
    },
    { label: '14 天内到期', value: expiringSoon.length, icon: IconAlertCircle },
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

      <div className="overview-grid">
        <Paper withBorder p="lg" className="surface">
          <Group justify="space-between" align="flex-start" mb="md">
            <div>
              <Title order={3}>需要关注</Title>
              <Text size="sm" c="dimmed" mt={3}>优先处理临近到期或无法使用的授权设备</Text>
            </div>
            {attentionItems.length > 0 ? (
              <Button variant="subtle" size="xs" onClick={onOpenDevices}>查看全部</Button>
            ) : null}
          </Group>
          {attentionItems.length === 0 ? (
            <Group className="healthy-state" wrap="nowrap">
              <ThemeIcon color="teal" variant="light" radius="xl" size={42}><IconCheck size={22} /></ThemeIcon>
              <div>
                <Text fw={600}>当前没有待处理事项</Text>
                <Text size="sm" c="dimmed">近期没有授权设备到期，服务状态正常。</Text>
              </div>
            </Group>
          ) : (
            <Stack gap={0}>
              {attentionItems.map((item) => (
                <Group key={item.key} className="list-row" wrap="nowrap" align="flex-start">
                  <Badge color={item.color} variant="dot" size="xs" mt={7} aria-hidden="true" />
                  <div>
                    <Text size="sm" fw={600}>{item.title}</Text>
                    <Text size="xs" c="dimmed" mt={2}>{item.description}</Text>
                  </div>
                </Group>
              ))}
            </Stack>
          )}
        </Paper>

        <Paper withBorder p="lg" className="surface">
          <div className="section-copy">
            <Title order={3}>最近操作</Title>
            <Text size="sm" c="dimmed" mt={3}>管理员、授权设备和套餐的关键变更</Text>
          </div>
          {auditEvents.length === 0 ? (
            <Text size="sm" c="dimmed" py="xl" ta="center">暂无操作记录</Text>
          ) : (
            <Stack gap={0} mt="md">
              {auditEvents.slice(0, 8).map((event) => (
                <div key={event.id} className="list-row audit-item">
                  <Group justify="space-between" wrap="nowrap" gap="md">
                    <Text size="sm" fw={550} truncate>{getAuditActionLabel(event.action)}</Text>
                    <Text size="xs" c="dimmed" className="nowrap">{formatDateTime(event.occurredAt)}</Text>
                  </Group>
                  {event.reason ? <Text size="xs" c="dimmed" mt={3}>{event.reason}</Text> : null}
                </div>
              ))}
            </Stack>
          )}
        </Paper>
      </div>
    </Stack>
  );
}
