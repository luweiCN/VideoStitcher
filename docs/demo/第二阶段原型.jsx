import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  PlayCircle,
  Cpu,
  Zap,
  Sparkles,
  ChevronRight,
  Monitor,
  MessageSquare,
  CheckCircle2,
  Volume2,
  FileVideo,
  RefreshCcw,
  ArrowLeft,
  Layers,
  Settings,
  Clock,
  Plus,
  Send,
  Ghost,
  Laugh,
  BookOpen,
  Mic2,
  Dice5,
  Gamepad2,
  UserCircle,
  Save,
  Trash2,
  Archive,
  X,
  Pencil,
  Check,
  RotateCcw,
  Hash,
  Wand2,
  LayoutGrid,
  StretchHorizontal,
  Moon,
  Sun,
  AlertCircle,
  GripVertical,
  Film,
  Globe,
  Play,
  Upload,
  Database,
  FileText,
  Headphones,
  Paperclip,
  PanelLeftClose,
  MessageCircle,
  FileAudio,
  PenTool,
  Network,
  ImagePlus,
  ArrowUp,
  Palette,
  Bot,
  Map as MapIcon,
  ChevronDown,
  Scissors,
  Download,
} from "lucide-react";

// --- 全局交互音效引擎 ---
const playSound = (type = "click") => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    switch (type) {
      case "click":
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(
          100,
          audioCtx.currentTime + 0.1,
        );
        gainNode.gain.setValueAtTime(0.04, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
        break;
      case "nav":
        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(500, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(
          250,
          audioCtx.currentTime + 0.1,
        );
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
        break;
      case "backpack":
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(500, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(
          1200,
          audioCtx.currentTime + 0.1,
        );
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.2);
        break;
      case "action":
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
        oscillator.frequency.linearRampToValueAtTime(
          1100,
          audioCtx.currentTime + 0.05,
        );
        gainNode.gain.setValueAtTime(0.06, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.15);
        break;
      case "delete":
        oscillator.type = "sawtooth";
        oscillator.frequency.setValueAtTime(200, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.03, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
        break;
      default:
        break;
    }
  } catch (e) {}
};

const MODELS = [
  { id: "gemini", name: "Gemini 1.5 Pro", color: "bg-blue-600" },
  { id: "doubao", name: "豆包", color: "bg-indigo-600" },
  { id: "qwen", name: "通义千问", color: "bg-orange-600" },
  { id: "chatgpt", name: "ChatGPT", color: "bg-green-600" },
];

const VIDEO_MODELS = [
  {
    id: "sora2",
    name: "Sora 2.0",
    desc: "OpenAI 物理世界模拟",
    color: "text-indigo-500",
    bg: "bg-indigo-500",
  },
  {
    id: "seedance2",
    name: "Seedance 2.0",
    desc: "字节跳动 极致张力",
    color: "text-emerald-500",
    bg: "bg-emerald-500",
  },
  {
    id: "kling",
    name: "可灵 1.5",
    desc: "快手 高逼真生成",
    color: "text-blue-500",
    bg: "bg-blue-500",
  },
  {
    id: "runway",
    name: "Runway Gen-3",
    desc: "好莱坞级视觉引擎",
    color: "text-purple-500",
    bg: "bg-purple-500",
  },
];

const INITIAL_HOOK_STYLES = [
  {
    id: "humor",
    name: "幽默诙谐",
    icon: <Laugh size={18} className="text-orange-500" />,
    desc: "轻松搞笑，化解输牌尴尬",
    isDefault: true,
  },
  {
    id: "suspense",
    name: "悬疑剧情",
    icon: <Ghost size={18} className="text-purple-500" />,
    desc: "反转不断，悬念拉满",
    isDefault: true,
  },
  {
    id: "funny",
    name: "搞笑沙雕",
    icon: <Sparkles size={18} className="text-blue-500" />,
    desc: "脑洞大开，魔性洗脑",
    isDefault: true,
  },
  {
    id: "tutorial",
    name: "麻将教学",
    icon: <BookOpen size={18} className="text-emerald-500" />,
    desc: "干货满满，实战教学",
    isDefault: true,
  },
  {
    id: "commentary",
    name: "搞笑解说",
    icon: <Mic2 size={18} className="text-rose-500" />,
    desc: "毒舌点评，神级复盘",
    isDefault: true,
  },
];

const REGION_GROUPS = [
  {
    category: "通用",
    regions: [{ id: "universal", name: "全国通用", icon: "🇨🇳" }],
  },
  {
    category: "华北",
    regions: [
      { id: "beijing", name: "北京", icon: "🏯" },
      { id: "hebei", name: "河北", icon: "🏹" },
      { id: "neimenggu", name: "内蒙古", icon: "🐎" },
      { id: "shanxi", name: "山西", icon: "🏺" },
      { id: "tianjin", name: "天津", icon: "🎡" },
    ],
  },
  {
    category: "东北",
    regions: [
      { id: "heilongjiang", name: "黑龙江", icon: "🐻" },
      { id: "jilin", name: "吉林", icon: "❄️" },
      { id: "liaoning", name: "辽宁", icon: "⚓" },
    ],
  },
  {
    category: "华东",
    regions: [
      { id: "anhui", name: "安徽", icon: "⛰️" },
      { id: "fujian", name: "福建", icon: "🏮" },
      { id: "jiangsu", name: "江苏", icon: "🛶" },
      { id: "jiangxi", name: "江西", icon: "🏗️" },
      { id: "shandong", name: "山东", icon: "🌊" },
      { id: "shanghai", name: "上海", icon: "🗼" },
      { id: "taiwan", name: "台湾", icon: "🍍" },
      { id: "zhejiang", name: "浙江", icon: "🍵" },
    ],
  },
  {
    category: "华中",
    regions: [
      { id: "henan", name: "河南", icon: "🏺" },
      { id: "hubei", name: "湖北", icon: "⛵" },
      { id: "hunan", name: "湖南", icon: "🌶️" },
    ],
  },
  {
    category: "华南",
    regions: [
      { id: "guangdong", name: "广东", icon: "🍱" },
      { id: "guangxi", name: "广西", icon: "⛰️" },
      { id: "hainan", name: "海南", icon: "🌴" },
      { id: "hongkong", name: "香港", icon: "🏙️" },
      { id: "macau", name: "澳门", icon: "🎰" },
    ],
  },
  {
    category: "西南",
    regions: [
      { id: "chongqing", name: "重庆", icon: "🌶️" },
      { id: "guizhou", name: "贵州", icon: "🍶" },
      { id: "sichuan", name: "四川", icon: "🐼" },
      { id: "xizang", name: "西藏", icon: "🏔️" },
      { id: "yunnan", name: "云南", icon: "☁️" },
    ],
  },
  {
    category: "西北",
    regions: [
      { id: "gansu", name: "甘肃", icon: "🐪" },
      { id: "ningxia", name: "宁夏", icon: "🍷" },
      { id: "qinghai", name: "青海", icon: "🥣" },
      { id: "shaanxi", name: "陕西", icon: "🧱" },
      { id: "xinjiang", name: "新疆", icon: "葡萄" },
    ],
  },
];

const MOCK_SCRIPTS_LIBRARY = {
  humor: [
    "这牌打得稀烂，但我笑得灿烂！",
    "心态稳如松，点炮也从容！",
    "只要不掀桌，一切皆有可能！",
    "赢了会所嫩模，输了下海干活！",
  ],
  suspense: [
    "他手里最后一张牌，竟然是...",
    "生死时刻，绝杀翻盘！",
    "全场屏住呼吸，等一张幺鸡...",
    "本来是死局，这一手太绝了。",
  ],
  default: [
    "正宗本地规则，老乡都在玩！",
    "实时真人对战，公平竞技。",
    "绿色无外挂，休闲好去处。",
    "随时随地，想搓就搓！",
  ],
};

const STYLE_CATEGORIES = ["全部", "3D风格", "2D漫剪", "插画风格", "写实摄影"];
const DUMMY_STYLES = [
  {
    id: 1,
    name: "3D国创",
    category: "3D风格",
    bg: "bg-gradient-to-br from-red-500 to-orange-500",
  },
  {
    id: 2,
    name: "女频漫改",
    category: "2D漫剪",
    bg: "bg-gradient-to-br from-pink-400 to-purple-500",
  },
  {
    id: 3,
    name: "赛博朋克",
    category: "写实摄影",
    bg: "bg-gradient-to-br from-blue-600 to-cyan-400",
  },
  {
    id: 4,
    name: "治愈绘本",
    category: "插画风格",
    bg: "bg-gradient-to-br from-green-400 to-emerald-600",
  },
  {
    id: 5,
    name: "水墨武侠",
    category: "插画风格",
    bg: "bg-gradient-to-br from-slate-700 to-slate-900",
  },
  {
    id: 6,
    name: "美漫夸张",
    category: "2D漫剪",
    bg: "bg-gradient-to-br from-yellow-400 to-red-500",
  },
  {
    id: 7,
    name: "极简黏土",
    category: "3D风格",
    bg: "bg-gradient-to-br from-orange-200 to-amber-200",
  },
  {
    id: 8,
    name: "胶片纪实",
    category: "写实摄影",
    bg: "bg-gradient-to-br from-stone-500 to-stone-700",
  },
];

const STOCK_VIDEO_URLS = [
  "https://images.unsplash.com/photo-1511556820780-d912e42b4980?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1493612276216-ee3925520721?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80",
];

// --- 地图引擎工具函数与全局缓存 ---
let globalGeoMapData = null;

const projectGeo = (lng, lat) => {
  const width = 800;
  const height = 650;
  const centerLng = 104;
  const centerLat = 36;
  const scale = 13.5;
  const x = width / 2 + (lng - centerLng) * scale;
  const y = height / 2 - (lat - centerLat) * scale * 1.25;
  return [x, y];
};

const generateSvgPath = (coordinates, type) => {
  if (!coordinates || coordinates.length === 0) return "";
  let path = "";
  const processPolygon = (polygon) => {
    return (
      polygon
        .map((coord, i) => {
          const [x, y] = projectGeo(coord[0], coord[1]);
          return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
        })
        .join(" ") + " Z"
    );
  };

  if (type === "Polygon") {
    path = processPolygon(coordinates[0]);
  } else if (type === "MultiPolygon") {
    let maxPoly = coordinates[0];
    let maxLen = 0;
    coordinates.forEach((poly) => {
      if (poly[0] && poly[0].length > maxLen) {
        maxLen = poly[0].length;
        maxPoly = poly;
      }
    });
    if (maxPoly && maxPoly[0]) {
      path = processPolygon(maxPoly[0]);
    }
  }
  return path;
};

const MAP_COLORS = [
  "#FCA5A5",
  "#FCD34D",
  "#86EFAC",
  "#93C5FD",
  "#A78BFA",
  "#F472B6",
  "#FDBA74",
  "#6EE7B7",
];
const getProvColor = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return MAP_COLORS[Math.abs(hash) % MAP_COLORS.length];
};

const getProvMockData = (name) => {
  if (!name) return { bSideCount: 0, playCount: 0, gameplays: [] };
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  hash = Math.abs(hash);

  const bSideCount = 1200 + (hash % 8000);

  let gameplays = [];
  if (name.includes("四川") || name.includes("重庆"))
    gameplays = ["血战到底", "血流成河", "换三张"];
  else if (
    name.includes("广东") ||
    name.includes("广西") ||
    name.includes("海南")
  )
    gameplays = ["推倒胡", "鸡平胡", "买马"];
  else if (name.includes("福建") || name.includes("台湾"))
    gameplays = ["带鬼", "泉州游金", "十六张"];
  else if (name.includes("湖南") || name.includes("湖北"))
    gameplays = ["红中麻将", "转转麻将", "卡五星"];
  else gameplays = ["大众麻将", "跑得快", "斗地主"];

  return {
    bSideCount: bSideCount.toLocaleString(),
    playCount: gameplays.length,
    gameplays: gameplays,
  };
};

// --- 主应用组件 ---
export default function App() {
  const [view, setView] = useState("portal");
  const [theme, setTheme] = useState("dark");
  const [aSideStep, setASideStep] = useState("style");
  const [layoutMode, setLayoutMode] = useState("conveyor");
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [aSideRegion, setASideRegion] = useState("universal");
  const [aSideGameType, setASideGameType] = useState("麻将");
  const [customRequirement, setCustomRequirement] = useState("");
  const [hookStyles, setHookStyles] = useState(INITIAL_HOOK_STYLES);

  const [aSideModel, setASideModel] = useState("gemini");
  const [batchSize, setBatchSize] = useState(5);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [libraryMode, setLibraryMode] = useState("view");
  const [directorScript, setDirectorScript] = useState(null);

  const [personas, setPersonas] = useState([
    { id: 1, name: "民俗老炮", prompt: "资深老玩家，混迹牌馆30年。" },
    { id: 2, name: "5G冲浪手", prompt: "玩梗大师，网感极强。" },
  ]);
  const [activePersonaId, setActivePersonaId] = useState(1);
  const [gemEditorMode, setGemEditorMode] = useState(null);
  const [gemEditData, setGemEditData] = useState({ name: "", prompt: "" });

  const [aSideScripts, setASideScripts] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [libraryScripts, setLibraryScripts] = useState([]);
  const [successAnimation, setSuccessAnimation] = useState(null);
  const [libraryPulse, setLibraryPulse] = useState(false);
  const [isFlyingToConveyor, setIsFlyingToConveyor] = useState(false);
  const scriptRefs = useRef([]);

  const [draggedIdx, setDraggedIdx] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const [editingScriptId, setEditingScriptId] = useState(null);
  const [tempEditText, setTempEditText] = useState("");
  const [showQuickProduceConfirm, setShowQuickProduceConfirm] = useState(false);

  const [isKbAnalyzing, setIsKbAnalyzing] = useState(false);
  const [isAgentProcessing, setIsAgentProcessing] = useState(false);
  const [videoSlots, setVideoSlots] = useState([
    {
      id: 1,
      script: null,
      model: null,
      status: "idle",
      progress: 0,
      isSelected: false,
    },
    {
      id: 2,
      script: null,
      model: null,
      status: "idle",
      progress: 0,
      isSelected: false,
    },
    {
      id: 3,
      script: null,
      model: null,
      status: "idle",
      progress: 0,
      isSelected: false,
    },
    {
      id: 4,
      script: null,
      model: null,
      status: "idle",
      progress: 0,
      isSelected: false,
    },
  ]);
  const [modelModalInfo, setModelModalInfo] = useState({
    isOpen: false,
    target: null,
  });

  const [kbSources, setKbSources] = useState([]);
  const [kbInput, setKbInput] = useState("");
  const [kbChatHistory, setKbChatHistory] = useState([
    {
      role: "assistant",
      text: "你好！我已经加载了您的实机转化视频与文案资产。您可以问我关于这些素材的洞察，比如“提取这些文案中最有煽动性的词汇”，或者点击上方生成一段音频播客。",
    },
  ]);
  const [isAudioGenerating, setIsAudioGenerating] = useState(false);
  const [audioOverviewReady, setAudioOverviewReady] = useState(false);

  const [portalInput, setPortalInput] = useState("");
  const [portalAiMode, setPortalAiMode] = useState("托管模式");

  const [directorInput, setDirectorInput] = useState("");
  const [directorChatHistory, setDirectorChatHistory] = useState([]);
  const chatBottomRef = useRef(null);
  const [showStyleLib, setShowStyleLib] = useState(false);
  const [activeStyleCat, setActiveStyleCat] = useState("全部");
  const [highlightUpload, setHighlightUpload] = useState(false);

  const [dirConfig, setDirConfig] = useState({
    length: "short",
    ratio: "horizontal",
  });

  const [canvasNodes, setCanvasNodes] = useState([]);
  const [canvasEdges, setCanvasEdges] = useState([]);
  const [canvasTransform, setCanvasTransform] = useState({
    x: 0,
    y: 0,
    scale: 1,
  });

  const [dragNodeId, setDragNodeId] = useState(null);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
  });
  const [selectedNodeIds, setSelectedNodeIds] = useState([]);

  const [editingCanvasNodeId, setEditingCanvasNodeId] = useState(null);
  const [tempCanvasNodeText, setTempCanvasNodeText] = useState("");
  const [tempCharName, setTempCharName] = useState("");
  const [tempCharDesc, setTempCharDesc] = useState("");

  const [geoMapData, setGeoMapData] = useState(null);
  const [isMapLoading, setIsMapLoading] = useState(false);
  const [bSideHoveredProv, setBSideHoveredProv] = useState(null);
  const [bSideSelectedProv, setBSideSelectedProv] = useState(null);
  const mapContainerRef = useRef(null);

  const hoverTimeoutRef = useRef(null);
  const [showProvinceConfirm, setShowProvinceConfirm] = useState(null);

  const [bSideAiInput, setBSideAiInput] = useState("");
  const [mapTransform, setMapTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDraggingMap, setIsDraggingMap] = useState(false);

  // --- B面二级编辑器状态 ---
  const [bEditorProductName, setBEditorProductName] = useState("");
  const [bEditorStyle, setBEditorStyle] = useState("通用风格");
  const [bEditorScripts, setBEditorScripts] = useState([]);
  const [isBEditorGenerating, setIsBEditorGenerating] = useState(false);
  const [editingBScriptId, setEditingBScriptId] = useState(null);
  const [tempBScriptText, setTempBScriptText] = useState("");

  // --- B面视频渲染工作台状态 ---
  const [bVideoRenderProgress, setBVideoRenderProgress] = useState(0);
  const [activeBVideoIndex, setActiveBVideoIndex] = useState(0);
  const [exportPathModal, setExportPathModal] = useState(false);

  const toggleTheme = () => {
    playSound("click");
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };
  const toggleLayoutMode = () => {
    playSound("click");
    setLayoutMode((prev) => (prev === "conveyor" ? "grid" : "conveyor"));
  };
  const handleStyleSelect = (styleId) => {
    playSound("nav");
    setSelectedStyle(styleId);
    setASideStep("config");
  };

  const handleASideBack = () => {
    playSound("nav");
    if (view === "director-mode") setView("a-side-editor");
    else if (view === "knowledge-base") setView("video-factory");
    else if (view === "b-side-video-render") setView("b-side-editor");
    else if (view === "b-side-editor") setView("b-side");
    else if (view === "video-factory") setView("b-side");
    else if (view === "a-side-editor") setView("a-side");
    else if (aSideStep === "config") setASideStep("style");
    else setView("portal");
  };

  const showToast = (msg) => {
    playSound("nav");
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  useEffect(() => {
    if (view === "director-mode" && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [directorChatHistory, view]);

  // 地图交互
  const handleMapWheel = (e) => {
    if (view !== "b-side" || showProvinceConfirm) return;
    e.preventDefault();
    const zoomSensitivity = 0.001;
    const delta = -e.deltaY * zoomSensitivity;
    let newScale = mapTransform.scale * (1 + delta);
    newScale = Math.max(0.5, Math.min(newScale, 5));

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const ratio = newScale / mapTransform.scale;
    const newX = mouseX - (mouseX - mapTransform.x) * ratio;
    const newY = mouseY - (mouseY - mapTransform.y) * ratio;

    setMapTransform({ x: newX, y: newY, scale: newScale });
  };

  const handleMapPointerDown = (e) => {
    if (view !== "b-side" || showProvinceConfirm) return;
    if (e.button === 0 || e.button === 1 || e.button === 2) {
      setIsDraggingMap(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handleMapPointerMove = (e) => {
    if (view !== "b-side" || showProvinceConfirm) return;
    if (e.buttons === 0 && isDraggingMap) {
      setIsDraggingMap(false);
      return;
    }
    if (isDraggingMap) {
      setMapTransform((prev) => ({
        ...prev,
        x: prev.x + e.movementX,
        y: prev.y + e.movementY,
      }));
    }
  };

  const handleMapPointerUp = (e) => {
    if (view !== "b-side") return;
    setIsDraggingMap(false);
    try {
      if (
        e.currentTarget &&
        e.currentTarget.hasPointerCapture &&
        e.currentTarget.hasPointerCapture(e.pointerId)
      ) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch (err) {}
  };

  useEffect(() => {
    if (view === "b-side" && !geoMapData) {
      if (globalGeoMapData) {
        setGeoMapData(globalGeoMapData);
        return;
      }
      setIsMapLoading(true);
      fetch("https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json")
        .then((res) => res.json())
        .then((data) => {
          globalGeoMapData = data;
          setGeoMapData(data);
          setIsMapLoading(false);
        })
        .catch((err) => {
          console.error("Map fetch failed", err);
          showToast("地图数据加载失败，请检查网络连接");
          setIsMapLoading(false);
        });
    }
  }, [view, geoMapData]);

  const memoizedMapPaths = useMemo(() => {
    if (!geoMapData) return [];
    return geoMapData.features
      .map((feature, i) => {
        const name = feature.properties.name;
        if (!name) return null;
        if (
          name.includes("南海") ||
          name.includes("段线") ||
          name.includes("香港") ||
          name.includes("澳门")
        )
          return null;

        let displayName = name
          .replace(/维吾尔自治区|壮族自治区|回族自治区|自治区|特别行政区/g, "")
          .replace(/省|市$/g, "");

        const pathData = generateSvgPath(
          feature.geometry.coordinates,
          feature.geometry.type,
        );
        const color = getProvColor(displayName);

        let center = feature.properties.center || feature.properties.centroid;

        const visualOffsets = {
          新疆: [-1.5, 0.8],
          青海: [0.6, -0.2],
          西藏: [-1.0, 0.0],
          内蒙古: [0.4, 0.5],
          甘肃: [-0.6, -0.6],
          陕西: [0.3, -1.0],
          河北: [0.2, 0.8],
          黑龙江: [0.5, 0.5],
          广东: [0, 0.6],
          四川: [-0.5, 0.5],
          江苏: [0.2, -0.4],
          福建: [-0.3, 0.1],
          浙江: [-0.1, -0.3],
          宁夏: [0.2, -0.2],
          山西: [-0.1, -0.3],
          重庆: [-0.2, -0.2],
        };

        const offsetKey = Object.keys(visualOffsets).find((k) =>
          name.includes(k),
        );
        if (center && offsetKey) {
          center = [
            center[0] + visualOffsets[offsetKey][0],
            center[1] + visualOffsets[offsetKey][1],
          ];
        }

        let labelPos = center ? projectGeo(center[0], center[1]) : null;

        return {
          id: feature.properties.adcode || i,
          name: displayName,
          pathData,
          color,
          labelPos,
        };
      })
      .filter(Boolean);
  }, [geoMapData]);

  const focusOnProvince = (prov) => {
    if (!prov || !prov.labelPos) return;
    const [px, py] = prov.labelPos;

    const targetScale = 2.8;
    const cw = mapContainerRef.current
      ? mapContainerRef.current.clientWidth
      : 1000;
    const ch = mapContainerRef.current
      ? mapContainerRef.current.clientHeight
      : 800;

    const cx = cw / 2;
    const cy = ch / 2;

    const renderScale = Math.min(cw / 800, ch / 650, 896 / 800) * 0.95;

    const offsetX = (px - 400) * renderScale;
    const offsetY = (py - 325) * renderScale;

    const finalX = cx - cx * targetScale - offsetX * targetScale;
    const finalY = cy - cy * targetScale - offsetY * targetScale;

    setMapTransform({ x: finalX, y: finalY, scale: targetScale });
    setBSideSelectedProv(prov.name);
    setShowProvinceConfirm(prov.name);
  };

  const handleBSideAiSubmit = () => {
    if (!bSideAiInput.trim()) return;
    playSound("action");

    const matchedProv = memoizedMapPaths.find(
      (p) =>
        bSideAiInput.includes(p.name) ||
        (p.name.length >= 2 && bSideAiInput.includes(p.name.substring(0, 2))),
    );

    if (matchedProv) {
      focusOnProvince(matchedProv);
    } else {
      showToast(
        `已收到需求: ${bSideAiInput}，未匹配到特定省份，将为您全局规划...`,
      );
    }
    setBSideAiInput("");
  };

  // --- B面二级编辑器逻辑 ---
  const getStyleOptions = (prov) => {
    if (!prov) return ["通用风格"];
    if (prov.includes("福建") || prov.includes("台湾"))
      return ["通用风格", "福建麻将", "厦门麻将", "泉州游金", "带鬼玩法"];
    if (prov.includes("广东") || prov.includes("广西"))
      return ["通用风格", "广东麻将", "推倒胡", "鸡平胡", "粤语喊麦"];
    if (prov.includes("四川") || prov.includes("重庆"))
      return ["通用风格", "四川麻将", "血战到底", "血流成河", "川味解说"];
    if (prov.includes("湖南") || prov.includes("湖北"))
      return ["通用风格", "红中麻将", "转转麻将", "卡五星"];
    return ["通用风格", `${prov}地方麻将`, `${prov}方言解说`, "休闲搞笑"];
  };

  const currentStyleOptions = useMemo(
    () => getStyleOptions(bSideSelectedProv),
    [bSideSelectedProv],
  );

  useEffect(() => {
    setBEditorStyle("通用风格");
    setBEditorScripts([]);
  }, [bSideSelectedProv]);

  const handleBEditorGenerate = () => {
    setIsBEditorGenerating(true);
    playSound("action");
    setTimeout(() => {
      const pName = bEditorProductName.trim() || "微乐麻将";
      const style = bEditorStyle;
      const newScripts = [
        `朋友们别再打牌了，赶紧来试试这个${pName}，这是一款专供中年人的小程序游戏，不用下载，点击就能开始玩！`,
        `这把真的绝了！${style}的精髓就在这里，翻盘就在一瞬间！正宗本地规则，老乡都在玩。`,
        `打麻将是大多数中年朋友喜欢的娱乐方式，最近我发现了这个${pName}，只需微信就能玩，${style}地道极了！`,
        `爱打麻将的中年朋友们注意了，我推荐你们试试这个${pName}，既好玩又方便，随时随地匹配！`,
        `如果你喜欢心跳的感觉，这一局绝对不能错过。${pName}，正宗${style}，快来点击下方链接试试吧！`,
      ].map((text, i) => ({ id: Date.now() + i, text, saved: false }));
      setBEditorScripts(newScripts);
      setIsBEditorGenerating(false);
      playSound("backpack");
    }, 1500);
  };

  const handleSaveToKb = (id) => {
    playSound("action");
    setBEditorScripts((prev) =>
      prev.map((s) => (s.id === id ? { ...s, saved: true } : s)),
    );
    showToast("✔️ 已成功存入知识库，AI将学习该文案结构！");
  };

  const handleStartBVideoRender = () => {
    if (bEditorScripts.length === 0) {
      showToast("请先在左侧智能生成文案！");
      return;
    }
    playSound("action");
    setView("b-side-video-render");
    setBVideoRenderProgress(0);
    setActiveBVideoIndex(0);

    let p = 0;
    const renderInterval = setInterval(() => {
      p += Math.floor(Math.random() * 8) + 2;
      if (p >= 100) {
        p = 100;
        clearInterval(renderInterval);
        playSound("backpack");
      }
      setBVideoRenderProgress(p);
    }, 200);
  };

  const handleExportAllVideos = () => {
    playSound("action");
    showToast("打包完成，即将保存到本地...");
    setTimeout(() => {
      setExportPathModal(true);
    }, 500);
  };

  const getSafePosition = (startX, startY, width, nodeType, currentNodes) => {
    const heightMap = {
      script: 140,
      character: 380,
      storyboard: 400,
      video: 280,
    };
    const height = heightMap[nodeType] || 150;
    const padding = 40;
    let safeX = startX;
    let safeY = startY;
    let hasCollision = true;
    let loops = 0;
    while (hasCollision && loops < 100) {
      hasCollision = false;
      for (let n of currentNodes) {
        const nW = n.width || 320;
        const nH = heightMap[n.type] || 150;
        if (
          safeX < n.x + nW + padding &&
          safeX + width + padding > n.x &&
          safeY < n.y + nH + padding &&
          safeY + height + padding > n.y
        ) {
          safeY = n.y + nH + padding;
          hasCollision = true;
          break;
        }
      }
      loops++;
    }
    return { x: safeX, y: safeY };
  };

  const handleAddCustomStyle = (e) => {
    e.preventDefault();
    if (!customRequirement.trim()) return;
    playSound("action");
    setIsFlyingToConveyor(true);
    setTimeout(() => {
      setHookStyles((prev) => [
        {
          id: `custom-${Date.now()}`,
          name: customRequirement,
          icon: <Wand2 size={16} className="text-orange-400" />,
          desc: customRequirement,
          isDefault: false,
        },
        ...prev,
      ]);
      setIsFlyingToConveyor(false);
      setCustomRequirement("");
    }, 600);
  };

  const deleteStyle = (id, e) => {
    e.stopPropagation();
    playSound("delete");
    setHookStyles((prev) => prev.filter((s) => s.id !== id));
  };

  const openGemEditor = (mode, gem = null) => {
    playSound("nav");
    setGemEditorMode(mode);
    if (gem) setGemEditData({ id: gem.id, name: gem.name, prompt: gem.prompt });
    else setGemEditData({ name: "", prompt: "" });
  };

  const saveGem = () => {
    if (!gemEditData.name.trim()) return;
    playSound("action");
    if (gemEditorMode === "create") {
      setPersonas([...personas, { id: Date.now(), ...gemEditData }]);
    } else {
      setPersonas(
        personas.map((p) =>
          p.id === gemEditData.id ? { ...p, ...gemEditData } : p,
        ),
      );
    }
    setGemEditorMode(null);
  };

  const deleteGem = (id, e) => {
    e.stopPropagation();
    playSound("delete");
    setPersonas(personas.filter((p) => p.id !== id));
    if (activePersonaId === id && personas.length > 1)
      setActivePersonaId(personas[0].id);
  };

  const generateScripts = async () => {
    playSound("action");
    setIsGenerating(true);
    setTimeout(() => {
      const stylePool =
        MOCK_SCRIPTS_LIBRARY[selectedStyle] || MOCK_SCRIPTS_LIBRARY.default;
      const selected = [...stylePool]
        .sort(() => 0.5 - Math.random())
        .slice(0, batchSize);
      setASideScripts(
        selected.map((text, i) => ({ id: Date.now() + i, text })),
      );
      setIsGenerating(false);
    }, 500);
  };

  const generateFromKnowledgeBase = () => {
    playSound("action");
    setASideModel("kb");
    setIsKbAnalyzing(true);

    setTimeout(() => {
      setIsKbAnalyzing(false);
      setIsGenerating(true);
      setTimeout(() => {
        const kbMockScripts = [
          "[黄金3秒提取] 极速放大画面：这牌打得稀烂，但我笑得灿烂！",
          "[悬念结构复刻] BGM骤停：他手里最后一张牌，竟然是...",
          "[高转化痛点] 贴脸字卡：正宗本地规则，老乡都在玩！",
          "[情绪锚点学习] 夸张特效：生死时刻，绝杀翻盘！",
        ];
        const selected = [...kbMockScripts]
          .sort(() => 0.5 - Math.random())
          .slice(0, batchSize);
        setASideScripts(
          selected.map((text, i) => ({ id: Date.now() + i, text })),
        );
        setIsGenerating(false);
        showToast("已成功应用知识库高转化素材结构！");
      }, 800);
    }, 1500);
  };

  const saveScriptEdit = (id) => {
    if (!tempEditText.trim()) return;
    playSound("action");
    setASideScripts((prev) =>
      prev.map((s) => (s.id === id ? { ...s, text: tempEditText } : s)),
    );
    setEditingScriptId(null);
  };

  const regenerateSingleScript = (index) => {
    playSound("action");
    const stylePool =
      MOCK_SCRIPTS_LIBRARY[selectedStyle] || MOCK_SCRIPTS_LIBRARY.default;
    const randomText = stylePool[Math.floor(Math.random() * stylePool.length)];

    setASideScripts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], text: "✨ 正在重新生成..." };
      return next;
    });

    setTimeout(() => {
      setASideScripts((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], text: randomText };
        return next;
      });
      playSound("click");
    }, 600);
  };

  const handleSaveToLibrary = (index) => {
    const card = scriptRefs.current[index];
    const libBtn = document.getElementById("library-button");
    if (!card || !libBtn) return;
    const cardRect = card.getBoundingClientRect();
    const libRect = libBtn.getBoundingClientRect();
    playSound("backpack");
    setSuccessAnimation({
      index,
      tx: libRect.left - cardRect.left + 20,
      ty: libRect.top - cardRect.top + 10,
    });
    setTimeout(() => {
      setLibraryPulse(true);
      setLibraryScripts((prev) => [
        ...prev,
        { id: Date.now() + index, text: aSideScripts[index].text },
      ]);
      setTimeout(() => setLibraryPulse(false), 400);
      setSuccessAnimation(null);
    }, 700);
  };

  const handleDragStart = (e, index) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e, index) => {
    e.preventDefault();
  };
  const handleDrop = (e, index) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    const newScripts = [...libraryScripts];
    const draggedItem = newScripts[draggedIdx];
    newScripts.splice(draggedIdx, 1);
    newScripts.splice(index, 0, draggedItem);
    setLibraryScripts(newScripts);
    setDraggedIdx(null);
    playSound("click");
  };

  const handleQuickProduce = () => {
    if (libraryScripts.length === 0) {
      showToast("待产库为空，请先从下方勾选生成的文案！");
      return;
    }
    if (libraryScripts.length < 4) {
      playSound("nav");
      setShowQuickProduceConfirm(true);
      return;
    }
    executeQuickProduce();
  };

  const executeQuickProduce = () => {
    setShowQuickProduceConfirm(false);
    playSound("action");
    setIsAgentProcessing(true);

    setTimeout(() => {
      const defaultExpansions = [
        "AI 编剧自动拓展：大特写玩家紧张的眼神...",
        "AI 编剧自动拓展：金币爆出的特效镜头...",
        "AI 编剧自动拓展：上帝视角俯瞰牌局...",
        "AI 编剧自动拓展：结尾动态引导下载...",
      ];

      const newSlots = videoSlots.map((slot, idx) => ({
        ...slot,
        script: libraryScripts[idx]
          ? libraryScripts[idx].text
          : defaultExpansions[idx],
        model: null,
        status: "idle",
        progress: 0,
        isSelected: false,
      }));

      setVideoSlots(newSlots);
      setIsAgentProcessing(false);
      setView("video-factory");
    }, 2500);
  };

  const handleAssignModel = (modelId) => {
    playSound("action");
    const target = modelModalInfo.target;
    setModelModalInfo({ isOpen: false, target: null });

    const startGenerationForSlot = (slotId) => {
      setVideoSlots((prev) =>
        prev.map((s) =>
          s.id === slotId
            ? {
                ...s,
                model: modelId,
                status: "generating",
                progress: 0,
                isSelected: false,
              }
            : s,
        ),
      );
      let p = 0;
      const speed = Math.random() * 5 + 5;
      const interval = setInterval(() => {
        p += speed;
        if (p >= 100) {
          p = 100;
          clearInterval(interval);
          setVideoSlots((prev) =>
            prev.map((s) =>
              s.id === slotId ? { ...s, status: "done", progress: 100 } : s,
            ),
          );
          playSound("backpack");
        } else {
          setVideoSlots((prev) =>
            prev.map((s) =>
              s.id === slotId && s.status === "generating"
                ? { ...s, progress: Math.min(Math.round(p), 99) }
                : s,
            ),
          );
        }
      }, 300);
    };

    if (target === "global") {
      videoSlots.forEach((s) => startGenerationForSlot(s.id));
    } else {
      startGenerationForSlot(target);
    }
  };

  const handleRegenerateSlot = (slotId) => {
    playSound("action");
    const slot = videoSlots.find((s) => s.id === slotId);
    if (slot && slot.model) {
      setVideoSlots((prev) =>
        prev.map((s) =>
          s.id === slotId
            ? { ...s, status: "generating", progress: 0, isSelected: false }
            : s,
        ),
      );
      let p = 0;
      const speed = Math.random() * 5 + 5;
      const interval = setInterval(() => {
        p += speed;
        if (p >= 100) {
          p = 100;
          clearInterval(interval);
          setVideoSlots((prev) =>
            prev.map((s) =>
              s.id === slotId ? { ...s, status: "done", progress: 100 } : s,
            ),
          );
          playSound("backpack");
        } else {
          setVideoSlots((prev) =>
            prev.map((s) =>
              s.id === slotId && s.status === "generating"
                ? { ...s, progress: Math.min(Math.round(p), 99) }
                : s,
            ),
          );
        }
      }, 300);
    }
  };

  const toggleSlotSelection = (slotId) => {
    playSound("click");
    setVideoSlots((prev) =>
      prev.map((s) =>
        s.id === slotId ? { ...s, isSelected: !s.isSelected } : s,
      ),
    );
  };

  const handleSlotScriptChange = (slotId, newScript) => {
    setVideoSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, script: newScript } : s)),
    );
  };

  const handleGlobalAction = (actionType) => {
    const selectedSlots = videoSlots.filter(
      (s) => s.status === "done" && s.isSelected,
    );
    if (selectedSlots.length === 0) {
      showToast("请先勾选已生成满意的成品视频！");
      return;
    }
    playSound("action");

    if (actionType === "local") {
      showToast(`已成功将 ${selectedSlots.length} 个视频存档至本地A面库！`);
    } else if (actionType === "upload") {
      const newSources = selectedSlots.map((s) => ({
        id: `src-${s.id}`,
        title: `实机转化分镜_00${s.id}.mp4`,
        type: "video",
        excerpt: s.script,
      }));
      setKbSources(newSources);
      setAudioOverviewReady(false);
      setKbChatHistory([
        {
          role: "assistant",
          text: `已为您成功加载 ${newSources.length} 个素材源。我是您的广告策略大模型，您可以向我提问分析，或者生成一期深度素材解析播客。`,
        },
      ]);
      setView("knowledge-base");
    }
  };

  const handleKBSendChat = (e) => {
    e.preventDefault();
    if (!kbInput.trim()) return;
    playSound("click");
    setKbChatHistory((prev) => [...prev, { role: "user", text: kbInput }]);
    const currentInput = kbInput;
    setKbInput("");
    setTimeout(() => {
      playSound("backpack");
      setKbChatHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `基于您上传的 ${kbSources.length} 个源分析，您提到的“${currentInput}”确实是核心点。其中“${kbSources[0]?.excerpt?.substring(0, 10)}...”这条脚本的钩子结构最符合当前下沉市场的心理预期。`,
        },
      ]);
    }, 1000);
  };

  const handleGenerateAudioOverview = () => {
    playSound("action");
    setIsAudioGenerating(true);
    setTimeout(() => {
      setIsAudioGenerating(false);
      setAudioOverviewReady(true);
      playSound("backpack");
    }, 3000);
  };

  const handleSelectStyle = (style) => {
    playSound("click");
    setDirectorInput((prev) => {
      const text = prev.trim();
      return text
        ? `${text}\n[风格参考: ${style.name}] `
        : `[风格参考: ${style.name}] `;
    });
    setShowStyleLib(false);
    showToast(`已附加风格预设：${style.name}`);
  };

  const handleDirectorSend = (e) => {
    if (e) e.preventDefault();
    if (!directorInput.trim()) return;
    playSound("click");

    setDirectorChatHistory((prev) => [
      ...prev,
      { role: "user", text: directorInput },
    ]);
    const currentInput = directorInput;
    setDirectorInput("");

    setTimeout(() => {
      playSound("backpack");
      setDirectorChatHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          name: "系统助手",
          text: `已收到指令：“${currentInput}”，正在为您解析画面结构并更新右侧节点树...`,
        },
      ]);
    }, 1000);
  };

  const handleEnterDirectorMode = () => {
    playSound("click");
    if (libraryScripts.length === 0) {
      showToast("待产库为空，请先在上方生成并勾选文案！");
      return;
    }
    setLibraryMode("select");
    setShowLibraryModal(true);
    showToast("导演模式每次仅限精细化创作一条脚本，请从库中选择：");
  };

  const handleSelectDirectorScript = (script) => {
    playSound("action");
    setDirectorScript(script);
    setShowLibraryModal(false);
    setLibraryMode("view");

    setCanvasTransform({ x: 0, y: 0, scale: 1 });
    setSelectedNodeIds([]);

    setCanvasNodes([
      {
        id: "node_script",
        type: "script",
        width: 320,
        x: 240,
        y: 50,
        data: { text: script.text },
      },
    ]);
    setCanvasEdges([]);
    setDirConfig({ length: "short", ratio: "horizontal" });

    setDirectorChatHistory([
      {
        role: "assistant",
        name: "艺术总监",
        text: "您好！我是您的AI艺术总监。您的脚本已同步至右侧画板，您可以随时双击修改。在正式分发任务前，请确认项目的基础规格：",
        isConfigForm: true,
      },
    ]);
    setView("director-mode");
  };

  const handleDirectorConfigSubmit = () => {
    playSound("click");

    const lengthStr =
      dirConfig.length === "short" ? "短视频 (<15s)" : "长视频 (>15s)";
    const ratioStr =
      dirConfig.ratio === "horizontal" ? "横版 (16:9)" : "竖版 (9:16)";
    const summary = `【已确认规格】 ${lengthStr} | ${ratioStr}`;

    setDirectorChatHistory((prev) => {
      const newHistory = [...prev];
      if (newHistory[0].isConfigForm) newHistory[0].submitted = true;
      return [...newHistory, { role: "user", text: summary }];
    });

    setTimeout(() => {
      playSound("nav");
      setDirectorChatHistory((prev) => [
        ...prev,
        { role: "system", text: "艺术总监 邀请 选角导演 加入了群聊" },
      ]);

      setTimeout(() => {
        playSound("backpack");
        setDirectorChatHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            name: "选角导演",
            text: "大家好，我是选角导演。请问是想自己上传人物参考图，还是由我为您分析脚本并自动生成人物设定与概念图？",
            buttons: [
              { label: "上传人物参考图", action: "upload_ref" },
              { label: "⚡ 根据脚本自动生成", action: "auto_gen_char" },
            ],
          },
        ]);
      }, 1000);
    }, 800);
  };

  const handleRegenerateCanvasNode = (nodeId) => {
    playSound("action");
    setCanvasNodes((prev) =>
      prev.map((n) => {
        if (n.id === nodeId) {
          if (n.type === "character")
            return { ...n, data: { ...n.data, isGeneratingImage: true } };
          return { ...n, isGenerating: true };
        }
        return n;
      }),
    );

    setTimeout(() => {
      playSound("backpack");
      setCanvasNodes((prev) =>
        prev.map((n) => {
          if (n.id === nodeId) {
            if (n.type === "character") {
              return {
                ...n,
                data: {
                  ...n.data,
                  isGeneratingImage: false,
                  imageUrl: n.data.imageUrl + "&r=" + Date.now(),
                },
              };
            }
            return {
              ...n,
              isGenerating: false,
              data: { ...n.data, url: n.data.url + "&r=" + Date.now() },
            };
          }
          return n;
        }),
      );
      showToast("节点资产已刷新！");
    }, 2500);
  };

  const handleDirectorChatAction = (action, label) => {
    playSound("click");
    setDirectorChatHistory((prev) => [...prev, { role: "user", text: label }]);

    if (action === "auto_gen_char") {
      setTimeout(() => {
        playSound("action");
        setDirectorChatHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            name: "选角导演",
            text: "收到！正在为您解析脚本深意并提取核心人物群像... \n已在右侧画布布置人物综合模块。正在后台黑盒调用 Banana 视觉模型生图，请稍候...",
          },
        ]);

        setCanvasNodes((prev) => {
          let newNodes = [...prev];
          const charData = [
            {
              id: "node_char_1",
              type: "character",
              width: 320,
              startX: 50,
              startY: 250,
              data: {
                title: "可能出现的人物 1",
                name: "阿强 (核心玩家)",
                desc: "三十岁左右，面容略显疲惫，典型下沉市场玩家。",
                imageUrl:
                  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
                isGeneratingImage: true,
              },
            },
            {
              id: "node_char_2",
              type: "character",
              width: 320,
              startX: 400,
              startY: 250,
              data: {
                title: "可能出现的人物 2",
                name: "阿祖 (对局老油条)",
                desc: "戴着半框眼镜，常年混迹棋牌室，表情波澜不惊。",
                imageUrl:
                  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80",
                isGeneratingImage: true,
              },
            },
            {
              id: "node_char_3",
              type: "character",
              width: 320,
              startX: 750,
              startY: 250,
              data: {
                title: "可能出现的人物 3",
                name: "小龙 (跟风新手)",
                desc: "二十出头，喜欢咋咋呼呼，不懂规矩，牌技极差。",
                imageUrl:
                  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
                isGeneratingImage: true,
              },
            },
          ];

          charData.forEach((c) => {
            const safe = getSafePosition(
              c.startX,
              c.startY,
              c.width,
              c.type,
              newNodes,
            );
            newNodes.push({ ...c, x: safe.x, y: safe.y });
          });
          return newNodes;
        });

        setCanvasEdges((prev) => [
          ...prev,
          { id: "edge_s_c1", source: "node_script", target: "node_char_1" },
          { id: "edge_s_c2", source: "node_script", target: "node_char_2" },
          { id: "edge_s_c3", source: "node_script", target: "node_char_3" },
        ]);

        setTimeout(() => {
          playSound("backpack");
          setCanvasNodes((prev) =>
            prev.map((n) => {
              if (n.type === "character")
                return { ...n, data: { ...n.data, isGeneratingImage: false } };
              return n;
            }),
          );

          setTimeout(() => {
            playSound("nav");
            setDirectorChatHistory((prev) => [
              ...prev,
              { role: "system", text: "选角导演 邀请 分镜师 加入了群聊" },
            ]);

            setTimeout(() => {
              playSound("backpack");
              setDirectorChatHistory((prev) => [
                ...prev,
                {
                  role: "assistant",
                  name: "分镜师",
                  text: "各位好，我是分镜师。人物综合视觉设定已就绪！如果有不满意的设定，您可以点击节点右上角铅笔图标进行修改，修改后将根据新提示词自动刷新图片。\n\n确认无误后，请点击【下一步】输出核心分镜矩阵。",
                  buttons: [
                    {
                      label: "🚀 确认人物，输出 5x5 动态分镜",
                      action: "generate_storyboard",
                    },
                  ],
                },
              ]);
            }, 1000);
          }, 1500);
        }, 3500);
      }, 1000);
    } else if (action === "generate_storyboard") {
      setTimeout(() => {
        playSound("action");
        setDirectorChatHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            name: "分镜师",
            text: `正在融合多角色特征... 正在后台调用 Banana 模型生成核心分镜图 (${dirConfig.ratio === "horizontal" ? "16:9横版" : "9:16竖版"})，请稍候...`,
          },
        ]);

        const isHorizontal = dirConfig.ratio === "horizontal";
        const storyboardWidth = isHorizontal ? 640 : 360;
        const storyboardLabel = `5x5 核心动态分镜 (${isHorizontal ? "16:9" : "9:16"})`;
        const centerPosX = isHorizontal ? 240 : 380;

        setCanvasNodes((prev) => {
          let newNodes = [...prev];
          const sb = {
            id: "node_storyboard",
            type: "storyboard",
            width: storyboardWidth,
            startX: centerPosX,
            startY: 700,
            isGenerating: true,
            data: { label: storyboardLabel, isHorizontal },
          };
          const safe = getSafePosition(
            sb.startX,
            sb.startY,
            sb.width,
            sb.type,
            newNodes,
          );
          newNodes.push({ ...sb, x: safe.x, y: safe.y });
          return newNodes;
        });

        // 从新合并的 character 节点连接到分镜
        setCanvasEdges((prev) => [
          ...prev,
          {
            id: "edge_c1_sb",
            source: "node_char_1",
            target: "node_storyboard",
          },
          {
            id: "edge_c2_sb",
            source: "node_char_2",
            target: "node_storyboard",
          },
          {
            id: "edge_c3_sb",
            source: "node_char_3",
            target: "node_storyboard",
          },
        ]);

        setTimeout(() => {
          playSound("backpack");
          setDirectorChatHistory((prev) => [
            ...prev,
            {
              role: "assistant",
              name: "分镜师",
              text: `🎬 核心分镜矩阵生成完毕！确认无误后，请交接给摄像导演开始成片渲染。`,
              buttons: [
                { label: "🎥 分镜确认，开始拍摄", action: "invite_cameraman" },
              ],
            },
          ]);

          setCanvasNodes((prev) =>
            prev.map((n) => {
              if (n.id === "node_storyboard")
                return { ...n, isGenerating: false };
              return n;
            }),
          );
        }, 4000);
      }, 800);
    } else if (action === "invite_cameraman") {
      setTimeout(() => {
        playSound("nav");
        setDirectorChatHistory((prev) => [
          ...prev,
          { role: "system", text: "分镜师 邀请 摄像导演 加入了群聊" },
        ]);

        setTimeout(() => {
          playSound("action");
          setDirectorChatHistory((prev) => [
            ...prev,
            {
              role: "assistant",
              name: "摄像导演",
              text: `我是摄像导演！根据配置（${dirConfig.length === "short" ? "短视频" : "长视频"}），正在调度底层大模型进行运动轨迹渲染...`,
            },
          ]);

          const isHorizontal = dirConfig.ratio === "horizontal";
          const isLong = dirConfig.length === "long";

          setCanvasNodes((prev) => {
            let newNodes = [...prev];

            if (!isLong) {
              const v = {
                id: "node_video_short",
                type: "video",
                width: 320,
                startX: 400,
                startY: 1150,
                isGenerating: true,
                data: {
                  title: "视频最终输出",
                  label: "Lego_Ads_Short.mp4",
                  duration: "15s",
                  isFinal: true,
                  url: "",
                  isHorizontal,
                },
              };
              const safe = getSafePosition(
                v.startX,
                v.startY,
                v.width,
                v.type,
                newNodes,
              );
              newNodes.push({ ...v, x: safe.x, y: safe.y });
              setCanvasEdges((edges) => [
                ...edges,
                {
                  id: "edge_sb_vshort",
                  source: "node_storyboard",
                  target: "node_video_short",
                },
              ]);
            } else {
              const sliceWidth = isHorizontal ? 240 : 160;
              const gap = 40;
              const totalWidth = 6 * sliceWidth + 5 * gap;
              const startX = 560 - totalWidth / 2;

              const newEdges = [];
              Array.from({ length: 6 }).forEach((_, i) => {
                const slice = {
                  id: `node_video_slice_${i}`,
                  type: "video",
                  width: sliceWidth,
                  startX: startX + i * (sliceWidth + gap),
                  startY: 1150,
                  isGenerating: true,
                  data: {
                    title: `视频切片 ${i + 1}`,
                    label: `片段 0${i + 1}`,
                    duration: "05s",
                    isFinal: false,
                    url: "",
                    isHorizontal,
                    sliceIndex: i,
                  },
                };
                const safe = getSafePosition(
                  slice.startX,
                  slice.startY,
                  slice.width,
                  slice.type,
                  newNodes,
                );
                newNodes.push({ ...slice, x: safe.x, y: safe.y });
                newEdges.push({
                  id: `edge_sb_vs${i}`,
                  source: "node_storyboard",
                  target: `node_video_slice_${i}`,
                });
              });
              setCanvasEdges((edges) => [...edges, ...newEdges]);
            }
            return newNodes;
          });

          setTimeout(() => {
            playSound("backpack");
            if (!isLong) {
              setDirectorChatHistory((prev) => [
                ...prev,
                {
                  role: "assistant",
                  name: "摄像导演",
                  text: "✅ 短视频成品渲染完毕！您可以在画布最下方预览播放。",
                },
              ]);
              setCanvasNodes((prev) =>
                prev.map((n) =>
                  n.id === "node_video_short"
                    ? {
                        ...n,
                        isGenerating: false,
                        data: { ...n.data, url: STOCK_VIDEO_URLS[0] },
                      }
                    : n,
                ),
              );
            } else {
              setDirectorChatHistory((prev) => [
                ...prev,
                {
                  role: "assistant",
                  name: "摄像导演",
                  text: "🎞️ 6个长视频切片均已渲染完毕！请核对画面，若无误，请点击下方合成最终成片。",
                  buttons: [
                    { label: "🎞️ 合成完整长视频", action: "merge_long_video" },
                  ],
                },
              ]);
              setCanvasNodes((prev) =>
                prev.map((n) =>
                  n.id.startsWith("node_video_slice")
                    ? {
                        ...n,
                        isGenerating: false,
                        data: {
                          ...n.data,
                          url: STOCK_VIDEO_URLS[
                            n.data.sliceIndex % STOCK_VIDEO_URLS.length
                          ],
                        },
                      }
                    : n,
                ),
              );
            }
          }, 5000);
        }, 1000);
      }, 800);
    } else if (action === "merge_long_video") {
      setTimeout(() => {
        playSound("action");
        setDirectorChatHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            name: "摄像导演",
            text: "收到！正在将6个切片顺滑拼接压制，生成 30s 最终长视频...",
          },
        ]);

        const isHorizontal = dirConfig.ratio === "horizontal";
        const finalId = "node_video_final_long";

        setCanvasNodes((prev) => {
          let newNodes = [...prev];
          const finalNode = {
            id: finalId,
            type: "video",
            width: isHorizontal ? 640 : 360,
            startX: isHorizontal ? 240 : 380,
            startY: 1500,
            isGenerating: true,
            data: {
              title: "最终成片 (30s)",
              label: "Lego_Ads_Long_Final.mp4",
              duration: "30s",
              isFinal: true,
              url: "",
              isHorizontal,
            },
          };
          const safe = getSafePosition(
            finalNode.startX,
            finalNode.startY,
            finalNode.width,
            finalNode.type,
            newNodes,
          );
          newNodes.push({ ...finalNode, x: safe.x, y: safe.y });

          const newEdges = Array.from({ length: 6 }).map((_, i) => ({
            id: `edge_vs${i}_final`,
            source: `node_video_slice_${i}`,
            target: finalId,
          }));
          setCanvasEdges((edges) => [...edges, ...newEdges]);

          return newNodes;
        });

        setTimeout(() => {
          playSound("backpack");
          setDirectorChatHistory((prev) => [
            ...prev,
            {
              role: "assistant",
              name: "系统助手",
              text: "🎉 恭喜！整个复杂的长视频制作流水线已跑通。成片已就绪！",
            },
          ]);
          setCanvasNodes((prev) =>
            prev.map((n) =>
              n.id === finalId
                ? {
                    ...n,
                    isGenerating: false,
                    data: {
                      ...n.data,
                      url: "https://images.unsplash.com/photo-1493612276216-ee3925520721?auto=format&fit=crop&w=800&q=80",
                    },
                  }
                : n,
            ),
          );
        }, 3500);
      }, 800);
    } else if (action === "upload_ref") {
      setTimeout(() => {
        playSound("nav");
        setDirectorChatHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            name: "选角导演",
            text: "好的！请点击下方对话框左侧的【+】或【图片】图标，上传您的参考图片。",
          },
        ]);
        showToast("请点击下方加号或图片图标上传");
        setHighlightUpload(true);
        setTimeout(() => setHighlightUpload(false), 4000);
      }, 800);
    }
  };

  const handleCanvasPointerDown = (e) => {
    if (e.target.closest("button, textarea, input")) return;

    const nodeEl = e.target.closest(".canvas-node");
    if (nodeEl) {
      const id = nodeEl.dataset.id;
      setDragNodeId(id);
      if (!selectedNodeIds.includes(id)) {
        setSelectedNodeIds([id]);
      }
      e.currentTarget.setPointerCapture(e.pointerId);
      playSound("click");
    } else {
      if (e.button === 0) {
        setIsSelecting(true);
        const rect = e.currentTarget.getBoundingClientRect();
        const canvasX =
          (e.clientX - rect.left - canvasTransform.x) / canvasTransform.scale;
        const canvasY =
          (e.clientY - rect.top - canvasTransform.y) / canvasTransform.scale;
        setSelectionBox({
          startX: canvasX,
          startY: canvasY,
          endX: canvasX,
          endY: canvasY,
        });
        if (!e.shiftKey) setSelectedNodeIds([]);
        e.currentTarget.setPointerCapture(e.pointerId);
      } else if (e.button === 1 || e.button === 2) {
        setIsDraggingCanvas(true);
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    }
  };

  const handleCanvasPointerMove = (e) => {
    if (e.buttons === 0 && (isDraggingCanvas || dragNodeId || isSelecting)) {
      handleCanvasPointerUp(e);
      return;
    }

    if (isDraggingCanvas) {
      setCanvasTransform((prev) => ({
        ...prev,
        x: prev.x + e.movementX,
        y: prev.y + e.movementY,
      }));
    } else if (isSelecting) {
      const rect = e.currentTarget.getBoundingClientRect();
      const canvasX =
        (e.clientX - rect.left - canvasTransform.x) / canvasTransform.scale;
      const canvasY =
        (e.clientY - rect.top - canvasTransform.y) / canvasTransform.scale;
      setSelectionBox((prev) => ({ ...prev, endX: canvasX, endY: canvasY }));

      const minX = Math.min(selectionBox.startX, canvasX);
      const maxX = Math.max(selectionBox.startX, canvasX);
      const minY = Math.min(selectionBox.startY, canvasY);
      const maxY = Math.max(selectionBox.startY, canvasY);

      const newlySelected = canvasNodes
        .filter((n) => {
          const nw = n.width || 320;
          const nh = 150;
          return !(
            n.x > maxX ||
            n.x + nw < minX ||
            n.y > maxY ||
            n.y + nh < minY
          );
        })
        .map((n) => n.id);

      setSelectedNodeIds(newlySelected);
    } else if (dragNodeId) {
      const dx = e.movementX / canvasTransform.scale;
      const dy = e.movementY / canvasTransform.scale;
      setCanvasNodes((prev) =>
        prev.map((n) => {
          if (selectedNodeIds.includes(n.id) || n.id === dragNodeId) {
            return { ...n, x: n.x + dx, y: n.y + dy };
          }
          return n;
        }),
      );
    }
  };

  const handleCanvasPointerUp = (e) => {
    setIsDraggingCanvas(false);
    setIsSelecting(false);
    setDragNodeId(null);
    try {
      if (
        e.currentTarget &&
        e.currentTarget.hasPointerCapture &&
        e.currentTarget.hasPointerCapture(e.pointerId)
      ) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch (err) {}
  };

  const handleCanvasWheel = (e) => {
    if (view !== "director-mode") return;
    const zoomSensitivity = 0.001;
    const delta = -e.deltaY * zoomSensitivity;
    let newScale = canvasTransform.scale * (1 + delta);
    newScale = Math.max(0.2, Math.min(newScale, 3));

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const ratio = newScale / canvasTransform.scale;
    const newX = mouseX - (mouseX - canvasTransform.x) * ratio;
    const newY = mouseY - (mouseY - canvasTransform.y) * ratio;

    setCanvasTransform({ x: newX, y: newY, scale: newScale });
  };

  const isDark = theme === "dark";

  const dynamicStyles = `
    @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
    @keyframes syncLinearUp { 0% { transform: translateY(0); } 25% { transform: translateY(-20px); } 50% { transform: translateY(0); } 75% { transform: translateY(20px); } 100% { transform: translateY(0); } }
    @keyframes syncLinearDown { 0% { transform: translateY(0); } 25% { transform: translateY(20px); } 50% { transform: translateY(0); } 75% { transform: translateY(-20px); } 100% { transform: translateY(0); } }
    .animate-sync-up { animation: syncLinearUp 6s linear infinite; }
    .animate-sync-down { animation: syncLinearDown 6s linear infinite; }
    .float-pause:hover { animation-play-state: paused !important; }
    .conveyor-track { display: flex; width: max-content; animation: marquee 30s linear infinite; }
    .conveyor-container:hover .conveyor-track { animation-play-state: paused; }
    @keyframes flyToBag { 0% { transform: translate(0, 0) scale(1); opacity: 1; filter: blur(0); } 100% { transform: translate(var(--tx), var(--ty)) scale(0.1); opacity: 0; filter: blur(8px); } }
    .card-fly { animation: flyToBag 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards; pointer-events: none; z-index: 1000 !important; }
    .glow-orange-diffuse { box-shadow: 0 0 60px 0px rgba(249,115,22, 0.15); }
    .glow-blue-diffuse { box-shadow: 0 0 60px 0px rgba(37, 99, 235, 0.15); }
    .dark .tile-hover-glow:hover { box-shadow: 0 0 30px 5px rgba(249, 115, 22, 0.25) !important; border-color: rgba(249, 115, 22, 0.4) !important; }
    .dark .tile-hover-glow-blue:hover { box-shadow: 0 0 30px 5px rgba(37, 99, 235, 0.25) !important; border-color: rgba(37, 99, 235, 0.4) !important; }
    .lib-pulse-active { animation: libPulse 0.4s; border-color: #22c55e !important; }
    @keyframes libPulse { 0% { transform: scale(1); } 50% { transform: scale(1.15); box-shadow: 0 0 20px 5px rgba(34, 197, 94, 0.3); } 100% { transform: scale(1); } }
    @keyframes pulseGlow { 0% { opacity: 0.5; } 50% { opacity: 1; box-shadow: inset 0 0 20px rgba(255,255,255,0.1); } 100% { opacity: 0.5; } }
    .rendering-pulse { animation: pulseGlow 2s ease-in-out infinite; }
    
    .notebook-bg { background-color: transparent; }
    .notebook-sidebar { background-color: ${isDark ? "#27272A" : "#FFFFFF"}; border-color: ${isDark ? "#3F3F46" : "#E8EAED"}; }
    .notebook-card { background-color: ${isDark ? "#27272A" : "#FFFFFF"}; border-color: ${isDark ? "#3F3F46" : "#E8EAED"}; box-shadow: 0 4px 12px rgba(0,0,0,${isDark ? "0.2" : "0.05"}); }
    .notebook-input { background-color: ${isDark ? "#18181B" : "#F1F3F4"}; }
    .audio-pulse { animation: audioWave 1.2s ease-in-out infinite; }
    @keyframes audioWave { 0% { transform: scaleY(0.5); } 50% { transform: scaleY(1.2); } 100% { transform: scaleY(0.5); } }

    .global-bg-dots-dark {
        background-color: #18181B; 
        background-image: radial-gradient(rgba(255, 255, 255, 0.08) 1.5px, transparent 1.5px);
        background-size: 24px 24px;
    }
    .global-bg-dots-light {
        background-color: #F8FAFC;
        background-image: radial-gradient(rgba(0, 0, 0, 0.05) 1.5px, transparent 1.5px);
        background-size: 24px 24px;
    }

    .bg-dots-dark { 
        background-color: #18181B;
        background-image: radial-gradient(rgba(255, 255, 255, 0.12) 1.5px, transparent 1.5px); 
        background-size: var(--dot-size, 24px) var(--dot-size, 24px);
        background-position: var(--bg-x, 0px) var(--bg-y, 0px);
    }
    .bg-dots-light { 
        background-color: #F8FAFC;
        background-image: radial-gradient(rgba(0, 0, 0, 0.08) 1.5px, transparent 1.5px); 
        background-size: var(--dot-size, 24px) var(--dot-size, 24px);
        background-position: var(--bg-x, 0px) var(--bg-y, 0px);
    }
    
    @keyframes dashLine { to { stroke-dashoffset: -20; } }
    
    .btn-gradient-glow {
        background-size: 200% auto;
        animation: gradientGlow 3s linear infinite;
    }
    @keyframes gradientGlow { 0% { background-position: 0% center; } 50% { background-position: 100% center; } 100% { background-position: 0% center; } }
  `;

  return (
    <div
      className={`${isDark ? "dark global-bg-dots-dark text-slate-300" : "global-bg-dots-light text-slate-600"} min-h-screen font-sans transition-colors duration-700 overflow-x-hidden`}
    >
      <style>{dynamicStyles}</style>

      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[7000] px-6 py-3 bg-[#27272A]/90 backdrop-blur-md border border-white/10 text-white text-sm font-bold rounded-full shadow-2xl animate-in slide-in-from-top-4 flex items-center gap-2">
          <AlertCircle size={16} className="text-orange-500" /> {toastMsg}
        </div>
      )}

      {/* AI编剧处理态 */}
      {isAgentProcessing && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 relative mb-8">
              <div className="absolute inset-0 border-t-4 border-orange-500 rounded-full animate-spin"></div>
              <div className="absolute inset-2 border-r-4 border-blue-500 rounded-full animate-[spin_1.5s_reverse_infinite]"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Wand2 size={32} className="text-white animate-pulse" />
              </div>
            </div>
            <h2 className="text-2xl font-black text-white mb-3 tracking-widest uppercase">
              AI 编剧 Agent 介入中
            </h2>
            <p className="text-slate-400 font-mono text-sm type-writer">
              正在解析文案，拆解核心分镜头并生成物理模拟提示词...
            </p>
          </div>
        </div>
      )}

      {/* 确认弹窗 */}
      {showQuickProduceConfirm && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowQuickProduceConfirm(false)}
          ></div>
          <div
            className={`relative w-full max-w-md p-8 rounded-[32px] border shadow-2xl animate-in zoom-in-95 ${isDark ? "bg-[#27272A] border-orange-500/30" : "bg-white border-orange-200"}`}
          >
            <div className="flex items-center gap-4 mb-4 text-orange-500">
              <AlertCircle size={32} />
              <h3
                className={`text-xl font-black ${isDark ? "text-white" : "text-slate-900"}`}
              >
                待产库数量不足
              </h3>
            </div>
            <p
              className={`text-sm mb-8 leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}
            >
              是否继续下一步？目前待产库数量不足 4 条（当前{" "}
              {libraryScripts.length} 条），继续将使用 AI
              自动拓展补齐剩余分镜。您也可以取消并继续添加。
            </p>
            <div className="flex items-center justify-end gap-4">
              <button
                onClick={() => {
                  setShowQuickProduceConfirm(false);
                  playSound("click");
                }}
                className={`px-6 py-3 rounded-2xl font-bold transition-all ${isDark ? "bg-white/5 hover:bg-white/10 text-slate-200" : "bg-slate-100 hover:bg-slate-200 text-slate-600"}`}
              >
                继续添加
              </button>
              <button
                onClick={executeQuickProduce}
                className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-bold shadow-lg transition-all active:scale-95"
              >
                确认继续
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 模型选择 */}
      {modelModalInfo.isOpen && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setModelModalInfo({ isOpen: false, target: null })}
          ></div>
          <div
            className={`relative w-full max-w-lg p-8 rounded-[32px] border shadow-2xl animate-in zoom-in-95 ${isDark ? "bg-[#27272A] border-white/10" : "bg-white border-slate-200"}`}
          >
            <h3 className="text-xl font-black mb-2 flex items-center gap-2">
              <Film className="text-orange-500" /> 选择视频渲染模型
              {modelModalInfo.target === "global" && (
                <span className="ml-2 text-[10px] bg-orange-500/20 text-orange-500 px-2 py-1 rounded-full uppercase">
                  全局应用
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400 mb-8">
              选择主流的 DiT 或 Diffusion 视频大模型以开始物理世界模拟渲染。
            </p>
            <div className="grid grid-cols-2 gap-4">
              {VIDEO_MODELS.map((vm) => (
                <button
                  key={vm.id}
                  onClick={() => handleAssignModel(vm.id)}
                  className={`p-4 rounded-2xl border text-left transition-all hover:scale-105 ${isDark ? "bg-[#18181B] border-white/5 hover:border-white/20" : "bg-slate-50 border-slate-200 hover:shadow-lg hover:border-orange-500"}`}
                >
                  <div className={`font-black text-base mb-1 ${vm.color}`}>
                    {vm.name}
                  </div>
                  <div className="text-[10px] font-medium text-slate-400">
                    {vm.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 导出路径弹窗 */}
      {exportPathModal && (
        <div className="fixed inset-0 z-[8000] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setExportPathModal(false)}
          ></div>
          <div
            className={`relative w-full max-w-md p-8 rounded-[32px] border shadow-2xl animate-in zoom-in-95 ${isDark ? "bg-[#18181B] border-[#3F3F46]" : "bg-white border-slate-200"}`}
          >
            <div className="flex items-center gap-4 mb-4 text-green-500">
              <CheckCircle2 size={32} />
              <h3
                className={`text-xl font-black ${isDark ? "text-white" : "text-slate-900"}`}
              >
                导出成功
              </h3>
            </div>
            <p
              className={`text-sm mb-4 leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}
            >
              5 个营销视频及配套文本配置已成功打包，请在下方路径查看：
            </p>
            <div
              className={`p-4 rounded-xl font-mono text-xs break-all mb-8 border ${isDark ? "bg-[#09090B] border-[#3F3F46] text-blue-400" : "bg-slate-100 border-slate-300 text-blue-600"}`}
            >
              C:\Users\Admin\Documents\LegoAds\Exports\Batch_20260305\
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setExportPathModal(false)}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold shadow-lg transition-all active:scale-95"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 头部导航 */}
      {view !== "knowledge-base" && view !== "director-mode" && (
        <header
          className={`fixed top-0 left-0 w-full h-14 z-[2000] flex items-center justify-between px-8 ${isDark ? "bg-black/20 border-white/5" : "bg-white/20 border-slate-200"} backdrop-blur-md border-b`}
        >
          <div className="flex items-center gap-4">
            {view !== "portal" && (
              <button
                onClick={handleASideBack}
                className={`flex items-center gap-1.5 transition-all text-xs font-black uppercase ${isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"}`}
              >
                <ArrowLeft size={14} /> 返回
              </button>
            )}
            <span
              className={`text-[10px] font-black italic tracking-[0.3em] ${isDark ? "opacity-30" : "opacity-60 text-orange-600"}`}
            >
              LEGO-ADS ENGINE
            </span>
          </div>

          <div className="flex items-center gap-4">
            {view === "a-side" && aSideStep === "style" && (
              <button
                onClick={toggleLayoutMode}
                className={`px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase transition-all ${isDark ? "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10" : "bg-white border-slate-200 text-slate-500"}`}
              >
                {layoutMode === "conveyor" ? "平铺预览" : "传送带"}
              </button>
            )}
            {view !== "portal" && view !== "video-factory" && (
              <button
                id="library-button"
                onClick={() => {
                  setLibraryMode("view");
                  setShowLibraryModal(true);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${libraryPulse ? "lib-pulse-active" : isDark ? "bg-white/5 border-white/10" : "bg-white border-slate-200 shadow-sm"}`}
              >
                <Archive
                  size={16}
                  className={
                    libraryPulse ? "text-green-500" : "text-orange-500"
                  }
                />
                <span className="text-[10px] font-black uppercase">
                  待产库: {libraryScripts.length}
                </span>
              </button>
            )}
            <button
              onClick={toggleTheme}
              className={`p-1.5 rounded-lg border transition-all ${isDark ? "bg-slate-900 border-slate-800 text-yellow-400" : "bg-white border-slate-200 text-slate-400"}`}
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </header>
      )}

      {/* 待产库 Modal */}
      {showLibraryModal &&
        view !== "knowledge-base" &&
        view !== "director-mode" && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-6 animate-in fade-in">
            <div
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
              onClick={() => {
                setShowLibraryModal(false);
                setLibraryMode("view");
              }}
            ></div>
            <div
              className={`relative w-full max-w-3xl rounded-[32px] border shadow-2xl flex flex-col max-h-[80vh] ${isDark ? "bg-[#27272A] border-white/10" : "bg-white border-slate-200"}`}
            >
              <header
                className={`p-6 border-b flex items-center justify-between ${isDark ? "border-white/5" : "border-slate-100 bg-slate-50 rounded-t-[32px]"}`}
              >
                <h3 className="text-lg font-black flex items-center gap-2">
                  {libraryMode === "select" ? (
                    <FileVideo className="text-blue-500" />
                  ) : (
                    <Archive className="text-orange-500" />
                  )}
                  {libraryMode === "select"
                    ? "选择脚本进入导演模式"
                    : "待产出资产库"}
                </h3>
                <div className="flex items-center gap-4">
                  {libraryMode !== "select" && (
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest bg-slate-500/10 px-3 py-1 rounded-full">
                      长按左侧图标可拖拽排序
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setShowLibraryModal(false);
                      setLibraryMode("view");
                    }}
                    className={`p-2 rounded-full transition-all ${isDark ? "hover:bg-white/10 text-slate-300 hover:text-white" : "hover:bg-slate-200 text-slate-500"}`}
                  >
                    <X size={20} />
                  </button>
                </div>
              </header>
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {libraryScripts.map((s, index) => (
                  <div
                    key={s.id}
                    draggable={libraryMode === "view"}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={() => setDraggedIdx(null)}
                    className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${libraryMode === "view" ? "cursor-grab active:cursor-grabbing" : ""} ${draggedIdx === index ? "opacity-40 scale-[0.98] border-orange-500 shadow-lg" : isDark ? "bg-[#18181B] border-white/5 hover:border-white/20" : "bg-slate-50 border-slate-200 hover:shadow-md"}`}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {libraryMode === "view" && (
                        <div className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-orange-500 transition-colors">
                          <GripVertical size={18} />
                        </div>
                      )}
                      <span className="w-6 h-6 rounded-full bg-slate-500/10 flex items-center justify-center text-[10px] font-black text-slate-400 shrink-0 border border-slate-500/20">
                        {index + 1}
                      </span>
                      <p
                        className={`text-sm font-medium leading-relaxed flex-1 pr-4 select-none ${isDark ? "text-slate-200" : "text-slate-700"}`}
                      >
                        {s.text}
                      </p>
                    </div>
                    {libraryMode === "select" ? (
                      <button
                        onClick={() => handleSelectDirectorScript(s)}
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg transition-transform active:scale-95 shrink-0"
                      >
                        选择创作
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setLibraryScripts((prev) =>
                            prev.filter((x) => x.id !== s.id),
                          );
                          playSound("delete");
                        }}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors shrink-0"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                ))}
                {libraryScripts.length === 0 && (
                  <div className="py-20 text-center text-slate-400 italic">
                    待产库空空如也，快去工厂生产吧！
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      {/* 视图1：Portal */}
      {view === "portal" && (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 relative">
          <div className="text-center mb-10">
            <h1
              className={`text-4xl font-black tracking-tighter italic mb-2 ${isDark ? "text-white" : "text-slate-900"}`}
            >
              AI 视频生产工厂
            </h1>
            <p
              className={`text-[10px] font-medium uppercase tracking-[0.4em] ${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              Creative Production hub
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-10 max-w-3xl w-full px-4">
            <button
              onClick={() => {
                setView("a-side");
                setASideStep("style");
                playSound("nav");
              }}
              className={`group animate-sync-up float-pause relative rounded-[40px] p-10 text-left transition-all border ${isDark ? "bg-white/[0.02] border-white/5 glow-orange-diffuse" : "bg-white border-slate-100 shadow-xl hover:shadow-2xl hover:border-orange-200"}`}
            >
              <PlayCircle className="text-orange-500 mb-6" size={32} />
              <h2
                className={`text-2xl font-black mb-2 italic ${isDark ? "text-white" : "text-slate-900"}`}
              >
                A面制作
              </h2>
              <p
                className={`text-[10px] leading-relaxed mb-6 ${isDark ? "text-slate-400" : "text-slate-500"}`}
              >
                脚本创作传送带。支持海量省份地域自定义。
              </p>
              <div className="text-orange-500 text-[10px] font-black uppercase">
                Start Production{" "}
                <ChevronRight size={12} className="inline ml-1" />
              </div>
            </button>
            <button
              onClick={() => {
                setView("b-side");
                playSound("nav");
              }}
              className={`group animate-sync-down float-pause relative rounded-[40px] p-10 text-left transition-all border ${isDark ? "bg-white/[0.02] border-white/5 glow-blue-diffuse" : "bg-white border-slate-100 shadow-xl hover:shadow-2xl hover:border-blue-200"}`}
            >
              <Cpu className="text-blue-500 mb-6" size={32} />
              <h2
                className={`text-2xl font-black mb-2 italic ${isDark ? "text-white" : "text-slate-900"}`}
              >
                B面制作
              </h2>
              <p
                className={`text-[10px] leading-relaxed mb-6 ${isDark ? "text-slate-400" : "text-slate-500"}`}
              >
                实机转化地图引擎。深度下钻与资产合成。
              </p>
              <div className="text-blue-500 text-[10px] font-black uppercase">
                Build Game <ChevronRight size={12} className="inline ml-1" />
              </div>
            </button>
          </div>

          <div className="w-full max-w-3xl px-4 mt-16 animate-in fade-in slide-in-from-bottom-8">
            <h3
              className={`text-sm font-black tracking-widest uppercase mb-4 flex items-center gap-2 ${isDark ? "text-slate-300" : "text-slate-700"}`}
            >
              <Sparkles size={16} className="text-orange-500" />
              素材快速生成
            </h3>
            <div
              className={`relative p-2 rounded-[28px] border shadow-2xl transition-all duration-300 focus-within:border-orange-500/50 focus-within:shadow-[0_0_30px_rgba(249,115,22,0.15)] ${isDark ? "bg-[#18181B]/80 border-[#3F3F46] backdrop-blur-xl" : "bg-white/80 border-slate-200 backdrop-blur-xl"}`}
            >
              <textarea
                value={portalInput}
                onChange={(e) => setPortalInput(e.target.value)}
                placeholder="今天要产出什么素材..."
                className="w-full h-24 p-4 bg-transparent outline-none resize-none text-sm font-medium"
              />
              <div className="flex items-center justify-between px-3 pb-2 pt-1 border-t border-transparent">
                <div
                  className={`flex p-1 rounded-xl border ${isDark ? "bg-[#27272A] border-[#3F3F46]" : "bg-slate-100 border-slate-200"}`}
                >
                  {["托管模式", "对话模式"].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => {
                        setPortalAiMode(mode);
                        playSound("click");
                      }}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${portalAiMode === mode ? (isDark ? "bg-[#3F3F46] text-white shadow-sm" : "bg-white text-slate-800 shadow-sm") : isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-800"}`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    if (portalInput.trim()) {
                      playSound("action");
                      showToast(`已启动 [${portalAiMode}] 分析您的需求...`);
                      setPortalInput("");
                    }
                  }}
                  disabled={!portalInput.trim()}
                  className={`p-2.5 rounded-full transition-all ${portalInput.trim() ? "bg-orange-500 text-white shadow-lg hover:scale-105 active:scale-95 hover:bg-orange-400" : isDark ? "bg-[#3F3F46] text-[#666]" : "bg-slate-200 text-slate-400"}`}
                >
                  <ArrowUp size={16} strokeWidth={3} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 视图1.5：B面地理交互地图制作入口 */}
      {view === "b-side" && (
        <div className="min-h-screen flex flex-col pt-14 relative overflow-hidden animate-in fade-in">
          {/* Header / Title */}
          <div className="absolute top-24 left-16 z-20 pointer-events-none">
            <h2
              className={`text-4xl font-black italic tracking-tighter mb-3 flex items-center gap-3 ${isDark ? "text-white" : "text-slate-900"}`}
            >
              今天制作哪个省份素材？
            </h2>
            <p
              className={`text-xs font-bold uppercase tracking-[0.2em] bg-blue-500/10 text-blue-500 px-3 py-1.5 rounded-lg inline-block border border-blue-500/20`}
            >
              Select a region to load assets
            </p>
          </div>

          {/* 浮动信息面板 (悬浮时显示) */}
          {bSideHoveredProv &&
            !bSideSelectedProv &&
            (() => {
              const mockData = getProvMockData(bSideHoveredProv);
              return (
                <div
                  className="absolute bottom-32 left-12 z-50 animate-in fade-in slide-in-from-bottom-4 pointer-events-auto"
                  onMouseEnter={() => {
                    if (hoverTimeoutRef.current)
                      clearTimeout(hoverTimeoutRef.current);
                  }}
                  onMouseLeave={() => setBSideHoveredProv(null)}
                >
                  <div
                    className={`p-6 rounded-3xl border shadow-2xl ${isDark ? "bg-[#18181B]/90 border-[#3F3F46] backdrop-blur-xl" : "bg-white/90 border-slate-200 backdrop-blur-xl"}`}
                  >
                    <div className="text-[10px] font-black text-slate-500 tracking-widest uppercase mb-1">
                      Current Target
                    </div>
                    <div className="text-3xl font-black text-blue-500">
                      {bSideHoveredProv}
                    </div>
                    <div className="mt-4 flex gap-3 items-center">
                      <span
                        className={`px-2 py-1.5 rounded text-xs font-bold shadow-inner flex items-center gap-1.5 ${isDark ? "bg-[#27272A] text-slate-300" : "bg-slate-100 text-slate-600"}`}
                      >
                        B面库存数量:{" "}
                        <span className="text-orange-500 font-black">
                          {mockData.bSideCount}
                        </span>
                      </span>

                      <div className="relative group cursor-help">
                        <span
                          className={`px-2 py-1.5 rounded text-xs font-bold shadow-inner flex items-center gap-1.5 transition-colors ${isDark ? "bg-[#27272A] hover:bg-[#3F3F46] text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-600"}`}
                        >
                          玩法储备数量:{" "}
                          <span className="text-green-500 font-black">
                            {mockData.playCount}
                          </span>
                        </span>

                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] px-3 py-2.5 rounded-xl text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl z-50 bg-slate-800 text-white border border-slate-700 leading-relaxed">
                          目前储备素材有：
                          <br />
                          {mockData.gameplays.map((g, i) => (
                            <span
                              key={i}
                              className="text-green-400 font-bold mr-1"
                            >
                              {g}玩法
                              {i < mockData.gameplays.length - 1 ? "、" : ""}
                            </span>
                          ))}
                          等
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

          {/* 选中时的确认弹窗 */}
          {showProvinceConfirm && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
              <div
                className={`w-96 p-8 rounded-[32px] border shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 ${isDark ? "bg-[#18181B] border-[#3F3F46]" : "bg-white border-slate-200"}`}
              >
                <div className="w-16 h-16 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mb-6 border border-blue-500/20 shadow-inner">
                  <MapIcon size={32} />
                </div>
                <h3
                  className={`text-2xl font-black mb-3 ${isDark ? "text-white" : "text-slate-900"}`}
                >
                  制作{" "}
                  <span className="text-blue-500">{showProvinceConfirm}</span>{" "}
                  素材
                </h3>
                <p className="text-sm text-slate-500 mb-8 leading-relaxed px-2">
                  检测到您想制作【{showProvinceConfirm}
                  】的地域素材。系统将自动提取该地区的方言特征与核心玩法进行渲染，是否立即进入生产流水线？
                </p>
                <div className="flex w-full gap-4">
                  <button
                    onClick={() => {
                      setShowProvinceConfirm(null);
                      setMapTransform({ x: 0, y: 0, scale: 1 });
                      setBSideSelectedProv(null);
                      playSound("click");
                    }}
                    className={`flex-1 py-3.5 rounded-2xl font-bold transition-all ${isDark ? "bg-[#27272A] hover:bg-[#3F3F46] text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-600"}`}
                  >
                    取消
                  </button>
                  <button
                    onClick={() => {
                      setShowProvinceConfirm(null);
                      playSound("action");
                      setView("b-side-editor");
                    }}
                    className="flex-1 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-xl shadow-blue-500/20 transition-transform active:scale-95"
                  >
                    确认制作
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 真实地理 SVG 地图容器 */}
          <div
            className="flex-1 flex items-center justify-center relative z-10 w-full h-full mt-10 overflow-hidden cursor-grab active:cursor-grabbing touch-none"
            ref={mapContainerRef}
            onWheel={handleMapWheel}
            onPointerDown={handleMapPointerDown}
            onPointerMove={handleMapPointerMove}
            onPointerUp={handleMapPointerUp}
            onPointerCancel={handleMapPointerUp}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div
              style={{
                transform: `translate(${mapTransform.x}px, ${mapTransform.y}px) scale(${mapTransform.scale})`,
                transformOrigin: "0 0",
                transition: isDraggingMap
                  ? "none"
                  : "transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
              className="w-full h-full flex items-center justify-center"
            >
              {isMapLoading ? (
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                  <div className="text-xs font-black tracking-widest text-blue-500 uppercase animate-pulse">
                    Loading Geo Data...
                  </div>
                </div>
              ) : (
                geoMapData && (
                  <svg
                    viewBox="0 0 800 650"
                    className="w-full max-w-4xl max-h-[85vh] overflow-visible"
                  >
                    <g transform="translate(0, 10)">
                      {memoizedMapPaths.map((prov) => (
                        <path
                          key={`base-${prov.id}`}
                          d={prov.pathData}
                          fill={isDark ? "#09090b" : "#cbd5e1"}
                          className="opacity-100 transition-all duration-300"
                        />
                      ))}
                    </g>
                    {memoizedMapPaths.map((prov) => {
                      const isHovered = bSideHoveredProv === prov.name;
                      const isSelected =
                        bSideSelectedProv === prov.name ||
                        showProvinceConfirm === prov.name;
                      const dimNotHovered =
                        (bSideHoveredProv ||
                          bSideSelectedProv ||
                          showProvinceConfirm) &&
                        !isHovered &&
                        !isSelected;

                      return (
                        <g key={`top-${prov.id}`}>
                          <path
                            d={prov.pathData}
                            fill={isSelected ? "#3b82f6" : prov.color}
                            className={`transition-all duration-300 cursor-pointer origin-center 
                              ${isHovered ? "stroke-white stroke-[3px] opacity-100 z-50 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" : "stroke-white/20 stroke-[1px]"} 
                              ${isSelected ? "stroke-white stroke-[4px] drop-shadow-[0_0_25px_rgba(59,130,246,0.8)]" : ""}
                              ${dimNotHovered ? "opacity-30 grayscale saturate-50" : isDark ? "opacity-90" : "opacity-100"}
                            `}
                            onMouseEnter={() => {
                              if (hoverTimeoutRef.current)
                                clearTimeout(hoverTimeoutRef.current);
                              if (!showProvinceConfirm)
                                setBSideHoveredProv(prov.name);
                            }}
                            onMouseLeave={() => {
                              if (showProvinceConfirm) return;
                              hoverTimeoutRef.current = setTimeout(() => {
                                setBSideHoveredProv(null);
                              }, 100);
                            }}
                            onClick={() => {
                              if (!showProvinceConfirm) focusOnProvince(prov);
                            }}
                            onDoubleClick={() => {
                              if (!showProvinceConfirm) {
                                setBSideSelectedProv(prov.name);
                                playSound("action");
                                setView("b-side-editor");
                              }
                            }}
                            style={{
                              transformOrigin: "center",
                              transform:
                                isHovered || isSelected
                                  ? "translateY(-6px)"
                                  : "none",
                            }}
                          />
                          {prov.labelPos && (
                            <text
                              x={prov.labelPos[0]}
                              y={prov.labelPos[1]}
                              textAnchor="middle"
                              dominantBaseline="central"
                              stroke="rgba(255,255,255,0.6)"
                              strokeWidth={2 / mapTransform.scale}
                              strokeLinejoin="round"
                              className="font-black pointer-events-none transition-all duration-300 drop-shadow-sm"
                              style={{
                                fill: "#000000",
                                paintOrder: "stroke fill",
                                transform:
                                  isHovered || isSelected
                                    ? "translateY(-6px)"
                                    : "none",
                                fontSize: isSelected
                                  ? `${Math.max(12, 18 / mapTransform.scale)}px`
                                  : `${Math.max(8, 14 / mapTransform.scale)}px`,
                                letterSpacing: "0.05em",
                              }}
                            >
                              {prov.name}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                )
              )}
            </div>
          </div>

          {/* 地图缩放控制台 */}
          {view === "b-side" && geoMapData && !showProvinceConfirm && (
            <div className="absolute top-24 right-16 flex items-center gap-2 z-20">
              <div
                className={`px-4 py-2 rounded-full border text-xs font-bold backdrop-blur-md cursor-default select-none ${isDark ? "bg-[#27272A]/80 border-[#3F3F46] text-slate-300" : "bg-white/80 border-slate-200 text-slate-600"}`}
              >
                缩放: {Math.round(mapTransform.scale * 100)}%
              </div>
              <button
                onClick={() => {
                  setMapTransform({ x: 0, y: 0, scale: 1 });
                  setBSideSelectedProv(null);
                }}
                className={`p-2 rounded-full border backdrop-blur-md transition-colors ${isDark ? "bg-[#27272A]/80 border-[#3F3F46] hover:bg-[#3F3F46] text-slate-300" : "bg-white/80 border-slate-200 hover:bg-slate-100 text-slate-600"}`}
                title="重置视图"
              >
                <MapIcon size={16} />
              </button>
            </div>
          )}

          {/* B面底部悬浮 AI 对话框 */}
          <div
            className={`absolute bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-6 transition-all duration-500 ${showProvinceConfirm ? "translate-y-24 opacity-0 pointer-events-none" : "animate-in fade-in slide-in-from-bottom-8 pointer-events-auto"}`}
          >
            <div
              className={`relative flex items-center p-2 rounded-[24px] border shadow-2xl transition-all duration-300 focus-within:border-blue-500/50 focus-within:shadow-[0_0_30px_rgba(59,130,246,0.15)] ${isDark ? "bg-[#18181B]/80 border-[#3F3F46] backdrop-blur-xl" : "bg-white/80 border-slate-200 backdrop-blur-xl"}`}
            >
              <div
                className={`p-3 ${isDark ? "text-slate-300" : "text-slate-600"}`}
              >
                <Sparkles size={20} className="text-blue-500" />
              </div>
              <input
                type="text"
                value={bSideAiInput}
                onChange={(e) => setBSideAiInput(e.target.value)}
                placeholder="可对话沟通制作的素材方向 (例如: 帮我做个广东的视频)"
                className={`flex-1 h-12 bg-transparent outline-none text-sm font-medium px-2 ${isDark ? "text-white placeholder:text-slate-500" : "text-slate-800 placeholder:text-slate-400"}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleBSideAiSubmit();
                }}
              />
              <button
                onClick={handleBSideAiSubmit}
                disabled={!bSideAiInput.trim()}
                className={`p-3 rounded-[16px] transition-all mr-1 ${bSideAiInput.trim() ? "bg-blue-600 text-white shadow-lg hover:scale-105 active:scale-95 hover:bg-blue-500" : isDark ? "bg-[#3F3F46] text-[#666]" : "bg-slate-200 text-slate-400"}`}
              >
                <ArrowUp size={18} strokeWidth={3} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 视图1.8：B面二级文案编辑器 (从地图跳转而来) */}
      {view === "b-side-editor" && (
        <div className="min-h-screen flex flex-col pt-14 animate-in fade-in duration-300">
          <div
            className={`h-16 px-10 flex items-center justify-between border-b ${isDark ? "border-[#3F3F46] bg-[#18181B]" : "border-slate-200 bg-white"}`}
          >
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-black flex items-center gap-2">
                <MapIcon className="text-blue-500" size={20} />
                {bSideSelectedProv}素材制作
              </h2>
              <span
                className={`text-xs px-2 py-1 rounded-md font-bold ${isDark ? "bg-[#27272A] text-slate-400" : "bg-slate-100 text-slate-500"}`}
              >
                区域数据化流
              </span>
            </div>
          </div>

          <div className="flex-1 w-full max-w-7xl mx-auto p-6 flex gap-6 h-[calc(100vh-8rem)]">
            <div
              className={`w-80 flex flex-col rounded-2xl border shadow-lg overflow-hidden shrink-0 ${isDark ? "bg-[#18181B] border-[#3F3F46]" : "bg-white border-slate-200"}`}
            >
              <div
                className={`p-4 border-b font-black text-sm ${isDark ? "border-[#3F3F46] text-white" : "border-slate-200 text-slate-800"}`}
              >
                功能配置区
              </div>
              <div className="p-5 flex-1 flex flex-col gap-6 overflow-y-auto">
                <div className="flex flex-col gap-2">
                  <label
                    className={`text-xs font-bold flex items-center gap-1.5 ${isDark ? "text-slate-400" : "text-slate-600"}`}
                  >
                    <span className="text-red-500">*</span> 产品名字
                  </label>
                  <input
                    type="text"
                    value={bEditorProductName}
                    onChange={(e) => setBEditorProductName(e.target.value)}
                    placeholder="如若不填写，默认微乐麻将"
                    className={`w-full p-3 rounded-xl border text-sm font-bold outline-none transition-colors ${isDark ? "bg-[#27272A] border-[#3F3F46] text-white focus:border-blue-500" : "bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500"}`}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label
                    className={`text-xs font-bold flex items-center gap-1.5 ${isDark ? "text-slate-400" : "text-slate-600"}`}
                  >
                    <span className="text-red-500">*</span> 偏向文案风格
                  </label>
                  <div className="relative">
                    <select
                      value={bEditorStyle}
                      onChange={(e) => setBEditorStyle(e.target.value)}
                      className={`w-full p-3 rounded-xl border text-sm font-bold outline-none transition-colors appearance-none cursor-pointer ${isDark ? "bg-[#27272A] border-[#3F3F46] text-white focus:border-blue-500" : "bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500"}`}
                    >
                      {currentStyleOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? "text-slate-400" : "text-slate-500"}`}
                    />
                  </div>
                </div>
              </div>

              <div
                className={`p-4 border-t ${isDark ? "border-[#3F3F46] bg-[#18181B]" : "border-slate-200 bg-slate-50"}`}
              >
                <button
                  onClick={handleBEditorGenerate}
                  disabled={isBEditorGenerating}
                  className="relative w-full py-4 rounded-xl font-black text-white shadow-xl overflow-hidden group active:scale-95 transition-transform disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-500 to-pink-500 btn-gradient-glow"></div>
                  <div className="relative flex items-center justify-center gap-2 text-sm z-10">
                    {isBEditorGenerating ? (
                      <>
                        <RefreshCcw size={18} className="animate-spin" />{" "}
                        正在生成文案...
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} /> 智能生成文案
                      </>
                    )}
                  </div>
                </button>
              </div>
            </div>

            <div
              className={`flex-1 flex flex-col rounded-2xl border shadow-lg overflow-hidden ${isDark ? "bg-[#18181B] border-[#3F3F46]" : "bg-white border-slate-200"}`}
            >
              <div
                className={`p-4 border-b flex items-center justify-between ${isDark ? "border-[#3F3F46]" : "border-slate-200"}`}
              >
                <span
                  className={`font-black text-sm ${isDark ? "text-white" : "text-slate-800"}`}
                >
                  视频文案列表
                </span>
                {bEditorScripts.length > 0 && (
                  <span
                    className={`text-xs font-bold ${isDark ? "text-slate-400" : "text-slate-500"}`}
                  >
                    共生成 {bEditorScripts.length} 条记录
                  </span>
                )}
              </div>

              <div className="flex-1 p-6 overflow-y-auto space-y-4 relative">
                {bEditorScripts.length === 0 && !isBEditorGenerating && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center opacity-40">
                    <FileText size={48} className="mb-4" />
                    <span className="text-sm font-bold tracking-widest uppercase">
                      配置左侧参数后点击生成
                    </span>
                  </div>
                )}

                {bEditorScripts.map((script, idx) => (
                  <div
                    key={script.id}
                    className={`p-5 rounded-2xl border transition-all hover:-translate-y-0.5 group ${isDark ? "bg-[#27272A] border-[#3F3F46] hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10" : "bg-slate-50 border-slate-200 hover:border-blue-400 hover:shadow-md"}`}
                  >
                    {editingBScriptId === script.id ? (
                      <div className="flex flex-col gap-3">
                        <textarea
                          value={tempBScriptText}
                          onChange={(e) => setTempBScriptText(e.target.value)}
                          className={`w-full p-3 text-sm font-medium leading-relaxed rounded-xl border outline-none resize-none ${isDark ? "bg-[#18181B] border-[#52525B] text-white focus:border-blue-500" : "bg-white border-slate-300 text-slate-800 focus:border-blue-500"}`}
                          rows={3}
                          autoFocus
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingBScriptId(null)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${isDark ? "hover:bg-[#3F3F46] text-slate-300" : "hover:bg-slate-200 text-slate-600"}`}
                          >
                            取消
                          </button>
                          <button
                            onClick={() => {
                              setBEditorScripts((prev) =>
                                prev.map((s) =>
                                  s.id === script.id
                                    ? { ...s, text: tempBScriptText }
                                    : s,
                                ),
                              );
                              setEditingBScriptId(null);
                              playSound("action");
                            }}
                            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md transition-colors"
                          >
                            保存修改
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div
                          onDoubleClick={() => {
                            setEditingBScriptId(script.id);
                            setTempBScriptText(script.text);
                            playSound("click");
                          }}
                          className={`text-sm font-medium leading-relaxed mb-4 cursor-text ${isDark ? "text-slate-200" : "text-slate-700"}`}
                        >
                          {script.text}
                        </div>
                        <div className="flex items-center justify-between border-t pt-3 mt-2 border-inherit">
                          <button
                            onClick={() => {
                              setEditingBScriptId(script.id);
                              setTempBScriptText(script.text);
                              playSound("click");
                            }}
                            className={`text-xs font-bold flex items-center gap-1.5 transition-colors opacity-0 group-hover:opacity-100 ${isDark ? "text-slate-400 hover:text-blue-400" : "text-slate-500 hover:text-blue-600"}`}
                          >
                            <Pencil size={12} /> 编辑文案
                          </button>

                          <button
                            onClick={() => handleSaveToKb(script.id)}
                            disabled={script.saved}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${script.saved ? "bg-green-500/10 text-green-500 cursor-not-allowed" : isDark ? "bg-[#18181B] border border-[#52525B] text-slate-300 hover:text-blue-400 hover:border-blue-500/50" : "bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-400 shadow-sm"}`}
                          >
                            {script.saved ? (
                              <CheckCircle2 size={14} />
                            ) : (
                              <Database size={14} />
                            )}
                            {script.saved ? "已存入知识库" : "存入知识库"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {bEditorScripts.length > 0 && (
                <div
                  className={`p-4 border-t flex justify-end items-center shadow-[0_-10px_20px_rgba(0,0,0,0.2)] z-10 ${isDark ? "border-[#3F3F46] bg-[#18181B]" : "border-slate-200 bg-white"}`}
                >
                  <button
                    onClick={handleStartBVideoRender}
                    className="relative px-8 py-3 rounded-full bg-slate-100 hover:bg-white text-slate-900 font-black text-sm shadow-xl flex items-center gap-3 transition-transform active:scale-95 group overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-100 via-purple-100 to-pink-100 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="relative flex items-center gap-3 z-10">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-gradient-to-r from-blue-500 to-purple-500"></span>
                      </span>
                      生成视频 ({bEditorScripts.length})
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 视图1.9：营销成片渲染与大图预览 */}
      {view === "b-side-video-render" && (
        <div
          className={`min-h-screen flex flex-col pt-14 animate-in fade-in duration-500 ${isDark ? "bg-[#09090B]" : "bg-slate-100"}`}
        >
          <header
            className={`h-16 px-10 flex items-center justify-between border-b ${isDark ? "border-[#27272A] bg-[#09090B]" : "border-slate-200 bg-white"}`}
          >
            <div className="flex items-center gap-4">
              <button
                onClick={handleASideBack}
                className={`flex items-center gap-1.5 transition-all text-xs font-black uppercase ${isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"}`}
              >
                <ArrowLeft size={14} /> 返回
              </button>
              <h2 className="text-lg font-black ml-4">营销成片</h2>
            </div>
          </header>

          <div className="flex-1 w-full max-w-7xl mx-auto p-6 flex gap-6 h-[calc(100vh-8rem)]">
            <div
              className={`flex-[2] rounded-2xl flex flex-col items-center justify-center relative overflow-hidden shadow-2xl border ${isDark ? "bg-[#18181B] border-[#27272A]" : "bg-slate-900 border-slate-800"}`}
            >
              {bVideoRenderProgress < 100 ? (
                <div className="flex flex-col items-center justify-center text-white animate-in zoom-in-95">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-inner relative overflow-hidden">
                    <Scissors size={28} className="text-white relative z-10" />
                    <div
                      className="absolute bottom-0 w-full bg-blue-500/50 transition-all duration-200"
                      style={{ height: `${bVideoRenderProgress}%` }}
                    ></div>
                  </div>
                  <div className="text-lg font-bold tracking-widest flex items-center gap-2">
                    <RefreshCcw
                      size={16}
                      className="animate-spin text-slate-400"
                    />
                    合成效果中... {bVideoRenderProgress}%
                  </div>
                </div>
              ) : (
                <div className="w-full h-full relative group animate-in fade-in duration-700">
                  <img
                    src={
                      STOCK_VIDEO_URLS[
                        activeBVideoIndex % STOCK_VIDEO_URLS.length
                      ]
                    }
                    alt="Video Preview"
                    className="w-full h-full object-contain bg-black"
                    draggable={false}
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 cursor-pointer">
                    <PlayCircle
                      size={64}
                      className="text-white/80 hover:text-white hover:scale-110 transition-all drop-shadow-xl"
                      fill="rgba(0,0,0,0.4)"
                    />
                  </div>
                  <div className="absolute bottom-6 left-6 right-6">
                    <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden backdrop-blur-md">
                      <div className="h-full w-1/3 bg-blue-500 rounded-full"></div>
                    </div>
                    <div className="flex justify-between mt-2 text-xs font-bold text-white drop-shadow-md">
                      <span>00:07</span>
                      <span>00:20</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div
              className={`flex-[1] flex flex-col rounded-2xl border shadow-lg overflow-hidden ${isDark ? "bg-[#18181B] border-[#27272A]" : "bg-white border-slate-200"}`}
            >
              <div
                className={`p-6 border-b ${isDark ? "border-[#27272A]" : "border-slate-200"}`}
              >
                <h3
                  className={`text-base font-black mb-2 ${isDark ? "text-white" : "text-slate-900"}`}
                >
                  成功生成 {bEditorScripts.length} 个营销视频
                </h3>
                <p
                  className={`text-[10px] flex items-center gap-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                >
                  <CheckCircle2 size={12} className="text-green-500" />{" "}
                  如果视频原素材非原创，建议手动编辑加工，避免同质化
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 relative">
                {bEditorScripts.map((script, idx) => {
                  const isActive = activeBVideoIndex === idx;
                  return (
                    <div
                      key={script.id}
                      onClick={() => {
                        if (bVideoRenderProgress >= 100)
                          setActiveBVideoIndex(idx);
                        playSound("click");
                      }}
                      className={`p-3 rounded-xl border flex gap-4 cursor-pointer transition-all duration-300 ${
                        isActive
                          ? isDark
                            ? "bg-[#27272A] border-blue-500/50 shadow-md"
                            : "bg-blue-50 border-blue-400 shadow-sm"
                          : isDark
                            ? "bg-transparent border-transparent hover:bg-[#27272A]/50"
                            : "bg-transparent border-transparent hover:bg-slate-50"
                      }`}
                    >
                      <div className="w-24 h-16 shrink-0 rounded-lg overflow-hidden relative shadow-sm border border-slate-500/20 bg-black">
                        <img
                          src={STOCK_VIDEO_URLS[idx % STOCK_VIDEO_URLS.length]}
                          className={`w-full h-full object-cover transition-all ${bVideoRenderProgress < 100 ? "opacity-40 grayscale blur-sm" : "opacity-100"}`}
                        />

                        {bVideoRenderProgress < 100 && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                          </div>
                        )}

                        {bVideoRenderProgress >= 100 && (
                          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[8px] font-black text-white bg-black/60 backdrop-blur-sm border border-white/10">
                            00:20
                          </div>
                        )}
                        {isActive && bVideoRenderProgress >= 100 && (
                          <div className="absolute inset-0 border-2 border-blue-500 rounded-lg pointer-events-none"></div>
                        )}
                      </div>

                      <div className="flex-1 flex flex-col justify-center min-w-0">
                        <p
                          className={`text-xs font-bold leading-relaxed line-clamp-3 ${isActive ? (isDark ? "text-white" : "text-slate-900") : isDark ? "text-slate-400" : "text-slate-600"}`}
                        >
                          {script.text}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div
                className={`p-5 border-t flex justify-center ${isDark ? "border-[#27272A] bg-[#18181B]" : "border-slate-200 bg-slate-50"}`}
              >
                <button
                  disabled={bVideoRenderProgress < 100}
                  onClick={handleExportAllVideos}
                  className="relative w-full max-w-[200px] py-3.5 rounded-full font-black text-sm text-white shadow-xl overflow-hidden group active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="absolute inset-0 bg-slate-800 transition-colors group-hover:bg-slate-700"></div>
                  <div className="absolute inset-0 opacity-20 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 btn-gradient-glow"></div>
                  <div className="relative flex items-center justify-center gap-2 z-10">
                    <span className="relative flex h-2.5 w-2.5 mr-1">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-gradient-to-r from-blue-400 to-purple-400"></span>
                    </span>
                    全部导出
                    <Download size={16} className="ml-1" />
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 视图2：A面配置 */}
      {view === "a-side" && (
        <div className="min-h-screen flex flex-col items-center justify-center pt-14">
          {aSideStep === "style" ? (
            <div className="w-full flex flex-col items-center py-6 animate-in fade-in">
              <h2
                className={`text-3xl font-black tracking-tight mb-8 italic ${isDark ? "text-white" : "text-slate-900"}`}
              >
                选择您的创意方向
              </h2>
              {layoutMode === "conveyor" ? (
                <div
                  className={`conveyor-container w-full overflow-hidden py-8 border-y relative ${isDark ? "bg-[#27272A]/50 border-[#3F3F46]" : "bg-slate-100/50 border-slate-200"}`}
                >
                  <div className="conveyor-track space-x-6 px-6">
                    {[...hookStyles, ...hookStyles].map((style, idx) => (
                      <div
                        key={`${style.id}-${idx}`}
                        className="group relative"
                      >
                        <button
                          onClick={() => handleStyleSelect(style.id)}
                          className={`tile-hover-glow w-44 h-56 relative p-6 rounded-[28px] border transition-all duration-300 hover:border-orange-500 flex flex-col items-center text-center justify-center ${isDark ? "bg-[#27272A] border-[#3F3F46]" : "bg-white border-slate-200 shadow-sm"}`}
                        >
                          <div
                            className={`mb-4 p-4 rounded-2xl group-hover:rotate-6 transition-all ${isDark ? "bg-[#18181B]" : "bg-slate-50 shadow-inner"}`}
                          >
                            {style.icon}
                          </div>
                          <h3
                            className={`text-sm font-black mb-1 ${isDark ? "text-white" : "text-slate-800"}`}
                          >
                            {style.name}
                          </h3>
                          <p className="text-[9px] text-slate-400 line-clamp-2 leading-relaxed">
                            {style.desc}
                          </p>
                        </button>
                        {!style.isDefault && (
                          <button
                            onClick={(e) => deleteStyle(style.id, e)}
                            className="absolute top-4 right-4 p-1.5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <X size={10} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="w-full max-w-5xl px-8 grid grid-cols-5 gap-6">
                  {hookStyles.map((style) => (
                    <div key={style.id} className="group relative">
                      <button
                        onClick={() => handleStyleSelect(style.id)}
                        className={`tile-hover-glow w-full h-52 p-6 rounded-[28px] border transition-all duration-300 hover:border-orange-500 flex flex-col items-center text-center justify-center ${isDark ? "bg-[#27272A] border-[#3F3F46]" : "bg-white border-slate-200 shadow-sm"}`}
                      >
                        <div
                          className={`mb-3 p-3 rounded-xl ${isDark ? "bg-[#18181B]" : "bg-slate-50"}`}
                        >
                          {style.icon}
                        </div>
                        <h3
                          className={`text-xs font-black ${isDark ? "text-white" : "text-slate-800"}`}
                        >
                          {style.name}
                        </h3>
                      </button>
                      {!style.isDefault && (
                        <button
                          onClick={(e) => deleteStyle(style.id, e)}
                          className="absolute top-3 right-3 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="w-full max-w-lg mt-10 px-6">
                <form
                  onSubmit={handleAddCustomStyle}
                  className={`border rounded-[20px] p-1.5 flex items-center transition-all ${isDark ? "bg-[#27272A] border-[#3F3F46] focus-within:border-orange-500/50" : "bg-white border-slate-200 shadow-lg focus-within:border-orange-500"}`}
                >
                  <input
                    type="text"
                    value={customRequirement}
                    onChange={(e) => setCustomRequirement(e.target.value)}
                    placeholder="输入自定义创意方向..."
                    className="flex-1 bg-transparent border-none text-xs font-bold p-3 outline-none"
                  />
                  <button
                    type="submit"
                    className="p-2 bg-orange-500 text-white rounded-xl"
                  >
                    <Plus size={16} />
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center animate-in slide-in-from-bottom-4 py-2">
              <h2
                className={`text-2xl font-black mb-6 italic ${isDark ? "text-white" : "text-slate-900"}`}
              >
                配置素材属性
              </h2>
              <div className="w-full max-w-6xl px-12 space-y-4 mb-6">
                {REGION_GROUPS.map((group) => (
                  <div key={group.category} className="space-y-1.5">
                    <h3 className="text-[9px] font-black text-orange-500/70 uppercase pl-2 border-l-2 border-orange-500/20">
                      {group.category}
                    </h3>
                    <div className="grid grid-cols-7 gap-2">
                      {group.regions.map((region) => (
                        <button
                          key={region.id}
                          onClick={() => {
                            setASideRegion(region.id);
                            playSound("click");
                          }}
                          className={`tile-hover-glow group p-2 rounded-xl border transition-all flex flex-col items-center justify-center gap-1 ${aSideRegion === region.id ? "bg-orange-500 text-white border-orange-500 shadow-md" : isDark ? "bg-[#18181B] border-[#3F3F46] text-slate-400 hover:border-white/20" : "bg-white border-slate-100 text-slate-500 hover:border-orange-200 hover:shadow-sm"}`}
                        >
                          <span className="text-lg">{region.icon}</span>
                          <span className="font-black text-[9px] truncate w-full text-center leading-none">
                            {region.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 max-w-sm w-full px-6 mb-8">
                {["麻将", "扑克"].map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setASideGameType(type);
                      playSound("click");
                    }}
                    className={`tile-hover-glow-blue flex-1 py-3.5 rounded-2xl border font-black text-xs flex items-center justify-center gap-3 transition-all ${aSideGameType === type ? (isDark ? "bg-blue-600/20 border-blue-500 text-blue-400 shadow-lg" : "bg-blue-600 border-blue-600 text-white shadow-xl scale-105") : isDark ? "bg-[#18181B] border-[#3F3F46] text-slate-400 hover:border-white/20" : "bg-white border-slate-200 text-slate-500 hover:border-blue-200"}`}
                  >
                    {type === "麻将" ? (
                      <Dice5 size={16} />
                    ) : (
                      <Gamepad2 size={16} />
                    )}{" "}
                    {type}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  setView("a-side-editor");
                  playSound("nav");
                }}
                className="bg-orange-500 text-white px-12 py-4 rounded-[20px] font-black text-sm shadow-xl active:scale-95 transition-all"
              >
                进入生产工厂
              </button>
            </div>
          )}
        </div>
      )}

      {/* 视图3：A面编辑器 */}
      {view === "a-side-editor" && (
        <div className="min-h-screen flex flex-col pt-14">
          {gemEditorMode && (
            <div className="fixed inset-0 z-[3000] flex items-center justify-center p-6 animate-in fade-in duration-300">
              <div
                className="absolute inset-0 bg-black/90 backdrop-blur-md"
                onClick={() => setGemEditorMode(null)}
              ></div>
              <div
                className={`relative w-full max-w-xl p-8 rounded-[40px] border shadow-2xl animate-in zoom-in-95 ${isDark ? "bg-[#27272A] border-blue-500/30" : "bg-white border-blue-100"}`}
              >
                <h3 className="text-xl font-black mb-6 flex items-center gap-2 text-blue-500">
                  <Wand2 size={24} />{" "}
                  {gemEditorMode === "create" ? "创建新人设" : "编辑人设"}
                </h3>
                <input
                  type="text"
                  value={gemEditData.name}
                  onChange={(e) =>
                    setGemEditData({ ...gemEditData, name: e.target.value })
                  }
                  placeholder="名称 (例如: 资深老炮)"
                  className={`w-full p-4 rounded-2xl mb-4 border outline-none ${isDark ? "bg-[#18181B] border-white/5 text-white" : "bg-slate-50 border-slate-100"}`}
                />
                <textarea
                  value={gemEditData.prompt}
                  onChange={(e) =>
                    setGemEditData({ ...gemEditData, prompt: e.target.value })
                  }
                  placeholder="角色设定指令..."
                  className={`w-full p-4 rounded-2xl mb-6 border outline-none h-32 resize-none ${isDark ? "bg-[#18181B] border-white/5 text-white" : "bg-slate-50 border-slate-100"}`}
                />
                <button
                  onClick={saveGem}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-[20px] font-black shadow-xl transition-colors"
                >
                  保存配置
                </button>
              </div>
            </div>
          )}

          <div
            className={`h-16 border-b flex items-center justify-between px-10 ${isDark ? "bg-[#27272A]/80 border-[#3F3F46]" : "bg-white/50 border-slate-100"}`}
          >
            <div className="flex items-center gap-2 bg-slate-500/5 p-1 rounded-[18px]">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setASideModel(m.id);
                    playSound("click");
                  }}
                  className={`px-4 py-1.5 rounded-[14px] text-[9px] font-black transition-all ${aSideModel === m.id ? m.color + " text-white shadow-lg" : "text-slate-400 hover:text-slate-200"}`}
                >
                  {m.name}
                </button>
              ))}

              <div
                className={`w-px h-4 mx-1 ${isDark ? "bg-white/10" : "bg-slate-300"}`}
              ></div>
              <button
                onClick={generateFromKnowledgeBase}
                className={`px-4 py-1.5 rounded-[14px] text-[10px] font-black transition-all flex items-center gap-1.5 ${aSideModel === "kb" ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg" : "text-purple-500 hover:bg-purple-500/10"}`}
              >
                <Database size={12} />
                知识库爆款仿写
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-black opacity-40 uppercase">
                批量数量:
              </span>
              <select
                value={batchSize}
                onChange={(e) => setBatchSize(parseInt(e.target.value))}
                className={`bg-transparent border rounded px-2 py-1 text-[10px] font-black text-orange-500 outline-none ${isDark ? "border-slate-700 bg-transparent" : "border-slate-300 bg-transparent"}`}
              >
                {[1, 5, 10, 15].map((n) => (
                  <option
                    key={n}
                    value={n}
                    className={isDark ? "bg-slate-900" : "bg-white"}
                  >
                    {n} 条
                  </option>
                ))}
              </select>
            </div>
          </div>

          <main className="flex-1 flex flex-col items-center p-8 max-w-4xl mx-auto w-full overflow-y-auto pb-32">
            <div
              className={`w-full border rounded-[32px] p-6 mb-8 relative animate-in slide-in-from-top-4 ${isDark ? "bg-[#27272A] border-[#3F3F46]" : "bg-white border-slate-100 shadow-xl"}`}
            >
              <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <UserCircle size={16} /> Gem 智能人设库
              </h3>
              <div className="grid grid-cols-3 gap-4">
                {personas.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setActivePersonaId(p.id);
                      playSound("click");
                    }}
                    className={`group relative p-4 rounded-2xl border cursor-pointer transition-all ${activePersonaId === p.id ? (isDark ? "border-blue-500 bg-blue-500/10 shadow-inner" : "border-blue-500 bg-blue-50 shadow-inner") : isDark ? "bg-[#18181B] border-[#3F3F46] hover:border-white/20" : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"}`}
                  >
                    <div
                      className={`font-black text-sm mb-1 ${isDark ? "text-slate-200" : "text-slate-800"}`}
                    >
                      {p.name}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate pr-6">
                      {p.prompt}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openGemEditor("edit", p);
                      }}
                      className="absolute top-4 right-3 opacity-0 group-hover:opacity-100 transition-all text-slate-400 hover:text-blue-500"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteGem(p.id, e);
                      }}
                      className="absolute bottom-4 right-3 opacity-0 group-hover:opacity-100 transition-all text-slate-400 hover:text-red-500"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => openGemEditor("create")}
                  className={`p-4 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-all ${isDark ? "border-[#52525B] text-slate-400 hover:text-blue-500 hover:border-blue-500/50 hover:bg-[#18181B]" : "border-slate-300 bg-slate-50/50 text-slate-400 hover:text-blue-500 hover:border-blue-500 hover:bg-blue-50/50"}`}
                >
                  <Plus size={18} />
                  <span className="text-[10px] font-black uppercase">
                    新建人设
                  </span>
                </button>
              </div>
            </div>

            {isKbAnalyzing ? (
              <div className="py-20 flex flex-col items-center">
                <div className="w-12 h-12 relative mb-4">
                  <div className="absolute inset-0 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
                  <Database
                    className="absolute inset-0 m-auto text-purple-500 animate-pulse"
                    size={16}
                  />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500 animate-pulse italic">
                  正在解析知识库高转化结构...
                </p>
              </div>
            ) : isGenerating ? (
              <div className="py-20 flex flex-col items-center">
                <div className="w-10 h-10 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mb-4"></div>
                <p className="text-[10px] font-black animate-pulse uppercase tracking-[0.3em]">
                  Processing...
                </p>
              </div>
            ) : aSideScripts.length === 0 ? (
              <div
                className={`py-24 w-full flex flex-col items-center border-4 border-dashed rounded-[40px] ${isDark ? "border-[#3F3F46] bg-transparent" : "border-slate-200 bg-slate-50"}`}
              >
                <button
                  onClick={generateScripts}
                  className="bg-orange-500 text-white px-10 py-5 rounded-[24px] font-black text-lg shadow-xl hover:scale-105 transition-all"
                >
                  🚀 批量产出文案 ({batchSize}条)
                </button>
              </div>
            ) : (
              <div className="w-full flex flex-col items-center animate-in slide-in-from-bottom-4">
                <div className="grid grid-cols-1 gap-3 w-full">
                  {aSideScripts.map((script, idx) => (
                    <div
                      key={script.id}
                      ref={(el) => (scriptRefs.current[idx] = el)}
                      style={{
                        "--tx": `${successAnimation?.tx || 0}px`,
                        "--ty": `${successAnimation?.ty || 0}px`,
                      }}
                      className={`group relative p-6 rounded-[28px] border transition-all duration-500 flex items-center gap-6 ${successAnimation?.index === idx ? "card-fly" : isDark ? "bg-[#27272A] border-[#3F3F46] hover:border-orange-500/50" : "bg-white border-slate-100 shadow-sm hover:border-orange-200"}`}
                    >
                      <div className="w-8 h-8 bg-slate-500/10 rounded-xl flex items-center justify-center font-black text-[10px] text-slate-400 shrink-0 italic">
                        {idx + 1}
                      </div>

                      {editingScriptId === script.id ? (
                        <div className="flex-1 flex items-center gap-3 pr-2">
                          <input
                            value={tempEditText}
                            onChange={(e) => setTempEditText(e.target.value)}
                            className={`flex-1 bg-transparent border-b-2 ${isDark ? "border-orange-500 text-white" : "border-orange-500 text-slate-900"} outline-none text-sm font-bold px-2 py-1 transition-colors`}
                            autoFocus
                          />
                          <button
                            onClick={() => saveScriptEdit(script.id)}
                            className="p-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-all shadow-md"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => setEditingScriptId(null)}
                            className={`p-2 rounded-xl transition-all ${isDark ? "bg-slate-800 text-slate-300 hover:text-white" : "bg-slate-200 text-slate-600 hover:text-slate-900"}`}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <p
                            className={`flex-1 text-sm font-bold leading-relaxed ${isDark ? "text-slate-200" : "text-slate-700"}`}
                          >
                            {script.text}
                          </p>
                          {!successAnimation && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mr-2">
                              <button
                                onClick={() => regenerateSingleScript(idx)}
                                className={`p-2.5 rounded-xl transition-all ${isDark ? "text-slate-300 hover:text-blue-400 hover:bg-blue-500/10" : "text-slate-500 hover:text-blue-500 hover:bg-blue-50"}`}
                                title="重新生成"
                              >
                                <RefreshCcw size={16} />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingScriptId(script.id);
                                  setTempEditText(script.text);
                                  playSound("click");
                                }}
                                className={`p-2.5 rounded-xl transition-all ${isDark ? "text-slate-300 hover:text-orange-400 hover:bg-orange-500/10" : "text-slate-500 hover:text-orange-500 hover:bg-orange-50"}`}
                                title="编辑"
                              >
                                <Pencil size={16} />
                              </button>
                            </div>
                          )}
                        </>
                      )}

                      {!successAnimation && editingScriptId !== script.id && (
                        <button
                          onClick={() => handleSaveToLibrary(idx)}
                          className={`p-3 text-white rounded-xl transition-all active:scale-90 shadow-md ml-2 ${isDark ? "bg-[#18181B] hover:bg-green-600 border border-[#3F3F46]" : "bg-slate-900 hover:bg-green-600"}`}
                        >
                          <CheckCircle2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="w-full flex items-center justify-center gap-6 mt-12 mb-8 border-t border-slate-500/20 pt-8">
                  <button
                    onClick={handleQuickProduce}
                    className="flex-1 max-w-[240px] py-4 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-black text-sm shadow-xl shadow-orange-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Zap size={20} /> 快速产出合成
                  </button>
                  <button
                    onClick={handleEnterDirectorMode}
                    className={`flex-1 max-w-[240px] py-4 rounded-2xl border-2 font-black text-sm transition-all active:scale-95 flex items-center justify-center gap-2 ${isDark ? "border-[#3F3F46] text-slate-300 hover:bg-[#27272A]" : "border-slate-300 text-slate-600 hover:bg-slate-100"}`}
                  >
                    <Network size={20} /> 导演模式
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      {/* 视图4：视频工厂 */}
      {view === "video-factory" && (
        <div className="min-h-screen flex flex-col pt-14 pb-20 animate-in slide-in-from-bottom-8">
          <div className="max-w-7xl mx-auto w-full px-8 py-8 flex flex-col h-full">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2
                  className={`text-3xl font-black italic flex items-center gap-3 ${isDark ? "text-white" : "text-slate-900"}`}
                >
                  <Film className="text-blue-500" size={28} /> AI 视频渲染工坊
                </h2>
                <p className="text-slate-400 text-xs mt-2 font-medium tracking-widest uppercase">
                  Video Synthesis Engine
                </p>
              </div>
              <button
                onClick={() =>
                  setModelModalInfo({ isOpen: true, target: "global" })
                }
                className={`flex items-center gap-2 px-6 py-3 rounded-[20px] border-2 font-black text-sm transition-all hover:scale-105 shadow-lg ${isDark ? "border-blue-500/50 bg-blue-500/10 text-blue-400 hover:border-blue-500" : "border-blue-500 bg-blue-50 text-blue-600 hover:bg-blue-100"}`}
              >
                <Globe size={18} /> 🌍 全局模型配置
              </button>
            </div>

            <div className="grid grid-cols-2 gap-8 flex-1">
              {videoSlots.map((slot, index) => {
                const selectedModelObj = VIDEO_MODELS.find(
                  (m) => m.id === slot.model,
                );
                const isSlotGenerating = slot.status === "generating";
                const isSlotDone = slot.status === "done";

                return (
                  <div
                    key={slot.id}
                    className={`relative rounded-[32px] border overflow-hidden flex flex-col transition-all ${slot.isSelected ? "border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)] ring-2 ring-green-500/50" : isDark ? "bg-[#27272A] border-[#3F3F46] shadow-2xl" : "bg-white border-slate-200 shadow-xl"}`}
                  >
                    {isSlotDone && (
                      <button
                        onClick={() => toggleSlotSelection(slot.id)}
                        className="absolute top-5 left-5 z-20 bg-black/60 backdrop-blur-md rounded-full p-1.5 border border-white/20 hover:scale-110 transition-all shadow-xl"
                      >
                        {slot.isSelected ? (
                          <CheckCircle2
                            size={24}
                            className="text-green-500"
                            fill="currentColor"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full border-2 border-white/50"></div>
                        )}
                      </button>
                    )}

                    {isSlotDone && (
                      <button
                        onClick={() => handleRegenerateSlot(slot.id)}
                        className="absolute top-5 right-5 z-20 bg-black/60 backdrop-blur-md rounded-full px-3 py-2 border border-white/20 hover:scale-105 hover:bg-black/80 transition-all text-white flex items-center gap-2 shadow-xl"
                      >
                        <RefreshCcw size={14} className="text-orange-400" />
                        <span className="text-[10px] font-black uppercase tracking-wider">
                          重新生成
                        </span>
                      </button>
                    )}

                    <div
                      className={`flex-1 min-h-[260px] flex items-center justify-center p-8 relative ${isSlotGenerating ? "rendering-pulse" : ""} ${isDark ? "bg-[#18181B]" : "bg-slate-50"}`}
                    >
                      {slot.status === "idle" && (
                        <button
                          onClick={() =>
                            setModelModalInfo({ isOpen: true, target: slot.id })
                          }
                          className={`flex flex-col items-center justify-center gap-4 px-10 py-8 rounded-[24px] border-2 border-dashed transition-all hover:scale-105 ${isDark ? "border-[#52525B] text-slate-400 hover:border-orange-500 hover:text-orange-500" : "border-slate-300 text-slate-400 hover:border-orange-500 hover:text-orange-500"}`}
                        >
                          <Plus size={40} />
                          <span className="font-black text-sm tracking-widest uppercase">
                            选择模型生成
                          </span>
                        </button>
                      )}

                      {isSlotGenerating && (
                        <div className="flex flex-col items-center w-full max-w-xs">
                          <div
                            className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 shadow-lg animate-bounce ${selectedModelObj?.bg} text-white`}
                          >
                            <Cpu size={32} />
                          </div>
                          <h4
                            className={`text-xl font-black mb-2 ${selectedModelObj?.color}`}
                          >
                            {selectedModelObj?.name}
                          </h4>
                          <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest mb-6">
                            Rendering in progress...
                          </p>
                          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${selectedModelObj?.bg} transition-all duration-300`}
                              style={{ width: `${slot.progress}%` }}
                            ></div>
                          </div>
                          <div className="mt-2 text-xs font-mono font-bold text-slate-400">
                            {slot.progress}%
                          </div>
                        </div>
                      )}

                      {isSlotDone && (
                        <div className="absolute inset-0 group">
                          <div
                            className={`absolute inset-0 ${selectedModelObj?.bg} opacity-[0.08]`}
                          ></div>
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div
                              className={`w-20 h-20 rounded-full backdrop-blur-md bg-white/10 border border-white/20 flex items-center justify-center group-hover:scale-110 transition-transform ${selectedModelObj?.color}`}
                            >
                              <Play
                                size={32}
                                className="ml-2"
                                fill="currentColor"
                              />
                            </div>
                          </div>
                          <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-[10px] font-black text-white flex items-center gap-2 shadow-lg">
                            <div
                              className={`w-2 h-2 rounded-full ${selectedModelObj?.bg}`}
                            ></div>{" "}
                            {selectedModelObj?.name}
                          </div>
                        </div>
                      )}
                    </div>

                    <div
                      className={`p-5 border-t flex items-start gap-4 transition-colors ${isDark ? "border-[#3F3F46] bg-[#27272A]" : "border-slate-100 bg-white"} ${slot.isSelected ? "bg-green-500/5" : ""}`}
                    >
                      <div
                        className={`w-8 h-8 mt-2 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${isDark ? "bg-[#18181B] text-slate-400 border border-[#3F3F46]" : "bg-slate-200 text-slate-600"}`}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1 w-full">
                        <textarea
                          value={slot.script || ""}
                          onChange={(e) =>
                            handleSlotScriptChange(slot.id, e.target.value)
                          }
                          disabled={isSlotGenerating}
                          placeholder="请输入或编辑分镜文案..."
                          className={`w-full bg-transparent border-2 outline-none resize-none font-medium text-sm px-4 py-3 rounded-xl transition-all ${
                            isSlotGenerating
                              ? isDark
                                ? "border-[#3F3F46] text-slate-500 bg-[#18181B]/50 cursor-not-allowed"
                                : "border-slate-200 text-slate-400 bg-slate-100 cursor-not-allowed"
                              : isDark
                                ? "border-[#52525B] text-slate-300 focus:border-green-500 focus:bg-[#18181B] hover:border-[#3F3F46]"
                                : "border-slate-300 text-slate-700 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 hover:border-slate-400"
                          }`}
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="w-full flex items-center justify-center gap-8 mt-12 pt-8 border-t border-slate-500/20">
              <button
                onClick={() => handleGlobalAction("local")}
                className={`flex-1 max-w-[280px] py-4 rounded-2xl border-2 font-black text-sm transition-all active:scale-95 flex items-center justify-center gap-2 ${isDark ? "border-[#3F3F46] text-slate-300 hover:bg-[#27272A]" : "border-slate-300 text-slate-600 hover:bg-slate-100"}`}
              >
                <Save size={20} /> 存档本地A面库
              </button>
              <button
                onClick={() => handleGlobalAction("upload")}
                className="flex-1 max-w-[280px] py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm shadow-xl shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Database size={20} /> 上传知识库大模型
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 视图5：知识库大模型 */}
      {view === "knowledge-base" && (
        <div
          className={`flex h-screen w-full animate-in fade-in duration-500 notebook-bg ${isDark ? "text-slate-300" : "text-slate-800"}`}
        >
          <div
            className={`w-80 h-full flex flex-col border-r notebook-sidebar shadow-lg z-10`}
          >
            <div className="p-6 border-b border-inherit flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleASideBack}
                  className={`flex items-center gap-1.5 transition-all text-xs font-black uppercase ${isDark ? "text-slate-400 hover:text-white" : "text-slate-400 hover:text-slate-900"}`}
                >
                  <ArrowLeft size={14} /> 返回
                </button>
                <div
                  className={`w-px h-4 ${isDark ? "bg-[#52525B]" : "bg-slate-300"}`}
                ></div>
                <h2 className="text-xl font-bold tracking-tight">源</h2>
              </div>
              <button
                className={`p-2 rounded-full border transition-colors ${isDark ? "border-[#52525B] hover:bg-[#3F3F46] text-slate-300" : "border-slate-300 hover:bg-slate-100 text-slate-600"}`}
              >
                <Plus size={18} />
              </button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              <div className="text-xs font-bold uppercase tracking-widest opacity-50 mb-2">
                已添加 {kbSources.length} 个源
              </div>

              {kbSources.map((src, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all hover:-translate-y-1 shadow-sm ${isDark ? "bg-[#27272A] border-[#3F3F46] hover:border-orange-500/50" : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-md"}`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                      <FileVideo size={16} />
                    </div>
                    <div className="font-bold text-sm truncate">
                      {src.title}
                    </div>
                  </div>
                  <p className="text-[10px] opacity-60 line-clamp-2 leading-relaxed">
                    {src.excerpt}
                  </p>
                </div>
              ))}

              <div
                className={`p-4 rounded-2xl border border-dashed flex flex-col items-center justify-center gap-2 py-8 opacity-60 ${isDark ? "border-[#52525B]" : "border-slate-300"}`}
              >
                <FileText size={24} className="opacity-50" />
                <span className="text-xs font-medium">支持拖拽添加新资产</span>
              </div>
            </div>
          </div>

          <div className="flex-1 h-full flex flex-col relative overflow-hidden">
            <header className="h-16 px-6 flex items-center justify-between z-10">
              <div className="flex items-center gap-4">
                <h1 className="text-lg font-bold">乐高广告资产库</h1>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={toggleTheme}
                  className="p-2 opacity-50 hover:opacity-100 transition-opacity"
                >
                  {isDark ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                <button className="px-4 py-2 bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-sm font-bold rounded-full">
                  分享
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto flex flex-col items-center px-4 pb-40">
              <div
                className={`w-full max-w-3xl mt-8 p-6 rounded-[32px] border notebook-card flex flex-col gap-4`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Headphones size={24} className="text-blue-500" />
                    <h3 className="font-bold text-lg">音频概览</h3>
                  </div>
                  <button className="text-xs font-bold text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full">
                    Beta
                  </button>
                </div>
                <p className="text-sm opacity-60">
                  一键将选中的素材源转化为两人对谈的深度解析播客。洞察文案爆点与画面张力。
                </p>

                {audioOverviewReady ? (
                  <div className="mt-4 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
                        <Play size={20} fill="currentColor" className="ml-1" />
                      </button>
                      <div>
                        <div className="font-bold text-sm">
                          素材爆点解析.wav
                        </div>
                        <div className="text-xs opacity-60 flex items-center gap-2 mt-1">
                          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>{" "}
                          正在播放 (0:42 / 3:15)
                        </div>
                      </div>
                    </div>
                    <div className="flex -space-x-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 border-2 border-white dark:border-slate-800"></div>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 border-2 border-white dark:border-slate-800"></div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleGenerateAudioOverview}
                    disabled={isAudioGenerating}
                    className="mt-4 w-fit px-6 py-3 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-sm hover:scale-105 transition-transform flex items-center gap-2"
                  >
                    {isAudioGenerating ? (
                      <>
                        <div className="flex gap-1 audio-pulse">
                          <div className="w-1 h-3 bg-current rounded-full" />
                          <div className="w-1 h-4 bg-current rounded-full delay-75" />
                          <div className="w-1 h-2 bg-current rounded-full delay-150" />
                        </div>{" "}
                        生成中...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} /> 生成对谈播客
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="w-full max-w-3xl mt-12 space-y-8">
                {kbChatHistory.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center shrink-0 shadow-sm">
                        <Sparkles size={14} className="text-white" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] p-5 text-sm leading-relaxed ${msg.role === "user" ? (isDark ? "bg-[#27272A] text-slate-200" : "bg-slate-200 text-slate-700") : "bg-transparent"} rounded-[24px] ${msg.role === "user" ? "rounded-tr-sm" : "rounded-tl-sm"}`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              className={`absolute bottom-0 w-full p-8 pt-4 bg-gradient-to-t ${isDark ? "from-[#1C1C1F] via-[#1C1C1F] to-transparent" : "from-[#F8F9FA] via-[#F8F9FA] to-transparent"} flex flex-col items-center justify-center`}
            >
              <div className="w-full max-w-3xl flex flex-wrap gap-2 mb-4">
                {["提取核心痛点", "分析地域梗", "生成营销总结"].map((chip) => (
                  <button
                    key={chip}
                    onClick={() => setKbInput(chip)}
                    className={`px-4 py-2 rounded-full border text-xs font-bold transition-all ${isDark ? "border-[#3F3F46] bg-[#27272A] hover:bg-[#3F3F46]" : "border-slate-300 hover:bg-slate-200"} flex items-center gap-1.5`}
                  >
                    <MessageCircle size={12} className="opacity-50" /> {chip}
                  </button>
                ))}
              </div>

              <form
                onSubmit={handleKBSendChat}
                className={`w-full max-w-3xl rounded-[32px] border flex items-center p-2 shadow-lg notebook-input`}
              >
                <button
                  type="button"
                  className="p-3 opacity-50 hover:opacity-100 transition-opacity"
                >
                  <Paperclip size={20} />
                </button>
                <input
                  type="text"
                  value={kbInput}
                  onChange={(e) => setKbInput(e.target.value)}
                  placeholder={`向这 ${kbSources.length} 个源提问...`}
                  className="flex-1 bg-transparent border-none outline-none px-2 py-3 font-medium"
                />
                <button
                  type="submit"
                  disabled={!kbInput.trim()}
                  className={`p-3 rounded-full transition-colors ${kbInput.trim() ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "opacity-30"}`}
                >
                  <Send size={18} />
                </button>
              </form>
              <div className="text-[10px] opacity-40 mt-4 tracking-widest uppercase font-bold">
                Lego-Ads Engine can make mistakes. Check important info.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 视图6：导演模式无限画布 */}
      {view === "director-mode" && (
        <div
          className={`flex h-screen w-full overflow-hidden animate-in fade-in duration-500 bg-transparent ${isDark ? "text-slate-300" : "text-slate-800"}`}
        >
          {/* Left Sidebar: Chat Agent */}
          <div
            className={`w-80 h-full flex flex-col border-r shadow-2xl z-20 shrink-0 ${isDark ? "bg-[#27272A] border-[#3F3F46]" : "bg-white border-slate-200"}`}
          >
            <header className="p-5 border-b flex items-center justify-between border-inherit shrink-0">
              <button
                onClick={() => setView("a-side-editor")}
                className={`flex items-center gap-2 text-xs font-bold transition-all ${isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"}`}
              >
                <ArrowLeft size={14} /> 返回
              </button>
              <span className="text-[10px] font-black tracking-[0.2em] text-orange-500 uppercase">
                Director Mode
              </span>
            </header>

            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
              {directorChatHistory.map((msg, i) => {
                if (msg.role === "system") {
                  return (
                    <div
                      key={i}
                      className="w-full flex justify-center my-2 animate-in fade-in"
                    >
                      <span
                        className={`px-4 py-1.5 text-[10px] font-bold rounded-full tracking-widest ${isDark ? "bg-[#18181B] text-slate-400 border border-[#3F3F46]" : "bg-slate-200 text-slate-500"}`}
                      >
                        {msg.text}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={i}
                    className={`flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start"} animate-in slide-in-from-bottom-2`}
                  >
                    {msg.name && (
                      <div className="flex items-center gap-1.5 text-[10px] font-black tracking-widest text-slate-500 uppercase ml-1">
                        <Bot
                          size={12}
                          className={
                            msg.name === "艺术总监"
                              ? "text-orange-500"
                              : msg.name === "选角导演"
                                ? "text-blue-500"
                                : msg.name === "摄像导演"
                                  ? "text-red-500"
                                  : "text-green-500"
                          }
                        />{" "}
                        {msg.name}
                      </div>
                    )}
                    <div
                      className={`max-w-[90%] p-3 text-sm leading-relaxed rounded-2xl shadow-sm ${
                        msg.role === "user"
                          ? isDark
                            ? "bg-[#3F3F46] text-slate-200 rounded-tr-sm"
                            : "bg-slate-200 text-slate-800 rounded-tr-sm"
                          : isDark
                            ? "bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-tl-sm"
                            : "bg-orange-50 border border-orange-200 text-orange-600 rounded-tl-sm"
                      }`}
                    >
                      {msg.text}
                    </div>

                    {msg.isConfigForm && !msg.submitted && (
                      <div
                        className={`mt-3 w-[95%] p-4 rounded-xl border flex flex-col gap-4 ${isDark ? "bg-[#18181B] border-[#3F3F46]" : "bg-white/50 border-slate-200 shadow-sm"}`}
                      >
                        <div>
                          <div className="text-[10px] font-bold text-slate-500 mb-2">
                            影片长度
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                setDirConfig({ ...dirConfig, length: "short" })
                              }
                              className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${dirConfig.length === "short" ? "bg-orange-500 border-orange-400 text-white" : isDark ? "bg-[#27272A] border-[#3F3F46] text-slate-300" : "bg-slate-50 border-slate-200 text-slate-600"}`}
                            >
                              短视频 {"<15s"}
                            </button>
                            <button
                              onClick={() =>
                                setDirConfig({ ...dirConfig, length: "long" })
                              }
                              className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${dirConfig.length === "long" ? "bg-orange-500 border-orange-400 text-white" : isDark ? "bg-[#27272A] border-[#3F3F46] text-slate-300" : "bg-slate-50 border-slate-200 text-slate-600"}`}
                            >
                              长视频 {">15s"}
                            </button>
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-slate-500 mb-2">
                            画幅比例
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                setDirConfig({
                                  ...dirConfig,
                                  ratio: "horizontal",
                                })
                              }
                              className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${dirConfig.ratio === "horizontal" ? "bg-purple-500 border-purple-400 text-white" : isDark ? "bg-[#27272A] border-[#3F3F46] text-slate-300" : "bg-slate-50 border-slate-200 text-slate-600"}`}
                            >
                              横版 (16:9)
                            </button>
                            <button
                              onClick={() =>
                                setDirConfig({
                                  ...dirConfig,
                                  ratio: "vertical",
                                })
                              }
                              className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${dirConfig.ratio === "vertical" ? "bg-purple-500 border-purple-400 text-white" : isDark ? "bg-[#27272A] border-[#3F3F46] text-slate-300" : "bg-slate-50 border-slate-200 text-slate-600"}`}
                            >
                              竖版 (9:16)
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={handleDirectorConfigSubmit}
                          className={`w-full py-3 mt-1 text-white text-xs font-black rounded-xl shadow-lg transition-transform active:scale-95 ${isDark ? "bg-slate-300 text-slate-900 hover:bg-white" : "bg-slate-900 hover:bg-slate-800"}`}
                        >
                          确认并继续
                        </button>
                      </div>
                    )}

                    {msg.buttons && (
                      <div className="flex flex-col gap-2 mt-2 w-[90%]">
                        {msg.buttons.map((btn, btnIdx) => (
                          <button
                            key={btnIdx}
                            onClick={() =>
                              handleDirectorChatAction(btn.action, btn.label)
                            }
                            className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all text-left border ${
                              btn.action.includes("pro_mode")
                                ? "bg-blue-600 hover:bg-blue-50 text-white border-blue-600"
                                : btn.action.includes("invite") ||
                                    btn.action.includes("merge")
                                  ? "bg-red-600 hover:bg-red-50 text-white border-red-600 text-center justify-center shadow-lg"
                                  : isDark
                                    ? "border-[#52525B] bg-[#18181B] hover:border-orange-500 text-slate-300"
                                    : "border-slate-200 bg-white hover:border-orange-500 text-slate-700"
                            }`}
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={chatBottomRef} />
            </div>

            <div
              className={`p-4 border-t border-inherit shrink-0 ${isDark ? "bg-[#27272A]/50" : "bg-slate-50"}`}
            >
              <div
                className={`flex flex-col rounded-2xl border overflow-hidden transition-colors shadow-sm ${isDark ? "bg-[#18181B] border-[#52525B] focus-within:border-orange-500" : "bg-white border-slate-300 focus-within:border-orange-500"}`}
              >
                <textarea
                  value={directorInput}
                  onChange={(e) => setDirectorInput(e.target.value)}
                  placeholder="拖拽图片，或输入指令参与群聊..."
                  className="w-full h-20 p-3 bg-transparent resize-none outline-none text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleDirectorSend(e);
                    }
                  }}
                />
                <div
                  className={`flex items-center justify-between px-3 py-2 border-t ${isDark ? "border-[#3F3F46] bg-[#27272A]" : "border-slate-100 bg-slate-50"}`}
                >
                  <div className="flex items-center gap-1">
                    <button
                      className={`p-1.5 rounded-lg transition-colors ${isDark ? "text-slate-400 hover:text-white hover:bg-[#3F3F46]" : "text-slate-500 hover:text-slate-800 hover:bg-slate-200"}`}
                      title="添加附件"
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      className={`p-1.5 rounded-lg transition-all ${highlightUpload ? "bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.5)] animate-pulse" : isDark ? "text-slate-400 hover:text-white hover:bg-[#3F3F46]" : "text-slate-500 hover:text-slate-800 hover:bg-slate-200"}`}
                      title="上传参考图片"
                    >
                      <ImagePlus size={16} />
                    </button>
                    <button
                      onClick={() => setShowStyleLib(!showStyleLib)}
                      className={`p-1.5 rounded-lg transition-colors ${showStyleLib ? "text-orange-500 bg-orange-500/10" : isDark ? "text-slate-400 hover:text-white hover:bg-[#3F3F46]" : "text-slate-500 hover:text-slate-800 hover:bg-slate-200"}`}
                      title="风格库预设"
                    >
                      <Palette size={16} />
                    </button>
                  </div>
                  <button
                    onClick={handleDirectorSend}
                    disabled={!directorInput.trim()}
                    className={`p-1.5 rounded-full transition-colors ${directorInput.trim() ? "bg-orange-500 text-white shadow-md hover:bg-orange-400" : isDark ? "bg-[#3F3F46] text-[#666]" : "bg-slate-200 text-slate-400"}`}
                  >
                    <ArrowUp size={16} strokeWidth={3} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 风格库浮层 */}
          {showStyleLib && (
            <div
              className={`absolute left-80 bottom-6 w-[340px] h-[560px] z-30 rounded-r-[32px] rounded-tl-[32px] border shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-left-4 fade-in duration-300 ${isDark ? "bg-[#27272A] border-[#3F3F46]" : "bg-white border-slate-200"}`}
            >
              <div className="p-5 border-b border-inherit flex items-center justify-between">
                <h3 className="font-black text-lg flex items-center gap-2">
                  <Palette className="text-orange-500" /> 风格库
                </h3>
                <button
                  onClick={() => setShowStyleLib(false)}
                  className={`p-1.5 rounded-full transition-colors ${isDark ? "hover:bg-[#3F3F46] text-slate-400 hover:text-white" : "hover:bg-slate-200 text-slate-500"}`}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-3 flex flex-wrap gap-2 border-b border-inherit">
                {STYLE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveStyleCat(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${activeStyleCat === cat ? "bg-orange-500 text-white" : isDark ? "bg-[#18181B] text-slate-300 hover:text-white" : "bg-slate-100 text-slate-600 hover:text-black"}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-4">
                {DUMMY_STYLES.filter(
                  (s) =>
                    activeStyleCat === "全部" || s.category === activeStyleCat,
                ).map((style) => (
                  <div
                    key={style.id}
                    onClick={() => handleSelectStyle(style)}
                    className={`cursor-pointer group rounded-2xl border transition-all hover:scale-105 hover:border-orange-500 hover:shadow-lg overflow-hidden ${isDark ? "border-[#3F3F46] bg-[#18181B]" : "border-slate-200 bg-slate-50"}`}
                  >
                    <div
                      className={`w-full aspect-[3/4] ${style.bg} relative overflow-hidden`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                      <div className="absolute bottom-3 left-3 right-3 text-white font-black text-sm drop-shadow-md">
                        {style.name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Right Area: Infinite Node Canvas */}
          <div
            className={`flex-1 h-full relative overflow-hidden select-none ${isDark ? "bg-dots-dark" : "bg-dots-light"}`}
            style={{
              "--dot-size": `${24 * canvasTransform.scale}px`,
              "--bg-x": `${canvasTransform.x}px`,
              "--bg-y": `${canvasTransform.y}px`,
              touchAction: "none",
            }}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerUp}
            onWheel={handleCanvasWheel}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div
              className="absolute top-0 left-0 w-full h-full origin-top-left pointer-events-none"
              style={{
                transform: `translate(${canvasTransform.x}px, ${canvasTransform.y}px) scale(${canvasTransform.scale})`,
              }}
            >
              {isSelecting && (
                <div
                  className="absolute border-2 border-orange-500 bg-orange-500/20 z-50 pointer-events-none"
                  style={{
                    left: Math.min(selectionBox.startX, selectionBox.endX),
                    top: Math.min(selectionBox.startY, selectionBox.endY),
                    width: Math.abs(selectionBox.endX - selectionBox.startX),
                    height: Math.abs(selectionBox.endY - selectionBox.startY),
                  }}
                />
              )}

              {/* SVG 连线层 */}
              <svg
                className="absolute inset-0 pointer-events-none z-0"
                style={{ overflow: "visible" }}
              >
                {canvasEdges.map((edge) => {
                  const sourceNode = canvasNodes.find(
                    (n) => n.id === edge.source,
                  );
                  const targetNode = canvasNodes.find(
                    (n) => n.id === edge.target,
                  );
                  if (!sourceNode || !targetNode) return null;

                  const getSourceHeight = (type) => {
                    if (type === "script") return 140;
                    if (type === "character") return 380;
                    if (type === "storyboard") return 200;
                    if (type === "video") return 280;
                    return 120;
                  };

                  const getWidthOffset = (node) => {
                    return node.width ? node.width / 2 : 160;
                  };

                  const startX = sourceNode.x + getWidthOffset(sourceNode);
                  const startY =
                    sourceNode.y + getSourceHeight(sourceNode.type);
                  const endX = targetNode.x + getWidthOffset(targetNode);
                  const endY = targetNode.y;

                  const yOffset = Math.max(60, Math.abs(endY - startY) / 2);
                  const path = `M ${startX} ${startY} C ${startX} ${startY + yOffset}, ${endX} ${endY - yOffset}, ${endX} ${endY}`;

                  const isEdgeSelected =
                    selectedNodeIds.includes(sourceNode.id) ||
                    selectedNodeIds.includes(targetNode.id);

                  return (
                    <path
                      key={edge.id}
                      d={path}
                      stroke={
                        isEdgeSelected
                          ? "#f97316"
                          : sourceNode.type === "storyboard" ||
                              sourceNode.type === "video"
                            ? "#3b82f6"
                            : "#f97316"
                      }
                      strokeWidth={isEdgeSelected ? "4" : "3"}
                      fill="none"
                      strokeDasharray="6,6"
                      className={`animate-[dashLine_1s_linear_infinite] ${isEdgeSelected ? "opacity-100" : "opacity-60"}`}
                    />
                  );
                })}
              </svg>

              {/* 画布节点渲染 */}
              {canvasNodes.map((node) => {
                const isSelected = selectedNodeIds.includes(node.id);

                return (
                  <div
                    key={node.id}
                    data-id={node.id}
                    className={`canvas-node absolute p-5 rounded-2xl border shadow-xl cursor-grab active:cursor-grabbing z-10 pointer-events-auto transition-all duration-100 ${
                      isSelected
                        ? "ring-2 ring-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.25)] scale-[1.02] border-orange-500"
                        : isDark
                          ? "bg-[#27272A] border-[#3F3F46] hover:shadow-orange-500/10"
                          : "bg-white border-slate-200 hover:shadow-orange-500/20"
                    }`}
                    style={{
                      transform: `translate(${node.x}px, ${node.y}px)`,
                      width: `${node.width}px`,
                    }}
                  >
                    {/* Script 节点 */}
                    {node.type === "script" && (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <FileText size={14} className="text-blue-500" />{" "}
                            文案模块
                          </h4>
                          {editingCanvasNodeId !== node.id && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingCanvasNodeId(node.id);
                                setTempCanvasNodeText(node.data.text);
                                playSound("click");
                              }}
                              className="text-slate-400 hover:text-orange-500 transition-colors p-1"
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                        </div>
                        {editingCanvasNodeId === node.id ? (
                          <div className="flex flex-col gap-3">
                            <textarea
                              value={tempCanvasNodeText}
                              onChange={(e) =>
                                setTempCanvasNodeText(e.target.value)
                              }
                              className={`w-full p-3 text-sm font-medium rounded-xl border outline-none resize-none transition-colors ${isDark ? "bg-[#18181B] border-[#52525B] text-white focus:border-orange-500" : "bg-slate-50 border-slate-200 text-slate-800 focus:border-orange-500"}`}
                              rows={4}
                              autoFocus
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingCanvasNodeId(null);
                                }}
                                className="text-xs font-bold text-slate-500 hover:text-slate-300 px-3 py-1.5"
                              >
                                取消
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCanvasNodes((prev) =>
                                    prev.map((n) =>
                                      n.id === node.id
                                        ? {
                                            ...n,
                                            data: {
                                              ...n.data,
                                              text: tempCanvasNodeText,
                                            },
                                          }
                                        : n,
                                    ),
                                  );
                                  setEditingCanvasNodeId(null);
                                  playSound("action");
                                }}
                                className="text-xs font-bold bg-orange-500 text-white px-4 py-1.5 rounded-lg hover:bg-orange-600 shadow-md"
                              >
                                保存
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setEditingCanvasNodeId(node.id);
                              setTempCanvasNodeText(node.data.text);
                              playSound("click");
                            }}
                            className="text-sm font-medium leading-relaxed min-h-[60px] cursor-text"
                          >
                            {node.data.text}
                          </p>
                        )}
                      </>
                    )}

                    {/* 人物视觉合一节点 */}
                    {node.type === "character" && (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <UserCircle size={14} className="text-orange-500" />{" "}
                            人物视觉模块
                          </h4>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRegenerateCanvasNode(node.id);
                              }}
                              className={`p-1.5 rounded-md transition-colors ${isDark ? "hover:bg-[#3F3F46] text-slate-400 hover:text-orange-400" : "hover:bg-orange-50 text-slate-500 hover:text-orange-500"}`}
                              title="不满意？重新生图"
                              disabled={node.data.isGeneratingImage}
                            >
                              <RefreshCcw
                                size={12}
                                className={
                                  node.data.isGeneratingImage
                                    ? "animate-spin text-orange-500"
                                    : ""
                                }
                              />
                            </button>

                            {editingCanvasNodeId !== node.id && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingCanvasNodeId(node.id);
                                  setTempCharName(node.data.name);
                                  setTempCharDesc(node.data.desc);
                                  playSound("click");
                                }}
                                className="text-slate-400 hover:text-orange-500 transition-colors p-1.5 rounded-md"
                                title="编辑设定"
                              >
                                <Pencil size={14} />
                              </button>
                            )}
                            {editingCanvasNodeId === node.id && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingCanvasNodeId(null);
                                  setCanvasNodes((prev) =>
                                    prev.map((n) => {
                                      if (n.id === node.id) {
                                        return {
                                          ...n,
                                          data: {
                                            ...n.data,
                                            name: tempCharName,
                                            desc: tempCharDesc,
                                            isGeneratingImage: true,
                                          },
                                        };
                                      }
                                      return n;
                                    }),
                                  );
                                  playSound("action");
                                  setTimeout(() => {
                                    playSound("backpack");
                                    setCanvasNodes((prev) =>
                                      prev.map((n) => {
                                        if (n.id === node.id) {
                                          return {
                                            ...n,
                                            data: {
                                              ...n.data,
                                              isGeneratingImage: false,
                                              imageUrl:
                                                n.data.imageUrl +
                                                "&r=" +
                                                Date.now(),
                                            },
                                          };
                                        }
                                        return n;
                                      }),
                                    );
                                    showToast("已根据新设定重新生成人物图像！");
                                  }, 2500);
                                }}
                                className="bg-green-500 hover:bg-green-600 text-white p-1.5 rounded-md transition-colors shadow-md"
                                title="保存并生成"
                              >
                                <Check size={14} strokeWidth={3} />
                              </button>
                            )}
                          </div>
                        </div>

                        {editingCanvasNodeId === node.id ? (
                          <div
                            className={`p-3 rounded-xl border flex flex-col gap-2 mb-3 shadow-inner ${isDark ? "bg-[#18181B] border-[#52525B]" : "bg-slate-50 border-slate-300"}`}
                          >
                            <input
                              value={tempCharName}
                              onChange={(e) => setTempCharName(e.target.value)}
                              className="w-full bg-transparent font-bold text-sm text-orange-500 outline-none border-b border-transparent focus:border-orange-500/50 pb-1"
                              placeholder="角色名称"
                            />
                            <textarea
                              value={tempCharDesc}
                              onChange={(e) => setTempCharDesc(e.target.value)}
                              className="w-full h-16 bg-transparent text-xs opacity-80 leading-relaxed outline-none resize-none"
                              placeholder="角色特征描述..."
                            />
                          </div>
                        ) : (
                          <div
                            className={`p-3 rounded-xl border flex flex-col mb-3 ${isDark ? "bg-[#18181B] border-[#3F3F46]" : "bg-slate-50 border-slate-100"}`}
                          >
                            <div className="font-bold text-sm text-orange-500 mb-1">
                              {node.data.name}
                            </div>
                            <div className="text-xs opacity-70 leading-relaxed">
                              {node.data.desc}
                            </div>
                          </div>
                        )}

                        <div
                          className={`rounded-xl border overflow-hidden relative group ${isDark ? "border-[#3F3F46]" : "border-slate-200"}`}
                        >
                          {node.data.isGeneratingImage ? (
                            <div
                              className={`w-full h-40 flex flex-col items-center justify-center ${isDark ? "bg-[#18181B]" : "bg-slate-50"}`}
                            >
                              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                              <span className="text-[10px] text-purple-500 font-bold uppercase tracking-widest animate-pulse">
                                Banana 渲染中...
                              </span>
                            </div>
                          ) : (
                            <>
                              <img
                                src={node.data.imageUrl}
                                alt={node.data.name}
                                className="w-full h-40 object-cover"
                                draggable={false}
                              />
                              <div className="absolute bottom-0 w-full p-2 bg-black/60 backdrop-blur-sm text-white text-xs font-bold text-center">
                                视觉概念呈现
                              </div>
                            </>
                          )}
                        </div>
                      </>
                    )}

                    {/* Storyboard 分镜节点 */}
                    {node.type === "storyboard" && (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Film size={14} className="text-green-500" />{" "}
                            核心动态分镜矩阵
                          </h4>
                        </div>
                        <div
                          className={`rounded-xl border overflow-hidden relative group shadow-2xl ${isDark ? "border-[#3F3F46]" : "border-slate-200"}`}
                        >
                          {node.isGenerating ? (
                            <div
                              className={`w-full ${node.data.isHorizontal ? "aspect-video" : "aspect-[9/16]"} flex flex-col items-center justify-center ${isDark ? "bg-[#18181B]" : "bg-slate-50"}`}
                            >
                              <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                              <span className="text-xs text-green-500 font-bold uppercase tracking-widest animate-pulse">
                                Banana 分镜矩阵合成分割中...
                              </span>
                            </div>
                          ) : (
                            <div
                              className={`w-full ${node.data.isHorizontal ? "aspect-video" : "aspect-[9/16]"} flex flex-col relative`}
                            >
                              <div
                                className={`flex-1 grid ${node.data.isHorizontal ? "grid-cols-5 grid-rows-5" : "grid-cols-3 grid-rows-8"} gap-[1px] p-[1px] ${isDark ? "bg-[#3F3F46]" : "bg-slate-300"}`}
                              >
                                {Array.from({
                                  length: node.data.isHorizontal ? 25 : 24,
                                }).map((_, i) => (
                                  <div
                                    key={i}
                                    className={`relative flex flex-col items-center justify-center overflow-hidden transition-all hover:scale-[1.05] hover:z-10 shadow-sm cursor-pointer ${isDark ? "bg-[#18181B] hover:bg-[#3F3F46]" : "bg-slate-50 hover:bg-white"}`}
                                  >
                                    <span className="absolute top-1 left-1.5 text-[8px] font-black text-slate-500 opacity-40">
                                      {String(i + 1).padStart(2, "0")}
                                    </span>
                                    <ImagePlus
                                      size={14}
                                      className="opacity-10 text-slate-400"
                                    />
                                  </div>
                                ))}
                              </div>
                              <div className="absolute bottom-0 w-full p-2.5 bg-black/80 backdrop-blur-md text-white text-sm font-bold flex justify-between items-center px-4">
                                <span className="flex items-center gap-2">
                                  <Sparkles
                                    size={14}
                                    className="text-orange-500"
                                  />{" "}
                                  {node.data.label}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRegenerateCanvasNode(node.id);
                                  }}
                                  className="text-xs text-orange-400 hover:text-white flex items-center gap-1 transition-colors bg-white/10 px-2 py-1 rounded-md"
                                >
                                  <RefreshCcw size={12} /> 重新生成
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* 视频节点 */}
                    {node.type === "video" && (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <PlayCircle
                              size={14}
                              className={
                                node.data.isFinal
                                  ? "text-red-500"
                                  : "text-blue-500"
                              }
                            />
                            {node.data.title}
                          </h4>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRegenerateCanvasNode(node.id);
                            }}
                            className={`p-1.5 rounded-md transition-colors ${isDark ? "hover:bg-[#3F3F46] text-slate-400 hover:text-blue-400" : "hover:bg-blue-50 text-slate-500 hover:text-blue-500"}`}
                            title="重新渲染视频"
                            disabled={node.isGenerating}
                          >
                            <RefreshCcw
                              size={12}
                              className={
                                node.isGenerating
                                  ? "animate-spin text-blue-500"
                                  : ""
                              }
                            />
                          </button>
                        </div>

                        <div
                          className={`rounded-xl border overflow-hidden relative group shadow-2xl ${isDark ? "border-[#3F3F46]" : "border-slate-200"}`}
                        >
                          {node.isGenerating ? (
                            <div
                              className={`w-full ${node.data.isHorizontal ? "aspect-video" : "aspect-[9/16]"} flex flex-col items-center justify-center ${isDark ? "bg-[#18181B]" : "bg-slate-50"}`}
                            >
                              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                              <span className="text-[10px] text-blue-500 font-bold uppercase tracking-widest animate-pulse text-center px-4">
                                底层视频大模型
                                <br />
                                时空运动渲染中...
                              </span>
                            </div>
                          ) : (
                            <>
                              <img
                                src={node.data.url}
                                alt={node.data.label}
                                className={`w-full ${node.data.isHorizontal ? "aspect-video" : "aspect-[9/16]"} object-cover`}
                                draggable={false}
                              />

                              <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/40 transition-all cursor-pointer">
                                <PlayCircle
                                  size={40}
                                  className="text-white opacity-80 group-hover:scale-110 transition-transform"
                                  fill="rgba(0,0,0,0.3)"
                                />
                              </div>

                              <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md text-white text-[10px] font-black px-2 py-1 rounded-md shadow-sm border border-white/10">
                                ⏱ {node.data.duration}
                              </div>

                              <div
                                className={`absolute bottom-0 w-full p-2 bg-gradient-to-t from-black/90 to-transparent text-white text-xs font-bold text-center truncate ${node.data.isFinal ? "text-red-400" : ""}`}
                              >
                                {node.data.label}
                              </div>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 空画布提示 */}
            {canvasNodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="px-6 py-3 rounded-full bg-slate-500/10 text-slate-500 text-sm font-bold border border-slate-500/20 backdrop-blur-md">
                  系统解析后将在此区域为您铺设灵感节点树
                </div>
              </div>
            )}

            {/* Canvas Controls - 画布缩放控制台 */}
            <div className="absolute top-6 right-6 flex items-center gap-2 z-20">
              <div
                className={`px-4 py-2 rounded-full border text-xs font-bold backdrop-blur-md cursor-default select-none ${isDark ? "bg-[#27272A]/80 border-[#3F3F46] text-slate-300" : "bg-white/80 border-slate-200 text-slate-600"}`}
              >
                缩放: {Math.round(canvasTransform.scale * 100)}%
              </div>
              <button
                onClick={() => {
                  playSound("click");
                  setCanvasTransform({ x: 0, y: 0, scale: 1 });
                }}
                className={`p-2 rounded-full border backdrop-blur-md transition-colors ${isDark ? "bg-[#27272A]/80 border-[#3F3F46] hover:bg-[#3F3F46] text-slate-300" : "bg-white/80 border-slate-200 hover:bg-slate-100 text-slate-600"}`}
                title="重置视图比例 (100%)"
              >
                <Maximize size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const Maximize = ({ size = 24, className = "" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
  </svg>
);
