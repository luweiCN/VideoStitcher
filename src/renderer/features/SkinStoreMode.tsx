import React, { useState } from 'react';
import { CheckCircle2, Code2, FileCode2, Palette, Sparkles } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import PageThemeToggle from '@/components/PageThemeToggle';
import { usePageTheme } from '@/hooks/usePageTheme';
import { useHomeSkin } from '@/hooks/useHomeSkin';
import { DEFAULT_HOME_SKIN_ID, HOME_SKINS, HOME_SKIN_STORAGE_KEY, type HomeSkinId, isHomeSkinId } from '@/constants/homeSkins';

const getSavedSkin = (): HomeSkinId => {
  const savedSkin = localStorage.getItem(HOME_SKIN_STORAGE_KEY);
  return isHomeSkinId(savedSkin) ? savedSkin : DEFAULT_HOME_SKIN_ID;
};

const AirBnbPreview: React.FC = () => {
  return (
    <div className="relative h-44 overflow-hidden rounded-lg border border-black/5 bg-[#f7f3ef] shadow-inner">
      <div className="absolute inset-0 bg-[#f7f3ef]" />
      <div className="absolute -left-8 -top-10 h-32 w-32 rounded-full bg-white/90 blur-xl" />
      <div className="absolute -right-6 top-2 h-28 w-28 rounded-full bg-[#FF385C]/15 blur-xl" />
      <div className="absolute inset-x-4 top-4 h-10 rounded-md border border-black/5 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.08)]" />
      <div className="absolute bottom-4 left-4 right-4 grid grid-cols-3 gap-3">
        {['#ffffff', '#fff7f2', '#ffffff'].map((color, index) => (
          <div
            key={`${color}-${index}`}
            className="h-20 rounded-md border border-black/5 shadow-[0_14px_26px_rgba(15,23,42,0.08)]"
            style={{
              background: color,
              transform: index === 1 ? 'translateY(-6px)' : undefined,
            }}
          />
        ))}
      </div>
      <div className="absolute right-5 top-5 h-3 w-3 rounded-full bg-[#FF385C] shadow-[0_0_18px_rgba(255,56,92,0.45)]" />
    </div>
  );
};

const MetalBrassPreview: React.FC = () => {
  return (
    <div className="relative h-44 overflow-hidden rounded-lg border border-amber-200/30 bg-[#2c180d] shadow-inner">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#3e2011_0%,#9f623b_14%,#e3ad77_30%,#a4623b_48%,#d6955f_66%,#794221_82%,#2c180d_100%)]" />
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(255,238,212,0.10)_0_1px,rgba(70,34,16,0.12)_1px_2px,transparent_2px_5px)]" />
      <div className="absolute inset-x-4 top-4 h-10 rounded-md border border-amber-100/25 bg-black/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]" />
      <div className="absolute bottom-4 left-4 right-4 grid grid-cols-3 gap-3">
        {['#9f623b', '#d6955f', '#3e2011'].map((color, index) => (
          <div
            key={`${color}-${index}`}
            className="h-20 rounded-md border border-amber-100/25 shadow-[inset_0_1px_0_rgba(255,244,223,0.42),0_14px_26px_rgba(0,0,0,0.28)]"
            style={{
              background: `linear-gradient(180deg, rgba(255,255,255,0.28), rgba(0,0,0,0.22)), ${color}`,
              transform: index === 1 ? 'translateY(-6px)' : undefined,
            }}
          />
        ))}
      </div>
      <div className="absolute right-5 top-5 h-3 w-3 rounded-full bg-[#ffc072] shadow-[0_0_18px_rgba(255,192,114,0.72)]" />
    </div>
  );
};

const SkinPreview: React.FC<{ skinId: HomeSkinId }> = ({ skinId }) => {
  return skinId === 'metal-brass' ? <MetalBrassPreview /> : <AirBnbPreview />;
};

const SkinStoreMode: React.FC = () => {
  const { isLightTheme, togglePageTheme } = usePageTheme();
  const { workspaceSkinClassName } = useHomeSkin();
  const [selectedSkinId, setSelectedSkinId] = useState<HomeSkinId>(() => getSavedSkin());
  const isMetalSkinSelected = selectedSkinId === 'metal-brass';

  const handleApplySkin = (skinId: HomeSkinId) => {
    localStorage.setItem(HOME_SKIN_STORAGE_KEY, skinId);
    if (skinId === 'metal-brass') {
      localStorage.setItem('home-theme', 'dark');
    }
    setSelectedSkinId(skinId);
    window.dispatchEvent(new Event('home-skin-changed'));
  };

  return (
    <div className={`${workspaceSkinClassName} min-h-screen flex flex-col ${isLightTheme ? 'theme-light-page bg-[#F8F8F5] text-[#222222]' : 'bg-[#181818] text-[#D1D1D1]'}`}>
      <PageHeader
        title="皮肤商店"
        icon={Palette}
        description="管理工具箱界面皮肤，支持随时切换主页方案"
        iconColor="text-amber-400"
        rightContent={isMetalSkinSelected ? undefined : <PageThemeToggle isLightTheme={isLightTheme} onToggle={togglePageTheme} />}
      />

      <main className="flex-1 overflow-auto p-6">
        <section className="mx-auto max-w-6xl">
          <div className={`rounded-lg border p-6 shadow-sm ${isLightTheme ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-900/70'}`}>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-500">Skin Store</p>
                <h2 className="mt-2 text-3xl font-black">皮肤商店</h2>
                <p className={`mt-3 max-w-2xl text-sm leading-6 ${isLightTheme ? 'text-slate-600' : 'text-slate-400'}`}>
                  这里会集中管理 VideoStitcher 的界面皮肤。你之前的黄铜金属方案已经保留，可以和新版极简方案随时切换。
                </p>
              </div>
              <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${isLightTheme ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-amber-400/25 bg-amber-400/10 text-amber-200'}`}>
                <Sparkles className="h-4 w-4" />
                <span>已收录 {HOME_SKINS.length} 套皮肤</span>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {HOME_SKINS.map((skin) => {
              const isSelected = skin.id === selectedSkinId;

              return (
              <article
                key={skin.id}
                className={`overflow-hidden rounded-lg border shadow-sm transition-transform hover:-translate-y-1 ${
                  isSelected
                    ? isLightTheme
                      ? 'border-[#FF385C]/40 bg-white shadow-lg shadow-[#FF385C]/10'
                      : 'border-[#FF385C]/50 bg-slate-900/80'
                    : isLightTheme
                    ? 'border-slate-200 bg-white hover:shadow-lg'
                    : 'border-slate-800 bg-slate-900/80 hover:border-amber-400/40'
                }`}
              >
                <SkinPreview skinId={skin.id} />
                <div className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xl font-bold">{skin.name}</h3>
                    {isSelected && (
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                        isLightTheme ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-400/10 text-emerald-300'
                      }`}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        使用中
                      </span>
                    )}
                  </div>
                  <p className={`mt-3 text-sm leading-6 ${isLightTheme ? 'text-slate-600' : 'text-slate-400'}`}>
                    {skin.description}
                  </p>
                  {skin.id === 'metal-brass' && (
                    <div className={`mt-3 rounded-lg border px-3 py-2 text-xs leading-5 ${
                      isLightTheme
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : 'border-amber-400/25 bg-amber-400/10 text-amber-200'
                    }`}>
                      黄铜模式为黑夜专属皮肤。应用后系统会默认切换到黑夜模式，并隐藏白天 / 黑夜切换按钮。
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {skin.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`rounded-full border px-3 py-1 text-xs ${
                          isLightTheme ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-slate-700 bg-slate-800 text-slate-300'
                        }`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className={`mt-4 rounded-lg border p-3 ${
                    isLightTheme ? 'border-slate-200 bg-slate-50/80' : 'border-slate-800 bg-slate-950/35'
                  }`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <FileCode2 className="h-4 w-4 text-[#FF385C]" />
                        <span className="text-xs font-bold">完整代码已收录</span>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        isLightTheme ? 'bg-white text-slate-500' : 'bg-slate-900 text-slate-400'
                      }`}>
                        {skin.implementation.codeArtifacts.length} 份代码
                      </span>
                    </div>
                    <div className={`mt-3 grid grid-cols-2 gap-2 text-[11px] ${
                      isLightTheme ? 'text-slate-500' : 'text-slate-400'
                    }`}>
                      <div>根类：{skin.implementation.rootClassName}</div>
                      <div>存储值：{skin.implementation.storageValue}</div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {skin.implementation.coverage.map((item) => (
                        <span
                          key={item}
                          className={`rounded-full px-2 py-0.5 text-[10px] ${
                            isLightTheme ? 'bg-white text-slate-500' : 'bg-slate-900 text-slate-400'
                          }`}
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                    <details className="mt-3 group">
                      <summary className={`flex cursor-pointer select-none items-center gap-2 text-xs font-semibold ${
                        isLightTheme ? 'text-slate-700 hover:text-[#FF385C]' : 'text-slate-300 hover:text-[#FF385C]'
                      }`}>
                        <Code2 className="h-3.5 w-3.5" />
                        查看皮肤代码资产
                      </summary>
                      <div className="mt-3 space-y-3">
                        {skin.implementation.codeArtifacts.map((artifact) => (
                          <div
                            key={`${skin.id}-${artifact.title}`}
                            className={`overflow-hidden rounded-lg border ${
                              isLightTheme ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-950/60'
                            }`}
                          >
                            <div className={`flex items-start justify-between gap-3 border-b px-3 py-2 ${
                              isLightTheme ? 'border-slate-100' : 'border-slate-800'
                            }`}>
                              <div>
                                <div className="text-xs font-bold">{artifact.title}</div>
                                <div className={`mt-0.5 text-[10px] ${isLightTheme ? 'text-slate-500' : 'text-slate-500'}`}>
                                  {artifact.filePath}
                                </div>
                              </div>
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                isLightTheme ? 'bg-slate-100 text-slate-500' : 'bg-slate-900 text-slate-400'
                              }`}>
                                {artifact.language}
                              </span>
                            </div>
                            <p className={`px-3 pt-2 text-[11px] leading-5 ${isLightTheme ? 'text-slate-500' : 'text-slate-400'}`}>
                              {artifact.description}
                            </p>
                            <pre className={`mx-3 my-3 max-h-56 overflow-auto rounded-md p-3 text-[10px] leading-5 ${
                              isLightTheme ? 'bg-slate-950 text-slate-100' : 'bg-black text-slate-200'
                            }`}>
                              <code>{artifact.source}</code>
                            </pre>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                  <button
                    type="button"
                    disabled={isSelected}
                    onClick={() => handleApplySkin(skin.id)}
                    className={`mt-5 w-full rounded-lg px-4 py-2.5 text-sm font-semibold ${
                      isSelected
                        ? isLightTheme
                          ? 'bg-slate-100 text-slate-500'
                          : 'bg-slate-800 text-slate-400'
                        : 'bg-[#FF385C] text-white hover:bg-[#e93252]'
                    }`}
                  >
                    {isSelected ? '当前已应用' : '应用此皮肤'}
                  </button>
                </div>
              </article>
              );
            })}
          </div>

          <div className={`mt-6 rounded-lg border border-dashed p-6 text-center ${
            isLightTheme ? 'border-slate-300 bg-white/70 text-slate-500' : 'border-slate-700 bg-slate-900/40 text-slate-500'
          }`}>
            后续新皮肤会继续展示在这里
          </div>
        </section>
      </main>
    </div>
  );
};

export default SkinStoreMode;
