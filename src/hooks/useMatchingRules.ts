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
  const generateGroupingPrompt = useCallback((profiles: any[]) => {
    const currentRules = loadRules()
    
    let prompt = `请根据以下用户档案生成智能分组方案，每组${currentRules.hardRules.groupSize}人，返回JSON格式：

用户档案：
${profiles.map((p, i) => `
用户${i+1} (${p.user_id}):
- 性格总结: ${p.personality_summary}
- 社交风格: ${p.social_style}
- 兴趣标签: ${p.interests.join(', ')}
- 能量水平: ${p.energy_level}
- 对话风格: ${p.conversation_style}
- 角色预测: ${p.group_role_prediction}
- 性格关键词: ${p.personality_keywords.join(', ')}
`).join('\n')}

分组原则：
1. 每组恰好${currentRules.hardRules.groupSize}人
2. 年龄相差不超过${currentRules.hardRules.maxAgeGap}岁
3. 性别尽量均衡(理想${currentRules.hardRules.genderBalance.ideal.male}:${currentRules.hardRules.genderBalance.ideal.female}，可接受${currentRules.hardRules.genderBalance.acceptable.male}:${currentRules.hardRules.genderBalance.acceptable.female})`

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
- 硬性约束: 年龄差≤${currentRules.hardRules.maxAgeGap}岁, 性别比例${currentRules.hardRules.genderBalance.strict ? '必须' : '尽量'}符合要求, 人数=${currentRules.hardRules.groupSize}
- 软性匹配权重: 兴趣重叠(${currentRules.softRules.interests.weight}), 社交平衡(${currentRules.softRules.socialStyle.weight}), 能量协调(${currentRules.softRules.energyLevel.weight})
- 基础分数7.0，根据匹配质量加减分
- 违反硬性约束直接大幅扣分
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
    
    let prompt = `请对以下用户进行深度分析，返回JSON格式的心理档案：

用户信息：
- 姓名：${user.姓名 || '未知'}
- 性别：${user.性别 || '未知'}  
- 年龄：${user.年龄 || '未知'}
- 职业：${user.职业 || '未知'}
- 城市：${user.城市 || '未知'}
- 兴趣爱好：${user.兴趣爱好 || '未知'}
- 其他信息：${JSON.stringify(user, null, 2)}`

    // 添加自定义分析要求
    if (currentRules.customPrompts.userAnalysis) {
      prompt += `

额外分析要求：
${currentRules.customPrompts.userAnalysis}`
    }

    prompt += `

请分析并返回以下JSON格式：
{
  "user_id": "用户唯一标识",
  "personality_summary": "3-5句话的性格总结",
  "social_style": "社交风格(主动发起者/积极参与者/善于倾听者/深度思考者)",
  "interests": ["提取的兴趣标签列表"],
  "energy_level": "能量水平(高能量/中能量/低能量)", 
  "conversation_style": "对话风格描述",
  "group_role_prediction": "在小组中可能的角色",
  "mystery_tag": "神秘标签或特质",
  "potential_connections": ["可能感兴趣的话题或活动"],
  "personality_keywords": ["性格关键词列表"]
}

请确保返回纯JSON格式，不要添加任何其他文本或代码块标记。`

    return prompt
  }, [loadRules])

  return {
    rules,
    generateGroupingPrompt,
    generateEvaluationPrompt,
    generateUserAnalysisPrompt
  }
}