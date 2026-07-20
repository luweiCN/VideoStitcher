import {
  Alert,
  Button,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconFingerprint, IconLock, IconShieldCheck, IconUser } from '@tabler/icons-react';
import { useState } from 'react';
import { ApiClientError, login } from '../api';
import type { AdminSession } from '../types';

interface LoginScreenProps {
  onLogin(session: AdminSession): void;
}

interface LoginValues {
  username: string;
  password: string;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const form = useForm<LoginValues>({
    initialValues: { username: '', password: '' },
    validate: {
      username: (value) => value.trim().length < 3 ? '请输入管理员用户名' : null,
      password: (value) => value.length < 10 ? '密码至少 10 个字符' : null,
    },
  });

  const handleSubmit = async (values: LoginValues) => {
    setSubmitting(true);
    setErrorMessage(undefined);
    try {
      const result = await login(values.username, values.password);
      onLogin({ token: result.sessionToken, expiresAt: result.sessionExpiresAt, admin: result.admin });
    } catch (error: unknown) {
      setErrorMessage(error instanceof ApiClientError ? error.message : '暂时无法登录，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-shell">
      <section className="login-story" aria-labelledby="login-product-title">
        <div className="login-brand">
          <span className="brand-mark light" aria-hidden="true">VS</span>
          <Text fw={700}>VideoStitcher</Text>
        </div>
        <div className="login-story-copy">
          <Title id="login-product-title" order={1}>授权设备、套餐与兑换码，一处管理</Title>
          <Text>查看真实设备使用情况，发放可追踪的套餐包，并为销售渠道生成一次性套餐码。</Text>
        </div>
        <Group gap="sm" wrap="nowrap" className="security-copy">
          <ThemeIcon variant="light" color="violet" radius="md"><IconShieldCheck size={18} /></ThemeIcon>
          <Text size="sm">账号操作均记录到审计日志，密码不会以明文保存。</Text>
        </Group>
      </section>

      <section className="login-form-side" aria-labelledby="login-title">
        <Paper className="login-form-card">
          <Stack gap="lg">
            <div>
              <Group gap="sm" mb={8}>
                <ThemeIcon variant="light" color="violet" radius="md" size="lg"><IconFingerprint size={20} /></ThemeIcon>
                <Title id="login-title" order={2}>登录管理后台</Title>
              </Group>
              <Text c="dimmed" size="sm">使用管理员用户名和密码继续</Text>
            </div>
            {errorMessage ? <Alert color="red" title={errorMessage} /> : null}
            <form onSubmit={form.onSubmit(handleSubmit)}>
              <Stack gap="md">
                <TextInput
                  label="用户名"
                  placeholder="请输入管理员用户名"
                  leftSection={<IconUser size={17} />}
                  autoComplete="username"
                  {...form.getInputProps('username')}
                />
                <PasswordInput
                  label="密码"
                  placeholder="请输入密码"
                  leftSection={<IconLock size={17} />}
                  autoComplete="current-password"
                  {...form.getInputProps('password')}
                />
                <Button type="submit" size="md" loading={submitting} fullWidth>登录</Button>
              </Stack>
            </form>
            <div className="first-login-note">
              <Text size="sm" fw={600}>首次登录</Text>
              <Text size="xs" c="dimmed">请使用初始化的所有者账号登录；成功后可为团队成员创建独立管理员账号。</Text>
            </div>
          </Stack>
        </Paper>
      </section>
    </main>
  );
}
