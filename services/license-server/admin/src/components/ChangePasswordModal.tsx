import { Button, Group, Modal, PasswordInput, Stack, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { apiRequest, getErrorMessage } from '../api';

interface ChangePasswordModalProps {
  opened: boolean;
  token: string;
  onClose(): void;
  onChanged(): void;
}

interface ChangePasswordValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function ChangePasswordModal({
  opened,
  token,
  onClose,
  onChanged,
}: ChangePasswordModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<ChangePasswordValues>({
    initialValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    validate: {
      currentPassword: (value) => value.length >= 10 ? null : '请输入当前密码',
      newPassword: (value, values) => {
        if (value.length < 10 || value.length > 128) return '新密码需为 10 到 128 个字符';
        return value === values.currentPassword ? '新密码不能与当前密码相同' : null;
      },
      confirmPassword: (value, values) => value === values.newPassword ? null : '两次输入的新密码不一致',
    },
  });

  const close = () => {
    if (submitting) return;
    form.reset();
    onClose();
  };

  const submit = async (values: ChangePasswordValues) => {
    setSubmitting(true);
    try {
      await apiRequest('/v1/admin/auth/password', {
        method: 'POST',
        token,
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      });
      notifications.show({ color: 'teal', message: '密码已修改，请使用新密码重新登录' });
      form.reset();
      onChanged();
    } catch (error: unknown) {
      notifications.show({ color: 'red', message: getErrorMessage(error, '修改密码失败') });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal opened={opened} onClose={close} title="修改登录密码" centered size="md">
      <form onSubmit={form.onSubmit((values) => void submit(values))}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            修改成功后，当前账号在其他浏览器中的后台会话也会立即失效。
          </Text>
          <PasswordInput
            label="当前密码"
            autoComplete="current-password"
            {...form.getInputProps('currentPassword')}
          />
          <PasswordInput
            label="新密码"
            description="10 到 128 个字符"
            autoComplete="new-password"
            {...form.getInputProps('newPassword')}
          />
          <PasswordInput
            label="确认新密码"
            autoComplete="new-password"
            {...form.getInputProps('confirmPassword')}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={close} disabled={submitting}>取消</Button>
            <Button type="submit" loading={submitting}>修改密码</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
