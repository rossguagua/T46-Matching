import { useState, useEffect, useCallback } from 'react'
import { ApiConfig, ApiProvider, ApiQuota, ApiTest } from '../types/api'

// API提供商预设配置
export const API_PROVIDERS: ApiProvider[] = [
  {
    id: 'gemini',
    name: 'gemini',
    displayName: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    quotaEndpoint: '/v1beta/models',
    testPrompt: '请简单回复"连接测试成功"',
    models: [
      {
        id: 'gemini-2.5-pro',
        name: 'gemini-2.5-pro',
        displayName: 'Gemini 2.5 Pro (最强)',
        type: 'universal',
        maxTokens: 4000,
        temperature: 0.1
      },
      {
        id: 'gemini-2.5-flash',
        name: 'gemini-2.5-flash',
        displayName: 'Gemini 2.5 Flash (平衡)',
        type: 'universal',
        maxTokens: 8000,
        temperature: 0.2
      },
      {
        id: 'gemini-2.5-flash-lite',
        name: 'gemini-2.5-flash-lite',
        displayName: 'Gemini 2.5 Flash Lite (快速)',
        type: 'universal',
        maxTokens: 1500,
        temperature: 0.2
      },
      {
        id: 'gemini-1.5-pro',
        name: 'gemini-1.5-pro',
        displayName: 'Gemini 1.5 Pro (稳定)',
        type: 'universal',
        maxTokens: 2000,
        temperature: 0.1
      },
      {
        id: 'gemini-1.5-flash',
        name: 'gemini-1.5-flash',
        displayName: 'Gemini 1.5 Flash (经济)',
        type: 'universal',
        maxTokens: 1500,
        temperature: 0.2
      }
    ]
  },
  {
    id: 'deepseek',
    name: 'deepseek',
    displayName: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    testPrompt: 'Please reply with "Connection test successful"',
    models: [
      {
        id: 'deepseek-v3',
        name: 'deepseek-v3',
        displayName: 'DeepSeek V3',
        type: 'universal',
        maxTokens: 2000,
        temperature: 0.1
      }
    ]
  },
  {
    id: 'openai',
    name: 'openai',
    displayName: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    testPrompt: 'Please reply with "Connection test successful"',
    models: [
      {
        id: 'gpt-4o',
        name: 'gpt-4o',
        displayName: 'GPT-4O',
        type: 'universal',
        maxTokens: 2000,
        temperature: 0.1
      },
      {
        id: 'gpt-4o-mini',
        name: 'gpt-4o-mini',
        displayName: 'GPT-4O Mini',
        type: 'universal',
        maxTokens: 1000,
        temperature: 0.2
      }
    ]
  }
]

// 默认配置 - 使用实际存在的模型
const DEFAULT_CONFIG: ApiConfig = {
  providers: {
    gemini: {
      apiKey: '',
      enabled: true,
      selectedModels: {
        analysis: 'gemini-2.5-flash-lite',
        generation: 'gemini-2.5-pro', 
        review: 'gemini-2.5-pro'
      }
    },
    deepseek: {
      apiKey: '',
      enabled: false,
      selectedModels: {
        analysis: 'deepseek-v3',
        generation: 'deepseek-v3',
        review: 'deepseek-v3'
      }
    },
    openai: {
      apiKey: '',
      enabled: false,
      selectedModels: {
        analysis: 'gpt-4o-mini',
        generation: 'gpt-4o',
        review: 'gpt-4o'
      }
    }
  },
  activeProvider: 'gemini',
  lastUpdated: Date.now()
}


export const useApiConfig = () => {
  const [config, setConfig] = useState<ApiConfig>(DEFAULT_CONFIG)
  const [quotas, setQuotas] = useState<{ [providerId: string]: ApiQuota }>({})
  const [tests, setTests] = useState<{ [key: string]: ApiTest }>({})
  const [loading, setLoading] = useState(false)

  // 从localStorage加载配置
  const loadConfig = useCallback(() => {
    try {
      const saved = localStorage.getItem('t46-api-config')
      if (saved) {
        const parsed = JSON.parse(saved)
        const loadedConfig = { ...parsed }
        Object.keys(loadedConfig.providers || {}).forEach(providerId => {
          // 确保selectedModels存在且使用有效的模型
          if (!loadedConfig.providers[providerId]?.selectedModels) {
            loadedConfig.providers[providerId] = {
              ...loadedConfig.providers[providerId],
              selectedModels: DEFAULT_CONFIG.providers[providerId]?.selectedModels || {}
            }
          }
        })
        // 合并配置，保留默认值
        setConfig({
          ...DEFAULT_CONFIG,
          ...loadedConfig,
          providers: {
            ...DEFAULT_CONFIG.providers,
            ...loadedConfig.providers
          }
        })
      } else {
        setConfig(DEFAULT_CONFIG)
      }
    } catch (error) {
      console.error('加载API配置失败:', error)
      setConfig(DEFAULT_CONFIG)
    }
  }, [])

  // 保存配置到localStorage
  const saveConfig = useCallback((newConfig: ApiConfig) => {
    try {
      const toSave = { ...newConfig }
      toSave.lastUpdated = Date.now()
      localStorage.setItem('t46-api-config', JSON.stringify(toSave))
      setConfig(newConfig)
    } catch (error) {
      console.error('保存API配置失败:', error)
    }
  }, [])

  // 更新提供商配置
  const updateProvider = useCallback((providerId: string, updates: Partial<ApiConfig['providers'][string]>) => {
    const newConfig = {
      ...config,
      providers: {
        ...config.providers,
        [providerId]: {
          ...config.providers[providerId],
          ...updates
        }
      }
    }
    saveConfig(newConfig)
  }, [config, saveConfig])

  // 切换激活的提供商
  const setActiveProvider = useCallback((providerId: string) => {
    const newConfig = { ...config, activeProvider: providerId }
    saveConfig(newConfig)
  }, [config, saveConfig])

  // 测试API连接
  const testConnection = useCallback(async (providerId: string, modelId: string): Promise<boolean> => {
    const testKey = `${providerId}-${modelId}`
    setTests(prev => ({
      ...prev,
      [testKey]: {
        providerId,
        modelId,
        status: 'pending',
        timestamp: Date.now()
      }
    }))

    try {
      // 真实的API测试调用
      const provider = API_PROVIDERS.find(p => p.id === providerId)
      const providerConfig = config.providers[providerId]
      
      if (!provider || !providerConfig?.apiKey) {
        throw new Error('API配置不完整')
      }

      // 动态导入LLMAdapter
      const { default: LLMAdapter } = await import('../llm-adapter')
      const llmAdapter = new LLMAdapter()
      
      const startTime = Date.now()
      const result = await llmAdapter.generateContent(provider.testPrompt, {
        provider: providerId as any,
        model: modelId,
        temperature: 0.1,
        maxTokens: 50,
        apiKey: providerConfig.apiKey
      })

      const responseTime = Date.now() - startTime

      if (result.error) {
        throw new Error(result.error)
      }

      if (!result.text) {
        throw new Error('API响应内容为空')
      }
      
      setTests(prev => ({
        ...prev,
        [testKey]: {
          ...prev[testKey],
          status: 'success',
          responseTime,
          response: result.text.substring(0, 100) // 保存前100字符作为测试结果
        }
      }))
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      setTests(prev => ({
        ...prev,
        [testKey]: {
          ...prev[testKey],
          status: 'error',
          error: errorMessage
        }
      }))
      return false
    }
  }, [config])

  // 获取配额信息
  const refreshQuotas = useCallback(async () => {
    setLoading(true)
    try {
      // 这里会实现实际的配额查询逻辑
      // 暂时使用模拟数据
      const mockQuotas: { [providerId: string]: ApiQuota } = {
        gemini: {
          providerId: 'gemini',
          used: 850,
          limit: 1000,
          remaining: 150,
          resetTime: Date.now() + 24 * 60 * 60 * 1000
        },
        deepseek: {
          providerId: 'deepseek', 
          used: 20.5,
          limit: 100,
          remaining: 79.5,
          currency: 'USD'
        }
      }
      setQuotas(mockQuotas)
    } catch (error) {
      console.error('获取API配额失败:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // 获取当前激活的提供商配置
  const getActiveProviderConfig = useCallback(() => {
    const provider = API_PROVIDERS.find(p => p.id === config.activeProvider)
    const providerConfig = config.providers[config.activeProvider]
    return { provider, config: providerConfig }
  }, [config])

  // 检查配置是否完整
  const isConfigValid = useCallback((providerId?: string) => {
    const targetProvider = providerId || config.activeProvider
    const providerConfig = config.providers[targetProvider]
    return !!(providerConfig?.apiKey && providerConfig.enabled)
  }, [config])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  return {
    config,
    quotas,
    tests,
    loading,
    providers: API_PROVIDERS,
    updateProvider,
    setActiveProvider,
    testConnection,
    refreshQuotas,
    getActiveProviderConfig,
    isConfigValid,
    saveConfig
  }
}