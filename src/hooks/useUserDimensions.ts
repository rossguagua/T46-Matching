import { useState, useCallback, useEffect } from 'react'
import { UserDimensions, UserProfile, DimensionAnalysisConfig, DEFAULT_DIMENSION_CONFIG } from '../types/userDimensions'
import { useApiConfig } from './useApiConfig'
import LLMAdapter from '../llm-adapter'

export const useUserDimensions = () => {
  const [config, setConfig] = useState<DimensionAnalysisConfig>(DEFAULT_DIMENSION_CONFIG)
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  
  const { getActiveProviderConfig, isConfigValid } = useApiConfig()
  const llmAdapter = new LLMAdapter()

  // 加载配置
  const loadConfig = useCallback(() => {
    const savedConfig = localStorage.getItem('t46-dimension-config')
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig)
        setConfig({ ...DEFAULT_DIMENSION_CONFIG, ...parsed })
        return { ...DEFAULT_DIMENSION_CONFIG, ...parsed }
      } catch (error) {
        console.error('加载维度分析配置失败:', error)
        return DEFAULT_DIMENSION_CONFIG
      }
    }
    return DEFAULT_DIMENSION_CONFIG
  }, [])

  // 保存配置
  const saveConfig = useCallback((newConfig: DimensionAnalysisConfig) => {
    setConfig(newConfig)
    localStorage.setItem('t46-dimension-config', JSON.stringify(newConfig))
  }, [])

  // 加载用户档案
  const loadProfiles = useCallback(() => {
    const savedProfiles = localStorage.getItem('t46-user-profiles')
    if (savedProfiles) {
      try {
        const parsed = JSON.parse(savedProfiles)
        setProfiles(parsed)
        return parsed
      } catch (error) {
        console.error('加载用户档案失败:', error)
        return []
      }
    }
    return []
  }, [])

  // 保存用户档案
  const saveProfiles = useCallback((newProfiles: UserProfile[]) => {
    setProfiles(newProfiles)
    localStorage.setItem('t46-user-profiles', JSON.stringify(newProfiles))
  }, [])

  // 组件挂载时加载数据
  useEffect(() => {
    loadConfig()
    loadProfiles()
  }, [loadConfig, loadProfiles])

  // LLM调用函数
  const callLLM = useCallback(async (prompt: string): Promise<string> => {
    const { provider, config: providerConfig } = getActiveProviderConfig()
    
    if (!provider || !providerConfig || !isConfigValid()) {
      throw new Error('LLM配置不完整，请先在LLM管理页面配置API')
    }

    const modelId = providerConfig.selectedModels.analysis
    if (!modelId) {
      throw new Error('未配置analysis模型，请在LLM管理页面配置')
    }

    const model = provider.models.find(m => m.id === modelId)
    if (!model) {
      throw new Error(`找不到模型${modelId}`)
    }

    const response = await llmAdapter.generateContent(prompt, {
      provider: provider.name as any,
      model: modelId,
      temperature: model.temperature,
      maxTokens: model.maxTokens,
      apiKey: providerConfig.apiKey
    })

    if (response.error) {
      throw new Error(response.error)
    }

    return response.text
  }, [getActiveProviderConfig, isConfigValid, llmAdapter])

  // 分析单个用户维度
  const analyzeSingleUser = useCallback(async (userData: any): Promise<UserDimensions> => {
    const currentConfig = loadConfig()
    const prompt = currentConfig.masterPrompt.replace('{userData}', JSON.stringify(userData, null, 2))

    const result = await callLLM(prompt)
    
    // 强力JSON清理
    let cleanedResult = result.trim()
    
    // 移除markdown代码块
    cleanedResult = cleanedResult.replace(/```json\s*|\s*```/g, '').trim()
    
    // 找到JSON开始和结束位置
    const jsonStart = cleanedResult.search(/[{\[]/)
    if (jsonStart > 0) {
      const beforeJson = cleanedResult.substring(0, jsonStart)
      if (beforeJson.length > 10) {
        cleanedResult = cleanedResult.substring(jsonStart)
      }
    }
    
    const lastCloseBrace = cleanedResult.lastIndexOf('}')
    const lastCloseBracket = cleanedResult.lastIndexOf(']')
    const lastValidEnd = Math.max(lastCloseBrace, lastCloseBracket)
    
    if (lastValidEnd > 0 && lastValidEnd < cleanedResult.length - 1) {
      const afterJson = cleanedResult.substring(lastValidEnd + 1).trim()
      if (afterJson.length > 0) {
        cleanedResult = cleanedResult.substring(0, lastValidEnd + 1)
      }
    }
    
    // 修复常见JSON问题
    cleanedResult = cleanedResult.replace(/,\s*([}\]])/g, '$1')
    cleanedResult = cleanedResult.replace(/([^"\\])\n/g, '$1')
    
    // 修复未闭合的括号
    const openBraces = (cleanedResult.match(/{/g) || []).length
    const closeBraces = (cleanedResult.match(/}/g) || []).length
    if (openBraces > closeBraces) {
      cleanedResult += '}'.repeat(openBraces - closeBraces)
    }

    const dimensions = JSON.parse(cleanedResult) as UserDimensions
    
    // 确保必要字段
    dimensions.userId = dimensions.userId || `user_${Date.now()}`
    dimensions.name = dimensions.name || userData.自选昵称 || userData.姓名 || '未知用户'
    
    return dimensions
  }, [loadConfig, callLLM])

  // 批量分析用户维度
  const analyzeUsers = useCallback(async (
    usersData: any[], 
    onProgress?: (current: number, total: number, currentUser: string) => void
  ): Promise<UserProfile[]> => {
    if (!isConfigValid()) {
      throw new Error('请先配置LLM API')
    }

    setIsAnalyzing(true)
    const newProfiles: UserProfile[] = []
    const batchSize = 3 // 每批处理3个用户，避免API限制

    try {
      for (let i = 0; i < usersData.length; i += batchSize) {
        const batch = usersData.slice(i, i + batchSize)
        
        // 并行处理当前批次
        const batchPromises = batch.map(async (userData, batchIndex) => {
          const userIndex = i + batchIndex
          const userName = userData.自选昵称 || userData.姓名 || `用户${userIndex + 1}`
          
          onProgress?.(userIndex + 1, usersData.length, userName)
          
          try {
            const dimensions = await analyzeSingleUser(userData)
            
            const profile: UserProfile = {
              userId: dimensions.userId,
              name: dimensions.name,
              age: userData.年龄 || userData.age,
              gender: userData.性别 || userData.gender,
              dimensions,
              rawData: userData,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
            
            return profile
          } catch (error) {
            console.error(`用户${userIndex + 1}分析失败:`, error)
            // 返回基础档案
            return {
              userId: `user_${userIndex + 1}`,
              name: userName,
              age: userData.年龄 || userData.age,
              gender: userData.性别 || userData.gender,
              dimensions: {
                userId: `user_${userIndex + 1}`,
                name: userName,
                extroversion: { score: 5, label: '中开朗', sources: ['分析失败，使用默认值'] },
                thinkingStyle: { type: 'balanced', score: 5, confidence: 0.5, traits: ['分析失败'] },
                topicPreference: { primary: '生活分享型', keywords: [], diversity: 5 },
                socialMotivation: { type: 'recharge', intensity: 5, description: '分析失败', keywords: [] }
              },
              rawData: userData,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            } as UserProfile
          }
        })

        const batchResults = await Promise.all(batchPromises)
        newProfiles.push(...batchResults)

        // 批次间延迟，避免API速率限制
        if (i + batchSize < usersData.length) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }

      // 保存档案
      const allProfiles = [...profiles, ...newProfiles]
      saveProfiles(allProfiles)
      
      return newProfiles
    } finally {
      setIsAnalyzing(false)
    }
  }, [isConfigValid, profiles, saveProfiles, analyzeSingleUser])

  // 删除档案
  const deleteProfile = useCallback((userId: string) => {
    const updatedProfiles = profiles.filter(p => p.userId !== userId)
    saveProfiles(updatedProfiles)
  }, [profiles, saveProfiles])

  // 清空所有档案
  const clearAllProfiles = useCallback(() => {
    saveProfiles([])
  }, [saveProfiles])

  // 导出档案数据
  const exportProfiles = useCallback(() => {
    const exportData = profiles.map(profile => ({
      昵称: profile.name,
      年龄: profile.age,
      性别: profile.gender,
      开朗程度: `${profile.dimensions.extroversion.score}/10 (${profile.dimensions.extroversion.label})`,
      思维风格: `${profile.dimensions.thinkingStyle.type} (${profile.dimensions.thinkingStyle.score}/10)`,
      话题偏好: `${profile.dimensions.topicPreference.primary} (多样性: ${profile.dimensions.topicPreference.diversity}/10)`,
      社交动机: `${profile.dimensions.socialMotivation.type} (强度: ${profile.dimensions.socialMotivation.intensity}/10)`,
      创建时间: new Date(profile.createdAt).toLocaleString()
    }))
    
    return exportData
  }, [profiles])

  return {
    config,
    profiles,
    isAnalyzing,
    saveConfig,
    analyzeUsers,
    analyzeSingleUser,
    deleteProfile,
    clearAllProfiles,
    exportProfiles,
    loadProfiles
  }
}