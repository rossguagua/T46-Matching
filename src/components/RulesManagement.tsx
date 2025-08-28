import React, { useState, useEffect } from 'react'
import { MatchingRules, DEFAULT_RULES } from '../types/rules'
import '../styles/RulesManagement.css'

const RulesManagement: React.FC = () => {
  const [rules, setRules] = useState<MatchingRules>(DEFAULT_RULES)
  const [hasChanges, setHasChanges] = useState(false)
  const [activeTab, setActiveTab] = useState<'hard' | 'soft' | 'prompts' | 'scoring'>('hard')
  
  // 创建prompt生成器 - 避免hook冲突
  const createPromptGenerators = () => {
    const loadRules = () => {
      const savedRules = localStorage.getItem('t46-matching-rules')
      if (savedRules) {
        try {
          return JSON.parse(savedRules)
        } catch (error) {
          return rules
        }
      }
      return rules
    }

    const generateUserAnalysisPrompt = (user: any) => {
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

      if (currentRules.customPrompts?.userAnalysis) {
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
    }

    const generateGroupingPrompt = (profiles: any[], userData?: any[]) => {
      const currentRules = loadRules()
      let prompt = `请根据以下用户档案生成智能分组方案，每组${currentRules.hardRules?.groupSize || 6}人，返回JSON格式：

用户档案：
${profiles.map((p, i) => {
  const originalUser = userData?.[i] || {}
  return `
用户${i+1} (${p.user_id}):
- 基本信息: ${originalUser.自选昵称 || '未知'}, ${originalUser.年龄 || '?'}岁, ${originalUser.性别 || '未知'}
- 性格总结: ${p.personality_summary}
- 社交风格: ${p.social_style}
- 兴趣标签: ${p.interests?.join(', ') || '未知'}
- 能量水平: ${p.energy_level}
- 对话风格: ${p.conversation_style}
- 角色预测: ${p.group_role_prediction}
- 性格关键词: ${p.personality_keywords?.join(', ') || '未知'}`
}).join('\n')}

分组原则：

【硬性约束 - 必须严格遵守】
1. 每组必须恰好${currentRules.hardRules?.groupSize || 6}人
2. ⚠️ 重要：组内任意两人年龄差必须不超过${currentRules.hardRules?.maxAgeGap || 8}岁
3. ⚠️⚠️⚠️ 性别比例约束：混合模式，每组的性别比例只能是3男3女或2男4女`

      if (currentRules.customPrompts?.grouping) {
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
    }

    const generateEvaluationPrompt = (proposal: any) => {
      const currentRules = loadRules()
      let prompt = `请严格评估以下分组方案的质量，使用T46评分标准(0-10分)：

${proposal.groups?.map((group: any, i: number) => `
第${i+1}组 "${group.name}":
成员信息:
${group.members?.map((member: any, j: number) => `  ${j+1}. ${member.姓名 || '未知'} - 年龄:${member.年龄 || '?'} 性别:${member.性别 || '?'} 职业:${member.职业 || '?'}`).join('\n')}
组描述: ${group.description}
`).join('\n')}

评分标准：
【硬性约束检查 - 违反任一条直接扣3分以上】
- ⚠️ 年龄差必须≤${currentRules.hardRules?.maxAgeGap || 8}岁
- 人数必须=${currentRules.hardRules?.groupSize || 6}人
- 性别比例符合要求`

      if (currentRules.customPrompts?.evaluation) {
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
    }

    return { generateUserAnalysisPrompt, generateGroupingPrompt, generateEvaluationPrompt }
  }

  // 从localStorage加载规则
  useEffect(() => {
    const savedRules = localStorage.getItem('t46-matching-rules')
    if (savedRules) {
      try {
        setRules(JSON.parse(savedRules))
      } catch (error) {
        console.error('加载规则失败:', error)
      }
    }
  }, [])

  // 保存规则
  const saveRules = () => {
    localStorage.setItem('t46-matching-rules', JSON.stringify(rules))
    setHasChanges(false)
    alert('规则已保存！')
  }

  // 重置为默认
  const resetToDefault = () => {
    if (confirm('确定要重置为默认规则吗？')) {
      setRules(DEFAULT_RULES)
      setHasChanges(true)
    }
  }

  // 更新硬性规则
  const updateHardRule = (field: string, value: any) => {
    setRules(prev => ({
      ...prev,
      hardRules: {
        ...prev.hardRules,
        [field]: value
      }
    }))
    setHasChanges(true)
  }

  // 更新软性规则
  const updateSoftRule = (category: string, field: string, value: any) => {
    setRules(prev => ({
      ...prev,
      softRules: {
        ...prev.softRules,
        [category]: {
          ...prev.softRules[category as keyof typeof prev.softRules],
          [field]: value
        }
      }
    }))
    setHasChanges(true)
  }

  // 更新自定义Prompt
  const updateCustomPrompt = (field: string, value: string) => {
    setRules(prev => ({
      ...prev,
      customPrompts: {
        ...prev.customPrompts,
        [field]: value
      }
    }))
    setHasChanges(true)
  }

  // 更新评分标准
  const updateScoring = (field: string, value: number | boolean) => {
    setRules(prev => ({
      ...prev,
      scoring: {
        ...prev.scoring,
        [field]: value
      }
    }))
    setHasChanges(true)
  }

  return (
    <div className="rules-management">
      <div className="page-header">
        <h1 className="page-title">🛠️ 匹配规则管理</h1>
        <p className="page-subtitle">配置智能匹配的硬性规则、软性规则和评分标准</p>
      </div>

      {/* 标签页导航 */}
      <div className="rules-tabs">
        <div className="tabs-left">
          <button 
            className={`tab-btn ${activeTab === 'hard' ? 'active' : ''}`}
            onClick={() => setActiveTab('hard')}
          >
            <span className="tab-icon">🔧</span>
            <span className="tab-text">硬性规则</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'soft' ? 'active' : ''}`}
            onClick={() => setActiveTab('soft')}
          >
            <span className="tab-icon">🎯</span>
            <span className="tab-text">软性规则</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'scoring' ? 'active' : ''}`}
            onClick={() => setActiveTab('scoring')}
          >
            <span className="tab-icon">📊</span>
            <span className="tab-text">评分标准</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'prompts' ? 'active' : ''}`}
            onClick={() => setActiveTab('prompts')}
          >
            <span className="tab-icon">✨</span>
            <span className="tab-text">Prompt增强</span>
          </button>
        </div>
        
        {/* 操作按钮 - 与标签页同行 */}
        <div className="rules-actions">
          <button 
            className={`save-btn ${hasChanges ? 'has-changes' : ''}`}
            onClick={saveRules}
            disabled={!hasChanges}
          >
            {hasChanges ? '💾 保存更改' : '✅ 已保存'}
          </button>
          <button className="reset-btn" onClick={resetToDefault}>
            🔄 重置为默认
          </button>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="rules-content">

        {/* 硬性规则标签 */}
        {activeTab === 'hard' && (
        <div className="tab-content hard-rules">
          <div className="rules-section">
            <h3>基本配置</h3>
            <div className="rule-item">
              <label>
                <span className="rule-label">每组人数</span>
                <input
                  type="number"
                  min="2"
                  max="10"
                  value={rules.hardRules.groupSize}
                  onChange={(e) => updateHardRule('groupSize', parseInt(e.target.value))}
                  className="rule-input"
                />
                <span className="rule-hint">建议4-6人为最佳</span>
              </label>
            </div>
            
            <div className="rule-item">
              <label>
                <span className="rule-label">最大年龄差</span>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={rules.hardRules.maxAgeGap}
                  onChange={(e) => updateHardRule('maxAgeGap', parseInt(e.target.value))}
                  className="rule-input"
                />
                <span className="rule-hint">组内最大年龄-最小年龄</span>
              </label>
            </div>
          </div>

          <div className="rules-section">
            <h3>性别平衡配置</h3>
            <div className="gender-balance">
              <div className="balance-row">
                <span className="balance-label">理想比例</span>
                <div className="balance-inputs">
                  <label>
                    男性:
                    <input
                      type="number"
                      min="0"
                      max={rules.hardRules.groupSize}
                      value={rules.hardRules.genderBalance.ideal.male}
                      onChange={(e) => updateHardRule('genderBalance', {
                        ...rules.hardRules.genderBalance,
                        ideal: { ...rules.hardRules.genderBalance.ideal, male: parseInt(e.target.value) }
                      })}
                      className="gender-input"
                    />
                  </label>
                  <label>
                    女性:
                    <input
                      type="number"
                      min="0"
                      max={rules.hardRules.groupSize}
                      value={rules.hardRules.genderBalance.ideal.female}
                      onChange={(e) => updateHardRule('genderBalance', {
                        ...rules.hardRules.genderBalance,
                        ideal: { ...rules.hardRules.genderBalance.ideal, female: parseInt(e.target.value) }
                      })}
                      className="gender-input"
                    />
                  </label>
                </div>
              </div>
              
              <div className="balance-row">
                <span className="balance-label">可接受比例</span>
                <div className="balance-inputs">
                  <label>
                    男性:
                    <input
                      type="number"
                      min="0"
                      max={rules.hardRules.groupSize}
                      value={rules.hardRules.genderBalance.acceptable.male}
                      onChange={(e) => updateHardRule('genderBalance', {
                        ...rules.hardRules.genderBalance,
                        acceptable: { ...rules.hardRules.genderBalance.acceptable, male: parseInt(e.target.value) }
                      })}
                      className="gender-input"
                    />
                  </label>
                  <label>
                    女性:
                    <input
                      type="number"
                      min="0"
                      max={rules.hardRules.groupSize}
                      value={rules.hardRules.genderBalance.acceptable.female}
                      onChange={(e) => updateHardRule('genderBalance', {
                        ...rules.hardRules.genderBalance,
                        acceptable: { ...rules.hardRules.genderBalance.acceptable, female: parseInt(e.target.value) }
                      })}
                      className="gender-input"
                    />
                  </label>
                </div>
              </div>
              
              <div className="balance-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={rules.hardRules.genderBalance.strict}
                    onChange={(e) => updateHardRule('genderBalance', {
                      ...rules.hardRules.genderBalance,
                      strict: e.target.checked
                    })}
                  />
                  <span>严格执行性别比例（不满足直接否决）</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 软性规则标签 */}
      {activeTab === 'soft' && (
        <div className="tab-content soft-rules">
          {/* 兴趣匹配 */}
          <div className="rules-section">
            <h3>兴趣匹配</h3>
            <div className="rule-item">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={rules.softRules.interests.enabled}
                  onChange={(e) => updateSoftRule('interests', 'enabled', e.target.checked)}
                />
                <span>启用兴趣匹配</span>
              </label>
            </div>
            
            {rules.softRules.interests.enabled && (
              <>
                <div className="rule-item">
                  <label>
                    <span className="rule-label">最小兴趣重叠数</span>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={rules.softRules.interests.minOverlap}
                      onChange={(e) => updateSoftRule('interests', 'minOverlap', parseInt(e.target.value))}
                      className="rule-input"
                    />
                  </label>
                </div>
                
                <div className="rule-item">
                  <label>
                    <span className="rule-label">最大兴趣重叠数</span>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={rules.softRules.interests.maxOverlap}
                      onChange={(e) => updateSoftRule('interests', 'maxOverlap', parseInt(e.target.value))}
                      className="rule-input"
                    />
                  </label>
                </div>
                
                <div className="rule-item">
                  <label>
                    <span className="rule-label">权重 (0-1)</span>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={rules.softRules.interests.weight}
                      onChange={(e) => updateSoftRule('interests', 'weight', parseFloat(e.target.value))}
                      className="rule-input"
                    />
                  </label>
                </div>
              </>
            )}
          </div>

          {/* 社交风格 */}
          <div className="rules-section">
            <h3>社交风格平衡</h3>
            <div className="rule-item">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={rules.softRules.socialStyle.enabled}
                  onChange={(e) => updateSoftRule('socialStyle', 'enabled', e.target.checked)}
                />
                <span>启用社交风格平衡</span>
              </label>
            </div>
            
            {rules.softRules.socialStyle.enabled && (
              <>
                <div className="rule-item">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={rules.softRules.socialStyle.requireBalance}
                      onChange={(e) => updateSoftRule('socialStyle', 'requireBalance', e.target.checked)}
                    />
                    <span>要求风格平衡</span>
                  </label>
                </div>
                
                <div className="style-mix">
                  <span className="mix-label">理想组合</span>
                  <div className="mix-inputs">
                    <label>
                      主动发起者:
                      <input
                        type="number"
                        min="0"
                        max={rules.hardRules.groupSize}
                        value={rules.softRules.socialStyle.idealMix.initiators}
                        onChange={(e) => updateSoftRule('socialStyle', 'idealMix', {
                          ...rules.softRules.socialStyle.idealMix,
                          initiators: parseInt(e.target.value)
                        })}
                        className="mix-input"
                      />
                    </label>
                    <label>
                      积极参与者:
                      <input
                        type="number"
                        min="0"
                        max={rules.hardRules.groupSize}
                        value={rules.softRules.socialStyle.idealMix.participants}
                        onChange={(e) => updateSoftRule('socialStyle', 'idealMix', {
                          ...rules.softRules.socialStyle.idealMix,
                          participants: parseInt(e.target.value)
                        })}
                        className="mix-input"
                      />
                    </label>
                    <label>
                      善于倾听者:
                      <input
                        type="number"
                        min="0"
                        max={rules.hardRules.groupSize}
                        value={rules.softRules.socialStyle.idealMix.listeners}
                        onChange={(e) => updateSoftRule('socialStyle', 'idealMix', {
                          ...rules.softRules.socialStyle.idealMix,
                          listeners: parseInt(e.target.value)
                        })}
                        className="mix-input"
                      />
                    </label>
                  </div>
                </div>
                
                <div className="rule-item">
                  <label>
                    <span className="rule-label">权重 (0-1)</span>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={rules.softRules.socialStyle.weight}
                      onChange={(e) => updateSoftRule('socialStyle', 'weight', parseFloat(e.target.value))}
                      className="rule-input"
                    />
                  </label>
                </div>
              </>
            )}
          </div>

          {/* 能量水平 */}
          <div className="rules-section">
            <h3>能量水平分布</h3>
            <div className="rule-item">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={rules.softRules.energyLevel.enabled}
                  onChange={(e) => updateSoftRule('energyLevel', 'enabled', e.target.checked)}
                />
                <span>启用能量平衡</span>
              </label>
            </div>
            
            {rules.softRules.energyLevel.enabled && (
              <>
                <div className="rule-item">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={rules.softRules.energyLevel.requireBalance}
                      onChange={(e) => updateSoftRule('energyLevel', 'requireBalance', e.target.checked)}
                    />
                    <span>要求能量平衡</span>
                  </label>
                </div>
                
                <div className="energy-distribution">
                  <span className="dist-label">理想分布</span>
                  <div className="dist-inputs">
                    <label>
                      高能量:
                      <input
                        type="number"
                        min="0"
                        max={rules.hardRules.groupSize}
                        value={rules.softRules.energyLevel.distribution.high}
                        onChange={(e) => updateSoftRule('energyLevel', 'distribution', {
                          ...rules.softRules.energyLevel.distribution,
                          high: parseInt(e.target.value)
                        })}
                        className="dist-input"
                      />
                    </label>
                    <label>
                      中能量:
                      <input
                        type="number"
                        min="0"
                        max={rules.hardRules.groupSize}
                        value={rules.softRules.energyLevel.distribution.medium}
                        onChange={(e) => updateSoftRule('energyLevel', 'distribution', {
                          ...rules.softRules.energyLevel.distribution,
                          medium: parseInt(e.target.value)
                        })}
                        className="dist-input"
                      />
                    </label>
                    <label>
                      低能量:
                      <input
                        type="number"
                        min="0"
                        max={rules.hardRules.groupSize}
                        value={rules.softRules.energyLevel.distribution.low}
                        onChange={(e) => updateSoftRule('energyLevel', 'distribution', {
                          ...rules.softRules.energyLevel.distribution,
                          low: parseInt(e.target.value)
                        })}
                        className="dist-input"
                      />
                    </label>
                  </div>
                </div>
                
                <div className="rule-item">
                  <label>
                    <span className="rule-label">权重 (0-1)</span>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={rules.softRules.energyLevel.weight}
                      onChange={(e) => updateSoftRule('energyLevel', 'weight', parseFloat(e.target.value))}
                      className="rule-input"
                    />
                  </label>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Prompt增强标签 */}
      {activeTab === 'prompts' && (() => {
        const { generateUserAnalysisPrompt, generateGroupingPrompt, generateEvaluationPrompt } = createPromptGenerators()
        
        return (
          <div className="tab-content prompts">
            <div className="prompt-section">
              <h3>用户分析增强Prompt</h3>
              <p className="prompt-hint">添加额外的指令来优化用户档案分析</p>
              
              <div className="current-prompt-display">
                <h4>当前使用的完整Prompt：</h4>
                <pre className="prompt-preview">
                  {generateUserAnalysisPrompt({ 
                    姓名: '示例用户',
                    性别: '女',
                    年龄: 25,
                    职业: '产品经理',
                    城市: '北京',
                    兴趣爱好: '阅读、旅行、摄影'
                  })}
                </pre>
              </div>

              <div className="custom-prompt-input">
                <h4>自定义增强指令：</h4>
                <textarea
                  value={rules.customPrompts?.userAnalysis || ''}
                  onChange={(e) => updateCustomPrompt('userAnalysis', e.target.value)}
                  placeholder="例如：请特别关注用户的职业背景和生活方式..."
                  className="prompt-textarea"
                />
              </div>
            </div>
            
            <div className="prompt-section">
              <h3>分组生成增强Prompt</h3>
              <p className="prompt-hint">添加额外的分组策略指导</p>
              
              <div className="current-prompt-display">
                <h4>当前使用的完整Prompt：</h4>
                <pre className="prompt-preview">
                  {generateGroupingPrompt([
                    {
                      user_id: 'user_1',
                      personality_summary: '开朗外向，善于沟通的产品经理',
                      social_style: '主动发起者',
                      interests: ['阅读', '旅行'],
                      energy_level: '高能量',
                      conversation_style: '热情积极',
                      group_role_prediction: '组织者',
                      personality_keywords: ['外向', '领导力']
                    }
                  ], [
                    { 自选昵称: '示例用户1', 年龄: 25, 性别: '女' }
                  ])}
                </pre>
              </div>

              <div className="custom-prompt-input">
                <h4>自定义增强指令：</h4>
                <textarea
                  value={rules.customPrompts?.grouping || ''}
                  onChange={(e) => updateCustomPrompt('grouping', e.target.value)}
                  placeholder="例如：优先考虑地理位置接近的用户..."
                  className="prompt-textarea"
                />
              </div>
            </div>
            
            <div className="prompt-section">
              <h3>评估审核增强Prompt</h3>
              <p className="prompt-hint">添加额外的评分标准或注意事项</p>
              
              <div className="current-prompt-display">
                <h4>当前使用的完整Prompt：</h4>
                <pre className="prompt-preview">
                  {generateEvaluationPrompt({
                    groups: [
                      {
                        name: '示例组',
                        members: [
                          { 姓名: '用户1', 年龄: 25, 性别: '女', 职业: '产品经理' },
                          { 姓名: '用户2', 年龄: 27, 性别: '男', 职业: '设计师' }
                        ],
                        description: '活跃的创意组合'
                      }
                    ]
                  })}
                </pre>
              </div>

              <div className="custom-prompt-input">
                <h4>自定义增强指令：</h4>
                <textarea
                  value={rules.customPrompts?.evaluation || ''}
                  onChange={(e) => updateCustomPrompt('evaluation', e.target.value)}
                  placeholder="例如：严格检查是否有潜在的性格冲突..."
                  className="prompt-textarea"
                />
              </div>
            </div>
          </div>
        )
      })()}

      {/* 评分标准标签 */}
      {activeTab === 'scoring' && (
        <div className="tab-content scoring">
          <div className="scoring-section">
            <h3>分数阈值设置</h3>
            <div className="score-item">
              <label>
                <span className="score-label">通过分数线</span>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  value={rules.scoring.passThreshold}
                  onChange={(e) => updateScoring('passThreshold', parseFloat(e.target.value))}
                  className="score-input"
                />
                <span className="score-hint">低于此分数的组需要重新分配</span>
              </label>
            </div>
            
            <div className="score-item">
              <label>
                <span className="score-label">优秀分数线</span>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  value={rules.scoring.excellentThreshold}
                  onChange={(e) => updateScoring('excellentThreshold', parseFloat(e.target.value))}
                  className="score-input"
                />
                <span className="score-hint">达到此分数表示匹配质量优秀</span>
              </label>
            </div>
            
            <div className="score-item">
              <label>
                <span className="score-label">完美分数线</span>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  value={rules.scoring.perfectThreshold}
                  onChange={(e) => updateScoring('perfectThreshold', parseFloat(e.target.value))}
                  className="score-input"
                />
                <span className="score-hint">达到此分数表示近乎完美的匹配</span>
              </label>
            </div>
          </div>
          
          <div className="scoring-preview">
            <h3>评分等级预览</h3>
            <div className="score-levels">
              <div className="level fail">
                <span className="level-range">0 - {rules.scoring.passThreshold}</span>
                <span className="level-name">不合格</span>
              </div>
              <div className="level pass">
                <span className="level-range">{rules.scoring.passThreshold} - {rules.scoring.excellentThreshold}</span>
                <span className="level-name">合格</span>
              </div>
              <div className="level excellent">
                <span className="level-range">{rules.scoring.excellentThreshold} - {rules.scoring.perfectThreshold}</span>
                <span className="level-name">优秀</span>
              </div>
              <div className="level perfect">
                <span className="level-range">{rules.scoring.perfectThreshold} - 10</span>
                <span className="level-name">完美</span>
              </div>
            </div>
          </div>
        </div>
      )}
      </div> {/* 结束 rules-content */}
    </div>
  )
}

export default RulesManagement