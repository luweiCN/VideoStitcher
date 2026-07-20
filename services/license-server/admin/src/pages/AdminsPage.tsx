import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Drawer,
  Group,
  Paper,
  PasswordInput,
  ScrollArea,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconEdit, IconPlus, IconShieldCheck } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest, getErrorMessage } from '../api';
import { adminRoleLabels, adminStatusLabels, formatDateTime } from '../presentation';
import type { AdminAccount, AdminRole, AdminStatus } from '../types';

interface AdminsPageProps {
  token: string;
  currentAdmin: AdminAccount;
  onCurrentAdminChanged(admin: AdminAccount): void;
  onSignOut(): void;
}

interface CreateAdminValues {
  username: string;
  displayName: string;
  role: AdminRole;
  password: string;
}

interface EditAdminValues {
  displayName: string;
  role: AdminRole;
  status: AdminStatus;
  password: string;
}

export function AdminsPage({ token, currentAdmin, onCurrentAdminChanged, onSignOut }: AdminsPageProps) {
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminAccount>();
  const createForm = useForm<CreateAdminValues>({
    initialValues: { username: '', displayName: '', role: 'operator', password: '' },
    validate: {
      username: (value) => /^[a-z0-9][a-z0-9._-]{2,31}$/.test(value) ? null : '3 到 32 位小写字母、数字、点、下划线或连字符',
      displayName: (value) => value.trim() ? null : '请输入显示名称',
      password: (value) => value.length >= 10 ? null : '密码至少 10 个字符',
    },
  });
  const editForm = useForm<EditAdminValues>({
    initialValues: { displayName: '', role: 'operator', status: 'active', password: '' },
    validate: {
      displayName: (value) => value.trim() ? null : '请输入显示名称',
      password: (value) => value && value.length < 10 ? '密码至少 10 个字符' : null,
    },
  });

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiRequest<{ admins: AdminAccount[] }>('/v1/admin/accounts', { token });
      setAdmins(result.admins);
    } catch (error: unknown) {
      notifications.show({ color: 'red', message: getErrorMessage(error, '加载管理员账号失败') });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const openCreate = () => {
    createForm.setValues({ username: '', displayName: '', role: 'operator', password: '' });
    createForm.resetDirty();
    setCreateOpen(true);
  };

  const openEdit = (admin: AdminAccount) => {
    editForm.setValues({ displayName: admin.displayName, role: admin.role, status: admin.status, password: '' });
    setEditingAdmin(admin);
  };

  const createAccount = async (values: CreateAdminValues) => {
    setSubmitting(true);
    try {
      await apiRequest('/v1/admin/accounts', { method: 'POST', token, body: JSON.stringify(values) });
      notifications.show({ color: 'teal', message: '管理员账号已创建' });
      setCreateOpen(false);
      await loadAccounts();
    } catch (error: unknown) {
      notifications.show({ color: 'red', message: getErrorMessage(error, '创建管理员账号失败') });
    } finally {
      setSubmitting(false);
    }
  };

  const updateAccount = async (values: EditAdminValues) => {
    if (!editingAdmin) return;
    setSubmitting(true);
    try {
      const result = await apiRequest<{ admin: AdminAccount }>(
        `/v1/admin/accounts/${encodeURIComponent(editingAdmin.id)}`,
        {
          method: 'PUT', token,
          body: JSON.stringify({
            displayName: values.displayName,
            role: values.role,
            status: values.status,
            ...(values.password ? { password: values.password } : {}),
          }),
        },
      );
      setEditingAdmin(undefined);
      if (editingAdmin.id === currentAdmin.id && values.password) {
        notifications.show({ color: 'teal', message: '密码已更新，请使用新密码重新登录' });
        onSignOut();
        return;
      }
      if (editingAdmin.id === currentAdmin.id) onCurrentAdminChanged(result.admin);
      notifications.show({ color: 'teal', message: '管理员账号已更新' });
      await loadAccounts();
    } catch (error: unknown) {
      notifications.show({ color: 'red', message: getErrorMessage(error, '更新管理员账号失败') });
    } finally {
      setSubmitting(false);
    }
  };

  const rows = admins.map((admin) => (
    <Table.Tr key={admin.id}>
      <Table.Td>
        <Group gap="sm" wrap="nowrap">
          <Avatar color="violet" variant="light" radius="xl" size={36}>{admin.displayName.slice(0, 1)}</Avatar>
          <div className="primary-cell">
            <Group gap={6} wrap="nowrap">
              <Text size="sm" fw={600} truncate>{admin.displayName}</Text>
              {admin.id === currentAdmin.id ? <Badge color="gray" variant="light" size="xs">当前账号</Badge> : null}
            </Group>
            <Text size="xs" c="dimmed">@{admin.username}</Text>
          </div>
        </Group>
      </Table.Td>
      <Table.Td><Badge color={admin.role === 'owner' ? 'violet' : 'blue'} variant="light">{adminRoleLabels[admin.role]}</Badge></Table.Td>
      <Table.Td><Badge color={admin.status === 'active' ? 'teal' : 'gray'} variant="light">{adminStatusLabels[admin.status]}</Badge></Table.Td>
      <Table.Td><Text size="sm" className="nowrap">{formatDateTime(admin.lastLoginAt)}</Text></Table.Td>
      <Table.Td><Text size="sm" className="nowrap">{formatDateTime(admin.createdAt)}</Text></Table.Td>
      <Table.Td className="table-action-column">
        <Tooltip label="管理账号">
          <ActionIcon variant="subtle" color="gray" onClick={() => openEdit(admin)} aria-label={`管理 ${admin.displayName}`}><IconEdit size={17} /></ActionIcon>
        </Tooltip>
      </Table.Td>
    </Table.Tr>
  ));

  if (loading && admins.length === 0) return <Paper withBorder p="lg" className="surface"><Skeleton height={260} /></Paper>;

  return (
    <Stack gap="lg">
      <Paper withBorder p="lg" className="role-guide">
        <Group wrap="nowrap" align="flex-start">
          <ThemeIcon color="violet" variant="light" radius="md" size={42}><IconShieldCheck size={21} /></ThemeIcon>
          <div>
            <Text fw={650}>按职责分配后台权限</Text>
            <Text size="sm" c="dimmed" mt={3}>所有者可以管理管理员账号；运营管理员可以管理授权设备、套餐包和兑换码，但不能添加或停用管理员。</Text>
          </div>
        </Group>
      </Paper>

      <Paper withBorder className="surface table-surface">
        <Group justify="space-between" align="flex-start" wrap="nowrap" className="table-toolbar">
          <div>
            <Title order={3}>管理员账号</Title>
            <Text size="sm" c="dimmed" mt={3}>每位团队成员使用自己的账号登录，操作记录可追溯到个人。</Text>
          </div>
          <Button leftSection={<IconPlus size={17} />} onClick={openCreate}>添加管理员</Button>
        </Group>
        <ScrollArea>
          <Table verticalSpacing="sm" horizontalSpacing="lg" highlightOnHover miw={850}>
            <Table.Thead><Table.Tr>
              <Table.Th>管理员</Table.Th><Table.Th>账号角色</Table.Th><Table.Th>状态</Table.Th>
              <Table.Th>最近登录</Table.Th><Table.Th>创建时间</Table.Th><Table.Th className="table-action-column">操作</Table.Th>
            </Table.Tr></Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>

      <Drawer opened={createOpen} onClose={() => setCreateOpen(false)} title="添加管理员" position="right" size={500}>
        <form onSubmit={createForm.onSubmit(createAccount)}>
          <Stack gap="md">
            <TextInput label="登录用户名" description="创建后不可修改" placeholder="例如 operator.li" autoComplete="off" {...createForm.getInputProps('username')} />
            <TextInput label="显示名称" placeholder="例如：运营小李" {...createForm.getInputProps('displayName')} />
            <Select label="账号角色" allowDeselect={false} data={[
              { value: 'operator', label: '运营管理员 — 管理授权设备、套餐和兑换码' },
              { value: 'owner', label: '所有者 — 包含管理员账号管理权限' },
            ]} {...createForm.getInputProps('role')} />
            <PasswordInput label="初始密码" description="至少 10 个字符" autoComplete="new-password" {...createForm.getInputProps('password')} />
            <Button type="submit" mt="sm" loading={submitting}>创建账号</Button>
          </Stack>
        </form>
      </Drawer>

      <Drawer opened={editingAdmin !== undefined} onClose={() => setEditingAdmin(undefined)} title="管理管理员账号" position="right" size={500}>
        <form onSubmit={editForm.onSubmit(updateAccount)}>
          <Stack gap="md">
            <TextInput label="显示名称" {...editForm.getInputProps('displayName')} />
            <Select label="账号角色" allowDeselect={false} disabled={editingAdmin?.id === currentAdmin.id} data={[
              { value: 'operator', label: '运营管理员' }, { value: 'owner', label: '所有者' },
            ]} {...editForm.getInputProps('role')} />
            <Select label="账号状态" allowDeselect={false} disabled={editingAdmin?.id === currentAdmin.id} data={[
              { value: 'active', label: '启用' }, { value: 'disabled', label: '停用并使现有登录失效' },
            ]} {...editForm.getInputProps('status')} />
            <PasswordInput
              label="重置密码（选填）"
              description={editingAdmin?.id === currentAdmin.id ? '修改自己的密码后需要重新登录。' : '留空表示不修改；修改后该账号需要重新登录。'}
              autoComplete="new-password"
              {...editForm.getInputProps('password')}
            />
            <Button type="submit" mt="sm" loading={submitting}>保存变更</Button>
          </Stack>
        </form>
      </Drawer>
    </Stack>
  );
}
