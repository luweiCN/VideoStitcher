import {
  ActionIcon,
  Badge,
  Button,
  Drawer,
  Group,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconEdit, IconExternalLink, IconPlus, IconSettings, IconUserPlus, IconUsersGroup } from '@tabler/icons-react';
import { useState } from 'react';
import { apiRequest, getErrorMessage } from '../api';
import { formatDateTime, formatPlanTerm } from '../presentation';
import type { OverviewData, PlanRecord } from '../types';

interface PlansPageProps {
  token: string;
  overview: OverviewData;
  onChanged(): Promise<void>;
}

interface PlanFormValues {
  code: string;
  name: string;
  description: string;
  status: PlanRecord['status'];
  termUnit: PlanRecord['term']['unit'];
  termValue: number;
  isPublic: boolean;
  recommended: boolean;
  priceLabel: string;
  purchaseUrl: string;
  externalSku: string;
}

interface DefaultAccessFormValues {
  planId: string;
  status: 'active' | 'disabled';
  endsAt: string;
  reason: string;
}

interface NewDeviceDefaultAccessFormValues {
  planId: string;
  status: 'active' | 'disabled';
  reason: string;
}

function toLocalDateTime(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function PlansPage({ token, overview, onChanged }: PlansPageProps) {
  const [editingPlan, setEditingPlan] = useState<PlanRecord | 'new'>();
  const [defaultAccessOpen, setDefaultAccessOpen] = useState(false);
  const [newDeviceDefaultAccessOpen, setNewDeviceDefaultAccessOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<PlanFormValues>({
    initialValues: {
      code: '',
      name: '',
      description: '',
      status: 'active',
      termUnit: 'month',
      termValue: 1,
      isPublic: false,
      recommended: false,
      priceLabel: '',
      purchaseUrl: '',
      externalSku: '',
    },
    validate: {
      code: (value) => /^[a-z0-9][a-z0-9-]{1,39}$/.test(value) ? null : '仅支持小写字母、数字和连字符',
      name: (value) => value.trim() ? null : '请输入套餐名称',
      purchaseUrl: (value) => value && !/^https:\/\//.test(value) ? '请输入 HTTPS 地址' : null,
    },
  });
  const defaultAccessForm = useForm<DefaultAccessFormValues>({
    initialValues: { planId: overview.plans[0]?.id ?? '', status: 'active', endsAt: '', reason: '' },
    validate: {
      planId: (value) => value ? null : '请选择套餐包',
    },
  });
  const newDeviceDefaultAccessForm = useForm<NewDeviceDefaultAccessFormValues>({
    initialValues: { planId: overview.plans[0]?.id ?? '', status: 'active', reason: '' },
    validate: {
      planId: (value) => value ? null : '请选择套餐包',
    },
  });

  const openCreate = () => {
    form.setValues({
      code: '', name: '', description: '', status: 'active', termUnit: 'month', termValue: 1,
      isPublic: false, recommended: false, priceLabel: '', purchaseUrl: '', externalSku: '',
    });
    form.resetDirty();
    setEditingPlan('new');
  };

  const openEdit = (plan: PlanRecord) => {
    form.setValues({
      code: plan.code,
      name: plan.name,
      description: plan.description ?? '',
      status: plan.status,
      termUnit: plan.term.unit,
      termValue: plan.term.unit === 'perpetual' ? 1 : plan.term.value,
      isPublic: plan.isPublic,
      recommended: plan.recommended,
      priceLabel: plan.priceLabel ?? '',
      purchaseUrl: plan.purchaseUrl ?? '',
      externalSku: plan.externalSku ?? '',
    });
    setEditingPlan(plan);
  };

  const savePlan = async (values: PlanFormValues) => {
    setSubmitting(true);
    const term = values.termUnit === 'perpetual'
      ? { unit: 'perpetual' as const }
      : { unit: values.termUnit, value: values.termValue };
    try {
      if (editingPlan === 'new') {
        await apiRequest('/v1/admin/plans', {
          method: 'POST', token,
          body: JSON.stringify({
            code: values.code,
            name: values.name,
            ...(values.description ? { description: values.description } : {}),
            term,
            isPublic: values.isPublic,
            recommended: values.recommended,
            ...(values.priceLabel ? { priceLabel: values.priceLabel } : {}),
            ...(values.purchaseUrl ? { purchaseUrl: values.purchaseUrl } : {}),
            ...(values.externalSku ? { externalSku: values.externalSku } : {}),
          }),
        });
        notifications.show({ color: 'teal', message: '套餐包已创建' });
      } else if (editingPlan) {
        await apiRequest(`/v1/admin/plans/${encodeURIComponent(editingPlan.id)}`, {
          method: 'PUT', token,
          body: JSON.stringify({
            name: values.name,
            description: values.description || null,
            status: values.status,
            term,
            isPublic: values.isPublic,
            recommended: values.recommended,
            priceLabel: values.priceLabel || null,
            purchaseUrl: values.purchaseUrl || null,
            externalSku: values.externalSku || null,
          }),
        });
        notifications.show({ color: 'teal', message: '套餐包已更新' });
      }
      setEditingPlan(undefined);
      await onChanged();
    } catch (error: unknown) {
      notifications.show({ color: 'red', message: getErrorMessage(error, '保存套餐包失败') });
    } finally {
      setSubmitting(false);
    }
  };

  const openDefaultAccess = () => {
    defaultAccessForm.setValues({
      planId: overview.defaultAccess?.planId ?? overview.plans.find((plan) => plan.status === 'active')?.id ?? '',
      status: overview.defaultAccess?.status ?? 'active',
      endsAt: toLocalDateTime(overview.defaultAccess?.endsAt),
      reason: '',
    });
    setDefaultAccessOpen(true);
  };

  const saveDefaultAccess = async (values: DefaultAccessFormValues) => {
    setSubmitting(true);
    try {
      await apiRequest('/v1/admin/default-access', {
        method: 'PUT',
        token,
        body: JSON.stringify({
          planId: values.planId,
          status: values.status,
          endsAt: values.endsAt ? new Date(values.endsAt).toISOString() : null,
          reason: values.reason,
        }),
      });
      notifications.show({ color: 'teal', message: '全局权益已更新' });
      setDefaultAccessOpen(false);
      await onChanged();
    } catch (error: unknown) {
      notifications.show({ color: 'red', message: getErrorMessage(error, '更新全局权益失败') });
    } finally {
      setSubmitting(false);
    }
  };

  const openNewDeviceDefaultAccess = () => {
    newDeviceDefaultAccessForm.setValues({
      planId: overview.newDeviceDefaultAccess?.planId
        ?? overview.plans.find((plan) => plan.status === 'active')?.id
        ?? '',
      status: overview.newDeviceDefaultAccess?.status ?? 'active',
      reason: '',
    });
    setNewDeviceDefaultAccessOpen(true);
  };

  const saveNewDeviceDefaultAccess = async (values: NewDeviceDefaultAccessFormValues) => {
    setSubmitting(true);
    try {
      await apiRequest('/v1/admin/new-device-default-access', {
        method: 'PUT',
        token,
        body: JSON.stringify(values),
      });
      notifications.show({ color: 'teal', message: '新设备默认权益已更新' });
      setNewDeviceDefaultAccessOpen(false);
      await onChanged();
    } catch (error: unknown) {
      notifications.show({ color: 'red', message: getErrorMessage(error, '更新新设备默认权益失败') });
    } finally {
      setSubmitting(false);
    }
  };

  const rows = overview.plans.map((plan) => (
    <Table.Tr key={plan.id}>
      <Table.Td>
        <div className="primary-cell">
          <Group gap={6} wrap="nowrap">
            <Text size="sm" fw={600} truncate>{plan.name}</Text>
            {plan.recommended ? <Badge color="violet" variant="light" size="xs">推荐</Badge> : null}
          </Group>
          <Text size="xs" c="dimmed" truncate>{plan.description || plan.code}</Text>
        </div>
      </Table.Td>
      <Table.Td><Text size="sm">{formatPlanTerm(plan.term)}</Text></Table.Td>
      <Table.Td>{plan.isPublic ? <Badge color="teal" variant="light">已展示</Badge> : <Badge color="gray" variant="light">仅后台可见</Badge>}</Table.Td>
      <Table.Td>
        <Text size="sm" fw={550}>{plan.priceLabel || '暂未设置价格'}</Text>
        <Text size="xs" c="dimmed">{plan.externalSku ? `荔枝商品：${plan.externalSku}` : '尚未绑定外部商品'}</Text>
      </Table.Td>
      <Table.Td><Badge color={plan.status === 'active' ? 'teal' : 'gray'} variant="light">{plan.status === 'active' ? '可使用' : '已归档'}</Badge></Table.Td>
      <Table.Td className="table-action-column">
        <Tooltip label="编辑方案">
          <ActionIcon variant="subtle" color="gray" onClick={() => openEdit(plan)} aria-label={`编辑 ${plan.name}`}><IconEdit size={17} /></ActionIcon>
        </Tooltip>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <>
      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg" mb="lg">
        <Paper withBorder className="surface default-access-surface">
          <Group justify="space-between" align="center" wrap="nowrap">
            <Group gap="md" wrap="nowrap">
              <div className="default-access-icon"><IconUsersGroup size={21} /></div>
              <div>
                <Group gap="sm">
                  <Title order={3}>全局权益</Title>
                  {overview.defaultAccess ? (
                    <Badge color={overview.defaultAccess.effective ? 'teal' : 'gray'} variant="light">
                      {overview.defaultAccess.effective ? '正在生效' : overview.defaultAccess.status === 'disabled' ? '已停用' : '已结束'}
                    </Badge>
                  ) : <Badge color="gray" variant="light">未配置</Badge>}
                </Group>
                <Text size="sm" c="dimmed" mt={4}>
                  {overview.defaultAccess
                    ? `${overview.defaultAccess.planName} · ${overview.defaultAccess.endsAt ? `${formatDateTime(overview.defaultAccess.endsAt)} 截止` : '暂不设置截止时间'}`
                    : '新老设备都可使用；规则结束后再接续设备自己的套餐包。'}
                </Text>
              </div>
            </Group>
            <Button variant="light" leftSection={<IconSettings size={17} />} onClick={openDefaultAccess}>配置</Button>
          </Group>
        </Paper>

        <Paper withBorder className="surface default-access-surface">
          <Group justify="space-between" align="center" wrap="nowrap">
            <Group gap="md" wrap="nowrap">
              <div className="default-access-icon"><IconUserPlus size={21} /></div>
              <div>
                <Group gap="sm">
                  <Title order={3}>新设备默认权益</Title>
                  {overview.newDeviceDefaultAccess ? (
                    <Badge color={overview.newDeviceDefaultAccess.effective ? 'teal' : 'gray'} variant="light">
                      {overview.newDeviceDefaultAccess.effective
                        ? '自动发放中'
                        : overview.newDeviceDefaultAccess.status === 'disabled' ? '已停用' : '套餐已归档'}
                    </Badge>
                  ) : <Badge color="gray" variant="light">未配置</Badge>}
                </Group>
                <Text size="sm" c="dimmed" mt={4}>
                  {overview.newDeviceDefaultAccess
                    ? `${overview.newDeviceDefaultAccess.planName} · 仅首次接入自动发放一次`
                    : '无需用户手动领取；启用后只影响首次接入的新设备。'}
                </Text>
              </div>
            </Group>
            <Button variant="light" leftSection={<IconSettings size={17} />} onClick={openNewDeviceDefaultAccess}>配置</Button>
          </Group>
        </Paper>
      </SimpleGrid>

      <Paper withBorder className="surface table-surface">
        <Group justify="space-between" align="flex-start" wrap="nowrap" className="table-toolbar">
          <div>
            <Title order={3}>套餐包</Title>
            <Text size="sm" c="dimmed" mt={3}>先创建套餐模板，再发给授权设备或生成套餐码；已发出的套餐包不会被模板修改追溯影响。</Text>
          </div>
          <Button leftSection={<IconPlus size={17} />} onClick={openCreate}>创建套餐包</Button>
        </Group>
        <ScrollArea>
          <Table verticalSpacing="sm" horizontalSpacing="lg" highlightOnHover miw={980}>
            <Table.Thead><Table.Tr>
              <Table.Th>套餐名称</Table.Th><Table.Th>使用期限</Table.Th>
              <Table.Th>软件内展示</Table.Th><Table.Th>销售设置</Table.Th><Table.Th>状态</Table.Th><Table.Th className="table-action-column">操作</Table.Th>
            </Table.Tr></Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>

      <Drawer opened={defaultAccessOpen} onClose={() => setDefaultAccessOpen(false)} title="配置全局权益" position="right" size={540}>
        <Text size="sm" c="dimmed" mb="lg">这是一条全局规则，不会给每台设备复制套餐包。以后设置截止时间或停用一次，即可统一结束免费使用。</Text>
        <form onSubmit={defaultAccessForm.onSubmit(saveDefaultAccess)}>
          <Stack gap="md">
            <Select
              label="权益套餐"
              data={overview.plans.filter((plan) => plan.status === 'active').map((plan) => ({ value: plan.id, label: plan.name }))}
              {...defaultAccessForm.getInputProps('planId')}
            />
            <Select
              label="当前状态"
              allowDeselect={false}
              data={[{ value: 'active', label: '启用' }, { value: 'disabled', label: '停用' }]}
              {...defaultAccessForm.getInputProps('status')}
            />
            <TextInput
              type="datetime-local"
              label="统一截止时间（选填）"
              description="留空表示暂不设截止时间；以后可以再补。"
              {...defaultAccessForm.getInputProps('endsAt')}
            />
            <Textarea label="调整原因（选填）" placeholder="例如：当前阶段面向社群设备免费开放" rows={3} {...defaultAccessForm.getInputProps('reason')} />
            <Button type="submit" mt="sm" loading={submitting}>保存全局权益</Button>
          </Stack>
        </form>
      </Drawer>

      <Drawer
        opened={newDeviceDefaultAccessOpen}
        onClose={() => setNewDeviceDefaultAccessOpen(false)}
        title="配置新设备默认权益"
        position="right"
        size={540}
      >
        <Text size="sm" c="dimmed" mb="lg">
          设备第一次接入时会自动获得一份套餐包，无需用户点击领取。修改或停用规则不会给已有设备补发，也不会追回已经发出的套餐包。
        </Text>
        <form onSubmit={newDeviceDefaultAccessForm.onSubmit(saveNewDeviceDefaultAccess)}>
          <Stack gap="md">
            <Select
              label="自动发放的套餐包"
              data={overview.plans.filter((plan) => plan.status === 'active').map((plan) => ({ value: plan.id, label: plan.name }))}
              {...newDeviceDefaultAccessForm.getInputProps('planId')}
            />
            <Select
              label="当前状态"
              allowDeselect={false}
              data={[{ value: 'active', label: '启用' }, { value: 'disabled', label: '停用' }]}
              {...newDeviceDefaultAccessForm.getInputProps('status')}
            />
            <Textarea
              label="发放原因（选填）"
              placeholder="例如：新设备首次接入赠送 30 天"
              rows={3}
              {...newDeviceDefaultAccessForm.getInputProps('reason')}
            />
            <Button type="submit" mt="sm" loading={submitting}>保存新设备默认权益</Button>
          </Stack>
        </form>
      </Drawer>

      <Drawer opened={editingPlan !== undefined} onClose={() => setEditingPlan(undefined)} title={editingPlan === 'new' ? '创建套餐包' : '编辑套餐包'} position="right" size={600}>
        <form onSubmit={form.onSubmit(savePlan)}>
          <Stack gap="md">
            <div className="form-grid">
              <TextInput label="套餐名称" placeholder="例如：年度个人版" {...form.getInputProps('name')} />
              <TextInput label="套餐代码" description="创建后不可修改" placeholder="yearly-personal" disabled={editingPlan !== 'new'} {...form.getInputProps('code')} />
            </div>
            <Textarea label="方案说明" placeholder="说明套餐适用场景" rows={2} {...form.getInputProps('description')} />
            <div className="form-grid">
              <Select label="期限单位" allowDeselect={false} data={[
                { value: 'day', label: '按天' }, { value: 'month', label: '按月' }, { value: 'perpetual', label: '长期有效' },
              ]} {...form.getInputProps('termUnit')} />
              {form.values.termUnit !== 'perpetual' ? (
                <NumberInput label={form.values.termUnit === 'day' ? '天数' : '月数'} min={1} max={1200} {...form.getInputProps('termValue')} />
              ) : <div />}
            </div>
            {editingPlan !== 'new' ? (
              <Select label="方案状态" allowDeselect={false} data={[
                { value: 'active', label: '可继续使用' }, { value: 'archived', label: '归档，不再发放' },
              ]} {...form.getInputProps('status')} />
            ) : null}
            <Text size="xs" c="dimmed">套餐包固定发给一台授权设备，只决定使用期限和发放来源。</Text>

            <Paper withBorder p="lg" className="form-section">
              <Title order={4}>软件内展示与销售</Title>
              <Text size="xs" c="dimmed" mt={3} mb="lg">当前可先关闭，准备对接荔枝时再补齐。</Text>
              <Stack gap="md">
                <Switch
                  label="在软件的套餐页中展示"
                  description="未填写购买地址时仍会展示套餐，但购买按钮不可点击。"
                  {...form.getInputProps('isPublic', { type: 'checkbox' })}
                />
                <Switch label="标记为推荐方案" {...form.getInputProps('recommended', { type: 'checkbox' })} />
                <div className="form-grid">
                  <TextInput label="价格文案" placeholder="例如：¥99 / 年" {...form.getInputProps('priceLabel')} />
                  <TextInput label="荔枝商品编号（预留）" placeholder="暂时可以留空" {...form.getInputProps('externalSku')} />
                </div>
                <TextInput label="购买页面地址" leftSection={<IconExternalLink size={16} />} placeholder="https://..." {...form.getInputProps('purchaseUrl')} />
              </Stack>
            </Paper>
            <Button type="submit" mt="sm" loading={submitting}>保存套餐包</Button>
          </Stack>
        </form>
      </Drawer>
    </>
  );
}
