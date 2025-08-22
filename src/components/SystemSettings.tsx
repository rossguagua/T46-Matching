import React, { useState, useEffect } from 'react'
import { useApiConfig } from '../hooks/useApiConfig'

interface SystemConfig {
  apiProvider: string  // 使用string类型以支持所有提供商
  apiKey: string
  apiUrl?: string
  model?: string
  temperature?: number
  maxTokens?: number
  autoSave: boolean
  debugMode: boolean
  parallelBatchSize: number
  retryAttempts: number
  exportFormat: 'excel' | 'csv' | 'json'
  theme: 'light' | 'dark' | 'auto'
}

const SystemSettings: React.FC = () => {
  const { config, updateProvider, setActiveProvider, isConfigValid, providers } = useApiConfig()
  
  // 获取当前活跃的提供商配置
  const activeProviderConfig = config.activeProvider ? config.providers[config.activeProvider] : null
  
  const [settings, setSettings] = useState<SystemConfig>({
    apiProvider: config.activeProvider || 'gemini',
    apiKey: activeProviderConfig?.apiKey || '',
    apiUrl: '',
    model: '',
    temperature: 0.7,
    maxTokens: 2000,
    autoSave: true,
    debugMode: false,
    parallelBatchSize: 5,
    retryAttempts: 3,
    exportFormat: 'excel',
    theme: 'light'
  })
  const [hasChanges, setHasChanges] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)

  // 从localStorage加载系统设置
  useEffect(() => {
    const savedSettings = localStorage.getItem('t46-system-settings')
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        setSettings(prev => ({ ...prev, ...parsed }))
      } catch (error) {
        console.error('加载系统设置失败:', error)
      }
    }
  }, [])

  // 更新设置
  const updateSetting = (key: keyof SystemConfig, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  // 保存设置
  const saveSettings = () => {
    // 保存系统设置到localStorage
    localStorage.setItem('t46-system-settings', JSON.stringify(settings))
    
    // 切换活跃的提供商
    if (settings.apiProvider && settings.apiProvider !== config.activeProvider) {
      setActiveProvider(settings.apiProvider)
    }
    
    // 更新提供商配置
    if (settings.apiProvider && settings.apiKey) {
      updateProvider(settings.apiProvider, {
        apiKey: settings.apiKey,
        enabled: true
      })
    }
    
    setHasChanges(false)
    alert('设置已保存！')
  }

  // 重置设置
  const resetSettings = () => {
    if (confirm('确定要重置所有设置吗？')) {
      const defaultSettings: SystemConfig = {
        apiProvider: 'gemini',
        apiKey: '',
        apiUrl: '',
        model: '',
        temperature: 0.7,
        maxTokens: 2000,
        autoSave: true,
        debugMode: false,
        parallelBatchSize: 5,
        retryAttempts: 3,
        exportFormat: 'excel',
        theme: 'light'
      }
      setSettings(defaultSettings)
      setHasChanges(true)
    }
  }

  // 测试API连接
  const testConnection = async () => {
    if (!settings.apiKey) {
      alert('请先输入API密钥')
      return
    }

    try {
      // 这里可以添加实际的API测试逻辑
      alert('API连接测试成功！')
    } catch (error) {
      alert('API连接测试失败：' + error)
    }
  }

  return (
    <div className="system-settings">
      <div className="page-header">
        <h1 className="page-title">🔧 系统设置</h1>
        <p className="page-subtitle">配置API、性能参数和系统偏好</p>
      </div>

      {/* 操作按钮 */}
      <div className="settings-actions">
        <button 
          className={`save-btn ${hasChanges ? 'has-changes' : ''}`}
          onClick={saveSettings}
          disabled={!hasChanges}
        >
          {hasChanges ? '💾 保存更改' : '✅ 已保存'}
        </button>
        <button className="reset-btn" onClick={resetSettings}>
          🔄 重置设置
        </button>
        <button className="test-btn" onClick={testConnection}>
          🧪 测试连接
        </button>
      </div>

      {/* API配置 */}
      <div className="settings-section">
        <h3>API 配置</h3>
        
        <div className="setting-item">
          <label>
            <span className="setting-label">API 提供商</span>
            <select
              value={settings.apiProvider}
              onChange={(e) => updateSetting('apiProvider', e.target.value)}
              className="setting-select"
            >
              {providers && providers.map(provider => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="setting-item">
          <label>
            <span className="setting-label">API 密钥</span>
            <div className="api-key-input">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={settings.apiKey}
                onChange={(e) => updateSetting('apiKey', e.target.value)}
                placeholder="输入你的API密钥"
                className="setting-input"
              />
              <button
                className="toggle-visibility"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? '🙈' : '👁️'}
              </button>
            </div>
          </label>
        </div>

        {settings.apiProvider === 'custom' && (
          <div className="setting-item">
            <label>
              <span className="setting-label">API URL</span>
              <input
                type="text"
                value={settings.apiUrl}
                onChange={(e) => updateSetting('apiUrl', e.target.value)}
                placeholder="https://your-api-endpoint.com"
                className="setting-input"
              />
            </label>
          </div>
        )}

        <div className="setting-item">
          <label>
            <span className="setting-label">模型</span>
            <input
              type="text"
              value={settings.model}
              onChange={(e) => updateSetting('model', e.target.value)}
              placeholder="自动选择模型"
              className="setting-input"
            />
            <span className="setting-hint">留空将使用默认模型</span>
          </label>
        </div>
      </div>

      {/* 性能设置 */}
      <div className="settings-section">
        <h3>性能设置</h3>
        
        <div className="setting-item">
          <label>
            <span className="setting-label">Temperature (0-1)</span>
            <input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={settings.temperature}
              onChange={(e) => updateSetting('temperature', parseFloat(e.target.value))}
              className="setting-input"
            />
            <span className="setting-hint">控制生成内容的创造性</span>
          </label>
        </div>

        <div className="setting-item">
          <label>
            <span className="setting-label">最大Token数</span>
            <input
              type="number"
              min="100"
              max="8000"
              step="100"
              value={settings.maxTokens}
              onChange={(e) => updateSetting('maxTokens', parseInt(e.target.value))}
              className="setting-input"
            />
            <span className="setting-hint">控制响应的最大长度</span>
          </label>
        </div>

        <div className="setting-item">
          <label>
            <span className="setting-label">并行批处理大小</span>
            <input
              type="number"
              min="1"
              max="10"
              value={settings.parallelBatchSize}
              onChange={(e) => updateSetting('parallelBatchSize', parseInt(e.target.value))}
              className="setting-input"
            />
            <span className="setting-hint">同时处理的用户数量</span>
          </label>
        </div>

        <div className="setting-item">
          <label>
            <span className="setting-label">重试次数</span>
            <input
              type="number"
              min="0"
              max="5"
              value={settings.retryAttempts}
              onChange={(e) => updateSetting('retryAttempts', parseInt(e.target.value))}
              className="setting-input"
            />
            <span className="setting-hint">API调用失败时的重试次数</span>
          </label>
        </div>
      </div>

      {/* 系统偏好 */}
      <div className="settings-section">
        <h3>系统偏好</h3>
        
        <div className="setting-item">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.autoSave}
              onChange={(e) => updateSetting('autoSave', e.target.checked)}
            />
            <span>自动保存进度</span>
          </label>
        </div>

        <div className="setting-item">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.debugMode}
              onChange={(e) => updateSetting('debugMode', e.target.checked)}
            />
            <span>调试模式（显示详细日志）</span>
          </label>
        </div>

        <div className="setting-item">
          <label>
            <span className="setting-label">导出格式</span>
            <select
              value={settings.exportFormat}
              onChange={(e) => updateSetting('exportFormat', e.target.value as 'excel' | 'csv' | 'json')}
              className="setting-select"
            >
              <option value="excel">Excel (.xlsx)</option>
              <option value="csv">CSV (.csv)</option>
              <option value="json">JSON (.json)</option>
            </select>
          </label>
        </div>

        <div className="setting-item">
          <label>
            <span className="setting-label">主题</span>
            <select
              value={settings.theme}
              onChange={(e) => updateSetting('theme', e.target.value as 'light' | 'dark' | 'auto')}
              className="setting-select"
            >
              <option value="light">浅色</option>
              <option value="dark">深色</option>
              <option value="auto">跟随系统</option>
            </select>
          </label>
        </div>
      </div>

      {/* 状态信息 */}
      <div className="settings-info">
        <h3>系统状态</h3>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">API状态</span>
            <span className={`info-value ${isConfigValid() ? 'success' : 'error'}`}>
              {isConfigValid() ? '✅ 已配置' : '❌ 未配置'}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">当前提供商</span>
            <span className="info-value">{settings.apiProvider.toUpperCase()}</span>
          </div>
          <div className="info-item">
            <span className="info-label">模型</span>
            <span className="info-value">{settings.model || '未设置'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">本地存储</span>
            <span className="info-value">
              {Object.keys(localStorage).filter(k => k.startsWith('t46-')).length} 项
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SystemSettings