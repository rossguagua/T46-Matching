import { useCallback } from 'react'

// 数据标准化和分组策略算法
interface GenderStats {
  totalUsers: number
  maleCount: number
  femaleCount: number
  femaleAcceptAllFemale: number
  femaleRejectAllFemale: number
  genderRatio: number
  isGenderImbalanced: boolean
}

interface GroupStrategy {
  strategy: 'HYBRID_PARALLEL' | 'PRIORITY_MIXED' | 'ALL_FEMALE_ONLY' | 'BALANCED'
  mixedGroups: number
  allFemaleGroups: number
  canSatisfyAllPreferences: boolean
  compromiseRequired?: boolean
  details: string
}

interface EnhancedUserProfile {
  user_id: string
  name: string
  age: number
  gender: string
  acceptsAllFemaleGroup?: boolean
  groupingConstraints?: {
    genderPreference: 'mixed' | 'all-female' | 'flexible'
    priority: number
    flexibility: number
    poolAssignment: 'MIXED_POOL' | 'FORCED_MIXED_POOL' | 'FLEXIBLE_POOL' | 'UNASSIGNED_POOL'
  }
  personality_vector?: {
    openness: number
    extroversion: number
    agreeableness: number
    emotional_stability: number
    conscientiousness: number
  }
  matching_factors?: {
    must_match: string[]
    prefer_match: string[]
    must_avoid: string[]
    compatibility_keywords: string[]
  }
}

export const useEnhancedMatching = () => {
  
  // 分析性别平衡和用户偏好
  const analyzeGenderBalance = useCallback((userData: any[]): GenderStats => {
    const stats = {
      totalUsers: userData.length,
      maleCount: userData.filter(u => 
        u.性别 === '男' || u.gender === '男' || u.gender === 'M' || u.gender === 'Male'
      ).length,
      femaleCount: userData.filter(u => 
        u.性别 === '女' || u.gender === '女' || u.gender === 'F' || u.gender === 'Female'
      ).length,
      femaleAcceptAllFemale: 0,
      femaleRejectAllFemale: 0,
      genderRatio: 0,
      isGenderImbalanced: false
    }
    
    // 统计女性用户对全女局的接受度
    userData.forEach(user => {
      const isFemale = user.性别 === '女' || user.gender === '女' || user.gender === 'F'
      const acceptsAllFemale = user['是否接受全女'] === '是' || 
                               user['是否接受全女'] === true ||
                               user['是否接受全女'] === '接受' ||
                               user['是否接受全女'] === 'Y' ||
                               user['是否接受全女'] === 'Yes'
      
      if (isFemale) {
        if (acceptsAllFemale) {
          stats.femaleAcceptAllFemale++
        } else if (user['是否接受全女'] !== undefined && user['是否接受全女'] !== '') {
          stats.femaleRejectAllFemale++
        }
      }
    })
    
    stats.genderRatio = stats.femaleCount > 0 ? stats.maleCount / stats.femaleCount : 0
    stats.isGenderImbalanced = stats.genderRatio < 0.4 || stats.genderRatio > 2.5
    
    return stats
  }, [])
  
  // 计算最优分组策略
  const calculateOptimalStrategy = useCallback((stats: GenderStats, groupSize: number = 6): GroupStrategy => {
    // 如果男性数量为0，只能全女组
    if (stats.maleCount === 0) {
      return {
        strategy: 'ALL_FEMALE_ONLY',
        mixedGroups: 0,
        allFemaleGroups: Math.floor(stats.femaleCount / groupSize),
        canSatisfyAllPreferences: stats.femaleRejectAllFemale === 0,
        details: '无男性用户，采用全女组策略'
      }
    }
    
    // 计算混合组需要的最少男性数量
    const minMalesPerGroup = 2 // 最少2男4女
    const maxMalesPerGroup = 3 // 最多3男3女
    const requiredMalesForMixed = Math.ceil(stats.femaleRejectAllFemale * minMalesPerGroup / (groupSize - minMalesPerGroup))
    
    if (stats.maleCount >= requiredMalesForMixed) {
      // 策略A: 混合组 + 全女组并行
      const possibleMixedGroups = Math.floor(stats.maleCount / minMalesPerGroup)
      const femalesInMixedGroups = possibleMixedGroups * (groupSize - minMalesPerGroup)
      const remainingFemales = stats.femaleCount - femalesInMixedGroups
      
      return {
        strategy: 'HYBRID_PARALLEL',
        mixedGroups: possibleMixedGroups,
        allFemaleGroups: Math.floor(remainingFemales / groupSize),
        canSatisfyAllPreferences: true,
        details: `混合组(2男4女或3男3女) + 全女组并行，可满足所有用户偏好`
      }
    } else if (stats.maleCount > 0) {
      // 策略B: 优先满足强制需求，其余进全女组
      const possibleMixedGroups = Math.floor(stats.maleCount / minMalesPerGroup)
      const femalesInMixedGroups = possibleMixedGroups * (groupSize - minMalesPerGroup)
      const remainingFemales = stats.femaleCount - femalesInMixedGroups
      
      return {
        strategy: 'PRIORITY_MIXED',
        mixedGroups: possibleMixedGroups,
        allFemaleGroups: Math.floor(remainingFemales / groupSize),
        canSatisfyAllPreferences: false,
        compromiseRequired: true,
        details: `男性不足，部分拒绝全女局的用户可能需要进入全女组`
      }
    }
    
    // 默认平衡策略
    return {
      strategy: 'BALANCED',
      mixedGroups: Math.floor(stats.totalUsers / groupSize),
      allFemaleGroups: 0,
      canSatisfyAllPreferences: true,
      details: '性别比例平衡，采用标准混合分组'
    }
  }, [])
  
  // 为用户分配池标签
  const assignUserToPool = useCallback((profile: any, strategy: GroupStrategy): string => {
    const isMale = profile.gender === '男' || profile.性别 === '男'
    const isFemale = profile.gender === '女' || profile.性别 === '女'
    const acceptsAllFemale = profile.acceptsAllFemaleGroup || 
                            profile['是否接受全女'] === '是' ||
                            profile['是否接受全女'] === true
    
    if (isMale) return 'MIXED_POOL'
    if (isFemale && !acceptsAllFemale && strategy.strategy !== 'ALL_FEMALE_ONLY') {
      return 'FORCED_MIXED_POOL'
    }
    if (isFemale && acceptsAllFemale) return 'FLEXIBLE_POOL'
    return 'UNASSIGNED_POOL'
  }, [])
  
  // 增强用户档案（第二步的标准化处理）
  const enhanceUserProfiles = useCallback((profiles: any[], strategy: GroupStrategy): EnhancedUserProfile[] => {
    return profiles.map((profile, index) => {
      const poolAssignment = assignUserToPool(profile, strategy)
      
      // 计算优先级分数
      let priority = 5 // 基础分数
      if (poolAssignment === 'FORCED_MIXED_POOL') priority = 10 // 必须进混合组的用户优先级最高
      if (poolAssignment === 'MIXED_POOL') priority = 8 // 男性用户优先级较高
      if (profile.avoid_preferences?.length > 0) priority += 1 // 有明确避免偏好的用户优先级略高
      
      // 计算灵活度
      let flexibility = 0.5 // 基础灵活度
      if (poolAssignment === 'FLEXIBLE_POOL') flexibility = 0.8 // 接受全女局的用户灵活度高
      if (profile.openness_score > 7) flexibility += 0.1
      if (profile.ideal_group_size_preference === '无所谓') flexibility += 0.1
      
      return {
        ...profile,
        user_id: profile.user_id || `user_${index + 1}`,
        groupingConstraints: {
          genderPreference: poolAssignment === 'FORCED_MIXED_POOL' ? 'mixed' : 
                           poolAssignment === 'FLEXIBLE_POOL' ? 'flexible' : 
                           'mixed',
          priority,
          flexibility: Math.min(flexibility, 1),
          poolAssignment: poolAssignment as any
        }
      }
    })
  }, [assignUserToPool])
  
  // 生成增强的用户分析Prompt（第一轮AI对话）
  const generateEnhancedUserAnalysisPrompt = useCallback((user: any) => {
    const name = user.自选昵称 || user.姓名 || user.昵称 || user.name || '未知'
    const acceptsAllFemale = user['是否接受全女'] || '未明确'
    
    return `你是一位专业的心理分析师和社交行为专家。请对用户进行多维度深度分析。

用户基本信息：
${JSON.stringify(user, null, 2)}

特别注意：
- 是否接受全女组：${acceptsAllFemale}

分析维度：
1. 【显性特征】从问卷直接提取的客观信息
2. 【隐性特征】通过语言风格、选择偏好推断的深层特质
3. 【社交动机】参与活动的真实目的和期待
4. 【匹配向量】生成用于计算相似度的特征向量

必须返回的结构化数据：
{
  "user_id": "唯一标识",
  "name": "${name}",
  "basic_info": {
    "age": 年龄数字,
    "gender": "性别",
    "location": "地区",
    "profession": "职业"
  },
  "personality_vector": {
    "openness": 0-10,
    "extroversion": 0-10,
    "agreeableness": 0-10,
    "emotional_stability": 0-10,
    "conscientiousness": 0-10
  },
  "social_preferences": {
    "preferred_group_size": "small/medium/large",
    "interaction_style": "leader/follower/facilitator/observer",
    "energy_pattern": "给予能量者/需要能量者/能量平衡者",
    "conversation_depth": "深度交流/轻松闲聊/两者兼顾",
    "accepts_all_female_group": ${acceptsAllFemale === '是' ? 'true' : 'false'}
  },
  "matching_factors": {
    "must_match": ["必须匹配的特征"],
    "prefer_match": ["偏好匹配的特征"],
    "must_avoid": ["必须避免的特征"],
    "compatibility_keywords": ["5-10个关键词用于相似度计算"]
  },
  "ai_insights": {
    "hidden_needs": "未明说但推测的需求",
    "potential_conflicts": "可能的冲突点",
    "ideal_partner_profile": "理想搭档画像",
    "group_contribution": "能为小组带来什么",
    "gender_preference_analysis": "对性别组成的真实偏好分析"
  }
}

请确保：
1. 所有数值都基于问卷内容合理推断
2. 不要遗漏任何可用于匹配的信息
3. 生成的向量要有区分度
4. 返回纯JSON格式`
  }, [])
  
  // 生成智能分组Prompt（第三轮AI对话 - MatchingAgent）
  const generateSmartGroupingPrompt = useCallback((profiles: EnhancedUserProfile[], strategy: GroupStrategy, groupSize: number = 6) => {
    // 按池分类用户
    const usersByPool = {
      MIXED_POOL: profiles.filter(p => p.groupingConstraints?.poolAssignment === 'MIXED_POOL'),
      FORCED_MIXED_POOL: profiles.filter(p => p.groupingConstraints?.poolAssignment === 'FORCED_MIXED_POOL'),
      FLEXIBLE_POOL: profiles.filter(p => p.groupingConstraints?.poolAssignment === 'FLEXIBLE_POOL'),
      UNASSIGNED_POOL: profiles.filter(p => p.groupingConstraints?.poolAssignment === 'UNASSIGNED_POOL')
    }
    
    return `你是一个精通图论和组合优化的匹配专家。基于以下分组策略和用户档案生成最优分组方案。

【分组策略】
策略类型：${strategy.strategy}
目标混合组数：${strategy.mixedGroups}组
目标全女组数：${strategy.allFemaleGroups}组
策略说明：${strategy.details}

【用户池分布】
- 男性池(MIXED_POOL)：${usersByPool.MIXED_POOL.length}人
- 强制混合池(FORCED_MIXED_POOL)：${usersByPool.FORCED_MIXED_POOL.length}人
- 灵活池(FLEXIBLE_POOL)：${usersByPool.FLEXIBLE_POOL.length}人
- 未分配池(UNASSIGNED_POOL)：${usersByPool.UNASSIGNED_POOL.length}人

【用户详情】
${profiles.map((p, i) => `
用户${i+1} [${p.user_id}]：
- 基本：${p.name}, ${p.age}岁, ${p.gender}
- 池分配：${p.groupingConstraints?.poolAssignment}
- 优先级：${p.groupingConstraints?.priority}/10
- 灵活度：${p.groupingConstraints?.flexibility}
- 性格向量：[${Object.values(p.personality_vector || {}).join(', ')}]
`).join('')}

【匹配算法要求】
1. 硬约束验证：
   - 每组严格${groupSize}人
   - 年龄差必须≤3岁
   - 混合组性别比例：2男4女或3男3女
   - 全女组：6女0男

2. 分组执行顺序：
   第一阶段：优先处理FORCED_MIXED_POOL和MIXED_POOL用户，组成混合组
   第二阶段：处理FLEXIBLE_POOL用户，组成全女组
   第三阶段：处理剩余用户

3. 软约束优化：
   - 性格向量相似度（余弦相似度）
   - 兴趣重叠度
   - 社交风格互补性
   - 能量平衡度

返回格式：
{
  "groups": [
    {
      "group_id": "组ID",
      "group_type": "mixed/all-female",
      "members": [用户索引数组],
      "group_metrics": {
        "age_range": [最小年龄, 最大年龄],
        "gender_composition": "3M3F/2M4F/6F",
        "personality_variance": 0-1,
        "compatibility_score": 0-10
      },
      "group_dynamics": {
        "predicted_leader": "预测的组长",
        "risk_factors": ["潜在风险"]
      }
    }
  ],
  "unassigned": [未分配用户索引],
  "algorithm_metadata": {
    "mixed_groups_formed": 数量,
    "all_female_groups_formed": 数量,
    "constraint_violations": [],
    "optimization_score": 0-1
  }
}

确保返回纯JSON格式。`
  }, [])
  
  // 生成质量审核Prompt（第四轮AI对话 - ReviewAgent）
  const generateQualityAuditPrompt = useCallback((proposal: any, profiles: EnhancedUserProfile[]) => {
    return `你是一位严格的质量审核专家。请对以下分组方案进行多维度评估。

【分组方案】
${JSON.stringify(proposal, null, 2)}

【用户档案】
${profiles.map(p => `${p.user_id}: ${p.name}(${p.age}岁,${p.gender})`).join('\n')}

【评估维度】

1. 硬约束合规性检查（每项违规扣3分）：
   - 组大小是否为6人
   - 年龄差是否≤3岁
   - 性别比例是否符合要求（混合组2:4或3:3，全女组0:6）
   - 用户池分配是否正确（FORCED_MIXED_POOL用户必须在混合组）

2. 软约束质量评分（总分10分）：
   - 组内凝聚力（3分）：性格匹配度、兴趣重叠度
   - 组间平衡性（2分）：各组质量是否均衡
   - 用户偏好满足度（3分）：是否满足用户的匹配偏好
   - 风险管理（2分）：是否存在明显的冲突风险

3. 优化建议生成：
   - 识别问题组和问题用户
   - 提供具体的调整建议
   - 评估调整的可行性

返回格式：
{
  "compliance_check": {
    "hard_constraints": {
      "group_size": {"status": "PASS/FAIL", "details": "说明"},
      "age_gap": {"status": "PASS/FAIL", "details": "说明"},
      "gender_ratio": {"status": "PASS/FAIL", "details": "说明"},
      "pool_assignment": {"status": "PASS/FAIL", "details": "说明"}
    },
    "violations": ["违规项列表"]
  },
  "quality_metrics": {
    "cohesion_score": 0-3,
    "balance_score": 0-2,
    "preference_score": 0-3,
    "risk_score": 0-2,
    "total_score": 0-10
  },
  "group_analysis": {
    "group_id": {
      "strengths": ["优势"],
      "weaknesses": ["劣势"],
      "risks": ["风险"],
      "improvement_priority": 1-5
    }
  },
  "optimization_suggestions": [
    {
      "type": "swap/merge/split",
      "target_groups": ["组ID"],
      "target_users": ["用户ID"],
      "reason": "调整原因",
      "expected_improvement": "预期改善"
    }
  ],
  "final_verdict": {
    "approved": true/false,
    "confidence": 0-1,
    "summary": "总体评价"
  }
}

确保返回纯JSON格式。`
  }, [])
  
  return {
    analyzeGenderBalance,
    calculateOptimalStrategy,
    enhanceUserProfiles,
    generateEnhancedUserAnalysisPrompt,
    generateSmartGroupingPrompt,
    generateQualityAuditPrompt
  }
}