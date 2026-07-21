import {
  Alert,
  Anchor,
  Badge,
  Button,
  Group,
  Paper,
  Progress,
  ScrollArea,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  Textarea,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconBrandGithub,
  IconCheck,
  IconCloudUpload,
  IconDownload,
  IconHistory,
  IconRocket,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest, getErrorMessage } from '../api';
import { formatDateTime } from '../presentation';
import type {
  DesktopReleaseRecord,
  ReleaseDashboard,
  ReleaseOperation,
} from '../types';

interface ReleasesPageProps {
  token: string;
}

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function ReleasesPage({ token }: ReleasesPageProps) {
  const [dashboard, setDashboard] = useState<ReleaseDashboard>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [releaseNotes, setReleaseNotes] = useState('');
  const [operation, setOperation] = useState<ReleaseOperation>();

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiRequest<ReleaseDashboard>('/v1/admin/releases', { token });
      setDashboard(result);
      const active = result.operations.find((item) => item.status !== 'completed');
      if (active) setOperation(active);
    } catch (error: unknown) {
      notifications.show({ color: 'red', message: getErrorMessage(error, '加载版本信息失败') });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!operation || operation.status === 'completed') return undefined;
    const timer = window.setInterval(() => {
      void apiRequest<ReleaseOperation>(
        `/v1/admin/release-operations/${encodeURIComponent(operation.requestId)}`,
        { token },
      ).then((nextOperation) => {
        const visibleOperation = nextOperation.status === 'waiting' && !nextOperation.url
          ? {
              ...nextOperation,
              kind: operation.kind,
              ...(operation.version === undefined ? {} : { version: operation.version }),
            }
          : nextOperation;
        setOperation(visibleOperation);
        if (nextOperation.status !== 'completed') return;
        if (nextOperation.conclusion === 'success') {
          notifications.show({ color: 'teal', message: '版本任务执行成功' });
          void loadDashboard();
        } else {
          notifications.show({ color: 'red', message: '版本任务执行失败，请查看运行详情' });
        }
      }).catch((error: unknown) => {
        notifications.show({ color: 'red', message: getErrorMessage(error, '读取发布进度失败') });
      });
    }, 8_000);
    return () => window.clearInterval(timer);
  }, [loadDashboard, operation, token]);

  const publish = async () => {
    setSubmitting(true);
    try {
      const nextOperation = await apiRequest<ReleaseOperation>('/v1/admin/releases', {
        method: 'POST',
        token,
        body: JSON.stringify({ releaseNotes }),
      });
      setOperation(nextOperation);
      notifications.show({ color: 'violet', message: `版本 ${nextOperation.version} 已进入发布队列` });
    } catch (error: unknown) {
      notifications.show({ color: 'red', message: getErrorMessage(error, '提交发布任务失败') });
    } finally {
      setSubmitting(false);
    }
  };

  const requestSetCurrent = (release: DesktopReleaseRecord) => {
    if (!dashboard?.catalog) return;
    const isRollback = compareVersions(release.version, dashboard.catalog.currentVersion) < 0;
    modals.openConfirmModal({
      title: isRollback ? `回退到 ${release.version}` : `切换到 ${release.version}`,
      children: (
        <Stack gap="xs">
          <Text size="sm">
            {isRollback
              ? '确认后，已经安装支持受控回退版本的客户端会检测到这个较低版本，并按正常更新流程提示安装。'
              : '确认后，客户端更新源会指向这个已经完整发布的版本。'}
          </Text>
          <Text size="sm" c="dimmed">历史安装包不会删除，版本文件也不会被覆盖。</Text>
        </Stack>
      ),
      labels: { confirm: isRollback ? '确认回退' : '确认切换', cancel: '取消' },
      confirmProps: { color: isRollback ? 'orange' : 'violet' },
      onConfirm: () => void setCurrent(release.version),
    });
  };

  const setCurrent = async (version: string) => {
    setSubmitting(true);
    try {
      const nextOperation = await apiRequest<ReleaseOperation>(
        `/v1/admin/releases/${encodeURIComponent(version)}/current`,
        { method: 'POST', token },
      );
      setOperation(nextOperation);
      notifications.show({ color: 'teal', message: `当前版本已切换为 ${version}` });
      await loadDashboard();
    } catch (error: unknown) {
      notifications.show({ color: 'red', message: getErrorMessage(error, '切换当前版本失败') });
    } finally {
      setSubmitting(false);
    }
  };

  const isBusy = submitting || (operation !== undefined && operation.status !== 'completed');
  const sourceVersion = dashboard && 'sourceVersion' in dashboard ? dashboard.sourceVersion : undefined;
  const sourceVersionPublished = dashboard && 'sourceVersionPublished' in dashboard
    ? dashboard.sourceVersionPublished
    : false;
  const sourceAlreadyPublished = sourceVersion !== undefined && (
    sourceVersionPublished
    || dashboard?.catalog?.releases.some((release) => release.version === sourceVersion) === true
  );
  const githubUnavailableMessage = dashboard?.github.status === 'unavailable'
    ? dashboard.github.message
    : undefined;
  const publishHelp = githubUnavailableMessage
    ?? (sourceAlreadyPublished
      ? `无法发布：v${sourceVersion} 已经发布，请先由开发人员更新 package.json 中的版本号。`
      : isBusy
        ? '已有版本发布任务正在执行，完成后才能再次发布。'
        : '发布会同时构建 Windows、Intel Mac 和 Apple Silicon Mac。');
  const operationHistory = dashboard?.operations.filter((item) => item.status === 'completed').slice(0, 8) ?? [];

  if (loading && !dashboard) return <Paper withBorder p="lg" className="surface"><Skeleton height={420} /></Paper>;
  if (!dashboard) return <Alert color="red" title="版本管理不可用">请检查授权服务的版本管理配置。</Alert>;

  return (
    <Stack gap="lg" aria-busy={isBusy}>
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
        <Paper withBorder p="lg" className="surface release-summary-card">
          <Group justify="space-between" wrap="nowrap">
            <div>
              <Text size="xs" c="dimmed">TOS 当前版本</Text>
              <Text fz={28} fw={700} mt={4}>v{dashboard.tosCurrentVersion ?? '—'}</Text>
              <Text size="xs" c="dimmed" mt={6}>
                {dashboard.tosCurrentVersionUpdatedAt
                  ? formatDateTime(dashboard.tosCurrentVersionUpdatedAt)
                  : '尚未检测到已发布版本'}
              </Text>
            </div>
            <ThemeIcon color="teal" variant="light" size={46} radius="md"><IconCheck size={23} /></ThemeIcon>
          </Group>
        </Paper>
        <Paper withBorder p="lg" className="surface release-summary-card">
          <Group justify="space-between" wrap="nowrap">
            <div>
              <Text size="xs" c="dimmed">master 待发布版本</Text>
              <Text fz={28} fw={700} mt={4}>{sourceVersion ? `v${sourceVersion}` : '—'}</Text>
              <Text size="xs" c={sourceAlreadyPublished || githubUnavailableMessage ? 'orange' : 'dimmed'} mt={6}>
                {githubUnavailableMessage
                  ? 'GitHub 新版本发布暂不可用'
                  : sourceAlreadyPublished
                    ? '版本号已使用，请先由开发人员更新 package.json'
                    : '可以提交自动构建'}
              </Text>
            </div>
            <ThemeIcon color="violet" variant="light" size={46} radius="md"><IconRocket size={23} /></ThemeIcon>
          </Group>
        </Paper>
        <Paper withBorder p="lg" className="surface release-summary-card">
          <Group justify="space-between" wrap="nowrap">
            <div>
              <Text size="xs" c="dimmed">已归档版本</Text>
              <Text fz={28} fw={700} mt={4}>{dashboard.catalog?.releases.length ?? 0}</Text>
              <Text size="xs" c="dimmed" mt={6}>不可变安装包永久保留</Text>
            </div>
            <ThemeIcon color="blue" variant="light" size={46} radius="md"><IconHistory size={23} /></ThemeIcon>
          </Group>
        </Paper>
      </SimpleGrid>

      {operation ? <OperationPanel operation={operation} /> : null}

      {githubUnavailableMessage ? (
        <Alert color="orange" title="新版本发布暂不可用" icon={<IconAlertTriangle size={19} />}>
          {githubUnavailableMessage}。TOS 版本历史和“设为当前”功能不受影响。
        </Alert>
      ) : null}

      {!dashboard.tosCurrentSwitchEnabled ? (
        <Alert color="orange" title="TOS 当前版本写入尚未配置" icon={<IconAlertTriangle size={19} />}>
          版本历史仍可查看，但暂时不能把历史版本设为当前版本。
        </Alert>
      ) : null}

      <Paper withBorder p="lg" className="surface">
        <Group justify="space-between" align="flex-start" wrap="nowrap" mb="md">
          <div>
            <Title order={3}>发布新版本</Title>
            <Text size="sm" c="dimmed" mt={3}>版本号从 master 的 package.json 自动读取，不在后台修改。</Text>
          </div>
          <ThemeIcon color="violet" variant="light" size={40}><IconCloudUpload size={20} /></ThemeIcon>
        </Group>
        <Textarea
          label="更新说明（选填）"
          description="留空时，GitHub Actions 会根据最近提交自动生成用户可读的更新说明。"
          placeholder="例如：修复批量导出偶发失败的问题"
          minRows={4}
          maxLength={8_000}
          value={releaseNotes}
          disabled={sourceVersion === undefined}
          onChange={(event) => setReleaseNotes(event.currentTarget.value)}
        />
        <Group justify="space-between" mt="md">
          <Text id="release-publish-help" size="xs" c={sourceAlreadyPublished ? 'orange' : 'dimmed'}>
            {publishHelp}
          </Text>
          <Button
            leftSection={<IconRocket size={17} />}
            loading={submitting}
            disabled={isBusy || sourceAlreadyPublished || sourceVersion === undefined}
            aria-describedby="release-publish-help"
            onClick={() => void publish()}
          >
            {sourceVersion ? `发布 v${sourceVersion}` : '发布新版本'}
          </Button>
        </Group>
      </Paper>

      <Paper withBorder className="surface table-surface">
        <div className="table-toolbar">
          <Title order={3}>版本历史</Title>
          <Text size="sm" c="dimmed" mt={3}>
            {dashboard.tosCurrentSwitchEnabled
              ? '可以把任意完整版本设为当前版本；这里不会提供删除操作。'
              : '当前只能查看版本历史；配置 TOS 写入权限后可以切换当前版本。'}
          </Text>
        </div>
        <ScrollArea>
          <Table verticalSpacing="sm" horizontalSpacing="lg" highlightOnHover miw={1050}>
            <Table.Thead><Table.Tr>
              <Table.Th>版本</Table.Th><Table.Th>状态</Table.Th><Table.Th>发布时间</Table.Th>
              <Table.Th>存储大小</Table.Th><Table.Th>更新说明</Table.Th><Table.Th>下载</Table.Th>
              <Table.Th className="table-action-column">操作</Table.Th>
            </Table.Tr></Table.Thead>
            <Table.Tbody>
              {(dashboard.catalog?.releases ?? []).map((release) => {
                const isCurrent = release.version === dashboard.catalog?.currentVersion;
                return (
                  <Table.Tr key={release.version}>
                    <Table.Td><Text fw={650} size="sm">v{release.version}</Text></Table.Td>
                    <Table.Td>
                      <Badge color={isCurrent ? 'teal' : 'gray'} variant="light">
                        {isCurrent ? '当前版本' : '已归档'}
                      </Badge>
                    </Table.Td>
                    <Table.Td><Text size="sm" className="nowrap">{formatDateTime(release.releaseDate)}</Text></Table.Td>
                    <Table.Td><Text size="sm" className="nowrap">{formatBytes(release.totalSizeBytes)}</Text></Table.Td>
                    <Table.Td><Text size="sm" lineClamp={2} maw={360}>{release.releaseNotes}</Text></Table.Td>
                    <Table.Td><DownloadLinks release={release} /></Table.Td>
                    <Table.Td className="table-action-column">
                      <Button
                        size="xs"
                        variant={isCurrent ? 'subtle' : 'light'}
                        disabled={isCurrent || isBusy || !dashboard.tosCurrentSwitchEnabled}
                        onClick={() => requestSetCurrent(release)}
                      >
                        {isCurrent ? '使用中' : '设为当前'}
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea>
        {(dashboard.catalog?.releases.length ?? 0) === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="xl">首次使用新版流水线发布后，这里会建立版本目录。</Text>
        ) : null}
      </Paper>

      {operationHistory.length > 0 ? (
        <Paper withBorder p="lg" className="surface">
          <Title order={3} mb="sm">最近任务</Title>
          <Stack gap="xs">
            {operationHistory.map((item) => (
              <Group key={`${item.requestId}-${item.updatedAt}`} justify="space-between" className="list-row">
                <div>
                  <Group gap={7}>
                    <Text size="sm" fw={600}>{item.kind === 'publish' ? '发布版本' : '切换当前版本'}</Text>
                    <Badge size="sm" variant="light" color="violet">
                      {item.version ? `v${item.version}` : '版本未知'}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed">{formatDateTime(item.createdAt)}</Text>
                </div>
                <Group gap="sm">
                  <Badge color={item.conclusion === 'success' ? 'teal' : 'red'} variant="light">
                    {item.conclusion === 'success' ? '成功' : '失败'}
                  </Badge>
                  {item.url ? <Anchor href={item.url} target="_blank" rel="noreferrer" size="xs">运行详情</Anchor> : null}
                </Group>
              </Group>
            ))}
          </Stack>
        </Paper>
      ) : null}
    </Stack>
  );
}

function OperationPanel({ operation }: { operation: ReleaseOperation }) {
  const completed = operation.status === 'completed';
  const succeeded = operation.conclusion === 'success';
  const isDirectSwitch = operation.kind === 'set-current';
  const progress = operation.status === 'waiting' ? 8 : operation.status === 'queued' ? 20 : completed ? 100 : 58;
  return (
    <Alert
      color={completed ? succeeded ? 'teal' : 'red' : 'violet'}
      title={completed
        ? succeeded
          ? isDirectSwitch ? '当前版本已切换' : '版本任务已完成'
          : '版本任务执行失败'
        : '版本任务正在执行'}
      icon={completed && !succeeded
        ? <IconAlertTriangle size={19} />
        : isDirectSwitch ? <IconCheck size={19} /> : <IconBrandGithub size={19} />}
      role={completed && !succeeded ? 'alert' : 'status'}
      aria-live="polite"
    >
      <Stack gap="sm">
        <Group justify="space-between">
          <Text size="sm">
            {operation.kind === 'publish' ? '发布版本' : '切换当前版本'} {operation.version ? `v${operation.version}` : ''}
          </Text>
          {operation.url ? <Anchor href={operation.url} target="_blank" rel="noreferrer" size="sm">查看 GitHub 运行详情</Anchor> : null}
        </Group>
        <Progress
          value={progress}
          animated={!completed}
          color={completed ? succeeded ? 'teal' : 'red' : 'violet'}
          aria-label="版本任务进度"
        />
        {operation.kind === 'publish' && operation.status === 'waiting' ? (
          <Text size="xs" c="dimmed">任务已提交，正在等待 GitHub 建立运行记录。</Text>
        ) : null}
      </Stack>
    </Alert>
  );
}

function DownloadLinks({ release }: { release: DesktopReleaseRecord }) {
  if (release.downloads.length === 0) return <Text size="xs" c="dimmed">暂无快捷链接</Text>;
  return (
    <Group gap={6} wrap="nowrap">
      {release.downloads.map((download) => (
        <Anchor
          key={download.name}
          href={download.url}
          target="_blank"
          rel="noreferrer"
          title={`${download.name} · ${formatBytes(download.size)}`}
        >
          <Badge variant="light" color={download.platform === 'windows' ? 'blue' : 'gray'} leftSection={<IconDownload size={12} />}>
            {download.platform === 'windows' ? 'Windows' : `Mac ${download.arch === 'arm64' ? 'M 芯片' : 'Intel'}`}
          </Badge>
        </Anchor>
      ))}
    </Group>
  );
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
}

function compareVersions(left: string, right: string): number {
  if (!VERSION_PATTERN.test(left) || !VERSION_PATTERN.test(right)) return left.localeCompare(right);
  const [leftCore, leftPreRelease] = left.split('-', 2);
  const [rightCore, rightPreRelease] = right.split('-', 2);
  const leftParts = (leftCore ?? '').split('.').map(Number);
  const rightParts = (rightCore ?? '').split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  if (leftPreRelease === undefined && rightPreRelease !== undefined) return 1;
  if (leftPreRelease !== undefined && rightPreRelease === undefined) return -1;
  return (leftPreRelease ?? '').localeCompare(rightPreRelease ?? '');
}
