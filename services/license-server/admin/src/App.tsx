import {
  ActionIcon,
  Alert,
  AppShell,
  Avatar,
  Burger,
  Button,
  Group,
  MantineProvider,
  Menu,
  NavLink,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
  Title,
  Tooltip,
  createTheme,
} from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications, notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';
import {
  IconChartDots3,
  IconChartHistogram,
  IconChevronDown,
  IconDeviceDesktop,
  IconKey,
  IconLock,
  IconLogout,
  IconPackage,
  IconRefresh,
  IconShieldLock,
} from '@tabler/icons-react';
import { Component, useCallback, useEffect, useMemo, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { ApiClientError, apiRequest } from './api';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { LoginScreen } from './components/LoginScreen';
import { AdminsPage } from './pages/AdminsPage';
import { CodesPage } from './pages/CodesPage';
import { OverviewPage } from './pages/OverviewPage';
import { PlansPage } from './pages/PlansPage';
import { UsagePage } from './pages/UsagePage';
import { UsersPage as AuthorizedDevicesPage } from './pages/UsersPage';
import { adminRoleLabels } from './presentation';
import type { AdminAccount, AdminSession, AuditEvent, OverviewData, PageKey } from './types';

const SESSION_STORAGE_KEY = 'videostitcher-admin-session-v1';
const PAGE_KEYS: PageKey[] = ['overview', 'devices', 'usage', 'plans', 'codes', 'admins'];

const theme = createTheme({
  primaryColor: 'violet',
  primaryShade: 6,
  defaultRadius: 'md',
  fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
  headings: {
    fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
    fontWeight: '650',
  },
  components: {
    Button: { defaultProps: { fw: 600 } },
    Paper: { defaultProps: { radius: 'md' } },
  },
});

const pageMetadata: Record<PageKey, { title: string; description: string }> = {
  overview: { title: '概览', description: '查看授权设备规模、在线状态和近期需要处理的事项。' },
  devices: { title: '授权设备', description: '按设备 ID 管理运营备注、套餐队列和使用状态。' },
  usage: { title: '使用分析', description: '查看每台授权设备的前台时长、启动次数和最近活跃情况。' },
  plans: { title: '套餐包', description: '创建可发放的套餐模板，并管理全局权益和新设备默认权益。' },
  codes: { title: '套餐兑换码', description: '按套餐生成可交付给销售渠道的一次性兑换码批次。' },
  admins: { title: '管理员账号', description: '为团队成员创建独立账号并分配管理权限。' },
};

class AdminPageErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  public state = { failed: false };

  public static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[管理后台] 页面渲染失败:', error, errorInfo);
  }

  public render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <Alert color="red" title="当前页面加载失败">
        <Group justify="space-between" align="center">
          <Text size="sm">请刷新页面重新加载最新版本；如果问题仍然存在，请查看服务日志。</Text>
          <Button size="xs" variant="light" color="red" onClick={() => window.location.reload()}>
            刷新页面
          </Button>
        </Group>
      </Alert>
    );
  }
}

function readStoredSession(): AdminSession | undefined {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return undefined;
    const value = JSON.parse(raw) as Partial<AdminSession>;
    if (
      typeof value.token !== 'string'
      || typeof value.expiresAt !== 'string'
      || typeof value.admin !== 'object'
      || value.admin === null
      || new Date(value.expiresAt).getTime() <= Date.now()
    ) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return undefined;
    }
    return value as AdminSession;
  } catch {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return undefined;
  }
}

function readInitialPage(): PageKey {
  const rawPage = window.location.hash.replace(/^#\/?/, '');
  if (rawPage === 'users') return 'devices';
  const page = rawPage as PageKey;
  return PAGE_KEYS.includes(page) ? page : 'overview';
}

export function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <ModalsProvider>
        <Notifications position="top-right" />
        <AdminConsole />
      </ModalsProvider>
    </MantineProvider>
  );
}

function AdminConsole() {
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure(false);
  const [passwordModalOpened, { open: openPasswordModal, close: closePasswordModal }] = useDisclosure(false);
  const [session, setSession] = useState<AdminSession | undefined>(readStoredSession);
  const [page, setPage] = useState<PageKey>(readInitialPage);
  const [overview, setOverview] = useState<OverviewData>();
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string>();

  const signOut = useCallback(() => {
    const token = session?.token;
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setSession(undefined);
    setOverview(undefined);
    setAuditEvents([]);
    if (token) {
      void apiRequest('/v1/admin/auth/logout', { method: 'POST', token }).catch(() => undefined);
    }
  }, [session?.token]);

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setLoadError(undefined);
    try {
      const [nextOverview, auditResult] = await Promise.all([
        apiRequest<OverviewData>('/v1/admin/overview', { token: session.token }),
        apiRequest<{ events: AuditEvent[] }>('/v1/admin/audit-events?limit=100', { token: session.token }),
      ]);
      setOverview(nextOverview);
      setAuditEvents(auditResult.events);
    } catch (error: unknown) {
      if (error instanceof ApiClientError && error.status === 401) {
        signOut();
        notifications.show({ color: 'orange', message: '登录已失效，请重新登录' });
        return;
      }
      setLoadError(error instanceof Error ? error.message : '加载后台数据失败');
    } finally {
      setLoading(false);
    }
  }, [session, signOut]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleLogin = (nextSession: AdminSession) => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
  };

  const handleCurrentAdminChanged = (admin: AdminAccount) => {
    setSession((current) => {
      if (!current) return current;
      const nextSession = { ...current, admin };
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
      return nextSession;
    });
  };

  const navigate = (nextPage: PageKey) => {
    if ((nextPage === 'admins' || nextPage === 'codes') && session?.admin.role !== 'owner') return;
    setPage(nextPage);
    window.location.hash = nextPage;
    closeMobile();
  };

  const navigationItems = useMemo(() => [
    { key: 'overview' as const, icon: IconChartDots3, label: '概览' },
    { key: 'devices' as const, icon: IconDeviceDesktop, label: '授权设备' },
    { key: 'usage' as const, icon: IconChartHistogram, label: '使用分析' },
    { key: 'plans' as const, icon: IconPackage, label: '套餐包' },
    ...(session?.admin.role === 'owner'
      ? [
          { key: 'codes' as const, icon: IconKey, label: '套餐兑换码' },
          { key: 'admins' as const, icon: IconShieldLock, label: '管理员账号' },
        ]
      : []),
  ], [session?.admin.role]);

  if (!session) return <LoginScreen onLogin={handleLogin} />;

  const visiblePage = (page === 'admins' || page === 'codes') && session.admin.role !== 'owner'
    ? 'overview'
    : page;
  const metadata = pageMetadata[visiblePage];

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{ width: 248, breakpoint: 'md', collapsed: { mobile: !mobileOpened } }}
      padding={0}
      className="admin-shell"
    >
      <AppShell.Header className="app-header">
        <Group h="100%" px="lg" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="md" size="sm" aria-label="打开导航" />
            <Text size="sm" c="dimmed" fw={550} visibleFrom="md">授权服务控制台</Text>
          </Group>
          <Group gap="xs" wrap="nowrap">
            <Tooltip label="刷新后台数据">
              <ActionIcon variant="subtle" color="gray" size="lg" loading={loading} onClick={() => void refresh()}>
                <IconRefresh size={18} stroke={1.8} />
              </ActionIcon>
            </Tooltip>
            <Menu position="bottom-end" width={230} shadow="md">
              <Menu.Target>
                <Button variant="subtle" color="dark" px="xs" rightSection={<IconChevronDown size={14} />}>
                  <Group gap={8} wrap="nowrap">
                    <Avatar color="violet" radius="xl" size={30}>{session.admin.displayName.slice(0, 1)}</Avatar>
                    <Text size="sm" fw={600} className="header-account-name">{session.admin.displayName}</Text>
                  </Group>
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{adminRoleLabels[session.admin.role]} · @{session.admin.username}</Menu.Label>
                <Menu.Divider />
                <Menu.Item leftSection={<IconLock size={16} />} onClick={openPasswordModal}>修改密码</Menu.Item>
                <Menu.Divider />
                <Menu.Item color="red" leftSection={<IconLogout size={16} />} onClick={signOut}>退出登录</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar className="app-navbar">
        <div className="navbar-brand">
          <span className="brand-mark" aria-hidden="true">VS</span>
          <div><strong>VideoStitcher</strong><span>管理后台</span></div>
        </div>
        <AppShell.Section grow component={ScrollArea} px="sm" py="md">
          <Stack gap={4}>
            {navigationItems.map((item) => (
              <NavLink
                key={item.key}
                active={visiblePage === item.key}
                label={item.label}
                leftSection={<item.icon size={18} stroke={1.7} />}
                onClick={() => navigate(item.key)}
                variant="filled"
              />
            ))}
          </Stack>
        </AppShell.Section>
        <AppShell.Section className="navbar-account">
          <Group gap="sm" wrap="nowrap">
            <Avatar color="violet" variant="light" radius="xl" size={36}>{session.admin.displayName.slice(0, 1)}</Avatar>
            <div>
              <Text size="sm" fw={600} truncate>{session.admin.displayName}</Text>
              <Text size="xs" c="dimmed">{adminRoleLabels[session.admin.role]}</Text>
            </div>
          </Group>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <main className="page-container">
          <Group justify="space-between" align="flex-start" mb="xl" wrap="nowrap">
            <div>
              <Title order={1}>{metadata.title}</Title>
              <Text c="dimmed" mt={6}>{metadata.description}</Text>
            </div>
          </Group>

          {loadError ? (
            <Alert color="red" title="后台数据加载失败" mb="lg">
              <Group justify="space-between">
                <Text size="sm">{loadError}</Text>
                <Button size="xs" variant="light" color="red" onClick={() => void refresh()}>重试</Button>
              </Group>
            </Alert>
          ) : null}

          {!overview ? (
            <div className="surface"><Skeleton height={330} radius="md" /></div>
          ) : (
            <AdminPageErrorBoundary key={visiblePage}>
              <PageContent
                page={visiblePage}
                session={session}
                overview={overview}
                auditEvents={auditEvents}
                refresh={refresh}
                navigate={navigate}
                onCurrentAdminChanged={handleCurrentAdminChanged}
                signOut={signOut}
              />
            </AdminPageErrorBoundary>
          )}
        </main>
      </AppShell.Main>

      <ChangePasswordModal
        opened={passwordModalOpened}
        token={session.token}
        onClose={closePasswordModal}
        onChanged={signOut}
      />
    </AppShell>
  );
}

interface PageContentProps {
  page: PageKey;
  session: AdminSession;
  overview: OverviewData;
  auditEvents: AuditEvent[];
  refresh(): Promise<void>;
  navigate(page: PageKey): void;
  onCurrentAdminChanged(admin: AdminAccount): void;
  signOut(): void;
}

function PageContent({
  page,
  session,
  overview,
  auditEvents,
  refresh,
  navigate,
  onCurrentAdminChanged,
  signOut,
}: PageContentProps) {
  switch (page) {
    case 'overview':
      return <OverviewPage overview={overview} auditEvents={auditEvents} onOpenDevices={() => navigate('devices')} />;
    case 'devices':
      return <AuthorizedDevicesPage token={session.token} overview={overview} onChanged={refresh} />;
    case 'usage':
      return <UsagePage overview={overview} />;
    case 'plans':
      return <PlansPage token={session.token} overview={overview} onChanged={refresh} />;
    case 'codes':
      return <CodesPage token={session.token} overview={overview} onChanged={refresh} />;
    case 'admins':
      return (
        <AdminsPage
          token={session.token}
          currentAdmin={session.admin}
          onCurrentAdminChanged={onCurrentAdminChanged}
          onSignOut={signOut}
        />
      );
    default: {
      const exhaustive: never = page;
      throw new Error(`未知页面：${exhaustive}`);
    }
  }
}
