// 匹配规则类型定义
export interface MatchingRules {
  // 硬性规则
  hardRules: {
    groupSize: number                    // 每组人数
    maxAgeGap: number                    // 最大年龄差
    allowAgeGapExceptions: boolean       // 是否允许年龄差异常
    mustAssignAll: boolean               // 是否必须分配所有成员
    genderRatio: number                  // 性别比例（男性比例0-1）
    strictGenderRatio: boolean           // 是否严格执行性别比例
    genderMode: 'mixed' | 'all-female'  // 性别分组模式：mixed(3:3/2:4) 或 all-female(0:6)
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
    personality: {
      enabled: boolean
      weight: number           // 性格互补权重 (0-1)
    }
    diversity: {
      enabled: boolean
      weight: number           // 职业多样性权重 (0-1)
    }
    communication: {
      enabled: boolean
      weight: number           // 沟通风格兼容权重 (0-1)
    }
    advanced?: {
      enabled: boolean
      depth?: number           // 分析深度 (1-10)
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
    analysis: string           // 分析Prompt
    generation: string         // 生成Prompt
    evaluation: string         // 评估Prompt
    userAnalysis?: string      // 用户分析额外提示（兼容旧版）
    grouping?: string          // 分组生成额外提示（兼容旧版）
  }
  
  // 评分标准
  scoring: {
    passThreshold: number      // 通过分数线
    goodThreshold: number      // 良好分数线
    excellentThreshold: number // 优秀分数线
    perfectThreshold: number   // 完美分数线
    minAcceptable: number      // 最低接受分数
    strictMode: boolean | number // 严格评分模式
  }
}

// 默认规则配置
export const DEFAULT_RULES: MatchingRules = {
  hardRules: {
    groupSize: 6,
    maxAgeGap: 8,
    allowAgeGapExceptions: false,
    mustAssignAll: true,
    genderRatio: 0.5,
    strictGenderRatio: false,
    genderMode: 'mixed',  // 默认使用混合模式
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
    personality: {
      enabled: true,
      weight: 0.3
    },
    diversity: {
      enabled: true,
      weight: 0.2
    },
    communication: {
      enabled: true,
      weight: 0.2
    },
    advanced: {
      enabled: false,
      depth: 5
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
    analysis: '',
    generation: '',
    evaluation: '',
    userAnalysis: '',
    grouping: ''
  },
  scoring: {
    passThreshold: 7.0,
    goodThreshold: 7.5,
    excellentThreshold: 8.5,
    perfectThreshold: 9.5,
    minAcceptable: 5.0,
    strictMode: false
  }
}