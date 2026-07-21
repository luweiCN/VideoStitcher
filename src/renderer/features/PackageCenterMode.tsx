import { useEffect, useState } from 'react';
import {
  Check,
  Code2,
  Clock3,
  Copy,
  ExternalLink,
  Gift,
  KeyRound,
  LoaderCircle,
  Monitor,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react';
import type {
  LicenseAccessSource,
  LicensePackageCenter,
  LicensePackageStatus,
  LicensePackageSummary,
  PublicLicensePlan,
} from '@shared/types/license';
import { useToastMessages } from '@/components/Toast';

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const sourceLabels: Record<LicenseAccessSource, string> = {
  none: '尚未获得权益',
  trial: '历史试用',
  complimentary: '运营赠送',
  paid: '购买兑换',
  legacy: '历史授权',
  development: '本地开发',
};

const packageStatusLabels: Record<LicensePackageStatus, string> = {
  active: '使用中',
  queued: '待生效',
  completed: '已用完',
  withdrawn: '已撤回',
};

const packageStatusClasses: Record<LicensePackageStatus, string> = {
  active: 'bg-emerald-500/10 text-emerald-300',
  queued: 'bg-violet-500/10 text-violet-300',
  completed: 'bg-slate-800 text-slate-400',
  withdrawn: 'bg-rose-500/10 text-rose-300',
};

function formatDate(value?: string): string {
  return value ? dateFormatter.format(new Date(value)) : '长期有效';
}

function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

function formatTerm(term: PublicLicensePlan['term']): string {
  if (term.unit === 'perpetual') return '长期有效';
  return `${term.value} ${term.unit === 'day' ? '天' : '个月'}`;
}

function isSafeExternalUrl(value: string | undefined): value is string {
  if (value === undefined) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function packageSchedule(item: LicensePackageSummary): string {
  if (item.source === 'development') return '仅供本地开发测试';
  if (item.status === 'withdrawn') return '已撤回';
  if (item.status === 'queued') return '待生效';
  if (item.status === 'active') return `有效期至 ${formatDate(item.expiresAt)}`;
  return '已结束';
}

export default function PackageCenterMode() {
  const toast = useToastMessages();
  const [center, setCenter] = useState<LicensePackageCenter>();
  const [plans, setPlans] = useState<PublicLicensePlan[]>([]);
  const [machineId, setMachineId] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [purchaseError, setPurchaseError] = useState('');
  const [copied, setCopied] = useState(false);

  const loadCenter = async () => {
    setLoading(true);
    setError('');
    setPurchaseError('');
    try {
      const [machineResult, centerResult, planResult] = await Promise.all([
        window.api.getMachineId(),
        window.api.getLicensePackageCenter(),
        window.api.getPublicLicensePlans(),
      ]);
      if (machineResult.success && machineResult.machineId) setMachineId(machineResult.machineId);
      if (!centerResult.success) throw new Error(centerResult.error);
      setCenter(centerResult.center);
      if (planResult.success) setPlans(planResult.plans);
      else setPurchaseError(planResult.error || '可购买套餐加载失败');
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : '软件授权信息加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCenter();
  }, []);

  const redeemCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!code.trim()) {
      setError('请输入套餐兑换码');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const result = await window.api.redeemLicensePackageCode(code.trim());
      if (!result.success) throw new Error(result.error);
      setCenter(result.center);
      setCode('');
      if (result.alreadyRedeemed) {
        toast.info('该套餐码已兑换到当前设备，无需重复操作。', '无需重复兑换');
      } else {
        toast.success('套餐已添加到当前设备。', '兑换成功');
      }
    } catch (redeemError: unknown) {
      setError(redeemError instanceof Error ? redeemError.message : '套餐兑换失败');
    } finally {
      setSubmitting(false);
    }
  };

  const copyMachineId = async () => {
    if (!machineId) return;
    try {
      await navigator.clipboard.writeText(machineId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('复制失败，请手动选择设备 ID');
    }
  };

  const openPurchasePage = async (url: string) => {
    setPurchaseError('');
    const result = await window.api.openExternal(url);
    if (!result.success) setPurchaseError(result.error || '无法打开购买页面');
  };

  const waitingForPackage = center?.access.mode === 'none' && center.access.source === 'none';

  return (
    <div className="space-y-6 text-slate-100">
      {loading ? (
        <div
          className="relative min-h-[420px] overflow-hidden rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/50 to-slate-800/30 backdrop-blur-sm"
          aria-live="polite"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600/5 to-purple-600/5" aria-hidden="true" />
          <div className="relative flex min-h-[420px] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 shadow-xl shadow-violet-600/20">
                <LoaderCircle className="size-7 animate-spin text-white motion-reduce:animate-none" />
              </div>
              <p className="mt-4 text-sm font-medium text-slate-300">正在读取授权信息…</p>
              <p className="mt-1 text-xs text-slate-500">正在同步当前权益和套餐包</p>
            </div>
          </div>
        </div>
      ) : center ? (
        <>
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(340px,0.82fr)]">
            <div className="group relative overflow-hidden rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/50 to-slate-800/30 backdrop-blur-sm">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600/5 to-purple-600/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100 motion-reduce:transition-none" aria-hidden="true" />
              <div className="relative p-6 sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 shadow-xl shadow-violet-600/20">
                      <ShieldCheck className="size-7 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">当前使用权益</h2>
                      <p className="mt-0.5 text-sm text-slate-500">当前设备正在使用的套餐</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void loadCenter()}
                      aria-label="刷新授权数据"
                      title="刷新授权数据"
                      className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-800/80 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 motion-reduce:transition-none"
                    >
                      <RefreshCw className="size-4" />
                    </button>
                    <span className={`rounded-xl border px-3 py-1.5 text-sm font-medium ${
                      center.authorized
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                    }`}>
                      {center.authorized
                        ? '当前可用'
                        : waitingForPackage
                          ? '等待授权'
                          : center.access.status === 'expired'
                            ? '已到期'
                            : '当前不可用'}
                    </span>
                  </div>
                </div>

                <div className="mt-8 rounded-xl border border-violet-500/20 bg-gradient-to-r from-violet-500/10 to-purple-500/10 p-5">
                  <h1 className="text-2xl font-bold tracking-[-0.025em] text-white sm:text-3xl">
                    {center.access.planName}
                  </h1>
                  <p className="mt-2 text-sm text-slate-400">
                    {center.access.mode === 'default'
                      ? center.deviceLabel
                      : `${sourceLabels[center.access.source]} · ${center.deviceLabel}`}
                  </p>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-800/50 bg-slate-950/50 p-4">
                    <p className="text-xs text-slate-500">{waitingForPackage ? '当前状态' : '可使用至'}</p>
                    <p className="mt-1.5 text-sm font-medium text-white">
                      {waitingForPackage ? '尚未获得套餐' : formatDate(center.access.expiresAt)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800/50 bg-slate-950/50 p-4">
                    <p className="text-xs text-slate-500">套餐包数量</p>
                    <p className="mt-1.5 text-sm font-medium text-white">{center.packages.length} 个</p>
                  </div>
                  <div className="rounded-xl border border-slate-800/50 bg-slate-950/50 p-4">
                    <p className="text-xs text-slate-500">等待生效</p>
                    <p className="mt-1.5 text-sm font-medium text-white">{center.queuedPackageCount} 个</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/50 to-slate-800/30 backdrop-blur-sm">
              <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600/5 to-violet-600/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100 motion-reduce:transition-none" aria-hidden="true" />
              <div className="relative p-6 sm:p-8">
                <div className="flex items-center gap-4">
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-600 to-violet-600 shadow-xl shadow-fuchsia-600/20">
                    <KeyRound className="size-7 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">兑换套餐码</h2>
                    <p className="mt-0.5 text-sm text-slate-500">将套餐添加到当前设备</p>
                  </div>
                </div>

                <form onSubmit={(event) => void redeemCode(event)} className="mt-8">
                  <label htmlFor="package-code" className="text-sm font-medium text-slate-300">套餐兑换码</label>
                  <input
                    id="package-code"
                    value={code}
                    onChange={(event) => setCode(event.currentTarget.value.toUpperCase())}
                    placeholder="VS-XXXX-XXXX-XXXX-XXXX-XXXX"
                    autoComplete="off"
                    spellCheck={false}
                    className="mt-2 h-12 w-full rounded-xl border border-slate-700/70 bg-slate-950/70 px-4 font-mono text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 motion-reduce:transition-none"
                  />
                  <p className="mt-2 text-xs leading-5 text-slate-500">购买或获赠套餐码后，可直接在这里兑换。</p>
                  <button
                    type="submit"
                    disabled={submitting || !code.trim()}
                    className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 text-sm font-medium text-white shadow-lg shadow-violet-600/20 transition-all hover:from-violet-500 hover:to-purple-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:shadow-none motion-reduce:transition-none"
                  >
                    {submitting ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : <PackageCheck className="size-4" />}
                    {submitting ? '正在兑换…' : '兑换到当前设备'}
                  </button>
                </form>
                {error ? (
                  <p className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm leading-6 text-rose-300" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          {plans.length > 0 ? (
            <section className="group relative overflow-hidden rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/50 to-slate-800/30 backdrop-blur-sm" aria-labelledby="available-plan-title">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600/5 to-pink-600/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100 motion-reduce:transition-none" aria-hidden="true" />
              <div className="relative p-6 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 shadow-xl shadow-purple-600/20">
                      <ShoppingBag className="size-7 text-white" />
                    </div>
                    <div>
                      <h2 id="available-plan-title" className="text-xl font-bold text-white">可购买套餐</h2>
                      <p className="mt-0.5 text-sm text-slate-500">购买后使用套餐码在当前设备兑换</p>
                    </div>
                  </div>
                  <span className="rounded-xl border border-slate-700/50 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">
                    一次购买，不会自动续费
                  </span>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {plans.map((plan) => {
                    const purchaseUrl = isSafeExternalUrl(plan.purchaseUrl) ? plan.purchaseUrl : undefined;
                    return (
                      <article key={plan.id} className="flex flex-col rounded-xl border border-slate-800/50 bg-slate-950/50 p-5 transition-colors hover:border-violet-500/30 motion-reduce:transition-none">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm text-slate-400">{formatTerm(plan.term)}</span>
                          {plan.recommended ? (
                            <span className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-xs font-medium text-violet-300">推荐</span>
                          ) : null}
                        </div>
                        <h3 className="mt-4 text-base font-bold text-white">{plan.name}</h3>
                        {plan.priceLabel ? <p className="mt-2 text-2xl font-bold text-white">{plan.priceLabel}</p> : null}
                        <p className="mt-2 flex-1 text-sm leading-6 text-slate-400">
                          {plan.description || '购买后获得套餐兑换码，可兑换到当前设备。'}
                        </p>
                        <button
                          type="button"
                          disabled={purchaseUrl === undefined}
                          onClick={() => purchaseUrl === undefined ? undefined : void openPurchasePage(purchaseUrl)}
                          className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 text-sm font-medium text-white transition-all hover:from-violet-500 hover:to-purple-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 motion-reduce:transition-none"
                        >
                          {purchaseUrl === undefined ? '暂未开放购买' : '前往购买'}
                          {purchaseUrl === undefined ? null : <ExternalLink className="size-3.5" aria-hidden="true" />}
                        </button>
                      </article>
                    );
                  })}
                </div>
                {purchaseError ? (
                  <p className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm leading-6 text-rose-300" role="alert">
                    {purchaseError}
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="group relative overflow-hidden rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/50 to-slate-800/30 backdrop-blur-sm" aria-labelledby="package-list-title">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-600/5 to-indigo-600/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100 motion-reduce:transition-none" aria-hidden="true" />
            <div className="relative p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-xl shadow-violet-600/20">
                    <Gift className="size-7 text-white" />
                  </div>
                  <div>
                    <h2 id="package-list-title" className="text-xl font-bold text-white">我的套餐包</h2>
                    <p className="mt-0.5 text-sm text-slate-500">当前设备已兑换或获赠的全部套餐</p>
                  </div>
                </div>
                {center.queuedPackageCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs text-violet-300">
                    <Clock3 className="size-3.5" />
                    {center.queuedPackageCount} 个套餐等待生效
                  </span>
                ) : null}
              </div>

              {center.packages.length === 0 ? (
                <div className="mt-8 flex min-h-40 items-center justify-center rounded-xl border border-slate-800/50 bg-slate-950/50 px-6 text-center">
                  <div>
                    <Gift className="mx-auto size-7 text-slate-500" />
                    <p className="mt-3 text-sm font-medium text-slate-200">还没有单独兑换或发放的套餐包</p>
                    <p className="mt-1 text-sm text-slate-500">兑换或获赠套餐后，会显示在这里。</p>
                  </div>
                </div>
              ) : (
                <div className="mt-8 divide-y divide-slate-800/70 overflow-hidden rounded-xl border border-slate-800/50 bg-slate-950/50 px-5 sm:px-6">
                  {center.packages.map((item) => (
                    <article key={item.id} className="flex flex-wrap items-start justify-between gap-4 py-5">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
                          {item.source === 'paid'
                            ? <ShoppingBag className="size-5" />
                            : item.source === 'development'
                              ? <Code2 className="size-5" />
                              : <Gift className="size-5" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-white">{item.planName}</h3>
                            <span className={`rounded-lg px-2 py-1 text-xs font-medium ${packageStatusClasses[item.status]}`}>
                              {packageStatusLabels[item.status]}
                            </span>
                            {item.source === 'development' ? (
                              <span className="rounded-lg bg-cyan-500/10 px-2 py-1 text-xs font-medium text-cyan-300">
                                仅本地
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm text-slate-400">{packageSchedule(item)}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.source === 'development'
                              ? '本地开发 · 长期有效'
                              : `${sourceLabels[item.source]} · ${formatTerm(item.term)} · ${formatDateTime(item.assignedAt)} 加入`}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="group relative overflow-hidden rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/50 to-slate-800/30 backdrop-blur-sm" aria-labelledby="device-info-title">
            <div className="absolute inset-0 bg-gradient-to-r from-slate-600/5 to-violet-600/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100 motion-reduce:transition-none" aria-hidden="true" />
            <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(240px,0.7fr)_minmax(0,1.3fr)] lg:items-center">
              <div className="flex items-center gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 to-violet-600 shadow-lg shadow-violet-600/10">
                  <Monitor className="size-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 id="device-info-title" className="text-lg font-bold text-white">当前授权设备</h2>
                  <p className="mt-1 truncate text-sm text-slate-400">{center.device.deviceName}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{center.device.platform} · v{center.device.appVersion}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-slate-800/50 bg-slate-950/50 p-3">
                <code className="min-w-0 flex-1 break-all text-xs leading-5 text-slate-300">{machineId || '设备 ID 暂不可用'}</code>
                <button
                  type="button"
                  onClick={() => void copyMachineId()}
                  disabled={!machineId}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                >
                  {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                  {copied ? '已复制' : '复制'}
                </button>
              </div>
            </div>
          </section>
        </>
      ) : (
        <div className="group relative min-h-[420px] overflow-hidden rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/50 to-slate-800/30 backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-rose-600/5 to-violet-600/5" aria-hidden="true" />
          <div className="relative flex min-h-[420px] items-center justify-center px-6 text-center">
            <div>
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800">
                <KeyRound className="size-7 text-slate-300" />
              </div>
              <h1 className="mt-4 text-xl font-bold text-white">套餐信息暂时无法读取</h1>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">{error || '请检查网络后重试。'}</p>
              <button
                type="button"
                onClick={() => void loadCenter()}
                className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-5 text-sm font-medium text-white transition-all hover:from-violet-500 hover:to-purple-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 motion-reduce:transition-none"
              >
                <RefreshCw className="size-4" />
                重新加载
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
