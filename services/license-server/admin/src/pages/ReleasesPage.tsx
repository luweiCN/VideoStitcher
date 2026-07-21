import {
  Alert,
  Anchor,
  Badge,
  Button,
  Group,
  Menu,
  Modal,
  Paper,
  Progress,
  ScrollArea,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconBrandGithub,
  IconCheck,
  IconChevronDown,
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
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [targetVersion, setTargetVersion] = useState('');

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
          notifications.show({ color: 'teal', message: getOperationSuccessMessage(visibleOperation) });
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
    const normalizedVersion = normalizeVersionInput(targetVersion);
    if (!normalizedVersion) {
      notifications.show({ color: 'red', message: '请输入有效版本号，例如 3.5 或 3.5.0' });
      return;
    }
    setSubmitting(true);
    try {
      const nextOperation = await apiRequest<ReleaseOperation>('/v1/admin/releases', {
        method: 'POST',
        token,
        body: JSON.stringify({ version: normalizedVersion, releaseNotes }),
      });
      setOperation(nextOperation);
      setPublishModalOpen(false);
      setReleaseNotes('');
      notifications.show({ color: 'violet', message: `版本 ${nextOperation.version} 已进入发布队列` });
    } catch (error: unknown) {
      notifications.show({ color: 'red', message: getErrorMessage(error, '提交发布任务失败') });
    } finally {
      setSubmitting(false);
    }
  };

  const requestDeployAdmin = () => {
    modals.openConfirmModal({
      title: '发布管理后台',
      children: (
        <Stack gap="xs">
          <Text size="sm">将 master 当前代码部署到火山引擎函数服务。</Text>
          <Text size="sm" c="dimmed">管理后台和授权 API 位于同一个函数包，会一起更新。</Text>
        </Stack>
      ),
      labels: { confirm: '开始部署', cancel: '取消' },
      confirmProps: { color: 'blue' },
      onConfirm: () => void deployAdmin(),
    });
  };

  const deployAdmin = async () => {
    setSubmitting(true);
    try {
      const nextOperation = await apiRequest<ReleaseOperation>('/v1/admin/releases/deploy-admin', {
        method: 'POST',
        token,
      });
      setOperation(nextOperation);
      notifications.show({ color: 'blue', message: '管理后台已进入部署队列' });
    } catch (error: unknown) {
      notifications.show({ color: 'red', message: getErrorMessage(error, '提交管理后台部署失败') });
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
  const versionBase = getLatestVersion([
    ...(sourceVersion ? [sourceVersion] : []),
    ...(dashboard?.catalog?.releases.map((release) => release.version) ?? []),
  ]);
  const versionSuggestions = versionBase ? {
    patch: incrementVersion(versionBase, 'patch'),
    minor: incrementVersion(versionBase, 'minor'),
    major: incrementVersion(versionBase, 'major'),
  } : undefined;
  const selectedSuggestion = versionSuggestions
    ? (Object.entries(versionSuggestions).find(([, version]) => version === targetVersion)?.[0] ?? '')
    : '';
  const openPublishModal = () => {
    setTargetVersion(versionSuggestions?.patch ?? sourceVersion ?? '');
    setPublishModalOpen(true);
  };
  const dashboardOperations = dashboard?.operations ?? [];
  const visibleOperations = operation
    ? [operation, ...dashboardOperations.filter((item) => item.requestId !== operation.requestId)].slice(0, 8)
    : dashboardOperations.slice(0, 8);

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
              <Text size="xs" c="dimmed">master 代码版本</Text>
              <Text fz={28} fw={700} mt={4}>{sourceVersion ? `v${sourceVersion}` : '—'}</Text>
              <Text size="xs" c={githubUnavailableMessage ? 'orange' : 'dimmed'} mt={6}>
                {githubUnavailableMessage
                  ? 'GitHub 发布服务暂不可用'
                  : sourceAlreadyPublished
                    ? '已发布，流水线可自动升级到下一版本'
                    : '发布时可直接使用或升级此版本'}
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
        <Alert color="orange" title="发布服务暂不可用" icon={<IconAlertTriangle size={19} />}>
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
            <Title order={3}>发布中心</Title>
            <Text size="sm" c="dimmed" mt={3}>管理后台和桌面应用使用独立流水线，可以分别发布。</Text>
          </div>
          <ThemeIcon color="violet" variant="light" size={40}><IconCloudUpload size={20} /></ThemeIcon>
        </Group>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <Paper withBorder p="md" radius="md">
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <div>
                <Text fw={650}>管理后台</Text>
                <Text size="sm" c="dimmed" mt={4}>部署 master 当前代码，不修改桌面应用版本。</Text>
              </div>
              <ThemeIcon color="blue" variant="light"><IconCloudUpload size={18} /></ThemeIcon>
            </Group>
            <Button
              mt="lg"
              variant="light"
              color="blue"
              fullWidth
              disabled={isBusy || Boolean(githubUnavailableMessage)}
              onClick={requestDeployAdmin}
            >
              发布管理后台
            </Button>
          </Paper>
          <Paper withBorder p="md" radius="md">
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <div>
                <Text fw={650}>桌面应用</Text>
                <Text size="sm" c="dimmed" mt={4}>选择版本号，构建各平台安装包并发布到 TOS。</Text>
              </div>
              <ThemeIcon color="violet" variant="light"><IconRocket size={18} /></ThemeIcon>
            </Group>
            <Button
              mt="lg"
              fullWidth
              disabled={isBusy || sourceVersion === undefined || Boolean(githubUnavailableMessage)}
              onClick={openPublishModal}
            >
              发布桌面应用
            </Button>
          </Paper>
        </SimpleGrid>
        <Text size="xs" c={githubUnavailableMessage ? 'orange' : 'dimmed'} mt="md">
          {githubUnavailableMessage ?? (isBusy
            ? '已有发布任务正在执行，完成后才能提交下一项任务。'
            : '桌面应用发布会构建 Windows、Intel Mac 和 Apple Silicon Mac。')}
        </Text>
      </Paper>

      <Modal
        opened={publishModalOpen}
        onClose={() => setPublishModalOpen(false)}
        title="发布桌面应用"
        size="lg"
        centered
      >
        <Stack gap="lg">
          <div>
            <Text size="sm" fw={600} mb={8}>快捷选择版本</Text>
            <SegmentedControl
              fullWidth
              value={selectedSuggestion}
              data={[
                { value: 'patch', label: 'Patch · 修订版' },
                { value: 'minor', label: 'Minor · 功能版' },
                { value: 'major', label: 'Major · 主版本' },
              ]}
              disabled={!versionSuggestions}
              onChange={(value) => {
                const version = versionSuggestions?.[value as keyof typeof versionSuggestions];
                if (version) setTargetVersion(version);
              }}
            />
            {versionBase ? <Text size="xs" c="dimmed" mt={7}>基于最新版本 v{versionBase} 计算。</Text> : null}
          </div>
          <TextInput
            label="目标版本"
            description="可以直接输入 3.5，提交时会规范为 3.5.0。流水线会同步更新 package.json。"
            placeholder="例如 3.5.0"
            value={targetVersion}
            onChange={(event) => setTargetVersion(event.currentTarget.value)}
            onBlur={() => {
              const normalized = normalizeVersionInput(targetVersion);
              if (normalized) setTargetVersion(normalized);
            }}
          />
          <Textarea
            label="更新说明（选填）"
            description="留空时，GitHub Actions 会根据最近提交自动生成用户可读的更新说明。"
            placeholder="例如：修复批量导出偶发失败的问题"
            minRows={5}
            maxLength={8_000}
            value={releaseNotes}
            onChange={(event) => setReleaseNotes(event.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setPublishModalOpen(false)}>取消</Button>
            <Button leftSection={<IconRocket size={17} />} loading={submitting} onClick={() => void publish()}>
              确认发布{normalizeVersionInput(targetVersion) ? ` v${normalizeVersionInput(targetVersion)}` : ''}
            </Button>
          </Group>
        </Stack>
      </Modal>

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
                    <Table.Td><ReleaseNotesCell release={release} /></Table.Td>
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

      {visibleOperations.length > 0 ? (
        <Paper withBorder p="lg" className="surface">
          <Title order={3}>版本操作记录</Title>
          <Text size="sm" c="dimmed" mt={3} mb="sm">
            发布桌面应用和管理后台对应 GitHub Actions；切换当前版本由后台直接完成。
          </Text>
          <Stack gap="xs" aria-live="polite">
            {visibleOperations.map((item) => {
              const status = getOperationStatus(item);
              return (
              <Group key={`${item.requestId}-${item.updatedAt}`} justify="space-between" className="list-row">
                <div>
                  <Group gap={7}>
                    <Text size="sm" fw={600}>{getOperationLabel(item.kind)}</Text>
                    {item.version ? (
                      <Badge size="sm" variant="light" color="violet">v{item.version}</Badge>
                    ) : null}
                  </Group>
                  <Text size="xs" c="dimmed">{formatDateTime(item.createdAt)}</Text>
                </div>
                <Group gap="sm">
                  <Badge color={status.color} variant="light">
                    {status.label}
                  </Badge>
                  {item.url ? <Anchor href={item.url} target="_blank" rel="noreferrer" size="xs">查看 Workflow</Anchor> : null}
                </Group>
              </Group>
              );
            })}
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
  const isAdminDeploy = operation.kind === 'deploy-admin';
  const progress = operation.status === 'waiting' ? 8 : operation.status === 'queued' ? 20 : completed ? 100 : 58;
  return (
    <Alert
      color={completed ? succeeded ? 'teal' : 'red' : 'violet'}
      title={completed
        ? succeeded
          ? isDirectSwitch ? '当前版本已切换' : isAdminDeploy ? '管理后台部署完成' : '桌面应用发布完成'
          : isAdminDeploy ? '管理后台部署失败' : '版本任务执行失败'
        : isAdminDeploy ? '管理后台正在部署' : '版本任务正在执行'}
      icon={completed && !succeeded
        ? <IconAlertTriangle size={19} />
        : isDirectSwitch ? <IconCheck size={19} /> : isAdminDeploy
          ? <IconCloudUpload size={19} />
          : <IconBrandGithub size={19} />}
      role={completed && !succeeded ? 'alert' : 'status'}
      aria-live="polite"
    >
      <Stack gap="sm">
        <Group justify="space-between">
          <Text size="sm">
            {getOperationLabel(operation.kind)} {operation.version ? `v${operation.version}` : ''}
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
    <Menu width={360} position="bottom-start" shadow="md" withinPortal>
      <Menu.Target>
        <Button
          size="compact-sm"
          variant="light"
          color="gray"
          leftSection={<IconDownload size={15} />}
          rightSection={<IconChevronDown size={14} />}
          aria-label={`下载 v${release.version} 安装包`}
        >
          下载安装包
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>v{release.version} 安装包</Menu.Label>
        {release.downloads.map((download) => (
          <Menu.Item
            key={download.name}
            component="a"
            href={download.url}
            target="_blank"
            rel="noreferrer"
            leftSection={<IconDownload size={16} />}
          >
            <Group justify="space-between" gap="md" wrap="nowrap">
              <div style={{ minWidth: 0 }}>
                <Text size="sm" fw={600}>{formatDownloadPlatform(download)}</Text>
                <Text size="xs" c="dimmed" truncate>{download.name}</Text>
              </div>
              <Text size="xs" c="dimmed" className="nowrap">{formatBytes(download.size)}</Text>
            </Group>
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

function ReleaseNotesCell({ release }: { release: DesktopReleaseRecord }) {
  const showFullNotes = () => {
    modals.open({
      title: `v${release.version} 更新说明`,
      size: 'lg',
      centered: true,
      children: (
        <Stack gap="sm">
          <Text size="xs" c="dimmed">发布于 {formatDateTime(release.releaseDate)}</Text>
          <Text size="sm" lh={1.7} style={{ whiteSpace: 'pre-wrap' }}>{release.releaseNotes}</Text>
        </Stack>
      ),
    });
  };

  return (
    <Stack gap={5} miw={300} maw={460}>
      <Text size="sm" lineClamp={2} style={{ whiteSpace: 'pre-line' }}>{release.releaseNotes}</Text>
      <Button variant="subtle" color="gray" size="compact-xs" w="fit-content" px={0} onClick={showFullNotes}>
        查看完整说明
      </Button>
    </Stack>
  );
}

function formatDownloadPlatform(download: DesktopReleaseRecord['downloads'][number]): string {
  if (download.platform === 'windows') return 'Windows（64 位）';
  return download.arch === 'arm64' ? 'macOS（Apple 芯片）' : 'macOS（Intel 芯片）';
}

function getOperationStatus(operation: ReleaseOperation): { label: string; color: string } {
  if (operation.status === 'waiting') return { label: '等待创建', color: 'gray' };
  if (operation.status === 'queued') return { label: '排队中', color: 'blue' };
  if (operation.status === 'in_progress') return { label: '运行中', color: 'violet' };
  if (operation.conclusion === 'success') return { label: '成功', color: 'teal' };
  if (operation.conclusion === 'cancelled') return { label: '已取消', color: 'gray' };
  if (operation.conclusion === 'skipped') return { label: '已跳过', color: 'gray' };
  if (operation.conclusion === 'timed_out') return { label: '已超时', color: 'orange' };
  return { label: '失败', color: 'red' };
}

function getOperationLabel(kind: ReleaseOperation['kind']): string {
  if (kind === 'publish') return '发布桌面应用';
  if (kind === 'deploy-admin') return '发布管理后台';
  return '切换当前版本';
}

function getOperationSuccessMessage(operation: ReleaseOperation): string {
  if (operation.kind === 'publish') return `桌面应用${operation.version ? ` v${operation.version}` : ''}发布成功`;
  if (operation.kind === 'deploy-admin') return '管理后台部署成功';
  return '当前版本切换成功';
}

function normalizeVersionInput(value: string): string | undefined {
  const normalized = value.trim().replace(/^v/i, '');
  if (/^\d+\.\d+$/.test(normalized)) return `${normalized}.0`;
  return /^\d+\.\d+\.\d+$/.test(normalized) ? normalized : undefined;
}

function getLatestVersion(versions: string[]): string | undefined {
  return versions
    .filter((version) => /^\d+\.\d+\.\d+$/.test(version))
    .reduce<string | undefined>((latest, version) => (
      latest === undefined || compareVersions(version, latest) > 0 ? version : latest
    ), undefined);
}

function incrementVersion(version: string, type: 'patch' | 'minor' | 'major'): string {
  const [major = 0, minor = 0, patch = 0] = version.split('.').map(Number);
  if (type === 'major') return `${major + 1}.0.0`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
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
