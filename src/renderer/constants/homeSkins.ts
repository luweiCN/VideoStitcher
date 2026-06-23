export type HomeSkinId = 'airbnb-minimal' | 'metal-brass';

export interface HomeSkinCodeArtifact {
  title: string;
  language: 'tsx' | 'css' | 'json';
  filePath: string;
  description: string;
  source: string;
}

export interface HomeSkinImplementation {
  storageValue: HomeSkinId;
  rootClassName: string;
  lightClassName: string;
  darkClassName: string;
  sourceFiles: [string, ...string[]];
  coverage: [string, ...string[]];
  codeArtifacts: [HomeSkinCodeArtifact, ...HomeSkinCodeArtifact[]];
}

export interface HomeSkin {
  id: HomeSkinId;
  name: string;
  description: string;
  tags: [string, ...string[]];
  status: 'current' | 'archived';
  implementation: HomeSkinImplementation;
}

export const HOME_SKIN_STORAGE_KEY = 'home-skin';
export const DEFAULT_HOME_SKIN_ID: HomeSkinId = 'airbnb-minimal';

const AIRBNB_MINIMAL_APP_SOURCE = String.raw`// src/renderer/App.tsx
const navButtonClass = isDarkTheme
  ? 'border-[#3B3B3B] bg-[#2A2A2A] text-[#D1D1D1] hover:border-[#4A4A4A] hover:bg-[#333333]'
  : 'border-[#E7E5DF] bg-white text-[#444444] shadow-[0_6px_18px_rgba(34,34,34,0.05)] hover:border-[#DDD8CF] hover:bg-[#F3F3EF]';

return (
  <div className={isDarkTheme ? 'home-airbnb home-dark bg-[#181818]' : 'home-airbnb home-light bg-[#F8F8F5]'}>
    <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between">
      <button className="rounded-lg bg-[#FF385C]">VideoStitcher</button>
      <button onClick={() => onNavigate('/skinStore')}>皮肤商店</button>
    </header>
    <main>
      <h1>
        <span>干净地完成每一次</span>
        <span className="text-[#FF385C]">视频批处理</span>
      </h1>
      <div className="grid grid-cols-4 gap-3">
        {features.map((feature) => (
          <button className="rounded-lg border bg-white p-5 hover:-translate-y-0.5" />
        ))}
      </div>
    </main>
  </div>
);`;

const AIRBNB_MINIMAL_CSS_SOURCE = String.raw`.home-airbnb {
  --airbnb-primary: #ff385c;
  --airbnb-primary-hover: #e43150;
  --airbnb-text: #222222;
  --airbnb-body: #444444;
  --airbnb-muted: #6b6b6b;
  --airbnb-weak: #9a9a9a;
  --airbnb-border: #e7e5df;
  --airbnb-card: #ffffff;
  --airbnb-soft: #fbfbf8;
  --airbnb-hover: #f3f3ef;
}

.home-airbnb.home-dark {
  --airbnb-text: #f2f2f2;
  --airbnb-body: #d1d1d1;
  --airbnb-muted: #a8a8a8;
  --airbnb-weak: #777777;
  --airbnb-border: #353535;
  --airbnb-card: #242424;
  --airbnb-soft: #2a2a2a;
  --airbnb-hover: #333333;
}`;

const METAL_BRASS_APP_SOURCE = String.raw`// src/renderer/App.tsx
if (homeSkin === 'metal-brass') {
  return (
    <div className={isDarkTheme ? 'home-metal home-lumia-dark text-white' : 'home-metal home-lumia-surface text-slate-900'}>
      <header>
        <button onClick={() => onNavigate('/')}>VideoStitcher</button>
        <HomeTaskIndicator onClick={() => onNavigate('/taskCenter')} theme={homeTheme} />
        <button onClick={() => onNavigate('/skinStore')}>皮肤商店</button>
        <button onClick={() => onNavigate('/admin')}>系统管理</button>
      </header>

      <main>
        <h1>VideoStitcher</h1>
        <p>全能视频批处理工具箱</p>
        <div className="grid">
          {features.map((feature) => (
            <button key={feature.path} className="home-lumia-tile" onClick={() => onNavigate(feature.path)}>
              <feature.icon />
              <h2>{feature.title}</h2>
              <p>{feature.description}</p>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}`;

const METAL_BRASS_CSS_SOURCE = String.raw`.home-lumia-surface {
  background:
    linear-gradient(90deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.18) 36%, rgba(82,91,101,0.26) 100%),
    radial-gradient(circle at 18% 18%, rgba(255,255,255,0.92), rgba(255,255,255,0.18) 28%, transparent 56%),
    repeating-linear-gradient(0deg, rgba(255,255,255,0.08) 0, rgba(255,255,255,0.08) 1px, transparent 1px, transparent 9px),
    repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 11px),
    linear-gradient(135deg, #f3f4f4 0%, #c6cbd0 48%, #858d95 100%);
}

.home-lumia-dark {
  background:
    radial-gradient(circle at 20% 18%, rgba(71,85,105,0.45), transparent 38%),
    repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 10px),
    linear-gradient(135deg, #101722 0%, #1f2937 52%, #0f172a 100%);
}

.home-lumia-tile::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.18), transparent 42%),
    repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0, rgba(255,255,255,0.035) 1px, transparent 1px, transparent 7px);
  opacity: 0.68;
}

.home-lumia-tile > * {
  position: relative;
  z-index: 1;
}

.home-metal {
  --home-metal-brush:
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.06) 0 1px, rgba(0, 0, 0, 0.08) 1px 2px, transparent 2px 5px),
    repeating-linear-gradient(0deg, transparent 0 19px, rgba(255, 255, 255, 0.055) 19px 20px, transparent 20px 37px),
    linear-gradient(90deg, rgba(0, 0, 0, 0.22), transparent 15%, rgba(255, 255, 255, 0.14) 28%, transparent 45%, rgba(255, 255, 255, 0.1) 68%, transparent 82%, rgba(0, 0, 0, 0.26)),
    linear-gradient(90deg, #434741 0%, #898a82 18%, #565b55 36%, #aaa398 54%, #696d66 72%, #2d312d 100%);
  --home-metal-dark:
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.04) 0 1px, rgba(0, 0, 0, 0.08) 1px 2px, transparent 2px 6px),
    linear-gradient(90deg, rgba(0, 0, 0, 0.28), transparent 20%, rgba(255, 255, 255, 0.08) 42%, transparent 70%, rgba(0, 0, 0, 0.35)),
    linear-gradient(90deg, #121312 0%, #313330 25%, #20231f 48%, #494b46 67%, #10110f 100%);
  --home-brass:
    radial-gradient(ellipse 220px 90px at 18% 16%, rgba(255, 239, 211, 0.45), transparent 62%),
    linear-gradient(90deg, rgba(58, 30, 15, 0.42) 0%, transparent 14%, rgba(255, 230, 190, 0.34) 28%, transparent 45%, rgba(255, 218, 167, 0.22) 63%, transparent 78%, rgba(42, 22, 12, 0.44) 100%),
    repeating-linear-gradient(0deg, rgba(255, 238, 212, 0.08) 0 1px, rgba(70, 34, 16, 0.1) 1px 2px, transparent 2px 5px),
    linear-gradient(90deg, #3e2011 0%, #9f623b 14%, #e3ad77 30%, #a4623b 48%, #d6955f 66%, #794221 82%, #2c180d 100%);
  background:
    radial-gradient(ellipse at 50% -12%, rgba(255, 255, 255, 0.18), transparent 34rem),
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(0, 0, 0, 0.38)),
    var(--home-metal-brush) !important;
}

.home-metal::before,
.home-metal::after {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
}

.home-metal::before {
  z-index: 0;
  background:
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.08) 0 1px, rgba(0, 0, 0, 0.1) 1px 2px, transparent 2px 4px),
    linear-gradient(90deg, rgba(0, 0, 0, 0.5), transparent 18%, transparent 82%, rgba(0, 0, 0, 0.5));
  mix-blend-mode: overlay;
  opacity: 0.34;
}

.home-metal::after {
  z-index: 0;
  background:
    radial-gradient(ellipse at top, transparent 26%, rgba(0, 0, 0, 0.34) 78%),
    radial-gradient(ellipse 760px 240px at 58% 20%, rgba(255, 255, 255, 0.18), transparent 64%);
  mix-blend-mode: soft-light;
}

.home-metal > header,
.home-metal > main,
.home-metal > footer {
  position: relative;
  z-index: 1;
}

.home-metal > header {
  margin: 16px 20px 0;
  padding: 14px 16px;
  border: 1px solid rgba(255, 252, 239, 0.2);
  border-right-color: rgba(0, 0, 0, 0.48);
  border-bottom-color: rgba(0, 0, 0, 0.72);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.18), transparent 22%, rgba(0, 0, 0, 0.42)),
    var(--home-metal-brush);
  box-shadow:
    0 18px 46px rgba(0, 0, 0, 0.42),
    inset 0 1px 0 rgba(255, 255, 255, 0.44),
    inset 0 -1px 0 rgba(0, 0, 0, 0.7);
}

.home-metal .home-lumia-tile,
.home-metal .home-lumia-tile:nth-child(1),
.home-metal .home-lumia-tile:nth-child(3),
.home-metal .home-lumia-tile:nth-child(5),
.home-metal .home-lumia-tile:nth-child(7),
.home-metal .home-lumia-tile:nth-child(8) {
  border-color: rgba(255, 229, 194, 0.36) !important;
  border-right-color: rgba(80, 42, 20, 0.72) !important;
  border-bottom-color: rgba(28, 16, 9, 0.88) !important;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.3), transparent 34%, rgba(0, 0, 0, 0.28)),
    var(--home-brass) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 223, 0.54),
    inset 0 -14px 28px rgba(45, 24, 12, 0.24),
    0 18px 38px rgba(0, 0, 0, 0.38),
    0 0 0 1px rgba(255, 198, 126, 0.12) !important;
}

.home-metal .home-lumia-tile:hover {
  filter: brightness(1.08) contrast(1.04);
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 223, 0.64),
    inset 0 -14px 28px rgba(45, 24, 12, 0.22),
    0 26px 44px rgba(0, 0, 0, 0.44),
    0 0 22px rgba(255, 192, 114, 0.18) !important;
}`;

const WORKSPACE_SKIN_RUNTIME_SOURCE = String.raw`// src/renderer/hooks/useHomeSkin.ts
export const readSavedHomeSkin = (): HomeSkinId => {
  const savedSkin = localStorage.getItem(HOME_SKIN_STORAGE_KEY);
  return isHomeSkinId(savedSkin) ? savedSkin : DEFAULT_HOME_SKIN_ID;
};

export const getWorkspaceSkinClassName = (skinId: HomeSkinId): string => {
  return skinId === 'metal-brass' ? 'video-merge-metal' : 'video-merge-airbnb';
};

export const useHomeSkin = () => {
  const [homeSkinId, setHomeSkinId] = useState<HomeSkinId>(() => readSavedHomeSkin());

  useEffect(() => {
    const handleSkinChanged = () => {
      setHomeSkinId(readSavedHomeSkin());
    };

    window.addEventListener('home-skin-changed', handleSkinChanged);
    window.addEventListener('storage', handleSkinChanged);

    return () => {
      window.removeEventListener('home-skin-changed', handleSkinChanged);
      window.removeEventListener('storage', handleSkinChanged);
    };
  }, []);

  return {
    homeSkinId,
    workspaceSkinClassName: getWorkspaceSkinClassName(homeSkinId),
  };
};`;

const METAL_BRASS_DARK_LOCK_SOURCE = String.raw`// src/renderer/hooks/usePageTheme.ts
const isMetalSkinSelected = () => localStorage.getItem(HOME_SKIN_STORAGE_KEY) === 'metal-brass';

export const usePageTheme = () => {
  const [pageTheme, setPageTheme] = useState<PageTheme>(() => {
    if (isMetalSkinSelected()) return 'dark';

    const savedTheme = localStorage.getItem('home-theme');
    return savedTheme === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    if (isMetalSkinSelected()) {
      localStorage.setItem('home-theme', 'dark');
      setPageTheme('dark');
      return;
    }

    localStorage.setItem('home-theme', pageTheme);
  }, [pageTheme]);

  const togglePageTheme = () => {
    if (isMetalSkinSelected()) {
      localStorage.setItem('home-theme', 'dark');
      setPageTheme('dark');
      return;
    }

    setPageTheme((theme) => (theme === 'light' ? 'dark' : 'light'));
  };

  return { pageTheme, isLightTheme: pageTheme === 'light', togglePageTheme };
};`;

export const HOME_SKINS: HomeSkin[] = [
  {
    id: 'airbnb-minimal',
    name: 'Airbnb 极简',
    description: '极简高级皮肤，包含柔和米白背景、珊瑚红强调色和轻量卡片入口。',
    tags: ['极简高级', '轻量卡片', '当前新版'],
    status: 'current',
    implementation: {
      storageValue: 'airbnb-minimal',
      rootClassName: 'home-airbnb',
      lightClassName: 'home-light',
      darkClassName: 'home-dark',
      sourceFiles: [
        'src/renderer/App.tsx',
        'src/renderer/index.css',
        'src/renderer/hooks/useHomeSkin.ts',
        'src/renderer/hooks/usePageTheme.ts',
        'src/renderer/constants/homeSkins.ts',
      ],
      coverage: ['首页根容器', '顶部入口按钮', '工具入口卡片', '二级入口根主题', '白天/黑夜 token', '本地存储切换'],
      codeArtifacts: [
        {
          title: '首页 Airbnb 入口结构',
          language: 'tsx',
          filePath: 'src/renderer/App.tsx',
          description: 'Airbnb 极简皮肤在首页的渲染结构与入口按钮方案。',
          source: AIRBNB_MINIMAL_APP_SOURCE,
        },
        {
          title: '首页 Airbnb 主题 token',
          language: 'css',
          filePath: 'src/renderer/index.css',
          description: '白天 / 黑夜模式共用的 Airbnb 配色 token。',
          source: AIRBNB_MINIMAL_CSS_SOURCE,
        },
        {
          title: '二级入口皮肤运行时',
          language: 'tsx',
          filePath: 'src/renderer/hooks/useHomeSkin.ts',
          description: '读取当前皮肤，并为所有二级工具页返回对应根主题 class。',
          source: WORKSPACE_SKIN_RUNTIME_SOURCE,
        },
      ],
    },
  },
  {
    id: 'metal-brass',
    name: '金属黄铜',
    description: '之前沉淀的黄铜金属质感皮肤，默认仅提供黑夜模式，应用后会隐藏白天 / 黑夜切换按钮。',
    tags: ['经典保留', '金属质感', '黑夜专属'],
    status: 'archived',
    implementation: {
      storageValue: 'metal-brass',
      rootClassName: 'home-metal',
      lightClassName: 'home-lumia-surface',
      darkClassName: 'home-lumia-dark',
      sourceFiles: [
        'src/renderer/App.tsx',
        'src/renderer/index.css',
        'src/renderer/hooks/useHomeSkin.ts',
        'src/renderer/hooks/usePageTheme.ts',
        'src/renderer/constants/homeSkins.ts',
      ],
      coverage: ['首页根容器', '金属页头', '黄铜功能磁贴', '二级入口金属主题', '拉丝背景', '黑夜专属锁定', '隐藏主题切换按钮', '本地存储切换'],
      codeArtifacts: [
        {
          title: '金属黄铜首页入口结构',
          language: 'tsx',
          filePath: 'src/renderer/App.tsx',
          description: '金属黄铜皮肤的首页分支、黑夜专属状态与入口渲染结构。',
          source: METAL_BRASS_APP_SOURCE,
        },
        {
          title: '金属黄铜完整样式代码',
          language: 'css',
          filePath: 'src/renderer/index.css',
          description: '金属黄铜皮肤的核心 CSS：拉丝背景、黄铜磁贴、明暗模式容器与 hover 质感。',
          source: METAL_BRASS_CSS_SOURCE,
        },
        {
          title: '二级入口皮肤运行时',
          language: 'tsx',
          filePath: 'src/renderer/hooks/useHomeSkin.ts',
          description: '读取当前皮肤，并让二级工具页切换到 video-merge-metal 根主题。',
          source: WORKSPACE_SKIN_RUNTIME_SOURCE,
        },
        {
          title: '黄铜黑夜专属锁定逻辑',
          language: 'tsx',
          filePath: 'src/renderer/hooks/usePageTheme.ts',
          description: '黄铜皮肤被选中时强制使用黑夜模式，并阻止切回白天模式。',
          source: METAL_BRASS_DARK_LOCK_SOURCE,
        },
      ],
    },
  },
];

export const HOME_SKIN_IDS = HOME_SKINS.map((skin) => skin.id);

export const getHomeSkinById = (skinId: HomeSkinId): HomeSkin => {
  return HOME_SKINS.find((skin) => skin.id === skinId) ?? HOME_SKINS[0];
};

export const isHomeSkinId = (value: string | null): value is HomeSkinId => {
  return HOME_SKIN_IDS.includes(value as HomeSkinId);
};
