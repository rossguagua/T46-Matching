import React, { useState, useEffect } from 'react'
import { useApiConfig } from '../hooks/useApiConfig'
import LLMAdapter from '../llm-adapter'

const LLMManagement: React.FC = () => {
  const {
    config,
    quotas,
    tests,
    loading,
    providers,
    updateProvider,
    setActiveProvider,
    testConnection,
    refreshQuotas,
    isConfigValid
  } = useApiConfig()

  const [showApiKey, setShowApiKey] = useState<{ [key: string]: boolean }>({})
  const [testingModel, setTestingModel] = useState<string | null>(null)
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null)

  useEffect(() => {
    refreshQuotas()
  }, [refreshQuotas])

  const handleApiKeyChange = (providerId: string, apiKey: string) => {
    updateProvider(providerId, { apiKey })
  }

  const handleProviderToggle = (providerId: string, enabled: boolean) => {
    updateProvider(providerId, { enabled })
    if (enabled && !config.providers[providerId]?.apiKey) {
      setExpandedProvider(providerId)
    }
  }

  const handleModelChange = (providerId: string, type: 'analysis' | 'generation' | 'review', modelId: string) => {
    const currentModels = config.providers[providerId]?.selectedModels || {}
    updateProvider(providerId, {
      selectedModels: { ...currentModels, [type]: modelId }
    })
  }

  const handleSetActive = (providerId: string) => {
    if (isConfigValid(providerId)) {
      setActiveProvider(providerId)
    }
  }

  const toggleApiKeyVisibility = (providerId: string) => {
    setShowApiKey(prev => ({ ...prev, [providerId]: !prev[providerId] }))
  }

  const handleTestModel = async (providerId: string, modelId: string) => {
    setTestingModel(`${providerId}-${modelId}`)
    await testConnection(providerId, modelId)
    setTestingModel(null)
  }

  const getProviderStatus = (providerId: string) => {
    const providerConfig = config.providers[providerId]
    if (!providerConfig?.apiKey) return 'no-key'
    if (!providerConfig.enabled) return 'disabled'
    if (config.activeProvider === providerId) return 'active'
    return 'ready'
  }

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'active': return '#28a745'
      case 'ready': return '#17a2b8'
      case 'disabled': return '#6c757d'
      case 'no-key': return '#dc3545'
      default: return '#6c757d'
    }
  }

  const getStatusText = (status: string) => {
    switch(status) {
      case 'active': return '当前使用中'
      case 'ready': return '已配置'
      case 'disabled': return '已禁用'
      case 'no-key': return '未配置密钥'
      default: return '未知'
    }
  }

  const getQuotaPercentage = (used: number, limit: number): number => {
    return Math.min(100, Math.round((used / limit) * 100))
  }

  const formatQuotaText = (quota: any): string => {
    if (!quota) return '未获取配额信息'
    if (quota.currency) {
      return `$${quota.used.toFixed(2)} / $${quota.limit} ${quota.currency}`
    }
    return `${quota.used} / ${quota.limit} 次`
  }

  const getTestStatus = (providerId: string, modelId: string) => {
    const testKey = `${providerId}-${modelId}`
    return tests[testKey]
  }

  return (
    <div className="llm-management">
      <div className="page-header">
        <h1 className="page-title">🤖 LLM API管理中心</h1>
        <p className="page-subtitle">配置AI服务提供商，管理API密钥和模型选择</p>
      </div>

      {/* 快速状态概览 */}
      <div className="status-overview">
        <div className="overview-card">
          <div className="overview-icon">🔑</div>
          <div className="overview-content">
            <div className="overview-value">
              {Object.values(config.providers).filter(p => p.apiKey).length} / {Object.keys(config.providers).length}
            </div>
            <div className="overview-label">已配置API</div>
          </div>
        </div>
        <div className="overview-card">
          <div className="overview-icon">✅</div>
          <div className="overview-content">
            <div className="overview-value" style={{ color: getStatusColor('active') }}>
              {config.activeProvider ? providers.find(p => p.id === config.activeProvider)?.displayName : '未选择'}
            </div>
            <div className="overview-label">当前提供商</div>
          </div>
        </div>
        <div className="overview-card">
          <div className="overview-icon">🚀</div>
          <div className="overview-content">
            <div className="overview-value">
              {Object.values(config.providers).filter(p => p.enabled).length}
            </div>
            <div className="overview-label">已启用服务</div>
          </div>
        </div>
      </div>

      {/* 提供商卡片列表 */}
      <div className="providers-grid">
        {providers.map(provider => {
          const providerConfig = config.providers[provider.id]
          const quota = quotas[provider.id]
          const status = getProviderStatus(provider.id)
          const isExpanded = expandedProvider === provider.id
          const isActive = config.activeProvider === provider.id

          return (
            <div 
              key={provider.id} 
              className={`provider-card-enhanced ${isActive ? 'active' : ''} ${status}`}
            >
              {/* 卡片头部 */}
              <div className="card-header">
                <div className="provider-identity">
                  <div className="provider-logo">
                    {provider.id === 'gemini' && '🔷'}
                    {provider.id === 'deepseek' && '🌊'}
                    {provider.id === 'openai' && '🤖'}
                  </div>
                  <div className="provider-details">
                    <h3 className="provider-name">{provider.displayName}</h3>
                    <span className="provider-status" style={{ color: getStatusColor(status) }}>
                      {getStatusText(status)}
                    </span>
                  </div>
                </div>
                
                <div className="card-actions">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={providerConfig?.enabled || false}
                      onChange={(e) => handleProviderToggle(provider.id, e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  
                  {isConfigValid(provider.id) && !isActive && (
                    <button
                      className="activate-btn"
                      onClick={() => handleSetActive(provider.id)}
                      disabled={!providerConfig?.enabled}
                    >
                      设为主要
                    </button>
                  )}
                  
                  <button
                    className="expand-btn"
                    onClick={() => setExpandedProvider(isExpanded ? null : provider.id)}
                  >
                    {isExpanded ? '收起' : '展开'}
                  </button>
                </div>
              </div>

              {/* API密钥配置区 */}
              <div className="api-key-section">
                <div className="section-title">
                  <span>API密钥</span>
                  {providerConfig?.apiKey && (
                    <span className="key-status">✅ 已配置</span>
                  )}
                </div>
                <div className="api-key-input-wrapper">
                  <input
                    type={showApiKey[provider.id] ? 'text' : 'password'}
                    value={providerConfig?.apiKey || ''}
                    onChange={(e) => handleApiKeyChange(provider.id, e.target.value)}
                    placeholder={`输入${provider.displayName} API密钥`}
                    className="api-key-input"
                  />
                  <button
                    className="visibility-toggle"
                    onClick={() => toggleApiKeyVisibility(provider.id)}
                    title={showApiKey[provider.id] ? '隐藏密钥' : '显示密钥'}
                  >
                    {showApiKey[provider.id] ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {/* 配额显示 */}
              {quota && (
                <div className="quota-section">
                  <div className="section-title">配额使用</div>
                  <div className="quota-display">
                    <div className="quota-bar-wrapper">
                      <div 
                        className="quota-bar-fill" 
                        style={{ 
                          width: `${getQuotaPercentage(quota.used, quota.limit)}%`,
                          backgroundColor: getQuotaPercentage(quota.used, quota.limit) > 80 ? '#dc3545' : '#28a745'
                        }}
                      />
                    </div>
                    <div className="quota-text">{formatQuotaText(quota)}</div>
                  </div>
                </div>
              )}

              {/* 展开的详细配置 */}
              {(isExpanded || isActive) && (
                <div className="expanded-config">
                  <div className="section-title">模型配置</div>
                  
                  <div className="model-config-grid">
                    {['analysis', 'generation', 'review'].map(taskType => (
                      <div key={taskType} className="model-config-item">
                        <label className="config-label">
                          {taskType === 'analysis' && '用户分析模型'}
                          {taskType === 'generation' && '方案生成模型'}
                          {taskType === 'review' && '审核评分模型'}
                        </label>
                        <select
                          value={providerConfig?.selectedModels?.[taskType as keyof typeof providerConfig.selectedModels] || ''}
                          onChange={(e) => handleModelChange(provider.id, taskType as any, e.target.value)}
                          className="model-select"
                        >
                          <option value="">选择模型</option>
                          {provider.models.filter(m => m.type === 'universal' || m.type === taskType).map(model => (
                            <option key={model.id} value={model.id}>
                              {model.displayName}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  {/* 模型测试区 */}
                  <div className="model-test-section">
                    <div className="section-title">模型测试</div>
                    <div className="test-grid">
                      {provider.models.map(model => {
                        const testStatus = getTestStatus(provider.id, model.id)
                        const isTestingThis = testingModel === `${provider.id}-${model.id}`
                        
                        return (
                          <div key={model.id} className="test-item">
                            <div className="test-model-info">
                              <span className="model-name">{model.displayName}</span>
                              <span className="model-params">
                                {model.maxTokens} tokens | temp: {model.temperature}
                              </span>
                            </div>
                            
                            <div className="test-actions">
                              {testStatus && (
                                <span className={`test-status ${testStatus.status}`}>
                                  {testStatus.status === 'success' && '✅'}
                                  {testStatus.status === 'error' && '❌'}
                                  {testStatus.status === 'pending' && '⏳'}
                                  {testStatus.responseTime && ` ${testStatus.responseTime}ms`}
                                </span>
                              )}
                              
                              <button
                                className="test-btn"
                                onClick={() => handleTestModel(provider.id, model.id)}
                                disabled={!providerConfig?.apiKey || isTestingThis}
                              >
                                {isTestingThis ? '测试中...' : '测试'}
                              </button>
                            </div>
                            
                            {testStatus?.error && (
                              <div className="test-error">{testStatus.error}</div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 帮助提示 */}
      <div className="help-section">
        <h3>💡 快速帮助</h3>
        <div className="help-grid">
          <div className="help-item">
            <strong>获取API密钥：</strong>
            <ul>
              <li>Gemini: <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a></li>
              <li>DeepSeek: <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer">DeepSeek Platform</a></li>
              <li>OpenAI: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">OpenAI Platform</a></li>
            </ul>
          </div>
          <div className="help-item">
            <strong>模型选择建议：</strong>
            <ul>
              <li>用户分析: 选择快速模型 (Flash/Mini)</li>
              <li>方案生成: 选择强大模型 (Pro/GPT-4)</li>
              <li>审核评分: 选择稳定模型 (低temperature)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LLMManagement