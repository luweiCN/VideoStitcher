/**
 * 地区预置数据
 * 层级结构：L1 中国 → L2 八大地理区 → L3 34个省级行政区
 *
 * 此文件是唯一数据源，供：
 * - 数据库初始化种子（ensurePresetsSeeded）
 * - 重置预置数据（resetPresets）
 */

export interface RegionPreset {
  id: string;
  name: string;
  parentId: string | null;
  level: number;
  emoji: string;
  culturalProfile: string;
  sortOrder: number;
}

// ────────────────────────────────────────────────
// L1：国家
// ────────────────────────────────────────────────

const L1_CHINA: RegionPreset = {
  id: 'region_china',
  name: '中国',
  parentId: null,
  level: 1,
  emoji: '🇨🇳',
  culturalProfile: '',
  sortOrder: 1,
};

// ────────────────────────────────────────────────
// L2：八大地理区
// ────────────────────────────────────────────────

const L2_HUABEI: RegionPreset = {
  id: 'region_huabei',
  name: '华北',
  parentId: 'region_china',
  level: 2,
  emoji: '🏛️',
  culturalProfile: `## 语言风格
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
- 不宜调侃政治或历史敏感话题`,
  sortOrder: 1,
};

const L2_DONGBEI: RegionPreset = {
  id: 'region_dongbei',
  name: '东北',
  parentId: 'region_china',
  level: 2,
  emoji: '🧊',
  culturalProfile: `## 语言风格
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
- 不宜过于精致或高冷的表达风格`,
  sortOrder: 2,
};

const L2_HUADONG: RegionPreset = {
  id: 'region_huadong',
  name: '华东',
  parentId: 'region_china',
  level: 2,
  emoji: '🌊',
  culturalProfile: `## 语言风格
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
- 不宜忽视细节和品质感`,
  sortOrder: 3,
};

const L2_HUAZHONG: RegionPreset = {
  id: 'region_huazhong',
  name: '华中',
  parentId: 'region_china',
  level: 2,
  emoji: '🌾',
  culturalProfile: `## 语言风格
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
- 不宜忽视基层民众的实际需求`,
  sortOrder: 4,
};

const L2_HUANAN: RegionPreset = {
  id: 'region_huanan',
  name: '华南',
  parentId: 'region_china',
  level: 2,
  emoji: '🌴',
  culturalProfile: `## 语言风格
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
- 不宜过于保守或传统的表达方式`,
  sortOrder: 5,
};

const L2_XINAN: RegionPreset = {
  id: 'region_xinan',
  name: '西南',
  parentId: 'region_china',
  level: 2,
  emoji: '🌶️',
  culturalProfile: `## 语言风格
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
- 不宜忽视少数民族文化的敏感性`,
  sortOrder: 6,
};

const L2_XIBEI: RegionPreset = {
  id: 'region_xibei',
  name: '西北',
  parentId: 'region_china',
  level: 2,
  emoji: '🏜️',
  culturalProfile: `## 语言风格
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
- 不宜轻视或边缘化西北文化`,
  sortOrder: 7,
};

const L2_GANGAOTAI: RegionPreset = {
  id: 'region_gangaotai',
  name: '港澳台',
  parentId: 'region_china',
  level: 2,
  emoji: '🌐',
  culturalProfile: `## 语言风格
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
- 避免简体字文化强行渗透，尊重用语习惯`,
  sortOrder: 8,
};

// ────────────────────────────────────────────────
// L3：华北（5个）
// ────────────────────────────────────────────────

const L3_BEIJING: RegionPreset = {
  id: 'region_beijing',
  name: '北京',
  parentId: 'region_huabei',
  level: 3,
  emoji: '🏯',
  culturalProfile: `## 语言风格
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
- 不宜夸张搞笑而失去分寸感`,
  sortOrder: 1,
};

const L3_TIANJIN: RegionPreset = {
  id: 'region_tianjin',
  name: '天津',
  parentId: 'region_huabei',
  level: 3,
  emoji: '🎭',
  culturalProfile: `## 语言风格
- 天津话幽默风趣，相声文化底蕴深
- 语调轻快，善用双关和俏皮话
- 表达接地气，市井气息浓

## 受众特征
- 乐天派，幽默感强，喜欢自嘲
- 传统曲艺文化认同度高
- 对市井生活和烟火气内容有共鸣

## 文化共鸣点
- 相声、快板等曲艺文化
- 天津卫的码头文化与商贾历史
- 狗不理包子、麻花等特色美食

## 禁忌
- 避免刻意模仿天津话而用词不当
- 不宜忽视天津与北京的文化差异`,
  sortOrder: 2,
};

const L3_HEBEI: RegionPreset = {
  id: 'region_hebei',
  name: '河北',
  parentId: 'region_huabei',
  level: 3,
  emoji: '🌾',
  culturalProfile: `## 语言风格
- 冀方言质朴，表达朴实无华
- 语调平稳，叙事踏实有力
- 乡土气息浓，善用农耕意象

## 受众特征
- 勤劳务实，吃苦耐劳
- 家乡认同感强，外出务工群体多
- 对正能量和奋斗题材有共鸣

## 文化共鸣点
- 燕赵文化与慷慨悲歌精神
- 承德避暑山庄与坝上草原
- 驴肉火烧、棋子烧饼等特色美食

## 禁忌
- 避免轻视河北作为首都周边的重要性
- 不宜强化"北漂"负面叙事`,
  sortOrder: 3,
};

const L3_SHANXI: RegionPreset = {
  id: 'region_shanxi',
  name: '山西',
  parentId: 'region_huabei',
  level: 3,
  emoji: '⛰️',
  culturalProfile: `## 语言风格
- 晋方言有独特韵味，古语词汇保留多
- 表达内敛稳重，不轻易显露情感
- 叙事有历史厚重感

## 受众特征
- 晋商文化影响，商业智慧积淀深厚
- 历史文化自豪感强
- 务实节俭，重视积累

## 文化共鸣点
- 晋商文化与票号历史
- 平遥古城与乔家大院
- 刀削面、老陈醋等饮食文化

## 禁忌
- 避免混淆山西（晋）与陕西（秦）
- 不宜忽视煤矿文化对社会结构的影响`,
  sortOrder: 4,
};

const L3_NEIMENGGU: RegionPreset = {
  id: 'region_neimenggu',
  name: '内蒙古',
  parentId: 'region_huabei',
  level: 3,
  emoji: '🐎',
  culturalProfile: `## 语言风格
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
- 不宜忽视游牧文化的尊严与独特性`,
  sortOrder: 5,
};

// ────────────────────────────────────────────────
// L3：东北（3个）
// ────────────────────────────────────────────────

const L3_LIAONING: RegionPreset = {
  id: 'region_liaoning',
  name: '辽宁',
  parentId: 'region_dongbei',
  level: 3,
  emoji: '🏭',
  culturalProfile: `## 语言风格
- 东北话代表地区，语气直爽豪迈
- 幽默风趣，赵本山小品文化影响深远
- 表达随性，情感外露

## 受众特征
- 重工业文化影响，讲义气重情谊
- 对喜剧和娱乐内容接受度极高
- 家乡自豪感强，东北认同突出

## 文化共鸣点
- 东北小品与二人转文化
- 大连、沈阳的都市与工业文化
- 猪肉炖粉条、锅包肉等东北美食

## 禁忌
- 避免过度消费东北穷困的刻板印象
- 不宜轻视东北工业文明的历史地位`,
  sortOrder: 1,
};

const L3_JILIN: RegionPreset = {
  id: 'region_jilin',
  name: '吉林',
  parentId: 'region_dongbei',
  level: 3,
  emoji: '🌨️',
  culturalProfile: `## 语言风格
- 东北方言，语气词丰富，表达生动
- 叙事节奏快，幽默元素多
- 真诚直接，少弯弯绕绕

## 受众特征
- 滑雪、冰雪运动爱好者聚集
- 朝鲜族文化影响，民族特色鲜明
- 汽车工业文化（一汽）认同感强

## 文化共鸣点
- 长白山与鸭绿江自然风光
- 朝鲜族文化（延边）
- 冰雪运动与冬季旅游

## 禁忌
- 避免混淆朝鲜族与朝鲜国的文化
- 不宜忽视吉林的民族多样性`,
  sortOrder: 2,
};

const L3_HEILONGJIANG: RegionPreset = {
  id: 'region_heilongjiang',
  name: '黑龙江',
  parentId: 'region_dongbei',
  level: 3,
  emoji: '❄️',
  culturalProfile: `## 语言风格
- 东北话最北端，语言粗犷豪爽
- 表达坦率，开门见山
- 冰雪文化赋予语言独特的寒地气质

## 受众特征
- 边境文化影响，开放包容度较高
- 农垦文化认同感强，吃苦耐劳
- 对自然风光和冬季文化有强烈认同

## 文化共鸣点
- 哈尔滨冰雪节与冰灯文化
- 大兴安岭原始森林与黑土地
- 俄式建筑与中俄文化融合

## 禁忌
- 避免强化"流放之地"的负面历史联想
- 不宜忽视黑龙江的文化多样性与自然资源价值`,
  sortOrder: 3,
};

// ────────────────────────────────────────────────
// L3：华东（7个）
// ────────────────────────────────────────────────

const L3_SHANGHAI: RegionPreset = {
  id: 'region_shanghai',
  name: '上海',
  parentId: 'region_huadong',
  level: 3,
  emoji: '🌆',
  culturalProfile: `## 语言风格
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
- 不宜忽视上海的独特城市文化认同`,
  sortOrder: 1,
};

const L3_JIANGSU: RegionPreset = {
  id: 'region_jiangsu',
  name: '江苏',
  parentId: 'region_huadong',
  level: 3,
  emoji: '🎋',
  culturalProfile: `## 语言风格
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
- 不宜调侃江苏人"卷"的刻板印象`,
  sortOrder: 2,
};

const L3_ZHEJIANG: RegionPreset = {
  id: 'region_zhejiang',
  name: '浙江',
  parentId: 'region_huadong',
  level: 3,
  emoji: '💼',
  culturalProfile: `## 语言风格
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
- 不宜轻视浙江各地的文化差异（温州/宁波/杭州各不同）`,
  sortOrder: 3,
};

const L3_ANHUI: RegionPreset = {
  id: 'region_anhui',
  name: '安徽',
  parentId: 'region_huadong',
  level: 3,
  emoji: '🖌️',
  culturalProfile: `## 语言风格
- 皖语区域广，南北差异明显
- 徽州话婉转，淮北话直爽
- 文化底蕴深，喜引经据典

## 受众特征
- 外出务工比例高，拼搏奋斗精神突出
- 徽商文化影响，重视教育与人脉
- 对故乡情怀和乡愁题材有强烈共鸣

## 文化共鸣点
- 徽派建筑与徽州文化（新安江流域）
- 黄山与九华山旅游文化
- 徽菜饮食文化（臭鳜鱼、毛豆腐）

## 禁忌
- 避免忽视安徽南北方言和文化的巨大差异
- 不宜强化安徽贫困的历史刻板印象`,
  sortOrder: 4,
};

const L3_FUJIAN: RegionPreset = {
  id: 'region_fujian',
  name: '福建',
  parentId: 'region_huadong',
  level: 3,
  emoji: '🌊',
  culturalProfile: `## 语言风格
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
- 不宜忽视台湾与福建的历史文化渊源`,
  sortOrder: 5,
};

const L3_JIANGXI: RegionPreset = {
  id: 'region_jiangxi',
  name: '江西',
  parentId: 'region_huadong',
  level: 3,
  emoji: '🏮',
  culturalProfile: `## 语言风格
- 赣语区，语调独特，介于南北之间
- 表达朴实，情感真挚，不浮夸
- 民俗文化词汇丰富

## 受众特征
- 革命文化教育深入人心（井冈山）
- 外出务工比例高，有强烈奋斗精神
- 对家乡发展和变化敏感度高

## 文化共鸣点
- 红色文化与革命历史
- 景德镇陶瓷文化
- 庐山与鄱阳湖自然景观

## 禁忌
- 避免轻视江西的文化历史贡献
- 不宜忽视革命文化的崇高地位`,
  sortOrder: 6,
};

const L3_SHANDONG: RegionPreset = {
  id: 'region_shandong',
  name: '山东',
  parentId: 'region_huadong',
  level: 3,
  emoji: '🦁',
  culturalProfile: `## 语言风格
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
- 不宜轻视礼仪和尊老爱幼的传统价值`,
  sortOrder: 7,
};

// ────────────────────────────────────────────────
// L3：华中（3个）
// ────────────────────────────────────────────────

const L3_HENAN: RegionPreset = {
  id: 'region_henan',
  name: '河南',
  parentId: 'region_huazhong',
  level: 3,
  emoji: '🐉',
  culturalProfile: `## 语言风格
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
- 不宜轻视中原文化的历史地位`,
  sortOrder: 1,
};

const L3_HUBEI: RegionPreset = {
  id: 'region_hubei',
  name: '湖北',
  parentId: 'region_huazhong',
  level: 3,
  emoji: '🌸',
  culturalProfile: `## 语言风格
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
- 不宜忽视武汉作为文化中心的自豪感`,
  sortOrder: 2,
};

const L3_HUNAN: RegionPreset = {
  id: 'region_hunan',
  name: '湖南',
  parentId: 'region_huazhong',
  level: 3,
  emoji: '🌹',
  culturalProfile: `## 语言风格
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
- 不宜过于温吞或软绵绵的表达`,
  sortOrder: 3,
};

// ────────────────────────────────────────────────
// L3：华南（3个）
// ────────────────────────────────────────────────

const L3_GUANGDONG: RegionPreset = {
  id: 'region_guangdong',
  name: '广东',
  parentId: 'region_huanan',
  level: 3,
  emoji: '🦐',
  culturalProfile: `## 语言风格
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
- 不宜忽视广东的语言多样性`,
  sortOrder: 1,
};

const L3_GUANGXI: RegionPreset = {
  id: 'region_guangxi',
  name: '广西',
  parentId: 'region_huanan',
  level: 3,
  emoji: '🎶',
  culturalProfile: `## 语言风格
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
- 不宜轻视广西在南方文化中的重要地位`,
  sortOrder: 2,
};

const L3_HAINAN: RegionPreset = {
  id: 'region_hainan',
  name: '海南',
  parentId: 'region_huanan',
  level: 3,
  emoji: '🏖️',
  culturalProfile: `## 语言风格
- 闽南语和粤语影响，表达热情开朗
- 海岛文化带来轻松休闲的语言气质
- 多元文化融合，接受度高

## 受众特征
- 自贸港政策影响，国际化意识增强
- 旅游服务业为主，重视体验经济
- 黎族苗族文化与汉文化并存

## 文化共鸣点
- 三亚海滩与热带度假文化
- 自由贸易港政策下的发展机遇
- 黎族传统文化（黎锦、竹竿舞）

## 禁忌
- 避免将海南简化为单纯旅游地
- 不宜忽视本地原住民文化的多样性`,
  sortOrder: 3,
};

// ────────────────────────────────────────────────
// L3：西南（5个）
// ────────────────────────────────────────────────

const L3_CHONGQING: RegionPreset = {
  id: 'region_chongqing',
  name: '重庆',
  parentId: 'region_xinan',
  level: 3,
  emoji: '🌉',
  culturalProfile: `## 语言风格
- 重庆话豪爽热辣，语调起伏鲜明
- 表达直接，情感热烈，气场强大
- 网络流行语生产地，活跃度高

## 受众特征
- 夜生活丰富，社交型消费突出
- 对美食和娱乐高度热情
- 立体城市认同感强，山城自豪感

## 文化共鸣点
- 重庆火锅文化（最强代表）
- 山城立体交通与赛博朋克景观
- 洪崖洞、解放碑的都市烟火气

## 禁忌
- 避免忽视重庆与四川的文化差异
- 不宜过于严肃，失去本地轻松热辣氛围`,
  sortOrder: 1,
};

const L3_SICHUAN: RegionPreset = {
  id: 'region_sichuan',
  name: '四川',
  parentId: 'region_xinan',
  level: 3,
  emoji: '🐼',
  culturalProfile: `## 语言风格
- 川话语调抑扬顿挫，个性鲜明
- 语言幽默，善用比喻和夸张
- 语速较快，情感表达直接热烈

## 受众特征
- 热爱美食和社交，生活享乐主义
- 幽默感强，能接受自嘲和调侃
- 重情义，朋友圈影响力大

## 文化共鸣点
- 火锅与川菜文化
- 大熊猫文化与成都慢生活
- 打麻将与盖碗茶的社交文化

## 禁忌
- 避免不了解川话而强行模仿造成误用
- 不宜过于严肃，失去本地轻松氛围`,
  sortOrder: 2,
};

const L3_GUIZHOU: RegionPreset = {
  id: 'region_guizhou',
  name: '贵州',
  parentId: 'region_xinan',
  level: 3,
  emoji: '🍃',
  culturalProfile: `## 语言风格
- 西南官话，语调平稳柔和
- 少数民族语言影响，表达多元
- 质朴真诚，不事浮华

## 受众特征
- 多民族聚居，文化包容性强
- 旅游资源丰富，生态意识高
- 对乡土文化和民族传统认同度高

## 文化共鸣点
- 苗族侗族等少数民族文化节庆
- 黄果树瀑布与喀斯特地貌
- 茅台酒文化与贵州辣椒

## 禁忌
- 避免对少数民族文化的简单化处理
- 不宜强化贵州落后的刻板印象`,
  sortOrder: 3,
};

const L3_YUNNAN: RegionPreset = {
  id: 'region_yunnan',
  name: '云南',
  parentId: 'region_xinan',
  level: 3,
  emoji: '🌺',
  culturalProfile: `## 语言风格
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
- 不宜简化或片面化云南的多元文化`,
  sortOrder: 4,
};

const L3_XIZANG: RegionPreset = {
  id: 'region_xizang',
  name: '西藏',
  parentId: 'region_xinan',
  level: 3,
  emoji: '🏔️',
  culturalProfile: `## 语言风格
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
- 不宜将西藏单纯娱乐化或商业化`,
  sortOrder: 5,
};

// ────────────────────────────────────────────────
// L3：西北（5个）
// ────────────────────────────────────────────────

const L3_SHAANXI: RegionPreset = {
  id: 'region_shaanxi',
  name: '陕西',
  parentId: 'region_xibei',
  level: 3,
  emoji: '🏺',
  culturalProfile: `## 语言风格
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
- 避免混淆山西（晋）和陕西（秦）
- 不宜轻视陕西的文化底蕴和历史价值`,
  sortOrder: 1,
};

const L3_GANSU: RegionPreset = {
  id: 'region_gansu',
  name: '甘肃',
  parentId: 'region_xibei',
  level: 3,
  emoji: '🐪',
  culturalProfile: `## 语言风格
- 西北官话，豪放大气中带历史厚重
- 表达朴实，善用地理和历史意象
- 语言有丝路文化的多元色彩

## 受众特征
- 历史文化认同感强（河西走廊）
- 农业和畜牧业文化影响深
- 对自然风光和历史遗迹认同度高

## 文化共鸣点
- 敦煌莫高窟与丝路文化
- 河西走廊与祁连山自然景观
- 牛肉面文化（兰州拉面）

## 禁忌
- 避免将甘肃简单等同于落后
- 不宜忽视少数民族（回族、藏族）文化`,
  sortOrder: 2,
};

const L3_QINGHAI: RegionPreset = {
  id: 'region_qinghai',
  name: '青海',
  parentId: 'region_xibei',
  level: 3,
  emoji: '🏔️',
  culturalProfile: `## 语言风格
- 受藏语和蒙古语影响，表达质朴
- 语言中有高原旷达的气质
- 表达真诚，少浮夸

## 受众特征
- 多民族聚居（藏族、回族、蒙古族）
- 生态意识强，对自然有深厚敬畏
- 旅游吸引力强，对外来文化开放

## 文化共鸣点
- 青海湖与三江源自然景观
- 藏传佛教文化（塔尔寺）
- 高原特色饮食（手抓羊肉、酥油茶）

## 禁忌
- 避免忽视宗教文化的重要性
- 不宜将青海仅视为路过的地方`,
  sortOrder: 3,
};

const L3_NINGXIA: RegionPreset = {
  id: 'region_ningxia',
  name: '宁夏',
  parentId: 'region_xibei',
  level: 3,
  emoji: '🌙',
  culturalProfile: `## 语言风格
- 回族文化影响，表达真诚庄重
- 普通话为主，语调平和
- 重视礼节，措辞得体

## 受众特征
- 回族文化核心区，宗教认同强
- 对枸杞、葡萄酒等特产有强烈自豪感
- 传统与现代并重的价值观

## 文化共鸣点
- 回族文化与伊斯兰风俗
- 西夏王朝历史遗迹
- 宁夏枸杞与葡萄酒产业

## 禁忌
- 严格尊重伊斯兰宗教禁忌
- 不宜在清真饮食相关场合不当发言`,
  sortOrder: 4,
};

const L3_XINJIANG: RegionPreset = {
  id: 'region_xinjiang',
  name: '新疆',
  parentId: 'region_xibei',
  level: 3,
  emoji: '🍇',
  culturalProfile: `## 语言风格
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
- 不宜对少数民族文化进行刻板描绘`,
  sortOrder: 5,
};

// ────────────────────────────────────────────────
// L3：港澳台（3个）
// ────────────────────────────────────────────────

const L3_HONGKONG: RegionPreset = {
  id: 'region_hongkong',
  name: '香港',
  parentId: 'region_gangaotai',
  level: 3,
  emoji: '🌃',
  culturalProfile: `## 语言风格
- 粤语为主，中英夹杂，港式表达独特
- 语速快，信息密度高，节奏紧凑
- 幽默风格独特，善用隐语和双关

## 受众特征
- 国际化视野，消费力强
- 影视娱乐文化影响力大（港剧/港片）
- 重视效率，对冗长表达耐心有限

## 文化共鸣点
- 港剧港片与粤语流行文化
- 茶餐厅文化与香港夜景
- 国际金融中心的商业文化

## 禁忌
- 政治话题极度敏感，须完全回避
- 不宜混用粤语与普通话表达习惯`,
  sortOrder: 1,
};

const L3_MACAO: RegionPreset = {
  id: 'region_macao',
  name: '澳门',
  parentId: 'region_gangaotai',
  level: 3,
  emoji: '🎰',
  culturalProfile: `## 语言风格
- 粤语与葡语文化双重影响
- 表达精炼，国际化色彩浓
- 中西融合的独特语言风格

## 受众特征
- 博彩旅游文化影响深远
- 中葡文化融合，包容性强
- 对奢侈品和高端消费接受度高

## 文化共鸣点
- 大三巴牌坊与葡式建筑遗迹
- 中葡文化融合的独特美食
- 博彩与娱乐产业文化

## 禁忌
- 政治话题同样敏感
- 不宜忽视澳门独特的葡语文化遗产`,
  sortOrder: 2,
};

const L3_TAIWAN: RegionPreset = {
  id: 'region_taiwan',
  name: '台湾',
  parentId: 'region_gangaotai',
  level: 3,
  emoji: '🌿',
  culturalProfile: `## 语言风格
- 繁体中文为主，台湾腔普通话温柔
- 闽南语（台语）影响深，口语活泼
- 表达礼貌细腻，重视情感温度

## 受众特征
- 娱乐内容消费力强（台剧/综艺）
- 重视环保和人文关怀
- 对生活品质和文化体验有高追求

## 文化共鸣点
- 夜市文化与台湾小吃
- 台剧与综艺娱乐文化
- 茶文化（高山茶、手摇茶）

## 禁忌
- 政治立场话题极度敏感，必须回避
- 不宜使用简体字或大陆用语习惯`,
  sortOrder: 3,
};

// ────────────────────────────────────────────────
// 导出完整预置数据
// ────────────────────────────────────────────────

export const REGION_PRESETS: RegionPreset[] = [
  // L1
  L1_CHINA,
  // L2
  L2_HUABEI,
  L2_DONGBEI,
  L2_HUADONG,
  L2_HUAZHONG,
  L2_HUANAN,
  L2_XINAN,
  L2_XIBEI,
  L2_GANGAOTAI,
  // L3 - 华北
  L3_BEIJING,
  L3_TIANJIN,
  L3_HEBEI,
  L3_SHANXI,
  L3_NEIMENGGU,
  // L3 - 东北
  L3_LIAONING,
  L3_JILIN,
  L3_HEILONGJIANG,
  // L3 - 华东
  L3_SHANGHAI,
  L3_JIANGSU,
  L3_ZHEJIANG,
  L3_ANHUI,
  L3_FUJIAN,
  L3_JIANGXI,
  L3_SHANDONG,
  // L3 - 华中
  L3_HENAN,
  L3_HUBEI,
  L3_HUNAN,
  // L3 - 华南
  L3_GUANGDONG,
  L3_GUANGXI,
  L3_HAINAN,
  // L3 - 西南
  L3_CHONGQING,
  L3_SICHUAN,
  L3_GUIZHOU,
  L3_YUNNAN,
  L3_XIZANG,
  // L3 - 西北
  L3_SHAANXI,
  L3_GANSU,
  L3_QINGHAI,
  L3_NINGXIA,
  L3_XINJIANG,
  // L3 - 港澳台
  L3_HONGKONG,
  L3_MACAO,
  L3_TAIWAN,
];
