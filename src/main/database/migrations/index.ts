/**
 * 数据库迁移模块
 * 支持跨版本升级
 */

import Database from 'better-sqlite3';

interface Migration {
  version: number;
  description: string;
  up: string;
}

/**
 * 迁移脚本列表
 * 按版本号顺序执行
 */
const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: '初始表结构',
    up: `
      -- 任务表（自增ID）
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        priority INTEGER NOT NULL DEFAULT 0,

        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        started_at INTEGER,
        completed_at INTEGER,

        execution_time INTEGER DEFAULT 0,

        output_dir TEXT NOT NULL,
        params TEXT NOT NULL DEFAULT '{}',

        progress INTEGER NOT NULL DEFAULT 0,
        current_step TEXT,

        retry_count INTEGER NOT NULL DEFAULT 0,
        max_retry INTEGER NOT NULL DEFAULT 3,

        error_code TEXT,
        error_message TEXT,
        error_stack TEXT,

        pid INTEGER,
        pid_started_at INTEGER,

        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
        CHECK (progress >= 0 AND progress <= 100)
      );

      -- 任务文件表
      CREATE TABLE IF NOT EXISTS task_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        path TEXT NOT NULL,
        category TEXT NOT NULL,
        category_label TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,

        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );

      -- 任务输出表
      CREATE TABLE IF NOT EXISTS task_outputs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        path TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'other',
        size INTEGER,
        created_at INTEGER NOT NULL,

        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );

      -- 任务日志表
      CREATE TABLE IF NOT EXISTS task_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        level TEXT NOT NULL DEFAULT 'info',
        message TEXT NOT NULL,
        raw TEXT,

        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,

        CHECK (level IN ('info', 'warning', 'error', 'success', 'debug'))
      );

      -- 任务中心会话表
      CREATE TABLE IF NOT EXISTS task_center_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at INTEGER NOT NULL,
        stopped_at INTEGER,
        total_execution_time INTEGER DEFAULT 0
      );

      -- 全局配置表
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      -- 创建索引
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
      CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
      CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
      CREATE INDEX IF NOT EXISTS idx_task_files_task_id ON task_files(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_outputs_task_id ON task_outputs(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_logs_timestamp ON task_logs(timestamp);
    `,
  },
  {
    version: 2,
    description: '添加 AI 视频生产相关表',
    up: `
      -- AI 脚本表
      CREATE TABLE IF NOT EXISTS ai_scripts (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        style TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        selected INTEGER NOT NULL DEFAULT 0
      );

      -- AI 角色表
      CREATE TABLE IF NOT EXISTS ai_characters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        image_url TEXT,
        created_at INTEGER NOT NULL
      );

      -- AI 分镜表
      CREATE TABLE IF NOT EXISTS ai_storyboard_scenes (
        id TEXT PRIMARY KEY,
        scene_number INTEGER NOT NULL,
        description TEXT NOT NULL,
        image_url TEXT,
        duration INTEGER,
        created_at INTEGER NOT NULL
      );

      -- AI 视频输出表
      CREATE TABLE IF NOT EXISTS ai_videos (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        progress INTEGER NOT NULL DEFAULT 0,
        task_id TEXT,
        created_at INTEGER NOT NULL,

        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
        CHECK (progress >= 0 AND progress <= 100)
      );

      -- 知识库文档表
      CREATE TABLE IF NOT EXISTS knowledge_documents (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        metadata TEXT,
        created_at INTEGER NOT NULL
      );

      -- 创建索引
      CREATE INDEX IF NOT EXISTS idx_ai_scripts_created_at ON ai_scripts(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_characters_created_at ON ai_characters(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_storyboard_scenes_scene_number ON ai_storyboard_scenes(scene_number);
      CREATE INDEX IF NOT EXISTS idx_ai_videos_status ON ai_videos(status);
      CREATE INDEX IF NOT EXISTS idx_knowledge_documents_created_at ON knowledge_documents(created_at DESC);
    `,
  },
  {
    version: 3,
    description: 'A 面视频生产功能表',
    up: `
      -- 1. 项目表
      CREATE TABLE IF NOT EXISTS aside_projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        game_type TEXT NOT NULL,
        selling_point TEXT,  -- 新增:项目卖点(可选,最多200字符)
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      -- 2. 创意方向表（项目级别）
      CREATE TABLE IF NOT EXISTS aside_creative_directions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        icon_name TEXT,
        is_preset INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES aside_projects(id) ON DELETE CASCADE
      );

      -- 3. 人设表（项目级别）
      CREATE TABLE IF NOT EXISTS aside_personas (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        is_preset INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES aside_projects(id) ON DELETE CASCADE
      );

      -- 4. 剧本表
      CREATE TABLE IF NOT EXISTS aside_screenplays (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        content TEXT NOT NULL,
        creative_direction_id TEXT,
        persona_id TEXT,
        region TEXT DEFAULT 'universal',  -- 移到剧本表
        ai_model TEXT,
        status TEXT DEFAULT 'draft',
        created_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES aside_projects(id) ON DELETE CASCADE,
        FOREIGN KEY (creative_direction_id) REFERENCES aside_creative_directions(id),
        FOREIGN KEY (persona_id) REFERENCES aside_personas(id),

        CHECK (status IN ('draft', 'library', 'producing', 'completed'))
      );

      -- 创建索引
      CREATE INDEX IF NOT EXISTS idx_aside_creative_directions_project ON aside_creative_directions(project_id);
      CREATE INDEX IF NOT EXISTS idx_aside_personas_project ON aside_personas(project_id);
      CREATE INDEX IF NOT EXISTS idx_aside_screenplays_project ON aside_screenplays(project_id);
      CREATE INDEX IF NOT EXISTS idx_aside_screenplays_status ON aside_screenplays(status);
    `,
  },
  {
    version: 4,
    description: '修复表名：aside_scripts → aside_screenplays（开发阶段修复）',
    up: `
      -- 空迁移: v3 已经使用了正确的表名 aside_screenplays
      -- 此迁移保留用于版本控制，但不需要执行任何操作
      SELECT 1;
    `,
    down: `
      -- 空迁移回滚
      SELECT 1;
    `,
  },
  {
    version: 5,
    description: '全局地区管理表',
    up: `
      -- 地区表（全局，所有项目共用）
      CREATE TABLE IF NOT EXISTS regions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id TEXT REFERENCES regions(id) ON DELETE SET NULL,
        level INTEGER NOT NULL DEFAULT 1,
        cultural_profile TEXT DEFAULT '',
        emoji TEXT DEFAULT '',
        icon_type TEXT DEFAULT NULL,
        icon_value TEXT DEFAULT NULL,
        is_preset INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_regions_parent_id ON regions(parent_id);
      CREATE INDEX IF NOT EXISTS idx_regions_level ON regions(level);
      CREATE INDEX IF NOT EXISTS idx_regions_is_active ON regions(is_active);

      -- 预置：中国（一级）
      INSERT INTO regions (id, name, parent_id, level, emoji, cultural_profile, is_preset, sort_order) VALUES
      ('region_china', '中国', NULL, 1, '🇨🇳', '', 1, 1);

      -- 预置：东北
      INSERT INTO regions (id, name, parent_id, level, emoji, cultural_profile, is_preset, sort_order) VALUES
      ('region_dongbei', '东北', 'region_china', 2, '🧊',
      '## 语言风格
- 语气词密集，感叹号频繁，直接表达情绪
- 常用口语化表达，语速偏快，节奏明快
- 喜用夸张比喻，幽默诙谐风格突出

## 受众特征
- 性格豪爽直接，重情重义
- 集体意识强，喜欢分享和热闹氛围
- 对真实、接地气的内容接受度高

## 文化共鸣点
- 冬季文化（冰雪、温泉、烧烤）
- 硬汉形象与侠义精神
- 邻里情义与集体娱乐氛围

## 禁忌
- 避免嘲讽东北口音或文化刻板印象
- 不宜过于精致或高冷的表达风格',
      1, 1);

      -- 预置：华北
      INSERT INTO regions (id, name, parent_id, level, emoji, cultural_profile, is_preset, sort_order) VALUES
      ('region_huabei', '华北', 'region_china', 2, '🏛️',
      '## 语言风格
- 北方普通话为主，表达清晰有力
- 叙事直接，逻辑性强，不绕弯子
- 喜用排比句和对仗表达，节奏感强

## 受众特征
- 务实理性，注重实际利益
- 历史文化认同感强，爱国情怀浓厚
- 对权威和专业背书有较高认可度

## 文化共鸣点
- 历史文化（故宫、长城、胡同）
- 四合院邻里文化
- 传统节日与民俗活动

## 禁忌
- 避免过于轻浮或娱乐化的表达
- 不宜调侃政治或历史敏感话题',
      1, 2);

      -- 预置：华东
      INSERT INTO regions (id, name, parent_id, level, emoji, cultural_profile, is_preset, sort_order) VALUES
      ('region_huadong', '华东', 'region_china', 2, '🌊',
      '## 语言风格
- 吴语区影响，表达委婉精致，语调柔和
- 善用修辞，措辞考究，逻辑性强
- 喜欢数据和案例支撑，理性化表达

## 受众特征
- 经济意识强，注重性价比和品质
- 教育水平高，接受新事物快
- 喜欢有文化底蕴的内容

## 文化共鸣点
- 江南水乡文化（苏绣、评弹、园林）
- 商业精明与创业精神
- 现代都市生活与传统文化融合

## 禁忌
- 避免粗俗或过于直白的表达
- 不宜忽视细节和品质感',
      1, 3);

      -- 预置：华中
      INSERT INTO regions (id, name, parent_id, level, emoji, cultural_profile, is_preset, sort_order) VALUES
      ('region_huazhong', '华中', 'region_china', 2, '🌾',
      '## 语言风格
- 中部方言影响，表达朴实接地气
- 善用俗语和谚语，生活化气息浓
- 语调平稳，叙事节奏适中

## 受众特征
- 务实勤劳，吃苦耐劳精神突出
- 家庭观念强，重视子女教育
- 对传统价值观有较高认同

## 文化共鸣点
- 农耕文化与丰收主题
- 楚文化（屈原、荆楚风情）
- 美食文化（热干面、臭鳜鱼）

## 禁忌
- 避免过于精英化或脱离生活的表达
- 不宜忽视基层民众的实际需求',
      1, 4);

      -- 预置：华南
      INSERT INTO regions (id, name, parent_id, level, emoji, cultural_profile, is_preset, sort_order) VALUES
      ('region_huanan', '华南', 'region_china', 2, '🌴',
      '## 语言风格
- 粤语文化影响，用词活泼，创造性强
- 中英混搭自然，接受外来词汇
- 语速快，节奏活跃，幽默感强

## 受众特征
- 开放务实，商业嗅觉敏锐
- 娱乐消费意愿强，追求新奇体验
- 对潮流和创新接受度高

## 文化共鸣点
- 粤港澳大湾区都市生活
- 饮茶文化与粤式生活方式
- 改革开放精神与创业故事

## 禁忌
- 避免忽视粤语文化的独特性
- 不宜过于保守或传统的表达方式',
      1, 5);

      -- 预置：西南
      INSERT INTO regions (id, name, parent_id, level, emoji, cultural_profile, is_preset, sort_order) VALUES
      ('region_xinan', '西南', 'region_china', 2, '🌶️',
      '## 语言风格
- 川渝方言影响，语调起伏大，生动活泼
- 幽默感强，善用戏谑和自嘲
- 接地气，口语化程度高，亲切自然

## 受众特征
- 乐观豁达，享乐主义倾向
- 社交活跃，夜生活丰富
- 对美食和娱乐内容高度关注

## 文化共鸣点
- 火锅文化与麻辣美食
- 慢生活与茶馆文化
- 民族多样性（苗族、彝族、藏族文化）

## 禁忌
- 避免过于严肃或说教的口吻
- 不宜忽视少数民族文化的敏感性',
      1, 6);

      -- 预置：西北
      INSERT INTO regions (id, name, parent_id, level, emoji, cultural_profile, is_preset, sort_order) VALUES
      ('region_xibei', '西北', 'region_china', 2, '🏜️',
      '## 语言风格
- 秦腔、陕北文化影响，豪放粗犷
- 表达直接有力，情感外露
- 喜用大开大合的叙述方式

## 受众特征
- 性格豪迈，重情重义
- 历史文化认同感强
- 对乡土情怀和故乡主题有强烈共鸣

## 文化共鸣点
- 丝绸之路文化与历史遗迹
- 黄土高原与黄河文明
- 牛羊肉、拉面等特色饮食

## 禁忌
- 避免对少数民族习俗的不当描述
- 不宜轻视或边缘化西北文化',
      1, 7);

      -- 预置：港澳台
      INSERT INTO regions (id, name, parent_id, level, emoji, cultural_profile, is_preset, sort_order) VALUES
      ('region_gangaotai', '港澳台', 'region_china', 2, '🌐',
      '## 语言风格
- 繁体中文为主，用词偏正式或港台腔
- 粤语/闽南语影响明显
- 东西方文化融合，时尚感强

## 受众特征
- 国际化视野，品味较高
- 对娱乐内容消费力强
- 重视个人权益和隐私

## 文化共鸣点
- 港式流行文化（港剧、粤语歌）
- 夜市文化与台湾小吃
- 中西融合的都市生活

## 禁忌
- 注意政治敏感话题
- 避免简体字文化强行渗透，尊重用语习惯',
      1, 8);

      -- 预置：北京
      INSERT INTO regions (id, name, parent_id, level, emoji, cultural_profile, is_preset, sort_order) VALUES
      ('region_beijing', '北京', 'region_china', 2, '🏯',
      '## 语言风格
- 北京话儿化音，亲切接地气
- 叙事自带幽默，擅用反讽和调侃
- 语速适中，表达大气不拘谨

## 受众特征
- 政治文化敏感度高，见多识广
- 高学历群体集中，理性消费
- 对文化艺术类内容接受度高

## 文化共鸣点
- 胡同文化与四合院邻里
- 皇城根下的历史积淀
- 京味美食（烤鸭、豆汁、卤煮）

## 禁忌
- 避免触碰政治敏感领域
- 不宜夸张搞笑而失去分寸感',
      1, 9);

      -- 预置：上海
      INSERT INTO regions (id, name, parent_id, level, emoji, cultural_profile, is_preset, sort_order) VALUES
      ('region_shanghai', '上海', 'region_china', 2, '🌆',
      '## 语言风格
- 沪语影响，表达精致考究
- 中英混搭自然流畅，国际范
- 讲究逻辑和数据支撑，言简意赅

## 受众特征
- 品质敏感，消费力强
- 时尚意识领先，对新事物接受快
- 独立意识强，重视个人品味

## 文化共鸣点
- 老上海情怀与摩登都市
- 咖啡馆文化与夜生活
- 国际大都市的多元融合

## 禁忌
- 避免土气或过于接地气的低俗表达
- 不宜忽视上海的独特城市文化认同',
      1, 10);

      -- 预置：广东
      INSERT INTO regions (id, name, parent_id, level, emoji, cultural_profile, is_preset, sort_order) VALUES
      ('region_guangdong', '广东', 'region_china', 2, '🦐',
      '## 语言风格
- 粤语俚语丰富，幽默机智
- 中英混搭，港式表达影响明显
- 务实直接，少废话多干货

## 受众特征
- 商业意识强，务实重效率
- 饮食文化高度重视
- 娱乐消费活跃，对综艺和游戏内容兴趣浓

## 文化共鸣点
- 粤菜文化（饮茶、海鲜）
- 改革开放前沿地带的创业精神
- 潮汕文化与广府文化各具特色

## 禁忌
- 不同地区（广府/潮汕/客家）文化差异大，避免混淆
- 不宜忽视广东的语言多样性',
      1, 11);

      -- 预置：四川/重庆
      INSERT INTO regions (id, name, parent_id, level, emoji, cultural_profile, is_preset, sort_order) VALUES
      ('region_sichuan', '四川/重庆', 'region_china', 2, '🌶️',
      '## 语言风格
- 川渝话语调抑扬顿挫，个性鲜明
- 语言幽默，善用比喻和夸张
- 语速较快，情感表达直接热烈

## 受众特征
- 热爱美食和社交，生活享乐主义
- 幽默感强，能接受自嘲和调侃
- 重情义，朋友圈影响力大

## 文化共鸣点
- 火锅文化是最强共鸣点
- 打麻将作为社交活动的重要性
- 慢生活与盖碗茶文化

## 禁忌
- 避免不了解川渝方言而强行模仿造成误用
- 不宜过于严肃，失去本地轻松氛围',
      1, 12);

      -- 预置：湖南
      INSERT INTO regions (id, name, parent_id, level, emoji, cultural_profile, is_preset, sort_order) VALUES
      ('region_hunan', '湖南', 'region_china', 2, '🌹',
      '## 语言风格
- 湖南话有鲜明地方特色，普通话带口音
- 表达有力，情感浓烈，霸气十足
- 直来直去，不喜欢拐弯抹角

## 受众特征
- 性格倔强坚韧，有闯劲
- 娱乐文化认同度高（湖南卫视影响）
- 对辣文化和地方自豪感很强

## 文化共鸣点
- 湘菜文化（剁椒鱼头、臭豆腐）
- 娱乐产业发达，综艺文化认同
- 历史人物崇拜（毛泽东故里）

## 禁忌
- 避免轻视湖南人的进取心和韧性
- 不宜过于温吞或软绵绵的表达',
      1, 13);

      -- 预置：湖北
      INSERT INTO regions (id, name, parent_id, level, emoji, cultural_profile, is_preset, sort_order) VALUES
      ('region_hubei', '湖北', 'region_china', 2, '🌸',
      '## 语言风格
- 楚语余韵，表达温和但内有坚持
- 叙事有条理，善于讲理
- 武汉话有独特魅力，接地气

## 受众特征
- 高校聚集，年轻知识分子比例高
- 重视理性辩论，不轻易接受说教
- 对历史文化有较强认同

## 文化共鸣点
- 热干面文化与武汉早点文化
- 黄鹤楼与楚文化历史
- 武汉夜市与江边生活

## 禁忌
- 避免触碰新冠疫情相关的负面描述
- 不宜忽视武汉作为文化中心的自豪感',
      1, 14);

      -- 预置：浙江
      INSERT INTO regions (id, name, parent_id, level, emoji, cultural_profile, is_preset, sort_order) VALUES
      ('region_zhejiang', '浙江', 'region_china', 2, '💼',
      '## 语言风格
- 吴语区，表达精明务实
- 商业用语娴熟，善于谈判和说服
- 措辞谨慎，重视契约精神

## 受众特征
- 商业意识极强，浙商精神闻名
- 互联网经济氛围浓（阿里巴巴影响）
- 对创业和商业成功故事高度共鸣

## 文化共鸣点
- 电商文化与创业精神（杭州互联网）
- 西湖文化与江南水乡
- 义乌小商品与全球贸易

## 禁忌
- 避免低估浙江人的商业头脑
- 不宜轻视浙江各地的文化差异（温州/宁波/杭州各不同）',
      1, 15);

      -- 预置：江苏
      INSERT INTO regions (id, name, parent_id, level, emoji, cultural_profile, is_preset, sort_order) VALUES
      ('region_jiangsu', '江苏', 'region_china', 2, '🎋',
      '## 语言风格
- 苏语温婉细腻，注重礼貌
- 措辞讲究，有书卷气
- 南北差异大（苏北/苏南），需注意区分

## 受众特征
- 教育重视程度全国名列前茅
- 内卷文化下的竞争意识强
- 对高品质生活和文化内容有追求

## 文化共鸣点
- 苏州园林与江南文化
- 高考文化与教育竞争话题
- 美食文化（阳澄湖大闸蟹、盐水鸭）

## 禁忌
- 避免混淆苏南苏北的文化差异
- 不宜调侃江苏人"卷"的刻板印象',
      1, 16);

      -- 预置：山东
      INSERT INTO regions (id, name, parent_id, level, emoji, cultural_profile, is_preset, sort_order) VALUES
      ('region_shandong', '山东', 'region_china', 2, '🦁',
      '## 语言风格
- 齐鲁话豪迈大气，语调高亢
- 表达直接爽快，不磨叽
- 喜用大词和豪情表达，气势足

## 受众特征
- 忠厚老实，重情重义
- 家庭和孝道观念极强
- 对家乡食物和文化有强烈自豪感

## 文化共鸣点
- 儒家文化发源地（曲阜孔庙）
- 大葱煎饼与山东硬汉形象
- 海洋文化（青岛啤酒、海鲜）

## 禁忌
- 避免嘲讽山东人的"实在"性格
- 不宜轻视礼仪和尊老爱幼的传统价值',
      1, 17);

      -- 预置：河南
      INSERT INTO regions (id, name, parent_id, level, emoji, cultural_profile, is_preset, sort_order) VALUES
      ('region_henan', '河南', 'region_china', 2, '🐉',
      '## 语言风格
- 中原官话，发音清晰，易于理解
- 表达实在，善用俗语和谚语
- 叙事有力，情感真挚

## 受众特征
- 吃苦耐劳，外出务工群体庞大
- 家乡认同感和归属感强烈
- 对正能量和励志内容接受度高

## 文化共鸣点
- 中原文化与华夏文明发源
- 少林功夫与武术文化
- 胡辣汤与烩面等特色美食

## 禁忌
- 避免强化河南人负面刻板印象
- 不宜轻视中原文化的历史地位',
      1, 18);

      -- 预置：陕西
      INSERT INTO regions (id, name, parent_id, level, emoji, cultural_profile, is_preset, sort_order) VALUES
      ('region_shaanxi', '陕西', 'region_china', 2, '🏺',
      '## 语言风格
- 陕西话有浑厚感，秦腔余韵
- 表达豪放直接，喜用加重语气
- 古语词汇使用率高，有历史感

## 受众特征
- 历史文化自豪感极强
- 性格直爽，容易建立信任
- 对家乡美食（肉夹馍、羊肉泡馍）极度认同

## 文化共鸣点
- 秦汉唐历史文化（兵马俑、大雁塔）
- 西安古城与夜游文化
- 美食文化：肉夹馍、凉皮、臊子面

## 禁忌
- 避免混淆山西和陕西（常见误区）
- 不宜轻视陕西的文化底蕴和历史价值',
      1, 19);

      -- 预置：云南
      INSERT INTO regions (id, name, parent_id, level, emoji, cultural_profile, is_preset, sort_order) VALUES
      ('region_yunnan', '云南', 'region_china', 2, '🌺',
      '## 语言风格
- 云南话温和，语调平稳悠扬
- 自然意象丰富，诗意气息浓
- 表达包容，受多民族文化影响

## 受众特征
- 多民族融合，文化多元包容
- 旅游消费意识强，生活品质追求
- 对自然、民族文化内容有共鸣

## 文化共鸣点
- 多民族文化（傣族、纳西族、白族）
- 丽江/大理旅游文化与慢生活
- 云南美食（过桥米线、汽锅鸡）

## 禁忌
- 避免混淆各少数民族文化
- 不宜简化或片面化云南的多元文化',
      1, 20);

      -- 预置：新疆
      INSERT INTO regions (id, name, parent_id, level, emoji, cultural_profile, is_preset, sort_order) VALUES
      ('region_xinjiang', '新疆', 'region_china', 2, '🍇',
      '## 语言风格
- 受维吾尔语影响，节奏感强
- 表达热情好客，情感真挚
- 音乐性强，喜欢韵律化表达

## 受众特征
- 多民族共存，包容性强
- 对自然风光和民俗活动高度认同
- 宗教文化影响不可忽视

## 文化共鸣点
- 草原、沙漠、天山等自然景观
- 瓜果文化（哈密瓜、葡萄、核桃）
- 维吾尔族歌舞与民俗文化

## 禁忌
- 严格避免宗教和民族政治敏感内容
- 不宜对少数民族文化进行刻板描绘',
      1, 21);

      -- 预置：西藏
      INSERT INTO regions (id, name, parent_id, level, emoji, cultural_profile, is_preset, sort_order) VALUES
      ('region_xizang', '西藏', 'region_china', 2, '🏔️',
      '## 语言风格
- 藏语影响，表达庄重平和
- 多使用自然和精神隐喻
- 语速较慢，充满哲思

## 受众特征
- 宗教信仰对生活影响深远
- 对自然环境和生态高度敬畏
- 传统文化认同感极强

## 文化共鸣点
- 藏传佛教文化与寺庙朝圣
- 布达拉宫与拉萨城市文化
- 雪域高原的壮美自然景观

## 禁忌
- 严格避免宗教政治敏感内容
- 不宜将西藏单纯娱乐化或商业化',
      1, 22);

      -- 预置：内蒙古
      INSERT INTO regions (id, name, parent_id, level, emoji, cultural_profile, is_preset, sort_order) VALUES
      ('region_neimenggu', '内蒙古', 'region_china', 2, '🐎',
      '## 语言风格
- 蒙古语影响，普通话表达豪放
- 善用草原和自然意象
- 表达豪迈，好客热情，情感直接

## 受众特征
- 游牧文化认同感强
- 对自然和动物有深厚情感
- 喜欢宽广、壮阔的表达风格

## 文化共鸣点
- 草原文化（骑马、套马、摔跤）
- 蒙古包与那达慕节日
- 手把肉与奶茶等饮食文化

## 禁忌
- 避免混淆蒙古族与蒙古国的关系
- 不宜忽视游牧文化的尊严与独特性',
      1, 23);

      -- 预置：福建
      INSERT INTO regions (id, name, parent_id, level, emoji, cultural_profile, is_preset, sort_order) VALUES
      ('region_fujian', '福建', 'region_china', 2, '🌊',
      '## 语言风格
- 闽南语影响，表达亲切有韵味
- 海洋文化带来开放进取的语言风格
- 善用祈福和吉祥语，重视口彩

## 受众特征
- 海外华人联系紧密，有国际视野
- 商业精明，闽商文化底蕴深
- 对宗族和家乡情结极为重视

## 文化共鸣点
- 闽南文化与妈祖信仰
- 福建土楼与客家文化
- 海鲜与闽菜饮食文化

## 禁忌
- 避免混淆闽南语和粤语
- 不宜忽视台湾与福建的历史文化渊源',
      1, 24);

      -- 预置：广西
      INSERT INTO regions (id, name, parent_id, level, emoji, cultural_profile, is_preset, sort_order) VALUES
      ('region_guangxi', '广西', 'region_china', 2, '🎶',
      '## 语言风格
- 粤语和少数民族语言影响，表达多元
- 山歌文化使语言富有韵律感
- 热情好客，表达方式真诚直接

## 受众特征
- 多民族融合，文化包容性强
- 对山水自然景观有强烈认同
- 喜欢节庆和集体活动

## 文化共鸣点
- 壮族文化与三月三节日
- 桂林山水与漓江旅游
- 螺蛳粉与广西特色美食

## 禁忌
- 避免混淆壮族与其他少数民族文化
- 不宜轻视广西在南方文化中的重要地位',
      1, 25);

      -- 预置：东南亚
      INSERT INTO regions (id, name, parent_id, level, emoji, cultural_profile, is_preset, sort_order) VALUES
      ('region_southeast_asia', '东南亚', NULL, 1, '🌏',
      '## 语言风格
- 多语言并存，英语或当地语言为主
- 表达热情友好，重视人际关系
- 宗教文化对日常用语影响明显

## 受众特征
- 年轻人口众多，移动互联网活跃
- 华人社区影响力不可忽视
- 对娱乐和游戏内容消费热情高

## 文化共鸣点
- 华人文化认同（农历新年、中华美食）
- 热带气候与海洋文化
- 各国独特的宗教节日与民俗

## 禁忌
- 严格避免宗教敏感内容（伊斯兰、佛教、基督教并存）
- 不宜以单一文化视角看待东南亚的多元性',
      1, 26);
    `,
  },
];

/**
 * 运行数据库迁移
 */
export function runMigrations(db: Database.Database): void {
  console.log('[数据库迁移] 开始执行迁移...');

  // 创建版本表
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL,
      description TEXT
    )
  `);

  // 获取当前版本
  const row = db.prepare('SELECT MAX(version) as version FROM schema_version').get() as {
    version: number | null;
  };
  const currentVersion = row?.version ?? 0;

  console.log(`[数据库迁移] 当前版本: v${currentVersion}`);

  // 获取待执行的迁移
  const pendingMigrations = MIGRATIONS.filter((m) => m.version > currentVersion).sort(
    (a, b) => a.version - b.version
  );

  if (pendingMigrations.length === 0) {
    console.log(`[数据库迁移] 已是最新版本，无需迁移`);
    return;
  }

  console.log(`[数据库迁移] 发现 ${pendingMigrations.length} 个待执行迁移`);

  // 执行迁移
  for (const migration of pendingMigrations) {
    console.log(`[数据库迁移] 开始执行 v${migration.version}: ${migration.description}`);

    try {
      // 使用事务确保：迁移 SQL 和版本记录要么都成功，要么都失败
      const transaction = db.transaction(() => {
        db.exec(migration.up);
        db.prepare(`
          INSERT INTO schema_version (version, applied_at, description)
          VALUES (?, ?, ?)
        `).run(migration.version, Date.now(), migration.description);
      });

      // 执行事务
      transaction();

      console.log(`[数据库迁移] ✅ v${migration.version} ${migration.description} - 成功`);
    } catch (err) {
      // 迁移失败，立即终止
      console.error(`[数据库迁移] ❌ v${migration.version} 失败:`, err);
      console.error(`[数据库迁移] 迁移已终止，数据库版本保持在 v${currentVersion}`);
      throw new Error(`数据库迁移 v${migration.version} 失败: ${(err as Error).message}`);
    }
  }

  const finalVersion = pendingMigrations[pendingMigrations.length - 1].version;
  console.log(`[数据库迁移] ✅ 所有迁移完成，当前版本 v${finalVersion}`);
}

/**
 * 获取当前数据库版本
 */
export function getCurrentVersion(db: Database.Database): number {
  const row = db.prepare('SELECT MAX(version) as version FROM schema_version').get() as {
    version: number | null;
  };
  return row?.version ?? 0;
}
