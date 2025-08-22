// 匹配规则类型定义
export interface MatchingRules {
  // 硬性规则
  hardRules: {
    groupSize: number                    // 每组人数
    maxAgeGap: number                    // 最大年龄差
    genderBalance: {
      ideal: { male: number; female: number }      // 理想性别比例
      acceptable: { male: number; female: number }  // 可接受性别比例
      strict: boolean                               // 是否严格执行
    }
  }
  
  // 软性规则
  softRules: {
    interests: {
      enabled: boolean
      minOverlap: number        // 最小兴趣重叠数
      maxOverlap: number        // 最大兴趣重叠数
      weight: number           // 权重 (0-1)
    }
    socialStyle: {
      enabled: boolean
      requireBalance: boolean   // 是否要求社交风格平衡
      idealMix: {
        initiators: number      // 主动发起者数量
        participants: number    // 积极参与者数量
        listeners: number       // 善于倾听者数量
      }
      weight: number
    }
    energyLevel: {
      enabled: boolean
      requireBalance: boolean   // 是否要求能量平衡
      distribution: {
        high: number
        medium: number
        low: number
      }
      weight: number
    }
  }
  
  // 自定义prompt增强
  customPrompts: {
    userAnalysis: string        // 用户分析额外提示
    grouping: string           // 分组生成额外提示
    evaluation: string         // 评估审核额外提示
  }
  
  // 评分标准
  scoring: {
    passThreshold: number      // 通过分数线
    excellentThreshold: number // 优秀分数线
    perfectThreshold: number   // 完美分数线
  }
}

// 默认规则配置
export const DEFAULT_RULES: MatchingRules = {
  hardRules: {
    groupSize: 6,
    maxAgeGap: 8,
    genderBalance: {
      ideal: { male: 3, female: 3 },
      acceptable: { male: 4, female: 2 },
      strict: false
    }
  },
  softRules: {
    interests: {
      enabled: true,
      minOverlap: 2,
      maxOverlap: 5,
      weight: 0.3
    },
    socialStyle: {
      enabled: true,
      requireBalance: true,
      idealMix: {
        initiators: 2,
        participants: 3,
        listeners: 1
      },
      weight: 0.3
    },
    energyLevel: {
      enabled: true,
      requireBalance: true,
      distribution: {
        high: 2,
        medium: 2,
        low: 2
      },
      weight: 0.2
    }
  },
  customPrompts: {
    userAnalysis: '',
    grouping: '',
    evaluation: ''
  },
  scoring: {
    passThreshold: 7.0,
    excellentThreshold: 8.5,
    perfectThreshold: 9.5
  }
}