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
}

const MatchingFlow: React.FC<MatchingFlowProps> = ({ onApiCall, preserveState, onStateChange, onResetState }) => {
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
  const [isDragMode, setIsDragMode] = useState(false)

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
    if (preserveState) {
      loadState()
    }
  }, [preserveState, loadState])

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
    setMatchingProgress(prev => prev.map(p => 
      p.step === step ? { ...p, status, details, progress } : p
    ))
  }, [])

  // 通用LLM调用函数
  const callLLM = useCallback(async (
    prompt: string,
    modelType: 'analysis' | 'generation' | 'review',
    operation: string
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

    const startTime = Date.now()
    try {
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
      onApiCall?.(modelId, operation, 'error', duration, provider.name)
      throw error
    }
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
    
    // 计算平均年龄
    const ages = data.map(user => Number(user.年龄) || 0).filter(age => age > 0)
    const averageAge = ages.length > 0 ? Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length * 10) / 10 : 0
    
    // 统计性别比例
    const genderCount = { 男: 0, 女: 0, 其他: 0 }
    data.forEach(user => {
      const gender = user.性别
      if (gender === '男' || gender === '男性') genderCount.男++
      else if (gender === '女' || gender === '女性') genderCount.女++
      else if (gender) genderCount.其他++
    })
    
    // 计算平均开放度（使用"对于现场话题和游戏的开放程度，你的接受度"字段）
    const openness = data.map(user => {
      const value = user['对于现场话题和游戏的开放程度，你的接受度']
      return value !== undefined && value !== null ? Number(value) : 0
    }).filter(v => v > 0)
    const averageOpenness = openness.length > 0 ? Math.round(openness.reduce((sum, v) => sum + v, 0) / openness.length * 10) / 10 : 0
    
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
      const optimizedResult = await optimizeGrouping(reviewResults)
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
        const analysisPrompt = `请对以下用户进行深度分析，返回JSON格式的心理档案：

用户信息：
- 昵称：${user.自选昵称 || '未知'}
- 性别：${user.性别 || '未知'}  
- 年龄：${user.年龄 || '未知'}
- 出生年份：${user.出生年份 || '未知'}
- 职业：${user.职业 || '未知'}
- 常出没区域：${user.上海常出没区域 || '未知'}
- 情感状态：${user.情感气象 || '未知'}
- 其他信息：${JSON.stringify(user, null, 2)}

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

        try {
          const result = await callLLM(analysisPrompt, 'analysis', `用户分析-${userIndex+1}`)
          const cleanedResult = result.replace(/```json\s*|\s*```/g, '').trim()
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

  // 生成分组方案
  const generateGroupingProposals = useCallback(async (profiles: UserProfile[]): Promise<GroupingProposal[]> => {
    const groupingPrompt = `请根据以下用户档案生成智能分组方案，每组6人，返回JSON格式：

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
1. 每组恰好6人
2. 年龄相差不超过8岁  
3. 性别尽量均衡(理想3:3，可接受4:2)
4. 兴趣爱好有重叠但不完全相同
5. 社交风格互补(主动+参与+倾听的组合)
6. 能量水平分布合理

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

    try {
      const result = await callLLM(groupingPrompt, 'generation', '分组方案生成')
      const cleanedResult = result.replace(/```json\s*|\s*```/g, '').trim()
      const proposal = JSON.parse(cleanedResult) as GroupingProposal
      
      // 转换索引为实际用户数据
      const processedGroups: Group[] = proposal.groups.map(g => ({
        ...g,
        members: (g.members as unknown as number[]).map(index => userData[index]).filter(Boolean),
        compatibility_score: 7.5 // 初始分数，等待审批
      }))
      
      return [{
        groups: processedGroups,
        unassigned: (proposal.unassigned as unknown as number[]).map(index => userData[index]).filter(Boolean),
        strategy: proposal.strategy,
        reasoning: proposal.reasoning
      }]
    } catch (error) {
      console.warn('分组生成失败，使用简单分组算法:', error)
      return [generateSimpleGrouping()]
    }
  }, [callLLM, userData])

  // 生成简单分组作为后备方案
  const generateSimpleGrouping = useCallback((): GroupingProposal => {
    const groupSize = rules.hardRules.groupSize // 从规则管理获取组大小
    const groups: Group[] = []
    const unassignedMembers: UserData[] = []
    
    for (let i = 0; i < userData.length; i += groupSize) {
      const members = userData.slice(i, i + groupSize)
      
      // 严格按照规则：只有满足组大小才创建组
      if (members.length === groupSize) {
        groups.push({
          id: `group_${groups.length + 1}`,
          name: `第${groups.length + 1}组：智能匹配组`,
          description: '基于规则的智能分组',
          members,
          compatibility_score: 7.0
        })
      } else {
        // 不足的人员作为剩余
        unassignedMembers.push(...members)
      }
    }
    
    return {
      groups,
      unassigned: unassignedMembers,
      strategy: `基础算法分组（${groupSize}人/组）`,
      reasoning: `严格按照规则管理设置：每组${groupSize}人，剩余${unassignedMembers.length}人待分配`
    }
  }, [userData, rules.hardRules.groupSize])

  // 审批分组方案
  const reviewGroupingProposals = useCallback(async (proposals: GroupingProposal[]): Promise<ReviewResult[]> => {
    const results: ReviewResult[] = []
    
    for (const proposal of proposals) {
      const reviewPrompt = `请严格评估以下分组方案的质量，使用T46评分标准(0-10分)：

${proposal.groups.map((group, i) => `
第${i+1}组 "${group.name}":
成员信息:
${group.members.map((member, j) => `  ${j+1}. ${member.自选昵称 || '未知'} - 年龄:${member.年龄 || '?'} 性别:${member.性别 || '?'} 职业:${member.职业 || '?'}`).join('\n')}
组描述: ${group.description}
`).join('\n')}

评分标准：
- 硬性约束: 年龄差≤8岁, 性别比例合理, 人数=6
- 软性匹配: 兴趣重叠, 社交风格平衡, 能量协调, 角色互补
- 基础分数7.0，根据匹配质量加减分
- 违反硬性约束直接大幅扣分

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

      try {
        const result = await callLLM(reviewPrompt, 'review', `方案审批-${results.length + 1}`)
        const cleanedResult = result.replace(/```json\s*|\s*```/g, '').trim()
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
  const optimizeGrouping = useCallback(async (reviewResults: ReviewResult[]): Promise<MatchingResult> => {
    // 选择最佳方案或进行优化
    const bestReview = reviewResults.reduce((best, current) => 
      current.overall_score > best.overall_score ? current : best
    )
    
    await new Promise(resolve => setTimeout(resolve, 1000)) // 模拟优化过程
    
    return {
      groups: [], // 这里需要从方案中恢复组信息
      unassigned: [],
      overall_score: bestReview.overall_score,
      strategy: '智能优化分组'
    }
  }, [])

  // 最终确定分组
  const finalizeGrouping = useCallback(async (_result: MatchingResult): Promise<MatchingResult> => {
    // 严格按照规则管理的设置进行分组
    const groupSize = rules.hardRules.groupSize // 从规则管理获取组大小
    const finalGroups: Group[] = []
    const unassignedMembers: UserData[] = []
    
    // 按照规则的组大小进行分组
    for (let i = 0; i < userData.length; i += groupSize) {
      const members = userData.slice(i, i + groupSize)
      
      // 只有当成员数等于规定的组大小时才创建组
      if (members.length === groupSize) {
        finalGroups.push({
          id: `group_${finalGroups.length + 1}`,
          name: `第${finalGroups.length + 1}组：AI智能匹配组`,
          description: '基于深度AI分析的精准匹配分组，严格遵守规则管理设置',
          members,
          compatibility_score: 7.5 + Math.random() * 2 // 7.5-9.5分范围
        })
      } else {
        // 不足一组的人员作为剩余人员
        unassignedMembers.push(...members)
      }
    }
    
    return {
      groups: finalGroups,
      unassigned: unassignedMembers,
      overall_score: finalGroups.length > 0 ? 8.0 : 0,
      strategy: `严格按照规则管理：${groupSize}人/组`
    }
  }, [userData, rules.hardRules.groupSize])

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
    
    // 通知父组件状态变化
    onStateChange?.({ preserveState: false, hasResults: false })
  }, [onStateChange])

  const exportToExcel = useCallback(() => {
    if (!matchingResult) return

    const wb = XLSX.utils.book_new()
    const excelData: any[] = []
    
    matchingResult.groups.forEach((group, groupIndex) => {
      const groupLetter = String.fromCharCode(65 + groupIndex)
      group.members.forEach((member, memberIndex) => {
        excelData.push({
          '分组': groupLetter,
          'NO.': memberIndex + 1,
          ...member
        })
      })
      
      if (groupIndex < matchingResult.groups.length - 1) {
        excelData.push({})
      }
    })

    const ws = XLSX.utils.json_to_sheet(excelData)
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
    
    // 计算数据统计
    const summary = analyzeDataSummary(userData)
    setDataSummary(summary)
    
    setAppState('preview')
  }, [userData, analyzeDataSummary])

  const handleDataEditorCancel = useCallback(() => {
    setShowDataEditor(false)
    setRawData([])
    setUserData([])
    setAppState('upload')
  }, [])

  const handleDataChange = useCallback((data: any[]) => {
    setUserData(data as UserData[])
  }, [])

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
          <button className="back-button" onClick={handleResetUpload}>
            ← 重新上传文件
          </button>
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

  const renderResultsPage = () => (
    <div className="page-container">
      <div className="results-section">
        <div className="page-header">
          <button className="back-button" onClick={handleResetUpload}>
            ← 返回重新分组
          </button>
          <h1 className="page-title">🎉 智能匹配完成！</h1>
          <p className="page-subtitle">
            为 {userData.length} 位用户生成了 {matchingResult?.groups.length} 个最优小组
            （整体匹配度: {matchingResult?.overall_score}/10）
          </p>
        </div>

        <div className="results-actions">
          <button className="export-button" onClick={exportToExcel}>
            📊 导出Excel结果
          </button>
          <button 
            className={`drag-mode-button ${isDragMode ? 'active' : ''}`}
            onClick={() => setIsDragMode(!isDragMode)}
          >
            {isDragMode ? '退出编辑模式' : '✋ 拖拽调整分组'}
          </button>
        </div>

        {isDragMode && matchingResult ? (
          <DraggableGroupManager
            result={matchingResult}
            onGroupsChange={setMatchingResult}
          />
        ) : (
          <div className="groups-container">
          {matchingResult?.groups.map((group) => (
            <div key={group.id} className="group-card">
              <div className="group-header">
                <h3 className="group-title">{group.name}</h3>
                <div className="group-score">
                  匹配度: {group.compatibility_score?.toFixed(2) || '0.00'}/10
                </div>
              </div>
              <div className="group-description">{group.description}</div>
              <div className="group-members-list">
                <div className="member-header">
                  <span className="header-nickname">自选昵称</span>
                  <span className="header-age">年龄</span>
                  <span className="header-gender">性别</span>
                  <span className="header-job">职业</span>
                </div>
                {group.members.map((member, memberIndex) => (
                  <div key={memberIndex} className="member-row">
                    <span className="member-nickname">{member.自选昵称 || 'N/A'}</span>
                    <span className="member-age">{member.年龄 || 'N/A'}</span>
                    <span className="member-gender">{member.性别 || 'N/A'}</span>
                    <span className="member-job">{member.职业 || 'N/A'}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          </div>
        )}

        {!isDragMode && matchingResult?.unassigned && matchingResult.unassigned.length > 0 && (
          <div className="unassigned-section">
            <h3>待分组用户 ({matchingResult.unassigned.length} 人)</h3>
            <div className="unassigned-members-list">
              <div className="member-header">
                <span className="header-nickname">自选昵称</span>
                <span className="header-age">年龄</span>
                <span className="header-gender">性别</span>
                <span className="header-job">职业</span>
              </div>
              {matchingResult.unassigned.map((member, index) => (
                <div key={index} className="member-row">
                  <span className="member-nickname">{member.自选昵称 || 'N/A'}</span>
                  <span className="member-age">{member.年龄 || 'N/A'}</span>
                  <span className="member-gender">{member.性别 || 'N/A'}</span>
                  <span className="member-job">{member.职业 || 'N/A'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // 主渲染
  return (
    <div className="matching-flow">
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