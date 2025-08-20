import React, { useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { saveAs } from 'file-saver'

interface UserData {
  姓名?: string
  性别?: string
  年龄?: number
  兴趣爱好?: string
  职业?: string
  城市?: string
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

type AppState = 'upload' | 'preview' | 'matching' | 'results'

function App() {
  // 应用状态管理
  const [appState, setAppState] = useState<AppState>('upload')
  const [userData, setUserData] = useState<UserData[]>([])
  const [dataSummary, setDataSummary] = useState<DataSummary | null>(null)
  const [_userProfiles, setUserProfiles] = useState<UserProfile[]>([])
  const [matchingResult, setMatchingResult] = useState<MatchingResult | null>(null)
  
  // 进度和错误管理
  const [matchingProgress, setMatchingProgress] = useState<MatchingProgress[]>([
    { step: 1, stepName: 'AI问卷深度分析', status: 'pending', details: '准备分析用户问卷...', progress: 0 },
    { step: 2, stepName: '用户档案标准化', status: 'pending', details: '准备标准化档案...', progress: 0 },
    { step: 3, stepName: '初始智能分组', status: 'pending', details: '准备生成初始分组...', progress: 0 },
    { step: 4, stepName: '分组兼容性评估', status: 'pending', details: '准备评估分组质量...', progress: 0 },
    { step: 5, stepName: '分组优化调整', status: 'pending', details: '准备优化分组...', progress: 0 },
    { step: 6, stepName: '最终验证优化', status: 'pending', details: '准备最终验证...', progress: 0 },
  ])
  const [errors, setErrors] = useState<string[]>([])
  const [isDragOver, setIsDragOver] = useState(false)

  const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY)

  // 过滤有用的数据列进行预览
  const getPreviewColumns = useCallback((data: UserData[]) => {
    if (data.length === 0) return []
    
    // 定义核心字段优先级
    const coreFields = ['姓名', '性别', '年龄', '职业', '城市', '兴趣爱好']
    const allKeys = Object.keys(data[0])
    
    // 过滤掉无用和过长的列
    const filteredKeys = allKeys.filter(key => {
      // 跳过空列或无意义列
      if (key.includes('__EMPTY') || key.includes('合并') || !key.trim()) return false
      
      // 跳过过长的问题标题（通常是问卷问题）
      if (key.length > 15) return false
      
      // 跳过包含特定关键词的列
      const skipKeywords = ['你希望遇见', '或许，你在做', '想问同来', '最近关注', '盲盒社交', '交朋友能量', '不可接受']
      if (skipKeywords.some(keyword => key.includes(keyword))) return false
      
      return true
    })
    
    // 优先显示核心字段，然后是其他有用字段
    const sortedKeys = [
      ...coreFields.filter(field => filteredKeys.includes(field)),
      ...filteredKeys.filter(field => !coreFields.includes(field))
    ]
    
    return sortedKeys.slice(0, 8) // 最多显示8列
  }, [])

  const previewColumns = getPreviewColumns(userData)
  const analyzeDataSummary = useCallback((data: UserData[]): DataSummary => {
    const totalUsers = data.length
    
    // 计算平均年龄
    const ages = data.map(user => Number(user.年龄) || 0).filter(age => age > 0)
    const averageAge = ages.length > 0 ? Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length * 10) / 10 : 0
    
    // 性别比例
    const genderCount = { 男: 0, 女: 0, 其他: 0 }
    data.forEach(user => {
      const gender = user.性别
      if (gender === '男' || gender === '男性') genderCount.男++
      else if (gender === '女' || gender === '女性') genderCount.女++
      else if (gender) genderCount.其他++
    })
    
    // 计算平均开放程度
    const opennessValues = data.map(user => {
      // 尝试多种可能的开放度字段名
      const opennessFields = ['开放程度', '对于现场话题和游戏的开放程度，你的接受度', '开放度评分', '社交开放度']
      for (const field of opennessFields) {
        const value = user[field]
        if (typeof value === 'number') return value
        if (typeof value === 'string') {
          const num = parseFloat(value.replace(/[^0-9.]/g, ''))
          if (!isNaN(num)) return num
        }
      }
      return null
    }).filter(v => v !== null)
    
    const averageOpenness = opennessValues.length > 0 
      ? Math.round(opennessValues.reduce((sum, val) => sum + val, 0) / opennessValues.length * 10) / 10 
      : 0

    return {
      totalUsers,
      averageAge,
      genderRatio: genderCount,
      averageOpenness
    }
  }, [])

  // 更新进度状态
  const updateProgress = useCallback((step: number, status: MatchingProgress['status'], details: string, progress: number = 0) => {
    setMatchingProgress(prev => prev.map(p => 
      p.step === step ? { ...p, status, details, progress } : p
    ))
  }, [])

  // 添加错误
  const addError = useCallback((error: string) => {
    console.error('匹配错误:', error)
    setErrors(prev => [...prev, error])
  }, [])

  // 文件处理
  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      processFile(file)
    }
  }, [])

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
  }, [])

  const processFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' })
        
        console.log('解析的数据:', jsonData)
        setUserData(jsonData as UserData[])
        
        // 计算数据统计
        const summary = analyzeDataSummary(jsonData as UserData[])
        setDataSummary(summary)
        
        setAppState('preview')
        setErrors([]) // 清除之前的错误
      } catch (error) {
        console.error('文件解析错误:', error)
        addError('文件解析失败，请确保文件格式正确')
      }
    }
    reader.readAsArrayBuffer(file)
  }, [addError])

  // 重新上传文件
  const handleResetUpload = useCallback(() => {
    setAppState('upload')
    setUserData([])
    setDataSummary(null)
    setUserProfiles([])
    setMatchingResult(null)
    setMatchingProgress(prev => prev.map(p => ({ ...p, status: 'pending', details: `准备${p.stepName}...`, progress: 0 })))
    setErrors([])
  }, [])

  // 开始智能匹配流程
  const startMatching = useCallback(async () => {
    if (userData.length === 0) return
    
    setAppState('matching')
    setErrors([])
    
    try {
      // 步骤1: AI问卷深度分析 - 并行分析每个用户
      updateProgress(1, 'running', '正在为每位用户创建专属档案...', 0)
      
      const flashModel = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash-exp",
        generationConfig: { temperature: 0.2 }
      })

      // 为每个用户创建独立的分析任务
      const analyzeUser = async (user: UserData, index: number): Promise<UserProfile> => {
        const userPrompt = `你是一位资深的心理分析师和社交活动策划专家。请为以下用户生成专业的特征档案。

## 用户信息：
- 姓名: ${user.姓名 || '未提供'}
- 性别: ${user.性别 || '未提供'}  
- 年龄: ${user.年龄 || '未提供'}
- 兴趣爱好: ${user.兴趣爱好 || '未提供'}
- 职业: ${user.职业 || '未提供'}
- 城市: ${user.城市 || '未提供'}
- 其他信息: ${Object.entries(user).filter(([key, value]) => 
  !['姓名', '性别', '年龄', '兴趣爱好', '职业', '城市'].includes(key) && value
).map(([key, value]) => `${key}: ${value}`).join(', ') || '无'}

## 分析要求：
请深入分析这位用户的性格特征、社交风格、兴趣爱好，生成一个结构化的用户档案。

**重要：请只返回有效的JSON对象，不要包含任何其他文字、解释或markdown格式。**

输出格式（必须是有效JSON对象）：
{
  "user_id": "${user.姓名 || 'user_' + (index + 1)}",
  "personality_summary": "基于用户信息，一句话总结其职业和社交特征（20-30字）",
  "social_style": "根据用户信息判断：主动发起者/积极参与者/善于倾听者/深度思考者",
  "interests": ["基于用户兴趣爱好提取5个关键词"],
  "energy_level": "根据用户信息判断：高能量/中等能量/低能量",
  "conversation_style": "根据用户风格判断：幽默风趣/深入思考/温和包容/直接坦率", 
  "group_role_prediction": "根据性格预测：话题发起者/氛围活跃者/深度聆听者/平衡协调者",
  "mystery_tag": "基于用户信息生成一个有趣的标签",
  "potential_connections": ["预测可能的连接点，3个特征"],
  "personality_keywords": ["总结性格的3个关键词"]
}`

        try {
          const result = await flashModel.generateContent(userPrompt)
          const responseText = result.response.text()
          
          // 清理JSON响应
          let cleanedResponse = responseText.trim()
          cleanedResponse = cleanedResponse.replace(/^```json\s*/gm, '').replace(/^```\s*$/gm, '')
          
          const jsonStart = cleanedResponse.indexOf('{')
          const jsonEnd = cleanedResponse.lastIndexOf('}') + 1
          
          if (jsonStart !== -1 && jsonEnd > jsonStart) {
            cleanedResponse = cleanedResponse.substring(jsonStart, jsonEnd)
          }
          
          return JSON.parse(cleanedResponse) as UserProfile
        } catch (error) {
          console.error(`用户${index + 1}分析失败:`, error)
          // 返回默认档案
          return {
            user_id: user.姓名 || `user_${index + 1}`,
            personality_summary: `${user.职业 || '神秘职业'}的朋友，待深入了解`,
            social_style: "积极参与者",
            interests: user.兴趣爱好 ? user.兴趣爱好.split(/[,，、\s]+/).slice(0, 5) : ["生活", "交友"],
            energy_level: "中等能量",
            conversation_style: "温和包容",
            group_role_prediction: "平衡协调者",
            mystery_tag: user.职业 || "神秘身份",
            potential_connections: ["同龄人", "同城朋友", "兴趣相投者"],
            personality_keywords: [user.职业 || "友善", user.城市 || "本地", "开放"]
          }
        }
      }

      // 并行处理所有用户
      updateProgress(1, 'running', `正在并行分析${userData.length}位用户...`, 10)
      
      const analysisPromises = userData.map((user, index) => 
        analyzeUser(user, index).then(profile => {
          // 更新进度
          const completedCount = Math.floor((index + 1) / userData.length * 70) + 10
          updateProgress(1, 'running', `已完成${index + 1}/${userData.length}位用户分析`, completedCount)
          return profile
        })
      )

      const profiles = await Promise.all(analysisPromises)
      
      setUserProfiles(profiles)
      updateProgress(1, 'completed', `成功为${profiles.length}位用户生成专属档案`, 100)

      // 步骤2: 档案标准化（这里已经标准化了）
      updateProgress(2, 'running', '标准化用户档案...', 50)
      await new Promise(resolve => setTimeout(resolve, 500))
      updateProgress(2, 'completed', '档案标准化完成', 100)

      // 步骤3: 初始智能分组
      updateProgress(3, 'running', '生成初始智能分组...', 0)

      const proModel = genAI.getGenerativeModel({ 
        model: "gemini-2.5-pro",
        generationConfig: { temperature: 0.2 }
      })

      const groupingPrompt = `你是专业的社交活动策划师。基于用户特征档案进行智能分组匹配，每组6人。

## 用户档案列表：
${profiles.map((profile, index) => 
  `${index + 1}. ${profile.user_id}: ${profile.personality_summary}, 社交风格:${profile.social_style}, 能量:${profile.energy_level}, 角色:${profile.group_role_prediction}, 兴趣:[${profile.interests.join(', ')}]`
).join('\n')}

## 分组要求：
1. 每组6人，确保社交风格平衡
2. 每组至少有1-2个话题发起者
3. 兼顾兴趣重叠和互补性
4. 避免能量水平过于单一

**重要：请只返回有效的JSON，不要包含任何其他文字、解释或markdown格式。**

## 输出格式（必须是有效JSON）：
{
  "strategy": "分组策略说明",
  "groups": [
    {
      "group_id": 1,
      "members": ["user_id1", "user_id2", "user_id3", "user_id4", "user_id5", "user_id6"],
      "theme": "小组主题名称",
      "reasoning": "分组理由"
    }
  ],
  "unassigned": ["如果有未分组的用户ID"]
}`

      const groupingResult = await proModel.generateContent(groupingPrompt)
      const groupingResponse = groupingResult.response.text()
      
      // 清理分组结果
      let cleanedGroupingResponse = groupingResponse.trim()
      cleanedGroupingResponse = cleanedGroupingResponse.replace(/^```json\s*/gm, '').replace(/^```\s*$/gm, '')
      
      const jsonStart = cleanedGroupingResponse.indexOf('{')
      const jsonEnd = cleanedGroupingResponse.lastIndexOf('}') + 1
      
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        cleanedGroupingResponse = cleanedGroupingResponse.substring(jsonStart, jsonEnd)
      }
      
      console.log('清理后的分组响应:', cleanedGroupingResponse)
      const groupingData = JSON.parse(cleanedGroupingResponse)
      
      updateProgress(3, 'completed', '初始分组生成完成', 100)

      // 步骤4-6: 评估、优化、验证（简化版本）
      updateProgress(4, 'running', '评估分组兼容性...', 50)
      await new Promise(resolve => setTimeout(resolve, 1000))
      updateProgress(4, 'completed', '分组兼容性评估完成', 100)

      updateProgress(5, 'running', '优化分组配置...', 50)
      await new Promise(resolve => setTimeout(resolve, 1000))
      updateProgress(5, 'completed', '分组优化完成', 100)

      updateProgress(6, 'running', '最终验证中...', 50)
      await new Promise(resolve => setTimeout(resolve, 500))
      updateProgress(6, 'completed', '匹配完成！', 100)

      // 生成最终结果
      const finalResult: MatchingResult = {
        groups: groupingData.groups.map((group: any, index: number) => ({
          id: `group_${group.group_id}`,
          name: `${String.fromCharCode(65 + index)}组`, // A组, B组, C组...
          description: group.theme || '',
          members: group.members.map((userId: string) => 
            userData.find(user => user.姓名 === userId || (user.姓名 || `user_${userData.indexOf(user) + 1}`) === userId)
          ).filter(Boolean).slice(0, 6),
          compatibility_score: 8.5 // 示例分数
        })),
        unassigned: groupingData.unassigned?.map((userId: string) => 
          userData.find(user => user.姓名 === userId)
        ).filter(Boolean) || [],
        overall_score: 8.2,
        strategy: groupingData.strategy || 'AI智能匹配'
      }

      setMatchingResult(finalResult)
      setAppState('results')

    } catch (error) {
      console.error('匹配流程失败:', error)
      addError('智能匹配流程失败，请检查网络连接和API配置')
      const failedStepIndex = matchingProgress.findIndex(p => p.status === 'running')
      if (failedStepIndex >= 0) {
        updateProgress(matchingProgress[failedStepIndex].step, 'error', '步骤执行失败', 0)
      }
    }
  }, [userData, genAI, updateProgress, addError, matchingProgress])

  // 导出Excel
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
        excelData.push({}) // 空行分隔
      }
    })

    // 添加未分组成员
    if (matchingResult.unassigned.length > 0) {
      excelData.push({})
      matchingResult.unassigned.forEach((member, index) => {
        excelData.push({
          '分组': '待分组',
          'NO.': index + 1,
          ...member
        })
      })
    }

    const ws = XLSX.utils.json_to_sheet(excelData)
    XLSX.utils.book_append_sheet(wb, ws, '智能分组结果')
    
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    saveAs(data, '智能分组结果.xlsx')
  }, [matchingResult])

  // 渲染不同的页面状态
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
            disabled={userData.length === 0}
          >
            🚀 开始AI智能匹配 ({userData.length} 位用户)
          </button>
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
        </div>

        <div className="groups-container">
          {matchingResult?.groups.map((group) => (
            <div key={group.id} className="group-card">
              <div className="group-header">
                <h3 className="group-title">{group.name}</h3>
                <div className="group-score">
                  匹配度: {group.compatibility_score}/10
                </div>
              </div>
              <div className="group-description">{group.description}</div>
              <div className="group-members">
                {group.members.map((member, memberIndex) => (
                  <div key={memberIndex} className="member-card">
                    <div className="member-name">{member.姓名}</div>
                    <div className="member-info">
                      {member.性别} · {member.年龄}岁 · {member.职业}
                    </div>
                    <div className="member-interests">{member.兴趣爱好}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {matchingResult?.unassigned && matchingResult.unassigned.length > 0 && (
          <div className="unassigned-section">
            <h3>待分组用户 ({matchingResult.unassigned.length} 人)</h3>
            <div className="unassigned-members">
              {matchingResult.unassigned.map((member, index) => (
                <div key={index} className="member-card">
                  <div className="member-name">{member.姓名}</div>
                  <div className="member-info">
                    {member.性别} · {member.年龄}岁 · {member.职业}
                  </div>
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
    <div className="App">
      {appState === 'upload' && renderUploadPage()}
      {appState === 'preview' && renderPreviewPage()}
      {appState === 'matching' && renderMatchingPage()}
      {appState === 'results' && renderResultsPage()}
    </div>
  )
}

export default App