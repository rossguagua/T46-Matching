import React, { useState, useCallback } from 'react'
import { useUserDimensions } from '../hooks/useUserDimensions'
import { DimensionAnalysisConfig, DEFAULT_DIMENSION_CONFIG } from '../types/userDimensions'
import '../styles/PromptEnhancement.css'

const PromptEnhancement: React.FC = () => {
  const { config, saveConfig } = useUserDimensions()
  const [localConfig, setLocalConfig] = useState<DimensionAnalysisConfig>(config)
  const [hasChanges, setHasChanges] = useState(false)
  const [activeTab, setActiveTab] = useState<keyof DimensionAnalysisConfig>('masterPrompt')
  const [testData, setTestData] = useState('')
  const [testResult, setTestResult] = useState('')
  const [isTesting, setIsTesting] = useState(false)

  // 更新配置
  const updateConfig = useCallback((key: keyof DimensionAnalysisConfig, value: string) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }, [])

  // 保存配置
  const handleSave = useCallback(() => {
    saveConfig(localConfig)
    setHasChanges(false)
  }, [localConfig, saveConfig])

  // 重置为默认
  const handleReset = useCallback(() => {
    if (confirm('确定要重置为默认配置吗？这将覆盖所有自定义设置。')) {
      setLocalConfig(DEFAULT_DIMENSION_CONFIG)
      setHasChanges(true)
    }
  }, [])

  // 测试提示词
  const handleTest = useCallback(async () => {
    if (!testData.trim()) {
      alert('请输入测试数据')
      return
    }

    setIsTesting(true)
    try {
      // 模拟测试结果
      await new Promise(resolve => setTimeout(resolve, 2000))
      setTestResult(`{
  "userId": "test_user_001",
  "name": "测试用户",
  "extroversion": {
    "score": 7,
    "label": "中开朗",
    "sources": ["基于问卷回答分析社交倾向", "交朋友能量指数显示中等偏高"]
  },
  "thinkingStyle": {
    "type": "balanced",
    "score": 6,
    "confidence": 0.8,
    "traits": ["理性与感性并重", "决策时会综合考虑"]
  },
  "topicPreference": {
    "primary": "生活分享型",
    "secondary": "创意文化型",
    "keywords": ["日常生活", "创意", "艺术", "分享"],
    "diversity": 7
  },
  "socialMotivation": {
    "type": "recharge",
    "intensity": 6,
    "description": "寻求情感支持和陪伴，希望在社交中获得能量补充",
    "keywords": ["陪伴", "支持", "共鸣"]
  }
}`)
    } catch (error) {
      setTestResult(`测试失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setIsTesting(false)
    }
  }, [testData])

  const tabs = [
    { 
      key: 'masterPrompt', 
      icon: '🎯', 
      label: '主提示词', 
      description: '整合所有维度的核心分析提示词',
      category: 'main'
    },
    { 
      key: 'extroversionPrompt', 
      icon: '😊', 
      label: '开朗程度', 
      description: '分析用户外向程度和社交倾向',
      category: 'dimension'
    },
    { 
      key: 'thinkingStylePrompt', 
      icon: '🧠', 
      label: '思维风格', 
      description: '判断理性、感性或平衡型思维',
      category: 'dimension'
    },
    { 
      key: 'topicPreferencePrompt', 
      icon: '💬', 
      label: '话题偏好', 
      description: '分析用户的话题兴趣类型',
      category: 'dimension'
    },
    { 
      key: 'socialMotivationPrompt', 
      icon: '🎪', 
      label: '社交动机', 
      description: '判断社交参与的内在动机',
      category: 'dimension'
    }
  ] as const

  return (
    <div className="prompt-enhancement">
      {/* 页面头部 */}
      <div className="page-header">
        <div>
          <h1 className="page-title">🚀 Prompt强化</h1>
          <p className="page-subtitle">配置用户维度分析的AI提示词，优化心理画像生成质量</p>
        </div>
        <div className="header-actions">
          <div className="config-status">
            {hasChanges && (
              <span className="unsaved-indicator">
                <span className="indicator-dot"></span>
                未保存的更改
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 标签页导航 */}
      <div className="prompt-tabs">
        <div className="tabs-left">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-text">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="tabs-actions">
          {hasChanges && (
            <button className="save-btn" onClick={handleSave}>
              <span>💾</span>
              保存更改
            </button>
          )}
          <button className="reset-btn" onClick={handleReset}>
            <span>🔄</span>
            重置默认
          </button>
        </div>
      </div>

      {/* 主内容区 - 规则管理风格的宽容器布局 */}
      <div className="prompt-content">
        {/* 提示词编辑器区域 */}
        <div className="prompt-section">
          <div className="section-header">
            <div className="section-title">
              <span className="section-icon">{tabs.find(t => t.key === activeTab)?.icon}</span>
              <div>
                <h3>{tabs.find(t => t.key === activeTab)?.label}</h3>
                <p className="section-description">{tabs.find(t => t.key === activeTab)?.description}</p>
              </div>
            </div>
            <div className="section-meta">
              <span className="char-count">
                {localConfig[activeTab].length} 字符
              </span>
            </div>
          </div>

          <div className="editor-container">
            <textarea
              className="prompt-editor"
              value={localConfig[activeTab]}
              onChange={(e) => updateConfig(activeTab, e.target.value)}
              placeholder="输入提示词内容..."
              rows={20}
            />
          </div>

          {/* 编写提示 */}
          <div className="editor-tips">
            <div className="tips-header">
              <span className="tips-icon">💡</span>
              <strong>编写提示词技巧</strong>
            </div>
            <ul className="tips-list">
              <li>使用明确的指令和示例格式</li>
              <li>在主提示词中使用 <code>{'{userData}'}</code> 占位符</li>
              <li>提供具体的评分标准和分类依据</li>
              <li>要求返回标准JSON格式以便解析</li>
              <li>避免过于复杂的嵌套指令</li>
            </ul>
          </div>
        </div>

        {/* 测试区域 - 只在主提示词页面显示 */}
        {activeTab === 'masterPrompt' && (
          <div className="prompt-section">
            <div className="section-header">
              <div className="section-title">
                <span className="section-icon">🧪</span>
                <div>
                  <h3>提示词测试</h3>
                  <p className="section-description">使用真实数据测试提示词效果</p>
                </div>
              </div>
            </div>

            <div className="test-container">
              <div className="test-grid">
                <div className="test-input-section">
                  <label className="test-label">测试数据 (JSON格式)</label>
                  <textarea
                    className="test-input"
                    value={testData}
                    onChange={(e) => setTestData(e.target.value)}
                    placeholder={`输入用户问卷数据进行测试，例如：
{
  "自选昵称": "测试用户",
  "性别": "女",
  "年龄": 25,
  "当你失去能量时你更倾向": "独处",
  "对于现场话题和游戏的开放程度，你的接受度": "7",
  "你的交朋友能量指数是：": "6",
  "当你对事物进行判断时，更多基于": "感觉和直觉",
  "最近你专注于": "个人成长",
  "职业": "设计师",
  "你更想和大家聊的话题是": "创意和艺术",
  "兴趣爱好": "绘画、音乐",
  "情感气象": "期待新的连接"
}`}
                    rows={10}
                  />
                </div>

                <div className="test-result-section">
                  <div className="test-actions">
                    <button 
                      className={`test-btn ${isTesting ? 'testing' : ''}`}
                      onClick={handleTest}
                      disabled={isTesting || !testData.trim()}
                    >
                      {isTesting ? (
                        <>
                          <span className="loading-spinner"></span>
                          分析中...
                        </>
                      ) : (
                        <>
                          <span>🔍</span>
                          开始测试分析
                        </>
                      )}
                    </button>
                  </div>

                  {testResult && (
                    <div className="test-result">
                      <div className="result-header">
                        <span className="result-icon">📊</span>
                        <strong>分析结果</strong>
                      </div>
                      <pre className="result-content">{testResult}</pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 配置帮助 - 只在维度页面显示 */}
        {activeTab !== 'masterPrompt' && (
          <div className="prompt-section">
            <div className="section-header">
              <div className="section-title">
                <span className="section-icon">❓</span>
                <div>
                  <h3>配置说明</h3>
                  <p className="section-description">该维度的分析要点和配置建议</p>
                </div>
              </div>
            </div>

            <div className="help-content">
              {activeTab === 'extroversionPrompt' && (
                <div className="help-item">
                  <h4>🎯 分析要点</h4>
                  <ul>
                    <li><strong>关键字段：</strong>当你失去能量时你更倾向、开放程度接受度、交朋友能量指数</li>
                    <li><strong>评分范围：</strong>1-10分，10分表示最开朗外向</li>
                    <li><strong>分类标准：</strong>高开朗(8-10) / 中开朗(5-7) / 内向型(1-4)</li>
                  </ul>
                  <h4>📝 输出格式</h4>
                  <pre className="format-example">{`{
  "score": 7,
  "label": "中开朗",
  "sources": ["推断依据1", "推断依据2"]
}`}</pre>
                </div>
              )}

              {activeTab === 'thinkingStylePrompt' && (
                <div className="help-item">
                  <h4>🎯 分析要点</h4>
                  <ul>
                    <li><strong>关键字段：</strong>判断基于什么、最近专注于、职业信息</li>
                    <li><strong>类型分类：</strong>rational(理性) / intuitive(感性) / balanced(平衡)</li>
                    <li><strong>评分对应：</strong>1-3理性型，4-7平衡型，8-10感性型</li>
                  </ul>
                  <h4>📝 输出格式</h4>
                  <pre className="format-example">{`{
  "type": "balanced",
  "score": 6,
  "confidence": 0.8,
  "traits": ["特征1", "特征2"]
}`}</pre>
                </div>
              )}

              {activeTab === 'topicPreferencePrompt' && (
                <div className="help-item">
                  <h4>🎯 分析要点</h4>
                  <ul>
                    <li><strong>关键字段：</strong>想聊的话题、兴趣爱好、情感气象</li>
                    <li><strong>类型分类：</strong>深度探索型 / 生活分享型 / 创意文化型</li>
                    <li><strong>多样性：</strong>1-10分评估话题广度和包容性</li>
                  </ul>
                  <h4>📝 输出格式</h4>
                  <pre className="format-example">{`{
  "primary": "生活分享型",
  "secondary": "创意文化型",
  "keywords": ["关键词1", "关键词2"],
  "diversity": 7
}`}</pre>
                </div>
              )}

              {activeTab === 'socialMotivationPrompt' && (
                <div className="help-item">
                  <h4>🎯 分析要点</h4>
                  <ul>
                    <li><strong>关键字段：</strong>情感气象、整体语调和表达方式</li>
                    <li><strong>类型分类：</strong>expand(扩展型) / recharge(充电型) / explore(探索型)</li>
                    <li><strong>强度评估：</strong>1-10分表示社交动机的强烈程度</li>
                  </ul>
                  <h4>📝 输出格式</h4>
                  <pre className="format-example">{`{
  "type": "recharge",
  "intensity": 6,
  "description": "详细描述",
  "keywords": ["关键词1", "关键词2"]
}`}</pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PromptEnhancement