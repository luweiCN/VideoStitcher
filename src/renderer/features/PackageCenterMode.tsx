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
    <div className="text-slate-100">
        {loading ? (
          <div className="flex min-h-[520px] items-center justify-center" aria-live="polite">
            <LoaderCircle className="size-7 animate-spin text-violet-400" />
            <span className="ml-3 text-sm text-slate-400">正在读取套餐信息…</span>
          </div>
        ) : center ? (
          <>
            <section className="grid gap-6 py-8 lg:grid-cols-[minmax(0,1.18fr)_minmax(340px,0.82fr)]">
              <div className="rounded-xl bg-neutral-900 p-6 ring-1 ring-inset ring-slate-800 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="mb-4 flex items-center gap-2 text-sm text-slate-400">
                      <ShieldCheck className="size-4 text-violet-300" />
                      当前使用权益
                    </div>
                    <h1 className="text-2xl font-semibold tracking-[-0.025em] text-white sm:text-3xl">
                      {center.access.planName}
                    </h1>
                    <p className="mt-3 text-sm text-slate-400">
                      {center.access.mode === 'default'
                        ? center.deviceLabel
                        : `${sourceLabels[center.access.source]} · ${center.deviceLabel}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void loadCenter()}
                      title="刷新授权数据"
                      className="inline-flex size-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                    >
                      <RefreshCw className="size-4" />
                    </button>
                    <span className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                      center.authorized
                        ? 'bg-emerald-500/10 text-emerald-300'
                        : 'bg-amber-500/10 text-amber-300'
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
                <div className="mt-8 grid gap-5 border-t border-slate-800 pt-6 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-slate-500">{waitingForPackage ? '当前状态' : '可使用至'}</p>
                    <p className="mt-2 text-sm font-medium text-slate-200">
                      {waitingForPackage ? '尚未获得套餐' : formatDate(center.access.expiresAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">套餐包数量</p>
                    <p className="mt-2 text-sm font-medium text-slate-200">{center.packages.length} 个</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">等待生效</p>
                    <p className="mt-2 text-sm font-medium text-slate-200">{center.queuedPackageCount} 个</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-neutral-900 p-6 ring-1 ring-inset ring-slate-800 sm:p-7">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
                    <KeyRound className="size-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-white">兑换套餐码</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-400">购买或获赠套餐码后，可直接兑换到当前设备。</p>
                  </div>
                </div>
                <form onSubmit={(event) => void redeemCode(event)} className="mt-6">
                  <label htmlFor="package-code" className="text-xs text-slate-400">套餐兑换码</label>
                  <input
                    id="package-code"
                    value={code}
                    onChange={(event) => setCode(event.currentTarget.value.toUpperCase())}
                    placeholder="VS-XXXX-XXXX-XXXX-XXXX-XXXX"
                    autoComplete="off"
                    spellCheck={false}
                    className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-black px-3 font-mono text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                  />
                  <button
                    type="submit"
                    disabled={submitting || !code.trim()}
                    className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-medium text-white transition-colors hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? <LoaderCircle className="size-4 animate-spin" /> : <PackageCheck className="size-4" />}
                    {submitting ? '正在兑换…' : '兑换到当前设备'}
                  </button>
                </form>
                {error ? (
                  <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2.5 text-sm leading-6 text-rose-300" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
            </section>

            {plans.length > 0 ? (
              <section className="border-t border-slate-800 py-8" aria-labelledby="available-plan-title">
                <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 id="available-plan-title" className="text-lg font-semibold text-white">可购买套餐</h2>
                    <p className="mt-1 text-sm text-slate-400">购买完成后，将收到的套餐兑换码填写到上方即可。</p>
                  </div>
                  <span className="text-xs text-slate-500">一次购买，不会自动续费</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {plans.map((plan) => {
                    const purchaseUrl = isSafeExternalUrl(plan.purchaseUrl) ? plan.purchaseUrl : undefined;
                    return (
                      <article key={plan.id} className="flex flex-col rounded-xl bg-neutral-900 p-5 ring-1 ring-inset ring-slate-800">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm text-slate-400">{formatTerm(plan.term)}</span>
                          {plan.recommended ? (
                            <span className="rounded-full bg-violet-500/10 px-2 py-1 text-xs font-medium text-violet-300">推荐</span>
                          ) : null}
                        </div>
                        <h3 className="mt-4 font-semibold text-white">{plan.name}</h3>
                        {plan.priceLabel ? <p className="mt-2 text-xl font-semibold text-white">{plan.priceLabel}</p> : null}
                        <p className="mt-2 flex-1 text-sm leading-6 text-slate-400">
                          {plan.description || '购买后获得套餐兑换码，可兑换到当前设备。'}
                        </p>
                        <button
                          type="button"
                          disabled={purchaseUrl === undefined}
                          onClick={() => purchaseUrl === undefined ? undefined : void openPurchasePage(purchaseUrl)}
                          className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:cursor-not-allowed disabled:bg-slate-900 disabled:text-slate-600"
                        >
                          {purchaseUrl === undefined ? '暂未开放购买' : '前往购买'}
                          {purchaseUrl === undefined ? null : <ExternalLink className="size-3.5" aria-hidden="true" />}
                        </button>
                      </article>
                    );
                  })}
                </div>
                {purchaseError ? (
                  <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2.5 text-sm leading-6 text-rose-300" role="alert">
                    {purchaseError}
                  </p>
                ) : null}
              </section>
            ) : null}

            <section className="border-t border-slate-800 py-8" aria-labelledby="package-list-title">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 id="package-list-title" className="text-lg font-semibold text-white">我的套餐包</h2>
                  <p className="mt-1 text-sm text-slate-400">查看当前设备已兑换或获赠的套餐。</p>
                </div>
                {center.queuedPackageCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-violet-300">
                    <Clock3 className="size-3.5" />
                    {center.queuedPackageCount} 个套餐等待生效
                  </span>
                ) : null}
              </div>
              {center.packages.length === 0 ? (
                <div className="flex min-h-40 items-center justify-center rounded-xl bg-neutral-900 px-6 text-center ring-1 ring-inset ring-slate-800">
                  <div>
                    <Gift className="mx-auto size-6 text-slate-500" />
                    <p className="mt-3 text-sm font-medium text-slate-200">还没有单独兑换或发放的套餐包</p>
                    <p className="mt-1 text-sm text-slate-500">兑换或获赠套餐后，会显示在这里。</p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-800 rounded-xl bg-neutral-900 px-5 ring-1 ring-inset ring-slate-800 sm:px-6">
                  {center.packages.map((item) => (
                    <article key={item.id} className="flex flex-wrap items-start justify-between gap-4 py-5">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-300">
                          {item.source === 'paid'
                            ? <ShoppingBag className="size-4" />
                            : item.source === 'development'
                              ? <Code2 className="size-4" />
                              : <Gift className="size-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-white">{item.planName}</h3>
                            <span className={`rounded-full px-2 py-1 text-xs font-medium ${packageStatusClasses[item.status]}`}>
                              {packageStatusLabels[item.status]}
                            </span>
                            {item.source === 'development' ? (
                              <span className="rounded-full bg-cyan-500/10 px-2 py-1 text-xs font-medium text-cyan-300">
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
            </section>

            <section className="border-t border-slate-800 py-8" aria-labelledby="device-info-title">
              <div className="flex items-start gap-3">
                <Monitor className="mt-0.5 size-5 text-slate-500" />
                <div className="min-w-0 flex-1">
                  <h2 id="device-info-title" className="text-sm font-semibold text-white">当前授权设备</h2>
                  <p className="mt-1 text-sm text-slate-400">{center.device.deviceName} · {center.device.platform} · v{center.device.appVersion}</p>
                  <div className="mt-4 flex items-start gap-2 rounded-lg bg-neutral-900 p-3 ring-1 ring-inset ring-slate-800">
                    <code className="min-w-0 flex-1 break-all text-xs leading-5 text-slate-300">{machineId || '设备 ID 暂不可用'}</code>
                    <button
                      type="button"
                      onClick={() => void copyMachineId()}
                      disabled={!machineId}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-50"
                    >
                      {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                      {copied ? '已复制' : '复制'}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : (
          <div className="flex min-h-[520px] items-center justify-center px-6 text-center">
            <div>
              <KeyRound className="mx-auto size-8 text-slate-600" />
              <h1 className="mt-4 text-lg font-semibold text-white">套餐信息暂时无法读取</h1>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">{error || '请检查网络后重试。'}</p>
              <button
                type="button"
                onClick={() => void loadCenter()}
                className="mt-5 h-10 rounded-lg bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-500"
              >
                重新加载
              </button>
            </div>
          </div>
        )}
    </div>
  );
}
