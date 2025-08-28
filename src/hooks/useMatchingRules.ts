import { useState, useEffect, useCallback } from 'react'
import { MatchingRules, DEFAULT_RULES } from '../types/rules'

export const useMatchingRules = () => {
  const [rules, setRules] = useState<MatchingRules>(DEFAULT_RULES)

  // 从localStorage加载规则
  const loadRules = useCallback(() => {
    const savedRules = localStorage.getItem('t46-matching-rules')
    if (savedRules) {
      try {
        const parsed = JSON.parse(savedRules)
        setRules(parsed)
        return parsed
      } catch (error) {
        console.error('加载规则失败:', error)
        return DEFAULT_RULES
      }
    }
    return DEFAULT_RULES
  }, [])

  // 组件挂载时加载规则
  useEffect(() => {
    loadRules()
  }, [loadRules])

  // 生成分组Prompt
  const generateGroupingPrompt = useCallback((profiles: any[], userData?: any[]) => {
    const currentRules = loadRules()
    
    let prompt = `请根据以下用户档案生成智能分组方案，每组${currentRules.hardRules.groupSize}人，返回JSON格式：

用户档案：
${profiles.map((p, i) => {
  const originalUser = userData?.[i] || {}
  return `
用户${i+1} (${p.user_id}):
- 基本信息: ${originalUser.自选昵称 || '未知'}, ${originalUser.年龄 || '?'}岁, ${originalUser.性别 || '未知'}
- 性格总结: ${p.personality_summary}
- 社交风格: ${p.social_style}
- 兴趣标签: ${p.interests.join(', ')}
- 能量水平: ${p.energy_level}
- 对话风格: ${p.conversation_style}
- 角色预测: ${p.group_role_prediction}
- 性格关键词: ${p.personality_keywords.join(', ')}`
}).join('\n')}

分组原则：

【硬性约束 - 必须严格遵守】
1. 每组必须恰好${currentRules.hardRules.groupSize}人
2. ⚠️ 重要：组内任意两人年龄差必须不超过${currentRules.hardRules.maxAgeGap}岁（例如：如果组内有25岁的成员，其他成员年龄必须在22-28岁之间）
3. ⚠️⚠️⚠️ 极其重要的性别比例约束：${
  currentRules.hardRules.genderMode === 'all-female' 
    ? '本次采用全女模式，每组必须是0男6女（全女组合）' 
    : '本次采用混合模式，每组的性别比例只能是以下两种之一：\n   - 3男3女（平衡组合）\n   - 2男4女（女性为主）\n   绝对不允许出现1:5、4:2、5:1、0:6等其他比例！'
}违反此规则的分组将被直接否决！

⚠️ 违反年龄差约束的分组将被视为无效！请确保每组内所有成员的年龄跨度不超过${currentRules.hardRules.maxAgeGap}岁。`

    // 添加软性规则
    if (currentRules.softRules.interests.enabled) {
      prompt += `
4. 兴趣爱好重叠${currentRules.softRules.interests.minOverlap}-${currentRules.softRules.interests.maxOverlap}个`
    }
    
    if (currentRules.softRules.socialStyle.enabled && currentRules.softRules.socialStyle.requireBalance) {
      prompt += `
5. 社交风格平衡(理想：${currentRules.softRules.socialStyle.idealMix.initiators}个主动发起者+${currentRules.softRules.socialStyle.idealMix.participants}个积极参与者+${currentRules.softRules.socialStyle.idealMix.listeners}个善于倾听者)`
    }
    
    if (currentRules.softRules.energyLevel.enabled && currentRules.softRules.energyLevel.requireBalance) {
      prompt += `
6. 能量水平分布(${currentRules.softRules.energyLevel.distribution.high}个高能量+${currentRules.softRules.energyLevel.distribution.medium}个中能量+${currentRules.softRules.energyLevel.distribution.low}个低能量)`
    }

    // 添加自定义Prompt
    if (currentRules.customPrompts.grouping) {
      prompt += `

额外要求：
${currentRules.customPrompts.grouping}`
    }

    prompt += `

请返回以下JSON格式：
{
  "groups": [
    {
      "id": "group_1", 
      "name": "第一组：[组名]",
      "members": [对应的原始userData索引数组],
      "description": "这个组的特色和匹配理由"
    }
  ],
  "unassigned": [未分配的userData索引],
  "strategy": "分组策略说明",
  "reasoning": "详细的分组推理过程"
}

确保返回纯JSON格式。`

    return prompt
  }, [loadRules])

  // 生成评估Prompt
  const generateEvaluationPrompt = useCallback((proposal: any) => {
    const currentRules = loadRules()
    
    let prompt = `请严格评估以下分组方案的质量，使用T46评分标准(0-10分)：

${proposal.groups.map((group: any, i: number) => `
第${i+1}组 "${group.name}":
成员信息:
${group.members.map((member: any, j: number) => `  ${j+1}. ${member.姓名 || '未知'} - 年龄:${member.年龄 || '?'} 性别:${member.性别 || '?'} 职业:${member.职业 || '?'}`).join('\n')}
组描述: ${group.description}
`).join('\n')}

评分标准：
【硬性约束检查 - 违反任一条直接扣3分以上】
- ⚠️ 年龄差必须≤${currentRules.hardRules.maxAgeGap}岁（检查每组内最大年龄与最小年龄的差值）
- 人数必须=${currentRules.hardRules.groupSize}人
- 性别比例${currentRules.hardRules.genderBalance.strict ? '必须' : '尽量'}符合要求

【软性匹配权重】
- 兴趣重叠(权重${currentRules.softRules.interests.weight})
- 社交平衡(权重${currentRules.softRules.socialStyle.weight})
- 能量协调(权重${currentRules.softRules.energyLevel.weight})

【评分规则】
- 基础分数7.0，根据匹配质量加减分
- 违反年龄差约束：每组扣3分
- 违反人数约束：每组扣2分
- 通过线: ${currentRules.scoring.passThreshold}分
- 优秀线: ${currentRules.scoring.excellentThreshold}分
- 完美线: ${currentRules.scoring.perfectThreshold}分`

    // 添加自定义评估要求
    if (currentRules.customPrompts.evaluation) {
      prompt += `

额外评估要求：
${currentRules.customPrompts.evaluation}`
    }

    prompt += `

请返回JSON格式评估结果：
{
  "approved": true/false,
  "overall_score": 总分(0-10),
  "group_scores": {"group_1": 分数, "group_2": 分数, ...},
  "violations": {
    "hard_constraints": ["违反的硬性约束列表"],
    "soft_constraints": ["需要改进的软性约束"]
  },
  "suggestions": ["具体改进建议"],
  "detailed_feedback": "详细的评分说明和理由"
}

确保返回纯JSON格式。`

    return prompt
  }, [loadRules])

  // 生成用户分析Prompt
  const generateUserAnalysisPrompt = useCallback((user: any) => {
    const currentRules = loadRules()
    
    // 智能字段映射，兼容不同的Excel字段名
    const name = user.自选昵称 || user.姓名 || user.昵称 || user.name || '未知'
    const gender = user.性别 || user.gender || '未知'
    const age = user.年龄 || user.age || '未知'
    const profession = user.职业 || user.profession || '未知'
    const city = user.居住城市或地区 || user.城市 || user.居住地 || user.city || '未知'
    const interests = user.兴趣爱好 || user.兴趣 || user.interests || '未知'
    const values = user['价值观/信仰'] || user.价值观 || user.信仰 || '未知'
    const skills = user['专业背景/技能'] || user.专业背景 || user.技能 || '未知'
    const personality = user.性格特征 || user.personality || '未知'
    const socialPreference = user.社交偏好 || user.社交风格 || '未知'
    const expectedPeople = user.期待认识的人群类型 || user.期待认识 || '未知'
    const avoidPeople = user.需要避免的人群类型 || user.避免类型 || '未知'
    const idealGroupSize = user.理想分组大小 || user.分组大小 || '未知'
    const openness = user['对于现场话题和游戏的开放程度，你的接受度'] || user.开放度 || user.接受度 || '未知'
    
    let prompt = `请对以下用户进行深度分析，生成详细的AI心理档案：

用户基本信息：
- 昵称：${name}
- 性别：${gender}  
- 年龄：${age}
- 职业：${profession}
- 居住地：${city}

个人特征：
- 兴趣爱好：${interests}
- 价值观/信仰：${values}
- 专业背景/技能：${skills}
- 性格特征：${personality}

社交偏好：
- 社交偏好：${socialPreference}
- 期待认识的人群类型：${expectedPeople}
- 需要避免的人群类型：${avoidPeople}
- 理想分组大小：${idealGroupSize}
- 活动开放度（1-10）：${openness}

完整原始数据：
${JSON.stringify(user, null, 2)}`

    // 添加自定义分析要求
    if (currentRules.customPrompts.userAnalysis) {
      prompt += `

额外分析要求：
${currentRules.customPrompts.userAnalysis}`
    }

    prompt += `

请基于以上信息进行深度心理分析，生成详细的用户档案，返回以下JSON格式：
{
  "user_id": "用户唯一标识",
  "name": "${name}",
  "age": ${age === '未知' ? 'null' : age},
  "gender": "${gender}",
  "location": "${city}",
  "profession": "${profession}",
  "personality_summary": "基于所有信息的3-5句话深度性格分析总结",
  "social_style": "社交风格(主动发起者/积极参与者/善于倾听者/深度思考者)",
  "core_values": ["从价值观信仰中提取的3-5个核心价值观"],
  "interests": ["从兴趣爱好中提取的具体兴趣标签列表，至少5个"],
  "professional_skills": ["从专业背景提取的技能列表"],
  "energy_level": "能量水平(高能量/中能量/低能量)",
  "conversation_style": "基于性格特征的对话风格描述",
  "group_role_prediction": "基于社交偏好预测在小组中可能的角色",
  "preferred_match_types": ["从期待认识的人群中提取的匹配偏好"],
  "avoid_preferences": ["从需要避免的人群中提取的规避偏好"],
  "openness_score": ${openness === '未知' ? 5 : openness},
  "ideal_group_size_preference": "${idealGroupSize}",
  "mystery_tag": "一个有趣的神秘标签或独特特质",
  "potential_connections": ["基于兴趣和价值观推断的5个可能感兴趣的话题或活动"],
  "personality_keywords": ["5-8个精准的性格关键词"],
  "ai_insights": "AI对这个人的独特洞察和匹配建议（50-100字）",
  "matching_preferences": "基于所有信息总结的匹配偏好说明"
}

请确保：
1. 充分利用用户提供的所有信息进行分析
2. 返回的档案要具体、详细、有洞察力
3. 返回纯JSON格式，不要添加任何markdown标记或代码块标记`

    return prompt
  }, [loadRules])

  return {
    rules,
    generateGroupingPrompt,
    generateEvaluationPrompt,
    generateUserAnalysisPrompt
  }
}