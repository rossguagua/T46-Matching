import React, { useState, useEffect } from 'react'
import { MatchingRules, DEFAULT_RULES } from '../types/rules'

const RulesManagement: React.FC = () => {
  const [rules, setRules] = useState<MatchingRules>(DEFAULT_RULES)
  const [hasChanges, setHasChanges] = useState(false)
  const [activeTab, setActiveTab] = useState<'hard' | 'soft' | 'prompts' | 'scoring'>('hard')

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
  const updateScoring = (field: string, value: number) => {
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
        <h1 className="page-title">⚙️ 匹配规则管理</h1>
        <p className="page-subtitle">配置智能匹配的硬性规则、软性规则和评分标准</p>
      </div>

      {/* 操作按钮 */}
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

      {/* 标签页导航 */}
      <div className="rules-tabs">
        <button 
          className={`tab ${activeTab === 'hard' ? 'active' : ''}`}
          onClick={() => setActiveTab('hard')}
        >
          硬性规则
        </button>
        <button 
          className={`tab ${activeTab === 'soft' ? 'active' : ''}`}
          onClick={() => setActiveTab('soft')}
        >
          软性规则
        </button>
        <button 
          className={`tab ${activeTab === 'prompts' ? 'active' : ''}`}
          onClick={() => setActiveTab('prompts')}
        >
          Prompt增强
        </button>
        <button 
          className={`tab ${activeTab === 'scoring' ? 'active' : ''}`}
          onClick={() => setActiveTab('scoring')}
        >
          评分标准
        </button>
      </div>

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
      {activeTab === 'prompts' && (
        <div className="tab-content prompts">
          <div className="prompt-section">
            <h3>用户分析增强Prompt</h3>
            <p className="prompt-hint">添加额外的指令来优化用户档案分析</p>
            <textarea
              value={rules.customPrompts.userAnalysis}
              onChange={(e) => updateCustomPrompt('userAnalysis', e.target.value)}
              placeholder="例如：请特别关注用户的职业背景和生活方式..."
              className="prompt-textarea"
            />
          </div>
          
          <div className="prompt-section">
            <h3>分组生成增强Prompt</h3>
            <p className="prompt-hint">添加额外的分组策略指导</p>
            <textarea
              value={rules.customPrompts.grouping}
              onChange={(e) => updateCustomPrompt('grouping', e.target.value)}
              placeholder="例如：优先考虑地理位置接近的用户..."
              className="prompt-textarea"
            />
          </div>
          
          <div className="prompt-section">
            <h3>评估审核增强Prompt</h3>
            <p className="prompt-hint">添加额外的评分标准或注意事项</p>
            <textarea
              value={rules.customPrompts.evaluation}
              onChange={(e) => updateCustomPrompt('evaluation', e.target.value)}
              placeholder="例如：严格检查是否有潜在的性格冲突..."
              className="prompt-textarea"
            />
          </div>
        </div>
      )}

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
    </div>
  )
}

export default RulesManagement