import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarClock,
  Check,
  Copy,
  ExternalLink,
  LoaderCircle,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Users,
  WifiOff,
} from 'lucide-react';
import licenseRuntimeConfig from '@shared/config/license-runtime.json';
import type { PublicLicensePlan } from '@shared/types/license';
import { useHomeSkin } from '@/hooks/useHomeSkin';

interface LicenseStatusView {
  authorized: boolean;
  reason?: string;
  offline?: boolean;
  developmentMode?: boolean;
  needsOnlineVerification?: boolean;
  entitlementExpired?: boolean;
  accessSource?: 'none' | 'trial' | 'complimentary' | 'paid' | 'legacy';
}

function isSafeExternalUrl(value: string | undefined): value is string {
  if (value === undefined) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function formatPlanTerm(plan: PublicLicensePlan): string {
  if (plan.term.unit === 'perpetual') return '长期有效';
  if (plan.term.unit === 'day') return `${plan.term.value} 天`;
  return `${plan.term.value} 个月`;
}

const UnauthorizedMode = () => {
  const navigate = useNavigate();
  const { workspaceSkinClassName } = useHomeSkin();
  const [machineId, setMachineId] = useState('');
  const [plans, setPlans] = useState<PublicLicensePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [copiedField, setCopiedField] = useState<'machine' | 'group' | null>(null);
  const [actionError, setActionError] = useState('');
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatusView>({ authorized: false });

  const community = licenseRuntimeConfig.community;
  const communityUrl = isSafeExternalUrl(community.qqGroupUrl) ? community.qqGroupUrl : undefined;
  useEffect(() => {
    const loadAccessState = async () => {
      try {
        const [machineResult, planResult, statusResult] = await Promise.all([
          window.api.getMachineId(),
          window.api.getPublicLicensePlans(),
          window.api.checkLicense({ forceRefresh: true }),
        ]);
        if (machineResult.success && machineResult.machineId) setMachineId(machineResult.machineId);
        if (planResult.success) setPlans(planResult.plans);
        setLicenseStatus({
          authorized: statusResult.authorized,
          reason: statusResult.reason,
          offline: statusResult.offlineMode,
          developmentMode: statusResult.developmentMode,
          needsOnlineVerification: statusResult.needsOnlineVerification,
          entitlementExpired: statusResult.entitlementExpired,
          accessSource: statusResult.accessSource,
        });
        if (statusResult.authorized) navigate('/', { replace: true });
      } catch (error: unknown) {
        console.error('加载授权状态失败:', error);
      } finally {
        setLoading(false);
      }
    };
    void loadAccessState();
  }, [navigate]);

  const checkLicenseStatus = async () => {
    setChecking(true);
    setActionError('');
    try {
      const result = await window.api.checkLicense({ forceRefresh: true });
      setLicenseStatus({
        authorized: result.authorized,
        reason: result.reason,
        offline: result.offlineMode,
        developmentMode: result.developmentMode,
        needsOnlineVerification: result.needsOnlineVerification,
        entitlementExpired: result.entitlementExpired,
        accessSource: result.accessSource,
      });
      if (result.authorized) navigate('/', { replace: true });
    } catch (error: unknown) {
      console.error('检查授权失败:', error);
      setActionError('暂时无法连接授权服务，请检查网络后重试。');
    } finally {
      setChecking(false);
    }
  };

  const copyText = async (value: string, field: 'machine' | 'group') => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(null), 2000);
    } catch (error: unknown) {
      console.error('复制失败:', error);
      setActionError('复制失败，请手动选择文字复制。');
    }
  };

  const openExternal = async (url: string, errorMessage: string) => {
    setActionError('');
    const result = await window.api.openExternal(url);
    if (!result.success) setActionError(result.error || errorMessage);
  };

  const needsOnlineVerification = licenseStatus.needsOnlineVerification === true;
  const entitlementExpired = licenseStatus.entitlementExpired === true;
  const statusTitle = needsOnlineVerification
    ? '需要联网验证'
    : entitlementExpired
      ? '当前套餐已到期'
      : '当前没有可用套餐';
  const statusDescription = needsOnlineVerification
    ? licenseStatus.reason || '请连接网络，确认当前授权状态后再继续使用。'
    : entitlementExpired
      ? '你可以续费或兑换新的套餐，完成后即可继续使用。'
      : licenseStatus.reason || '请先获取套餐兑换码，再到软件授权页自助兑换。';

  return (
    <div className={`${workspaceSkinClassName} min-h-screen overflow-y-auto bg-black text-slate-100`}>
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex items-center justify-between border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-violet-600 text-white">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">VideoStitcher</p>
              <p className="text-xs text-slate-500">设备授权中心</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
            处理素材不会上传
          </div>
        </header>

        <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[minmax(0,1.12fr)_minmax(340px,0.88fr)] lg:gap-16">
          <div className="max-w-2xl">
            <div className={`mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${
              needsOnlineVerification || entitlementExpired
                ? 'bg-amber-500/10 text-amber-300'
                : 'bg-violet-500/10 text-violet-300'
            }`}>
              {needsOnlineVerification
                ? <WifiOff className="size-4" />
                : entitlementExpired
                  ? <CalendarClock className="size-4" />
                  : <Users className="size-4" />}
              {needsOnlineVerification ? '等待联网验证' : entitlementExpired ? '套餐已到期' : '等待授权'}
            </div>
            <h1 className="max-w-xl text-3xl font-semibold tracking-[-0.025em] text-white sm:text-4xl">
              {statusTitle}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              {statusDescription}
            </p>

            {!needsOnlineVerification ? <div className="mt-8 border-y border-slate-800 py-6">
              <div className="flex items-start gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-violet-300">
                  <Users className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-white">加入用户群，领取套餐兑换码</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    当前免费阶段可联系管理员领取套餐兑换码，再到“软件授权”页自助兑换。
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {communityUrl ? (
                      <button
                        type="button"
                        onClick={() => void openExternal(communityUrl, '无法打开 QQ 群链接')}
                        className="inline-flex h-10 items-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-medium text-white transition-colors hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-50"
                      >
                        <Users className="size-4" aria-hidden="true" />
                        加入 QQ 群
                        <ExternalLink className="size-3.5" aria-hidden="true" />
                      </button>
                    ) : null}
                    {community.qqGroupNumber ? (
                      <button
                        type="button"
                        onClick={() => void copyText(community.qqGroupNumber, 'group')}
                        className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                      >
                        {copiedField === 'group' ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
                        QQ 群 {community.qqGroupNumber}
                      </button>
                    ) : (
                      <span className="text-sm text-slate-500">请联系软件提供方获取 QQ 群信息</span>
                    )}
                  </div>
                </div>
              </div>
            </div> : null}

            <div className="mt-7">
              <div className="mb-2 flex items-center justify-between gap-4 text-xs text-slate-500">
                <span>本机设备 ID</span>
                <button
                  type="button"
                  onClick={() => void copyText(machineId, 'machine')}
                  disabled={!machineId}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-slate-400 transition-colors hover:bg-slate-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {copiedField === 'machine' ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                  {copiedField === 'machine' ? '已复制' : '复制'}
                </button>
              </div>
              <div className="min-h-11 break-all rounded-lg bg-slate-950 px-3 py-3 font-mono text-xs leading-5 text-slate-300 ring-1 ring-inset ring-slate-800">
                {loading ? '正在读取设备信息…' : machineId || '设备 ID 获取失败'}
              </div>
            </div>
          </div>

          <aside className="rounded-xl bg-neutral-900 p-6 ring-1 ring-inset ring-slate-800 sm:p-7" aria-labelledby="access-title">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="access-title" className="text-lg font-semibold text-white">
                  {needsOnlineVerification ? '联网验证' : '开通步骤'}
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  {needsOnlineVerification
                    ? '连接网络后重新检查，服务器确认套餐状态后再决定是否需要续费。'
                    : '免费领取或购买套餐码后，在当前设备上自助兑换。'}
                </p>
              </div>
              <ShieldCheck className="size-5 text-slate-500" aria-hidden="true" />
            </div>

            {!needsOnlineVerification ? <ol className="mt-6 space-y-4 text-sm leading-6 text-slate-300">
              <li className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs">1</span><span>加入 QQ 群免费领取，或选择下方套餐购买。</span></li>
              <li className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs">2</span><span>获取一次性套餐兑换码。</span></li>
              <li className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs">3</span><span>打开“软件授权”，把兑换码兑换到当前设备。</span></li>
            </ol> : (
              <div className="mt-6 rounded-lg bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-200">
                当前只要求联网验证，不会在验证完成前判断套餐已经到期。
              </div>
            )}

            <div className="my-6 h-px bg-slate-800" />

            {!needsOnlineVerification ? <button
              type="button"
              onClick={() => navigate('/admin?tab=license')}
              className="mb-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-medium text-white transition-colors hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              <KeyRound className="size-4" />
              兑换套餐码或查看套餐
            </button> : null}

            <button
              type="button"
              onClick={() => void checkLicenseStatus()}
              disabled={checking}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {checking ? <LoaderCircle className="size-4 motion-safe:animate-spin" /> : <RefreshCw className="size-4" />}
              {checking ? '正在检查…' : '重新检查使用权限'}
            </button>

            {licenseStatus.needsOnlineVerification ? (
              <p className="mt-4 text-sm leading-6 text-amber-300">当前授权状态需要联网确认。</p>
            ) : null}
            {licenseStatus.offline && !licenseStatus.needsOnlineVerification ? (
              <p className="mt-4 text-sm leading-6 text-amber-300">当前正在使用离线缓存授权。</p>
            ) : null}
            {actionError ? (
              <p className="mt-4 text-sm leading-6 text-rose-300" role="alert">{actionError}</p>
            ) : null}
          </aside>
        </section>

        {!needsOnlineVerification && plans.length > 0 ? (
          <section className="border-t border-slate-800 py-8" aria-labelledby="public-plan-title">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="public-plan-title" className="text-lg font-semibold text-white">可选套餐</h2>
                <p className="mt-1 text-sm text-slate-400">一次购买，不会自动续费或连续扣款。</p>
              </div>
              <span className="text-xs text-slate-500">购买后在“软件授权”中自行兑换</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => {
                const purchaseUrl = isSafeExternalUrl(plan.purchaseUrl) ? plan.purchaseUrl : undefined;
                return (
                  <article key={plan.id} className="flex flex-col rounded-xl bg-neutral-900 p-5 ring-1 ring-inset ring-slate-800">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-400">{formatPlanTerm(plan)}</span>
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
                      onClick={() => purchaseUrl === undefined
                        ? undefined
                        : void openExternal(purchaseUrl, '无法打开购买页面')}
                      className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:cursor-not-allowed disabled:bg-slate-900 disabled:text-slate-600"
                    >
                      {purchaseUrl === undefined ? '暂未开放购买' : '前往购买'}
                      {purchaseUrl === undefined ? null : <ExternalLink className="size-3.5" aria-hidden="true" />}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-900 py-5 text-xs text-slate-600">
          <span>VideoStitcher 授权系统</span>
          <span>只记录授权状态、设备版本与在线时间，不上传处理内容</span>
        </footer>
      </main>
    </div>
  );
};

export default UnauthorizedMode;
