// 用户维度分析类型定义
export interface UserDimensions {
  userId: string
  name: string
  extroversion: {
    score: number        // 1-10，10分最开朗
    label: string       // "高开朗" | "中开朗" | "内向型" 
    sources: string[]   // 推断依据
  }
  thinkingStyle: {
    type: "rational" | "intuitive" | "balanced"
    score: number       // 1-10，理性(1-3) 平衡(4-7) 感性(8-10)
    confidence: number  // 推断置信度 0-1
    traits: string[]   // 具体特征
  }
  topicPreference: {
    primary: string     // 主要偏好类型
    secondary?: string  // 次要偏好类型
    keywords: string[]  // 关键词标签
    diversity: number   // 话题多样性 1-10
  }
  socialMotivation: {
    type: "expand" | "recharge" | "explore"
    intensity: number   // 社交动机强度 1-10
    description: string // 详细描述
    keywords: string[]  // 动机关键词
  }
}

export interface UserProfile {
  userId: string
  name: string
  age?: number
  gender?: string
  dimensions: UserDimensions
  rawData: any        // 原始问卷数据
  createdAt: string
  updatedAt: string
}

export interface DimensionAnalysisConfig {
  extroversionPrompt: string
  thinkingStylePrompt: string
  topicPreferencePrompt: string
  socialMotivationPrompt: string
  masterPrompt: string  // 主提示词，整合所有维度
}

export const DEFAULT_DIMENSION_CONFIG: DimensionAnalysisConfig = {
  extroversionPrompt: `分析用户的开朗程度维度：
基于【当你失去能量时你更倾向】、【对于现场话题和游戏的开放程度，你的接受度】、【你的交朋友能量指数是：】等字段，评估用户的外向程度。

返回格式：
{
  "score": 1-10的数值,
  "label": "高开朗/中开朗/内向型",
  "sources": ["具体的推断依据"]
}`,

  thinkingStylePrompt: `分析用户的思维风格维度：
基于【当你对事物进行判断时，更多基于】、【最近你专注于】、【职业】等字段，判断用户是理性分析型、感性直觉型还是平衡综合型。

返回格式：
{
  "type": "rational/intuitive/balanced",
  "score": 1-10的数值,
  "confidence": 0-1的置信度,
  "traits": ["具体特征"]
}`,

  topicPreferencePrompt: `分析用户的话题偏好维度：
基于【你更想和大家聊的话题是】、【兴趣爱好】、【情感气象】等字段，判断用户的话题偏好类型。

返回格式：
{
  "primary": "深度探索型/生活分享型/创意文化型",
  "secondary": "次要类型（可选）",
  "keywords": ["话题关键词"],
  "diversity": 1-10的多样性评分
}`,

  socialMotivationPrompt: `分析用户的社交动机维度：
基于【情感气象】、整体问卷语调等，判断用户的社交动机。

返回格式：
{
  "type": "expand/recharge/explore",
  "intensity": 1-10的强度,
  "description": "详细描述",
  "keywords": ["动机关键词"]
}`,

  masterPrompt: `你是一位专业的心理学专家，请对用户进行四个核心维度的深度分析：

## 用户原始数据
{userData}

## 分析任务
请基于用户的问卷回答，分析以下四个维度：

### 1. 开朗程度 (Extroversion)
- 关键字段：【当你失去能量时你更倾向】、【对于现场话题和游戏的开放程度，你的接受度】、【你的交朋友能量指数是：】
- 评分：1-10分，10分最开朗
- 分类：高开朗(8-10) / 中开朗(5-7) / 内向型(1-4)

### 2. 思维风格 (Thinking Style) 
- 关键字段：【当你对事物进行判断时，更多基于】、【最近你专注于】、【职业】
- 类型：理性分析型(rational) / 感性直觉型(intuitive) / 平衡综合型(balanced)
- 评分：1-10分，1-3理性，4-7平衡，8-10感性

### 3. 话题偏好 (Topic Preference)
- 关键字段：【你更想和大家聊的话题是】、【兴趣爱好】、【情感气象】
- 类型：深度探索型 / 生活分享型 / 创意文化型
- 多样性：1-10分评估话题广度

### 4. 社交动机 (Social Motivation)
- 关键字段：【情感气象】、整体语调
- 类型：扩展型(expand) / 充电型(recharge) / 探索型(explore)
- 强度：1-10分评估动机强烈程度

## 返回格式
请严格按照以下JSON格式返回：

{
  "userId": "user_1",
  "name": "用户昵称",
  "extroversion": {
    "score": 数值1-10,
    "label": "高开朗/中开朗/内向型",
    "sources": ["推断依据1", "推断依据2"]
  },
  "thinkingStyle": {
    "type": "rational/intuitive/balanced",
    "score": 数值1-10,
    "confidence": 数值0-1,
    "traits": ["特征1", "特征2"]
  },
  "topicPreference": {
    "primary": "主要类型",
    "secondary": "次要类型（可选）",
    "keywords": ["关键词1", "关键词2"],
    "diversity": 数值1-10
  },
  "socialMotivation": {
    "type": "expand/recharge/explore",
    "intensity": 数值1-10,
    "description": "详细描述",
    "keywords": ["关键词1", "关键词2"]
  }
}

请确保分析准确、具体，并提供充分的推断依据。`
}