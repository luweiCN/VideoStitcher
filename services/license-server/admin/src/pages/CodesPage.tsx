import {
  Alert,
  Badge,
  Button,
  Drawer,
  Group,
  NumberInput,
  Paper,
  Progress,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconCopy,
  IconDownload,
  IconEye,
  IconKey,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlus,
} from '@tabler/icons-react';
import { useState } from 'react';
import { apiRequest, getErrorMessage } from '../api';
import { formatDateTime, formatPlanTerm, packageGrantSourceLabels } from '../presentation';
import type {
  OverviewData,
  PackageGrantSource,
  RedemptionBatchRecord,
  RedemptionCodeInventory,
} from '../types';

interface CodesPageProps {
  token: string;
  overview: OverviewData;
  onChanged(): Promise<void>;
}

interface CreateBatchValues {
  name: string;
  planId: string;
  quantity: number;
  source: Extract<PackageGrantSource, 'complimentary' | 'paid'>;
  salesChannel: string;
  reason: string;
}

interface GeneratedBatch {
  batch: RedemptionBatchRecord;
  codes: string[];
}

function escapeCsv(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function CodesPage({ token, overview, onChanged }: CodesPageProps) {
  const activePlans = overview.plans.filter((plan) => plan.status === 'active');
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [inventory, setInventory] = useState<RedemptionCodeInventory>();
  const [loadingBatchId, setLoadingBatchId] = useState<string>();
  const form = useForm<CreateBatchValues>({
    initialValues: {
      name: '',
      planId: activePlans[0]?.id ?? '',
      quantity: 50,
      source: 'paid',
      salesChannel: '数码荔枝',
      reason: '',
    },
    validate: {
      name: (value) => value.trim() ? null : '请输入批次名称',
      planId: (value) => value ? null : '请选择套餐',
      quantity: (value) => Number.isInteger(value) && value >= 1 && value <= 500
        ? null
        : '每批可生成 1 到 500 个套餐码',
    },
  });

  const openCreate = () => {
    form.setValues({
      name: '',
      planId: activePlans[0]?.id ?? '',
      quantity: 50,
      source: 'paid',
      salesChannel: '数码荔枝',
      reason: '',
    });
    form.resetDirty();
    setCreateOpen(true);
  };

  const createBatch = async (values: CreateBatchValues) => {
    setSubmitting(true);
    try {
      const result = await apiRequest<GeneratedBatch>('/v1/admin/redemption-batches', {
        method: 'POST',
        token,
        body: JSON.stringify({
          ...values,
          salesChannel: values.salesChannel.trim() || undefined,
        }),
      });
      setCreateOpen(false);
      setInventory({
        batch: result.batch,
        codes: result.codes.map((code, index) => ({
          id: `new-${index}`,
          code,
          codeHint: code.slice(-4),
          status: 'available',
          createdAt: result.batch.createdAt,
        })),
      });
      notifications.show({ color: 'teal', message: `已生成 ${result.codes.length} 个套餐兑换码` });
      await onChanged();
    } catch (error: unknown) {
      notifications.show({ color: 'red', message: getErrorMessage(error, '生成套餐码批次失败') });
    } finally {
      setSubmitting(false);
    }
  };

  const openBatchCodes = async (batch: RedemptionBatchRecord) => {
    setLoadingBatchId(batch.id);
    try {
      const result = await apiRequest<RedemptionCodeInventory>(
        `/v1/admin/redemption-batches/${encodeURIComponent(batch.id)}/codes`,
        { token },
      );
      setInventory(result);
    } catch (error: unknown) {
      notifications.show({ color: 'red', message: getErrorMessage(error, '读取套餐码库存失败') });
    } finally {
      setLoadingBatchId(undefined);
    }
  };

  const copyCodes = async () => {
    if (!inventory) return;
    const availableCodes = inventory.codes.flatMap((item) => (
      item.status === 'available' && item.code !== undefined ? [item.code] : []
    ));
    if (availableCodes.length === 0) {
      notifications.show({ color: 'yellow', message: '当前没有可复制的未兑换套餐码' });
      return;
    }
    try {
      await navigator.clipboard.writeText(availableCodes.join('\n'));
      notifications.show({ color: 'teal', message: `已复制 ${availableCodes.length} 个可用套餐码` });
    } catch (error: unknown) {
      notifications.show({ color: 'red', message: getErrorMessage(error, '复制失败，请在文本框中手动复制') });
    }
  };

  const downloadCsv = () => {
    if (!inventory) return;
    const rows = [
      ['套餐兑换码', '尾号', '状态', '兑换时间', '套餐', '批次', '销售渠道'],
      ...inventory.codes.map((item) => [
        item.code ?? '',
        item.codeHint,
        item.status === 'available' ? '可用' : '已兑换',
        item.redeemedAt ?? '',
        inventory.batch.planName,
        inventory.batch.name,
        inventory.batch.salesChannel ?? '',
      ]),
    ];
    const csv = `\ufeff${rows.map((row) => row.map(escapeCsv).join(',')).join('\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${inventory.batch.name.replaceAll(/[\\/:*?"<>|]/g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const changeBatchStatus = (batch: RedemptionBatchRecord) => {
    const nextStatus = batch.status === 'active' ? 'disabled' : 'active';
    const action = nextStatus === 'active' ? '恢复' : '暂停';
    modals.openConfirmModal({
      title: `${action}“${batch.name}”？`,
      children: (
        <Text size="sm" c="dimmed">
          {nextStatus === 'disabled'
            ? '暂停后，尚未兑换的套餐码会立即不可用；已经兑换形成的套餐包不受影响。'
            : '恢复后，这一批尚未使用的套餐码可以继续兑换。'}
        </Text>
      ),
      labels: { confirm: action, cancel: '取消' },
      confirmProps: { color: nextStatus === 'disabled' ? 'orange' : 'violet' },
      onConfirm: async () => {
        try {
          await apiRequest(`/v1/admin/redemption-batches/${encodeURIComponent(batch.id)}`, {
            method: 'PUT',
            token,
            body: JSON.stringify({
              status: nextStatus,
              reason: `管理员在后台${action}套餐码批次`,
            }),
          });
          notifications.show({ color: 'teal', message: `已${action}套餐码批次` });
          await onChanged();
        } catch (error: unknown) {
          notifications.show({ color: 'red', message: getErrorMessage(error, `${action}批次失败`) });
        }
      },
    });
  };

  return (
    <Stack gap="lg">
      <Alert color="violet" variant="light" icon={<IconKey size={18} />} title="销售渠道只负责交付套餐码">
        套餐码与套餐模板在生成时绑定。可把导出的 CSV 上传到数码荔枝等渠道，用户付款后自行在客户端兑换。
      </Alert>

      <Paper withBorder className="surface table-surface">
        <Group justify="space-between" align="flex-end" wrap="nowrap" className="table-toolbar">
          <div>
            <Text fw={650}>套餐码批次</Text>
            <Text size="sm" c="dimmed" mt={3}>跟踪每批库存、核销进度和销售渠道</Text>
          </div>
          <Button leftSection={<IconPlus size={17} />} onClick={openCreate} disabled={activePlans.length === 0}>
            生成一批套餐码
          </Button>
        </Group>
        <ScrollArea>
          <Table verticalSpacing="md" horizontalSpacing="lg" highlightOnHover miw={1040}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>批次</Table.Th>
                <Table.Th>套餐</Table.Th>
                <Table.Th>渠道</Table.Th>
                <Table.Th>发放类型</Table.Th>
                <Table.Th>核销进度</Table.Th>
                <Table.Th>状态</Table.Th>
                <Table.Th>创建时间</Table.Th>
                <Table.Th className="table-action-column">操作</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(overview.redemptionBatches ?? []).map((batch) => {
                const percentage = batch.quantity === 0
                  ? 0
                  : Math.round((batch.redeemedCount / batch.quantity) * 100);
                return (
                  <Table.Tr key={batch.id}>
                    <Table.Td>
                      <Text size="sm" fw={600}>{batch.name}</Text>
                      <Text size="xs" c="dimmed">共 {batch.quantity} 个码</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{batch.planName}</Text>
                      <Text size="xs" c="dimmed">{formatPlanTerm(batch.term)}</Text>
                    </Table.Td>
                    <Table.Td><Text size="sm">{batch.salesChannel || '内部发放'}</Text></Table.Td>
                    <Table.Td><Text size="sm">{packageGrantSourceLabels[batch.source]}</Text></Table.Td>
                    <Table.Td>
                      <div className="batch-progress">
                        <Group justify="space-between" mb={5} wrap="nowrap">
                          <Text size="xs" c="dimmed">已兑 {batch.redeemedCount}</Text>
                          <Text size="xs" c="dimmed">剩余 {batch.availableCount}</Text>
                        </Group>
                        <Progress value={percentage} size={5} color="violet" />
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={batch.status === 'active' ? 'teal' : 'gray'} variant="light">
                        {batch.status === 'active' ? '可兑换' : '已暂停'}
                      </Badge>
                    </Table.Td>
                    <Table.Td><Text size="sm" c="dimmed" className="nowrap">{formatDateTime(batch.createdAt)}</Text></Table.Td>
                    <Table.Td className="table-action-column">
                      <Group gap={4} wrap="nowrap" justify="flex-end">
                        <Button
                          variant="subtle"
                          color="violet"
                          size="compact-sm"
                          leftSection={<IconEye size={15} />}
                          loading={loadingBatchId === batch.id}
                          onClick={() => void openBatchCodes(batch)}
                        >
                          查看代码
                        </Button>
                        <Button
                          variant="subtle"
                          color={batch.status === 'active' ? 'orange' : 'teal'}
                          size="compact-sm"
                          leftSection={batch.status === 'active' ? <IconPlayerPause size={15} /> : <IconPlayerPlay size={15} />}
                          onClick={() => changeBatchStatus(batch)}
                        >
                          {batch.status === 'active' ? '暂停' : '恢复'}
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea>
        <Group justify="space-between" className="table-footer">
          <Text size="xs" c="dimmed">共 {(overview.redemptionBatches ?? []).length} 个批次</Text>
          {(overview.redemptionBatches ?? []).length === 0 ? (
            <Text size="xs" c="dimmed">尚未生成套餐兑换码</Text>
          ) : null}
        </Group>
      </Paper>

      <Drawer opened={createOpen} onClose={() => setCreateOpen(false)} title="生成套餐码批次" position="right" size={540}>
        <Text size="sm" c="dimmed" mb="lg">
          套餐规则会在生成时固化。创建后可随时从批次列表查看、复制或导出套餐码。
        </Text>
        <form onSubmit={form.onSubmit(createBatch)}>
          <Stack gap="md">
            <TextInput label="批次名称" placeholder="例如：2026 年 8 月月度套餐" {...form.getInputProps('name')} />
            <Select
              label="对应套餐"
              placeholder="选择套餐模板"
              data={activePlans.map((plan) => ({ value: plan.id, label: `${plan.name} · ${formatPlanTerm(plan.term)}` }))}
              {...form.getInputProps('planId')}
            />
            <NumberInput
              label="生成数量"
              description="每批最多 500 个；需要更多时可创建多个批次。"
              min={1}
              max={500}
              clampBehavior="strict"
              {...form.getInputProps('quantity')}
            />
            <Select
              label="套餐来源"
              allowDeselect={false}
              data={[
                { value: 'paid', label: '购买兑换' },
                { value: 'complimentary', label: '运营赠送' },
              ]}
              {...form.getInputProps('source')}
            />
            <TextInput label="销售渠道（选填）" placeholder="例如：数码荔枝" {...form.getInputProps('salesChannel')} />
            <Textarea label="生成原因（选填）" placeholder="例如：准备上线月度套餐商品" rows={3} {...form.getInputProps('reason')} />
            <Button type="submit" mt="sm" loading={submitting}>生成套餐兑换码</Button>
          </Stack>
        </form>
      </Drawer>

      <Drawer
        opened={inventory !== undefined}
        onClose={() => setInventory(undefined)}
        title="套餐码库存"
        position="right"
        size={680}
      >
        {inventory ? (
          <Stack gap="lg">
            {inventory.codes.some((item) => item.code === undefined) ? (
              <Alert color="yellow" title="部分旧套餐码无法还原">
                这些套餐码生成时未保存可查看内容，当前只能看到尾号和核销状态；新生成的批次不受影响。
              </Alert>
            ) : null}
            <Group justify="space-between" wrap="nowrap">
              <div>
                <Text fw={650}>{inventory.batch.name}</Text>
                <Text size="sm" c="dimmed">
                  {inventory.batch.planName} · {inventory.batch.availableCount} 个可用 · {inventory.batch.redeemedCount} 个已兑换
                </Text>
              </div>
              <Group gap="xs" wrap="nowrap">
                <Button variant="light" leftSection={<IconCopy size={16} />} onClick={() => void copyCodes()}>复制可用码</Button>
                <Button leftSection={<IconDownload size={16} />} onClick={downloadCsv}>导出 CSV</Button>
              </Group>
            </Group>
            <ScrollArea h="calc(100vh - 220px)">
              <Table verticalSpacing="sm" horizontalSpacing="md" stickyHeader>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>套餐兑换码</Table.Th>
                    <Table.Th>状态</Table.Th>
                    <Table.Th>兑换时间</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {inventory.codes.map((item) => (
                    <Table.Tr key={item.id}>
                      <Table.Td>
                        <Text size="sm" ff="monospace" className="nowrap">
                          {item.code ?? `旧数据 · 尾号 ${item.codeHint}`}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={item.status === 'available' ? 'teal' : 'gray'} variant="light">
                          {item.status === 'available' ? '可用' : '已兑换'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed" className="nowrap">{formatDateTime(item.redeemedAt)}</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Stack>
        ) : null}
      </Drawer>
    </Stack>
  );
}
