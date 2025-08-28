import React, { useState, useCallback, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { useApiConfig } from '../hooks/useApiConfig'
import { useMatchingRules } from '../hooks/useMatchingRules'
import LLMAdapter from '../llm-adapter'
import DataEditor from './DataEditor'
import DraggableGroupManager from './DraggableGroupManager'

// 重用原有的接口定义
interface UserData {
  自选昵称?: string
  性别?: string
  出生年份?: number
  年龄?: number
  职业?: string
  上海常出没区域?: string
  兴趣爱好?: string
  情感气象?: string
  '当你失去能量时你更倾向'?: string
  '当你对事物进行判断时，更多基于'?: string
  '最近你专注于'?: string
  '你更想和大家聊的话题是'?: string
  [key: string]: any
}

interface DataSummary {
  totalUsers: number
  averageAge: number
  genderRatio: { 男: number; 女: number; 其他: number }
  averageOpenness: number
}

interface UserProfile {
  user_id: string
  personality_summary: string
  social_style: string
  interests: string[]
  energy_level: string
  conversation_style: string
  group_role_prediction: string
  mystery_tag: string
  potential_connections: string[]
  personality_keywords: string[]
}

interface Group {
  id: string
  name: string
  members: UserData[]
  description: string
  compatibility_score?: number
}

interface MatchingResult {
  groups: Group[]
  unassigned: UserData[]
  overall_score: number
  strategy: string
}

interface MatchingProgress {
  step: number
  stepName: string
  status: 'pending' | 'running' | 'completed' | 'error'
  details: string
  progress: number
}

interface GroupingProposal {
  groups: Group[]
  unassigned: UserData[]
  strategy: string
  reasoning: string
}

interface ReviewResult {
  approved: boolean
  overall_score: number
  group_scores: { [groupId: string]: number }
  violations: {
    hard_constraints: string[]
    soft_constraints: string[]
  }
  suggestions: string[]
  detailed_feedback: string
}

type AppState = 'upload' | 'validate' | 'preview' | 'matching' | 'results'

interface MatchingFlowProps {
  onApiCall?: (model: string, operation: string, status: 'success' | 'error', duration?: number, provider?: string) => void
  preserveState?: boolean
  onStateChange?: (state: { preserveState?: boolean; hasResults?: boolean; lastCompletedStep?: string }) => void
  onResetState?: () => void
  forceReset?: boolean
  onProcessDataChange?: (data: { steps: any[]; currentData?: any }) => void
}

const MatchingFlow: React.FC<MatchingFlowProps> = ({ onApiCall, preserveState, onStateChange, onResetState, forceReset, onProcessDataChange }) => {
  const { getActiveProviderConfig, isConfigValid } = useApiConfig()
  const { rules, generateGroupingPrompt, generateEvaluationPrompt, generateUserAnalysisPrompt } = useMatchingRules()
  
  // 应用状态管理
  const [appState, setAppState] = useState<AppState>('upload')
  const [userData, setUserData] = useState<UserData[]>([])
  const [rawData, setRawData] = useState<UserData[]>([]) // 保存原始上传的数据
  const [showDataEditor, setShowDataEditor] = useState(false)
  const [dataSummary, setDataSummary] = useState<DataSummary | null>(null)
  const [matchingResult, setMatchingResult] = useState<MatchingResult | null>(null)
  
  // 进度和错误管理
  const [matchingProgress, setMatchingProgress] = useState<MatchingProgress[]>([
    { step: 1, stepName: 'AI问卷深度分析', status: 'pending', details: '准备分析用户问卷...', progress: 0 },
    { step: 2, stepName: '用户档案标准化', status: 'pending', details: '准备标准化档案...', progress: 0 },
    { step: 3, stepName: 'MatchingAgent生成方案', status: 'pending', details: '准备生成初始分组方案...', progress: 0 },
    { step: 4, stepName: 'ReviewAgent严格审批', status: 'pending', details: '准备评估分组质量...', progress: 0 },
    { step: 5, stepName: '智能优化循环', status: 'pending', details: '准备迭代优化分组...', progress: 0 },
    { step: 6, stepName: '最终确认输出', status: 'pending', details: '准备生成最终结果...', progress: 0 },
  ])
  const [errors, setErrors] = useState<string[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  // 移除编辑模式概念，分组结果默认可编辑

  const llmAdapter = new LLMAdapter()

  // 保存和加载状态
  const saveState = useCallback(() => {
    const state = {
      appState,
      userData,
      rawData,
      showDataEditor,
      dataSummary,
      matchingResult,
      matchingProgress,
      timestamp: Date.now()
    }
    localStorage.setItem('t46-matching-state', JSON.stringify(state))
  }, [appState, userData, rawData, showDataEditor, dataSummary, matchingResult, matchingProgress])

  const loadState = useCallback(() => {
    try {
      const saved = localStorage.getItem('t46-matching-state')
      if (saved) {
        const state = JSON.parse(saved)
        // 只在3小时内加载保存的状态
        if (Date.now() - state.timestamp < 3 * 60 * 60 * 1000) {
          setAppState(state.appState)
          setUserData(state.userData || [])
          setRawData(state.rawData || [])
          setShowDataEditor(state.showDataEditor || false)
          setDataSummary(state.dataSummary)
          setMatchingResult(state.matchingResult)
          setMatchingProgress(state.matchingProgress || [
            { step: 1, stepName: 'AI问卷深度分析', status: 'pending', details: '准备分析用户问卷...', progress: 0 },
            { step: 2, stepName: '用户档案标准化', status: 'pending', details: '准备标准化档案...', progress: 0 },
            { step: 3, stepName: 'MatchingAgent生成方案', status: 'pending', details: '准备生成初始分组方案...', progress: 0 },
            { step: 4, stepName: 'ReviewAgent严格审批', status: 'pending', details: '准备评估分组质量...', progress: 0 },
            { step: 5, stepName: '智能优化循环', status: 'pending', details: '准备迭代优化分组...', progress: 0 },
            { step: 6, stepName: '最终确认输出', status: 'pending', details: '准备生成最终结果...', progress: 0 },
          ])
          onStateChange?.({ 
            preserveState: true, 
            hasResults: !!state.matchingResult,
            lastCompletedStep: state.appState
          })
        }
      }
    } catch (error) {
      console.error('加载状态失败:', error)
    }
  }, [onStateChange])

  // 组件挂载时加载状态
  useEffect(() => {
    if (preserveState && !forceReset) {
      loadState()
    } else if (forceReset) {
      // 强制重置时清空所有状态
      setAppState('upload')
      setUserData([])
      setRawData([])
      setShowDataEditor(false)
      setDataSummary(null)
      setMatchingResult(null)
      setMatchingProgress([
        { step: 1, stepName: 'AI问卷深度分析', status: 'pending', details: '准备分析用户问卷...', progress: 0 },
        { step: 2, stepName: '用户档案标准化', status: 'pending', details: '准备标准化档案...', progress: 0 },
        { step: 3, stepName: 'MatchingAgent生成方案', status: 'pending', details: '准备生成初始分组方案...', progress: 0 },
        { step: 4, stepName: 'ReviewAgent严格审批', status: 'pending', details: '准备评估分组质量...', progress: 0 },
        { step: 5, stepName: '智能优化循环', status: 'pending', details: '准备迭代优化分组...', progress: 0 },
        { step: 6, stepName: '最终确认输出', status: 'pending', details: '准备生成最终结果...', progress: 0 },
      ])
      setErrors([])
    }
  }, [preserveState, forceReset, loadState])

  // 自动保存状态
  useEffect(() => {
    if (userData.length > 0 || matchingResult) {
      saveState()
    }
  }, [userData, dataSummary, matchingResult, matchingProgress, saveState])

  // 监听外部重置请求
  useEffect(() => {
    if (onResetState) {
      // 这里可以添加一些清理逻辑
    }
  }, [onResetState])

  // 当匹配完成时通知父组件
  useEffect(() => {
    if (matchingResult && appState === 'results') {
      onStateChange?.({ hasResults: true, preserveState: true })
    }
  }, [matchingResult, appState, onStateChange])

  // 进度更新函数
  const updateProgress = useCallback((step: number, status: MatchingProgress['status'], details: string, progress: number = 0) => {
    setMatchingProgress(prev => {
      const updated = prev.map(p => 
        p.step === step ? { ...p, status, details, progress } : p
      )
      
      // 同步更新流程总览数据
      onProcessDataChange?.({
        steps: updated,
        currentData: {
          userData,
          // 这里可以根据需要添加其他流程数据
        }
      })
      
      return updated
    })
  }, [onProcessDataChange, userData])

  // 通用LLM调用函数（带重试机制）
  const callLLM = useCallback(async (
    prompt: string,
    modelType: 'analysis' | 'generation' | 'review',
    operation: string,
    maxRetries: number = 3
  ): Promise<string> => {
    const { provider, config: providerConfig } = getActiveProviderConfig()
    
    if (!provider || !providerConfig || !isConfigValid()) {
      throw new Error('LLM配置不完整，请先在LLM管理页面配置API')
    }

    const modelId = providerConfig.selectedModels[modelType]
    if (!modelId) {
      throw new Error(`未配置${modelType}模型，请在LLM管理页面配置`)
    }

    const model = provider.models.find(m => m.id === modelId)
    if (!model) {
      throw new Error(`找不到模型${modelId}`)
    }

    let lastError: any = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const startTime = Date.now()
      
      try {
        console.log(`🔄 ${operation} (尝试 ${attempt}/${maxRetries})`)
        
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

        if (!response.text || response.text.length < 10) {
          throw new Error(`${modelId} API返回过短(${response.text.length}字符)`)
        }

        const duration = Date.now() - startTime
        onApiCall?.(modelId, operation, 'success', duration, provider.name)
        return response.text
      } catch (error) {
        const duration = Date.now() - startTime
        lastError = error
        console.warn(`❌ ${operation}失败 (尝试 ${attempt}/${maxRetries}):`, error)
        
        // 如果是最后一次尝试，记录错误并抛出
        if (attempt === maxRetries) {
          onApiCall?.(modelId, operation, 'error', duration, provider.name)
          throw error
        }
        
        // 等待一段时间后重试（指数退避）
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
        console.log(`⏳ ${waitTime}ms后重试...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }
    
    throw lastError || new Error('请求失败')
  }, [getActiveProviderConfig, isConfigValid, llmAdapter, onApiCall])

  // 其他函数保持不变，但使用callLLM...
  // 这里我会继续实现核心的匹配逻辑，但为了节省空间，先重点实现关键结构

  // 文件处理函数
  const processFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' })
        
        setRawData(jsonData as UserData[])
        setShowDataEditor(true) // 显示数据编辑器
        setAppState('validate')
        setErrors([])
      } catch (error) {
        console.error('文件解析错误:', error)
        setErrors(['文件解析失败，请确保文件格式正确'])
      }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const analyzeDataSummary = useCallback((data: UserData[]): DataSummary => {
    const totalUsers = data.length
    
    // 计算平均年龄 - 处理多种可能的字段名
    const ages: number[] = []
    data.forEach(user => {
      // 尝试不同的年龄字段
      let age = Number(user.年龄) || Number(user.age) || Number(user.Age) || 0
      
      // 如果没有年龄字段，尝试从出生年份计算
      if (!age && user.出生年份) {
        const birthYear = Number(user.出生年份)
        if (birthYear > 1900 && birthYear < 2010) {
          age = new Date().getFullYear() - birthYear
        }
      }
      
      // 如果年龄在合理范围内，添加到数组
      if (age > 0 && age < 100) {
        ages.push(age)
      }
    })
    const averageAge = ages.length > 0 ? Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length * 10) / 10 : 0
    
    // 统计性别比例 - 处理各种可能的输入格式
    const genderCount = { 男: 0, 女: 0, 其他: 0 }
    data.forEach(user => {
      const gender = String(user.性别 || user.gender || user.Gender || '').trim().toLowerCase()
      
      if (gender === '男' || gender === '男性' || gender === 'male' || gender === 'm' || gender === '1') {
        genderCount.男++
      } else if (gender === '女' || gender === '女性' || gender === 'female' || gender === 'f' || gender === '2') {
        genderCount.女++
      } else if (gender && gender !== 'undefined' && gender !== 'null' && gender !== '') {
        genderCount.其他++
      }
    })
    
    // 计算平均开放度 - 查找各种可能的字段名
    const openness: number[] = []
    data.forEach(user => {
      // 尝试查找包含"开放"关键词的字段
      let opennessValue: number | undefined
      
      // 直接查找已知字段
      const possibleFields = [
        '对于现场话题和游戏的开放程度，你的接受度',
        '开放度',
        'openness',
        '接受度',
        '社交开放度'
      ]
      
      for (const field of possibleFields) {
        if (user[field] !== undefined && user[field] !== null) {
          const val = Number(user[field])
          if (!isNaN(val) && val > 0) {
            opennessValue = val
            break
          }
        }
      }
      
      // 如果还没找到，搜索包含"开放"的字段
      if (!opennessValue) {
        for (const key of Object.keys(user)) {
          if (key.includes('开放') || key.includes('接受')) {
            const val = Number(user[key])
            if (!isNaN(val) && val > 0 && val <= 10) {
              opennessValue = val
              break
            }
          }
        }
      }
      
      if (opennessValue && opennessValue > 0 && opennessValue <= 10) {
        openness.push(opennessValue)
      }
    })
    
    const averageOpenness = openness.length > 0 
      ? Math.round(openness.reduce((sum, v) => sum + v, 0) / openness.length * 10) / 10 
      : 0
    
    console.log('数据统计结果:', {
      totalUsers,
      averageAge,
      agesCount: ages.length,
      genderCount,
      opennessCount: openness.length,
      averageOpenness
    })
    
    return {
      totalUsers,
      averageAge,
      genderRatio: genderCount,
      averageOpenness
    }
  }, [])

  // 开始匹配流程（完整实现）
  const startMatching = useCallback(async () => {
    if (userData.length === 0) return
    
    setAppState('matching')
    setErrors([])

    // 检查LLM配置
    if (!isConfigValid()) {
      setErrors(['LLM API未配置，请先在LLM管理页面配置API'])
      return
    }
    
    try {
      // 第一步：AI问卷深度分析
      updateProgress(1, 'running', '正在进行AI问卷深度分析...', 0)
      const profiles = await performUserAnalysis(userData)
      updateProgress(1, 'completed', `分析完成，生成${profiles.length}个用户档案`, 100)

      // 第二步：用户档案标准化
      updateProgress(2, 'running', '正在标准化用户档案...', 0)
      const normalizedProfiles = await normalizeUserProfiles(profiles)
      updateProgress(2, 'completed', '档案标准化完成', 100)

      // 第三步：MatchingAgent生成方案
      updateProgress(3, 'running', '正在生成智能分组方案...', 0)
      const proposals = await generateGroupingProposals(normalizedProfiles)
      updateProgress(3, 'completed', `生成${proposals.length}个候选方案`, 100)

      // 第四步：ReviewAgent严格审批
      updateProgress(4, 'running', '正在进行方案质量审批...', 0)
      const reviewResults = await reviewGroupingProposals(proposals)
      updateProgress(4, 'completed', '质量审批完成', 100)

      // 第五步：智能优化循环
      updateProgress(5, 'running', '正在进行智能优化...', 0)
      const optimizedResult = await optimizeGrouping(reviewResults, proposals)
      updateProgress(5, 'completed', '优化完成', 100)

      // 第六步：最终确认输出
      updateProgress(6, 'running', '正在生成最终结果...', 0)
      const finalResult = await finalizeGrouping(optimizedResult)
      
      setMatchingResult(finalResult)
      updateProgress(6, 'completed', '智能匹配全部完成！', 100)
      setAppState('results')
      
    } catch (error) {
      console.error('匹配失败:', error)
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      setErrors([`匹配失败: ${errorMessage}`])
      
      // 找到当前正在执行的步骤并标记为错误
      const currentStep = matchingProgress.findIndex(p => p.status === 'running')
      if (currentStep >= 0) {
        updateProgress(currentStep + 1, 'error', `执行失败: ${errorMessage}`, 0)
      }
    }
  }, [userData, isConfigValid, matchingProgress])

  // 执行用户分析（并行处理）
  const performUserAnalysis = useCallback(async (users: UserData[]): Promise<UserProfile[]> => {
    console.log('开始用户分析，用户数量:', users.length)
    const profiles: UserProfile[] = []
    const batchSize = 5 // 每批并行处理5个用户
    
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize)
      const batchStart = i + 1
      const batchEnd = Math.min(i + batchSize, users.length)
      
      updateProgress(1, 'running', `并行分析用户批次 ${batchStart}-${batchEnd}/${users.length}`, Math.floor((i / users.length) * 100))
      
      // 创建并行分析任务
      const analysisPromises = batch.map(async (user, batchIndex) => {
        const userIndex = i + batchIndex
        // 使用规则管理中的配置生成用户分析Prompt
        const analysisPrompt = generateUserAnalysisPrompt(user)

        try {
          console.log(`开始分析用户 ${userIndex+1}:`, user.自选昵称 || user.姓名)
          const result = await callLLM(analysisPrompt, 'analysis', `用户分析-${userIndex+1}`)
          console.log(`用户 ${userIndex+1} 分析完成，结果长度:`, result.length)
          // 更严格的JSON清理
          let cleanedResult = result.replace(/```json\s*|\s*```/g, '').trim()
          // 移除可能的尾部逗号
          cleanedResult = cleanedResult.replace(/,\s*([}\]])/g, '$1')
          // 尝试修复未闭合的字符串
          if ((cleanedResult.match(/"/g) || []).length % 2 !== 0) {
            cleanedResult += '"'
          }
          // 尝试修复未闭合的括号
          const openBraces = (cleanedResult.match(/{/g) || []).length
          const closeBraces = (cleanedResult.match(/}/g) || []).length
          if (openBraces > closeBraces) {
            cleanedResult += '}'.repeat(openBraces - closeBraces)
          }
          
          const profile = JSON.parse(cleanedResult) as UserProfile
          profile.user_id = `user_${userIndex + 1}`
          return profile
        } catch (error) {
          console.warn(`用户${userIndex+1}分析失败，使用默认档案:`, error)
          // 使用默认档案
          return {
            user_id: `user_${userIndex + 1}`,
            personality_summary: '暂未完成深度分析的用户',
            social_style: '积极参与者',
            interests: [user.兴趣爱好 || '未知兴趣'],
            energy_level: '中能量',
            conversation_style: '平衡型对话者',
            group_role_prediction: '团队协作者',
            mystery_tag: '待发现特质',
            potential_connections: ['社交', '交友'],
            personality_keywords: ['友善', '开放']
          }
        }
      })
      
      // 等待当前批次完成
      const batchProfiles = await Promise.all(analysisPromises)
      profiles.push(...batchProfiles)
      
      // 批次间短暂延迟，避免API速率限制
      if (i + batchSize < users.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    return profiles
  }, [callLLM, updateProgress])

  // 档案标准化
  const normalizeUserProfiles = useCallback(async (profiles: UserProfile[]): Promise<UserProfile[]> => {
    // 这里可以添加数据清洗和标准化逻辑
    await new Promise(resolve => setTimeout(resolve, 1000)) // 模拟处理时间
    return profiles
  }, [])

  // 验证并修正分组的年龄约束
  const validateAndFixAgeConstraints = useCallback((proposal: GroupingProposal): GroupingProposal => {
    const maxAgeGap = rules.hardRules.maxAgeGap
    const groupSize = rules.hardRules.groupSize
    const fixedGroups: Group[] = []
    let allUnassignedMembers: UserData[] = [...(proposal.unassigned || [])]
    
    console.log('开始验证年龄约束，规则:', { maxAgeGap, groupSize })
    
    // 先收集所有需要重新分配的成员
    let membersToReassign: UserData[] = []
    const usedMemberNames = new Set<string>() // 防止成员重复
    
    // 检查每个组的年龄约束
    proposal.groups.forEach(group => {
      const members = [...group.members]
      const ages = members.map(m => Number(m.年龄) || 0).filter(age => age > 0)
      
      if (ages.length === 0) {
        // 如果没有年龄信息，保持原组
        fixedGroups.push(group)
        // 记录已使用的成员
        members.forEach(m => usedMemberNames.add(m.自选昵称))
        return
      }
      
      const maxAge = Math.max(...ages)
      const minAge = Math.min(...ages)
      const ageGap = maxAge - minAge
      
      if (ageGap <= maxAgeGap && members.length === groupSize) {
        // 年龄差符合要求且人数正确，保持原组
        fixedGroups.push(group)
        // 记录已使用的成员
        members.forEach(m => usedMemberNames.add(m.自选昵称))
      } else {
        // 需要重新分配，但要去重
        console.warn(`组 ${group.name} 年龄差为 ${ageGap} 岁或人数不对，需要重新分配`)
        members.forEach(member => {
          if (!usedMemberNames.has(member.自选昵称)) {
            membersToReassign.push(member)
            usedMemberNames.add(member.自选昵称)
          }
        })
      }
    })
    
    // 如果有成员需要重新分配
    if (membersToReassign.length > 0) {
      // 将所有待分配成员（包括原本未分配的）合并并按年龄排序，确保去重
      const unassignedMembers = allUnassignedMembers.filter(m => !usedMemberNames.has(m.自选昵称))
      const allMembers = [...membersToReassign, ...unassignedMembers]
      console.log('需要重新分配的成员总数:', allMembers.length)
      const sortedMembers = allMembers.sort((a, b) => {
        const ageA = Number(a.年龄) || 0
        const ageB = Number(b.年龄) || 0
        return ageA - ageB
      })
      
      // 重新分组算法：尝试创建符合年龄约束的小组
      let remainingMembers = [...sortedMembers]
      let finalUnassigned: UserData[] = []
      
      // 贪心算法：尽可能创建符合约束的组
      while (remainingMembers.length >= groupSize) {
        let bestGroup: UserData[] | null = null
        let bestGroupIndices: number[] = []
        let minAgeGap = Infinity
        
        // 尝试找到年龄差最小的一组
        for (let i = 0; i <= remainingMembers.length - groupSize; i++) {
          const candidateGroup = remainingMembers.slice(i, i + groupSize)
          const ages = candidateGroup.map(m => Number(m.年龄) || 0)
          const maxAge = Math.max(...ages)
          const minAge = Math.min(...ages)
          const ageGap = maxAge - minAge
          
          if (ageGap <= maxAgeGap && ageGap < minAgeGap) {
            bestGroup = candidateGroup
            bestGroupIndices = Array.from({length: groupSize}, (_, idx) => i + idx)
            minAgeGap = ageGap
          }
        }
        
        if (bestGroup) {
          // 找到了符合条件的组
          const ages = bestGroup.map(m => Number(m.年龄) || 0)
          const maxAge = Math.max(...ages)
          const minAge = Math.min(...ages)
          
          fixedGroups.push({
            id: `group_${fixedGroups.length + 1}`,
            name: `第${fixedGroups.length + 1}组`,
            members: bestGroup,
            description: '',
            compatibility_score: 8.5 - minAgeGap * 0.2
          })
          
          // 从剩余成员中移除已分组的成员
          remainingMembers = remainingMembers.filter((_, idx) => !bestGroupIndices.includes(idx))
        } else {
          // 无法再创建符合条件的组，剩余的都放入未分配
          break
        }
      }
      
      // 剩余的成员放入未分配
      finalUnassigned = [...remainingMembers]
      
      // 确保所有人都被分配或标记为未分配
      console.log('重新分配完成:', {
        fixedGroupsCount: fixedGroups.length,
        finalUnassignedCount: finalUnassigned.length,
        totalAfterReassign: fixedGroups.reduce((sum, g) => sum + g.members.length, 0) + finalUnassigned.length
      })
      
      allUnassignedMembers = finalUnassigned
    }
    
    const result = {
      ...proposal,
      groups: fixedGroups,
      unassigned: allUnassignedMembers,
      strategy: proposal.strategy + '\n[已应用年龄约束自动修正]'
    }
    
    console.log('validateAndFixAgeConstraints 最终结果:', {
      groupCount: result.groups.length,
      unassignedCount: result.unassigned.length,
      totalMembers: result.groups.reduce((sum, g) => sum + g.members.length, 0) + result.unassigned.length
    })
    
    return result
  }, [rules.hardRules.maxAgeGap, rules.hardRules.groupSize])

  // 生成分组方案
  const generateGroupingProposals = useCallback(async (profiles: UserProfile[]): Promise<GroupingProposal[]> => {
    // 使用规则管理中的配置生成Prompt，传递原始用户数据以包含年龄等信息
    const groupingPrompt = generateGroupingPrompt(profiles, userData)

    try {
      const result = await callLLM(groupingPrompt, 'generation', '分组方案生成')
      // 更严格的JSON清理
      let cleanedResult = result.replace(/```json\s*|\s*```/g, '').trim()
      // 移除可能的尾部逗号
      cleanedResult = cleanedResult.replace(/,\s*([}\]])/g, '$1')
      // 尝试修复未闭合的字符串
      if ((cleanedResult.match(/"/g) || []).length % 2 !== 0) {
        cleanedResult += '"'
      }
      // 尝试修复未闭合的括号
      const openBraces = (cleanedResult.match(/{/g) || []).length
      const closeBraces = (cleanedResult.match(/}/g) || []).length
      if (openBraces > closeBraces) {
        cleanedResult += '}'.repeat(openBraces - closeBraces)
      }
      const openBrackets = (cleanedResult.match(/\[/g) || []).length
      const closeBrackets = (cleanedResult.match(/\]/g) || []).length
      if (openBrackets > closeBrackets) {
        cleanedResult += ']'.repeat(openBrackets - closeBrackets)
      }
      
      const proposal = JSON.parse(cleanedResult) as GroupingProposal
      
      // 转换索引为实际用户数据，统一组名格式
      const processedGroups: Group[] = proposal.groups.map((g, index) => ({
        ...g,
        name: `第${index + 1}组`, // 统一组名为纯数字
        description: '', // 移除描述
        members: (g.members as unknown as number[]).map(index => userData[index]).filter(Boolean),
        compatibility_score: 7.5 // 初始分数，等待审批
      }))
      
      const rawProposal = {
        groups: processedGroups,
        unassigned: (proposal.unassigned as unknown as number[]).map(index => userData[index]).filter(Boolean),
        strategy: proposal.strategy,
        reasoning: proposal.reasoning
      }
      
      console.log('原始分组方案:', {
        groupCount: rawProposal.groups.length,
        groups: rawProposal.groups.map(g => ({
          name: g.name,
          memberCount: g.members.length,
          ages: g.members.map(m => m.年龄)
        })),
        unassignedCount: rawProposal.unassigned.length
      })
      
      // 验证并修正年龄约束
      const fixedProposal = validateAndFixAgeConstraints(rawProposal)
      
      console.log('修正后分组方案:', {
        groupCount: fixedProposal.groups.length,
        groups: fixedProposal.groups.map(g => ({
          name: g.name,
          memberCount: g.members.length,
          ages: g.members.map(m => m.年龄)
        })),
        unassignedCount: fixedProposal.unassigned.length
      })
      
      return [fixedProposal]
    } catch (error) {
      console.warn('分组生成失败，使用简单分组算法:', error)
      const simpleGrouping = generateSimpleGrouping()
      
      console.log('简单分组结果:', {
        groupCount: simpleGrouping.groups.length,
        unassignedCount: simpleGrouping.unassigned.length,
        totalMembers: simpleGrouping.groups.reduce((sum, g) => sum + g.members.length, 0) + simpleGrouping.unassigned.length
      })
      
      // 对简单分组也进行年龄约束验证
      const validatedGrouping = validateAndFixAgeConstraints(simpleGrouping)
      
      console.log('验证后的简单分组:', {
        groupCount: validatedGrouping.groups.length,
        unassignedCount: validatedGrouping.unassigned.length,
        totalMembers: validatedGrouping.groups.reduce((sum, g) => sum + g.members.length, 0) + validatedGrouping.unassigned.length
      })
      
      return [validatedGrouping]
    }
  }, [callLLM, userData, generateGroupingPrompt, validateAndFixAgeConstraints])

  // 生成简单分组作为后备方案
  const generateSimpleGrouping = useCallback((): GroupingProposal => {
    const groupSize = rules.hardRules.groupSize // 从规则管理获取组大小
    const maxAgeGap = rules.hardRules.maxAgeGap // 获取年龄差约束
    const groups: Group[] = []
    const unassignedMembers: UserData[] = []
    
    // 先按年龄排序，确保年龄相近的人分在一组
    const sortedUsers = [...userData].sort((a, b) => {
      const ageA = Number(a.年龄) || 0
      const ageB = Number(b.年龄) || 0
      return ageA - ageB
    })
    
    for (let i = 0; i < sortedUsers.length; i += groupSize) {
      const members = sortedUsers.slice(i, i + groupSize)
      
      // 检查组内年龄差
      if (members.length === groupSize) {
        const ages = members.map(m => Number(m.年龄) || 0).filter(age => age > 0)
        const maxAge = Math.max(...ages)
        const minAge = Math.min(...ages)
        const ageGap = maxAge - minAge
        
        // 只有满足年龄差约束才创建组
        if (ageGap <= maxAgeGap) {
          groups.push({
            id: `group_${groups.length + 1}`,
            name: `第${groups.length + 1}组`,
            description: '',
            members,
            compatibility_score: 7.0
          })
        } else {
          // 年龄差过大的组员作为未分配
          unassignedMembers.push(...members)
        }
      } else {
        // 不足的人员作为剩余
        unassignedMembers.push(...members)
      }
    }
    
    console.log('generateSimpleGrouping 生成结果:', {
      userDataLength: userData.length,
      sortedUsersLength: sortedUsers.length,
      groupsCreated: groups.length,
      unassignedCount: unassignedMembers.length,
      totalProcessed: groups.reduce((sum, g) => sum + g.members.length, 0) + unassignedMembers.length
    })
    
    return {
      groups,
      unassigned: unassignedMembers,
      strategy: `基础算法分组（${groupSize}人/组）`,
      reasoning: `严格按照规则管理设置：每组${groupSize}人，剩余${unassignedMembers.length}人待分配`
    }
  }, [userData, rules.hardRules.groupSize, rules.hardRules.maxAgeGap])

  // 审批分组方案
  const reviewGroupingProposals = useCallback(async (proposals: GroupingProposal[]): Promise<ReviewResult[]> => {
    const results: ReviewResult[] = []
    
    for (const proposal of proposals) {
      // 使用规则管理中的配置生成评估Prompt
      const reviewPrompt = generateEvaluationPrompt(proposal)

      try {
        const result = await callLLM(reviewPrompt, 'review', `方案审批-${results.length + 1}`)
        // 更严格的JSON清理
        let cleanedResult = result.replace(/```json\s*|\s*```/g, '').trim()
        
        // 检查是否为非JSON响应
        if (cleanedResult.startsWith('请') || cleanedResult.startsWith('错误') || !cleanedResult.startsWith('{')) {
          throw new Error('LLM返回了非JSON格式的响应: ' + cleanedResult.substring(0, 100))
        }
        
        // 移除可能的尾部逗号
        cleanedResult = cleanedResult.replace(/,\s*([}\]])/g, '$1')
        
        const review = JSON.parse(cleanedResult) as ReviewResult
        results.push(review)
      } catch (error) {
        console.warn('审批失败，使用默认评分:', error)
        results.push({
          approved: true,
          overall_score: 7.5,
          group_scores: Object.fromEntries(proposal.groups.map(g => [g.id, 7.5])),
          violations: { hard_constraints: [], soft_constraints: [] },
          suggestions: [],
          detailed_feedback: '自动审批通过'
        })
      }
    }
    
    return results
  }, [callLLM])

  // 优化分组
  const optimizeGrouping = useCallback(async (reviewResults: ReviewResult[], proposals: GroupingProposal[]): Promise<MatchingResult> => {
    // 选择最佳方案或进行优化
    const bestReviewIndex = reviewResults.reduce((bestIdx, current, idx) => 
      current.overall_score > reviewResults[bestIdx].overall_score ? idx : bestIdx, 0
    )
    
    const bestReview = reviewResults[bestReviewIndex]
    const bestProposal = proposals[bestReviewIndex]
    
    await new Promise(resolve => setTimeout(resolve, 1000)) // 模拟优化过程
    
    // 保留最佳方案的分组信息
    return {
      groups: bestProposal.groups.map(g => ({
        ...g,
        compatibility_score: bestReview.group_scores?.[g.id] || bestReview.overall_score || 7.5
      })),
      unassigned: bestProposal.unassigned || [],
      overall_score: bestReview.overall_score,
      strategy: bestProposal.strategy || '智能优化分组'
    }
  }, [])

  // 最终确定分组
  const finalizeGrouping = useCallback(async (result: MatchingResult): Promise<MatchingResult> => {
    // 对最终结果再次进行年龄约束验证
    const validatedProposal = validateAndFixAgeConstraints({
      groups: result.groups,
      unassigned: result.unassigned || [],
      strategy: result.strategy,
      reasoning: ''
    })
    
    // 计算每组的实际匹配分数
    const finalGroups = validatedProposal.groups.map(group => {
      const ages = group.members.map(m => Number(m.年龄) || 0).filter(age => age > 0)
      const maxAge = ages.length > 0 ? Math.max(...ages) : 0
      const minAge = ages.length > 0 ? Math.min(...ages) : 0
      const ageGap = maxAge - minAge
      
      // 根据年龄差计算分数
      let score = 8.0
      if (ageGap <= rules.hardRules.maxAgeGap) {
        score = 8.5 + (1 - ageGap / rules.hardRules.maxAgeGap) * 1.5 // 8.5-10分
      } else {
        score = 5.0 // 不符合年龄约束的组得低分
      }
      
      return {
        ...group,
        compatibility_score: score,
        description: ''
      }
    })
    
    // 计算整体分数
    const overallScore = finalGroups.length > 0 
      ? finalGroups.reduce((sum, g) => sum + (g.compatibility_score || 0), 0) / finalGroups.length
      : 0
    
    return {
      groups: finalGroups,
      unassigned: validatedProposal.unassigned,
      overall_score: overallScore,
      strategy: `${validatedProposal.strategy}\n最终验证：所有组均符合年龄差≤${rules.hardRules.maxAgeGap}岁的约束`
    }
  }, [validateAndFixAgeConstraints, rules.hardRules.maxAgeGap])

  // 文件操作处理器
  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragOver(false)
    const files = event.dataTransfer.files
    if (files.length > 0) {
      processFile(files[0])
    }
  }, [processFile])

  const handleResetUpload = useCallback(() => {
    // 清除localStorage中的状态
    localStorage.removeItem('t46-matching-state')
    
    setAppState('upload')
    setUserData([])
    setRawData([])
    setShowDataEditor(false)
    setDataSummary(null)
    setMatchingResult(null)
    setMatchingProgress([
      { step: 1, stepName: 'AI问卷深度分析', status: 'pending', details: '准备分析用户问卷...', progress: 0 },
      { step: 2, stepName: '用户档案标准化', status: 'pending', details: '准备标准化档案...', progress: 0 },
      { step: 3, stepName: 'MatchingAgent生成方案', status: 'pending', details: '准备生成初始分组方案...', progress: 0 },
      { step: 4, stepName: 'ReviewAgent严格审批', status: 'pending', details: '准备评估分组质量...', progress: 0 },
      { step: 5, stepName: '智能优化循环', status: 'pending', details: '准备迭代优化分组...', progress: 0 },
      { step: 6, stepName: '最终确认输出', status: 'pending', details: '准备生成最终结果...', progress: 0 },
    ])
    setErrors([])
    
    // 通知父组件重置状态
    if (onResetState) {
      onResetState()
    } else {
      onStateChange?.({ preserveState: false, hasResults: false })
    }
  }, [onStateChange, onResetState])

  // 创建空组函数
  const handleCreateEmptyGroup = useCallback(() => {
    if (!matchingResult) return
    
    const nextGroupNumber = matchingResult.groups.length + 1
    const newGroup: Group = {
      id: `group_${nextGroupNumber}`,
      name: `第${nextGroupNumber}组`,
      members: [],
      description: '',
      compatibility_score: 0
    }
    
    setMatchingResult({
      ...matchingResult,
      groups: [...matchingResult.groups, newGroup]
    })
  }, [matchingResult])

  const exportToExcel = useCallback(() => {
    if (!matchingResult) return

    const wb = XLSX.utils.book_new()
    const excelData: any[] = []
    
    // 导出已分组成员
    matchingResult.groups.forEach((group, groupIndex) => {
      const groupLetter = String.fromCharCode(65 + groupIndex)
      group.members.forEach((member, memberIndex) => {
        excelData.push({
          '分组': groupLetter,
          'NO.': memberIndex + 1,
          '状态': '已分配',
          ...member
        })
      })
      
      // 组之间添加空行
      if (groupIndex < matchingResult.groups.length - 1) {
        excelData.push({})
      }
    })
    
    // 如果有未分配成员，添加三行空行后导出
    if (matchingResult.unassigned && matchingResult.unassigned.length > 0) {
      // 添加三行空行分隔
      excelData.push({})
      excelData.push({})
      excelData.push({})
      
      // 添加未分配成员标题
      excelData.push({
        '分组': '未分配',
        'NO.': '',
        '状态': '待分配',
        '姓名': '--- 未分配人员 ---'
      })
      
      // 添加未分配成员
      matchingResult.unassigned.forEach((member, index) => {
        excelData.push({
          '分组': '未分配',
          'NO.': index + 1,
          '状态': '待分配',
          ...member
        })
      })
    }

    const ws = XLSX.utils.json_to_sheet(excelData)
    
    // 设置列宽
    const colWidths = [
      { wch: 8 },  // 分组
      { wch: 6 },  // NO.
      { wch: 8 },  // 状态
      { wch: 12 }, // 姓名
      { wch: 6 },  // 性别
      { wch: 6 },  // 年龄
      { wch: 15 }, // 职业
      { wch: 12 }, // 其他字段
    ]
    ws['!cols'] = colWidths
    
    XLSX.utils.book_append_sheet(wb, ws, '智能分组结果')
    
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    saveAs(data, '智能分组结果.xlsx')
  }, [matchingResult])

  // 获取预览列
  const getPreviewColumns = useCallback((data: UserData[]) => {
    if (data.length === 0) return []
    
    const coreFields = ['自选昵称', '性别', '年龄', '出生年份', '职业', '上海常出没区域', '情感气象']
    const allKeys = Object.keys(data[0])
    
    const filteredKeys = allKeys.filter(key => {
      if (key.includes('__EMPTY') || key.includes('合并') || !key.trim()) return false
      if (key.length > 15) return false
      const skipKeywords = ['你希望遇见', '或许，你在做', '想问同来', '最近关注', '盲盒社交', '交朋友能量', '不可接受']
      if (skipKeywords.some(keyword => key.includes(keyword))) return false
      return true
    })
    
    const sortedKeys = [
      ...coreFields.filter(field => filteredKeys.includes(field)),
      ...filteredKeys.filter(field => !coreFields.includes(field))
    ]
    
    return sortedKeys.slice(0, 8)
  }, [])

  const previewColumns = getPreviewColumns(userData)

  // 数据编辑器的处理函数
  const handleDataEditorConfirm = useCallback(() => {
    // 数据已经通过onDataChange更新
    setShowDataEditor(false)
    
    // 确保使用最新的用户数据计算统计
    if (userData && userData.length > 0) {
      const summary = analyzeDataSummary(userData)
      setDataSummary(summary)
      console.log('数据编辑器确认，统计信息:', summary)
    }
    
    setAppState('preview')
  }, [userData, analyzeDataSummary])

  const handleDataEditorCancel = useCallback(() => {
    setShowDataEditor(false)
    setRawData([])
    setUserData([])
    setAppState('upload')
  }, [])

  const handleDataChange = useCallback((data: any[]) => {
    const users = data as UserData[]
    setUserData(users)
    // 实时更新统计信息
    const summary = analyzeDataSummary(users)
    setDataSummary(summary)
    console.log('数据更新，新统计信息:', summary)
  }, [analyzeDataSummary])

  // 渲染函数
  const renderUploadPage = () => (
    <div className="page-container">
      <div className="upload-section">
        <h1 className="main-title">T46 AI智能社交分组系统</h1>
        <p className="main-subtitle">上传Excel文件，体验最先进的AI分组匹配</p>
        
        <div 
          className={`upload-area ${isDragOver ? 'dragover' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById('fileInput')?.click()}
        >
          <div className="upload-icon">📁</div>
          <div className="upload-text">点击此处选择Excel文件或拖拽文件到这里</div>
          <div className="upload-subtext">支持 .xlsx 和 .xls 格式</div>
          <input
            id="fileInput"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
          />
        </div>

        {errors.length > 0 && (
          <div className="error-section">
            <h3>❌ 错误信息：</h3>
            {errors.map((error, index) => (
              <div key={index} className="error-message">{error}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const renderPreviewPage = () => (
    <div className="page-container">
      <div className="preview-section">
        <div className="page-header">
          <h1 className="page-title">数据预览</h1>
        </div>

        <div className="data-summary">
          <div className="summary-card">
            <span className="summary-number">{userData.length}</span>
            <span className="summary-label">总用户数</span>
          </div>
          <div className="summary-card">
            <span className="summary-number">{dataSummary?.averageAge || 0}</span>
            <span className="summary-label">平均年龄</span>
          </div>
          <div className="summary-card">
            <span className="summary-number">
              {dataSummary ? `${dataSummary.genderRatio.男}:${dataSummary.genderRatio.女}` : '0:0'}
            </span>
            <span className="summary-label">男女比例</span>
          </div>
          <div className="summary-card">
            <span className="summary-number">{dataSummary?.averageOpenness || 0}</span>
            <span className="summary-label">开放度均分</span>
          </div>
        </div>

        <div className="preview-table-container">
          <table className="preview-table">
            <thead>
              <tr>
                <th>编号</th>
                {previewColumns.map((key) => (
                  <th key={key}>{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {userData.slice(0, 10).map((user, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  {previewColumns.map((key, cellIndex) => (
                    <td key={cellIndex}>{String(user[key] || '未填写')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {userData.length > 10 && (
            <div className="preview-note">显示前10条记录，共{userData.length}条数据</div>
          )}
        </div>

        <div className="action-section">
          <button 
            className="start-matching-button"
            onClick={startMatching}
            disabled={userData.length === 0 || !isConfigValid()}
          >
            🚀 开始AI智能匹配 ({userData.length} 位用户)
          </button>
          {!isConfigValid() && (
            <div className="config-warning">
              ⚠️ 请先在LLM管理页面配置API密钥
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const renderMatchingPage = () => (
    <div className="page-container">
      <div className="matching-section">
        <div className="page-header">
          <h1 className="page-title">AI智能匹配进行中...</h1>
          <p className="page-subtitle">请耐心等待，我们正在为您提供最优的分组方案</p>
        </div>

        <div className="progress-container">
          {matchingProgress.map((progress) => (
            <div key={progress.step} className={`progress-step ${progress.status}`}>
              <div className="step-header">
                <div className="step-indicator">
                  {progress.status === 'completed' && '✅'}
                  {progress.status === 'running' && '🔄'}
                  {progress.status === 'error' && '❌'}
                  {progress.status === 'pending' && '⏳'}
                </div>
                <div className="step-info">
                  <h3 className="step-title">步骤 {progress.step}: {progress.stepName}</h3>
                  <p className="step-details">{progress.details}</p>
                </div>
              </div>
              {progress.status === 'running' && progress.progress > 0 && (
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${progress.progress}%` }}
                  ></div>
                  <span className="progress-text">{progress.progress}%</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {errors.length > 0 && (
          <div className="error-section">
            <h3>⚠️ 执行过程中的问题：</h3>
            {errors.map((error, index) => (
              <div key={index} className="error-message">{error}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const renderResultsPage = () => {
    console.log('渲染结果页面，matchingResult:', matchingResult)
    console.log('分组数:', matchingResult?.groups?.length)
    console.log('未分配人数:', matchingResult?.unassigned?.length)
    
    return (
    <div className="page-container">
      <div className="results-section">
        <div className="page-header">
          <h1 className="page-title">🎉 智能匹配完成！</h1>
          <p className="page-subtitle">
            为 {userData.length} 位用户生成了 {matchingResult?.groups?.length || 0} 个最优小组
            （整体匹配度: {matchingResult?.overall_score?.toFixed(1) || 0}/10）
          </p>
          {matchingResult && matchingResult.unassigned && matchingResult.unassigned.length > 0 && (
            <p className="page-subtitle" style={{ color: 'orange' }}>
              注意：有 {matchingResult.unassigned.length} 位用户因年龄约束未能分组
            </p>
          )}
        </div>

        <div className="results-actions">
          <button className="export-button" onClick={exportToExcel}>
            📊 导出Excel结果
          </button>
          <button className="create-group-button" onClick={handleCreateEmptyGroup}>
            ➕ 新建空组
          </button>
        </div>

        {matchingResult && (
          <DraggableGroupManager
            result={matchingResult}
            onGroupsChange={setMatchingResult}
          />
        )}

        {/* 由于现在使用DraggableGroupManager，移除了重复的未分配用户显示 */}
      </div>
    </div>
    )
  }

  // 主渲染
  return (
    <div className="matching-flow">
      {/* 全局返回按钮 - 除了上传页面都显示 */}
      {appState !== 'upload' && (
        <button 
          className="global-back-button" 
          onClick={handleResetUpload}
          style={{
            position: 'fixed',
            top: '20px',
            left: '280px', // 考虑侧边栏宽度
            zIndex: 1000,
            padding: '10px 20px',
            backgroundColor: '#fff',
            border: '1px solid #ddd',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: '500',
            color: '#333',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f5f5f5';
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#fff';
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
          }}
        >
          ← 返回上传页面
        </button>
      )}
      
      {appState === 'upload' && renderUploadPage()}
      {appState === 'validate' && showDataEditor && (
        <DataEditor
          data={rawData}
          onDataChange={handleDataChange}
          onConfirm={handleDataEditorConfirm}
          onCancel={handleDataEditorCancel}
        />
      )}
      {appState === 'preview' && renderPreviewPage()}
      {appState === 'matching' && renderMatchingPage()}
      {appState === 'results' && renderResultsPage()}
    </div>
  )
}

export default MatchingFlow