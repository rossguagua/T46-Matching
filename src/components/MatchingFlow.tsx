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
  const { rules } = useMatchingRules()
  
  // 应用状态管理
  const [appState, setAppState] = useState<AppState>('upload')
  const [userData, setUserData] = useState<UserData[]>([])
  const [rawData, setRawData] = useState<UserData[]>([]) // 保存原始上传的数据
  const [showDataEditor, setShowDataEditor] = useState(false)
  const [dataSummary, setDataSummary] = useState<DataSummary | null>(null)
  const [matchingResult, setMatchingResult] = useState<MatchingResult | null>(null)
  
  // 进度和错误管理
  const [matchingProgress, setMatchingProgress] = useState<MatchingProgress[]>([
    { step: 1, stepName: '数据分析与策略制定', status: 'pending', details: '准备分析用户数据和制定分组策略...', progress: 0 },
    { step: 2, stepName: '2男4女组分配', status: 'pending', details: '准备分配2男4女混合组...', progress: 0 },
    { step: 3, stepName: '3男3女组分配', status: 'pending', details: '准备分配3男3女混合组...', progress: 0 },
    { step: 4, stepName: '全女组分配', status: 'pending', details: '准备处理全女组分配...', progress: 0 },
    { step: 5, stepName: '局部优化调整', status: 'pending', details: '准备进行组间优化调整...', progress: 0 },
    { step: 6, stepName: '完成验证', status: 'pending', details: '准备验证最终结果...', progress: 0 },
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
            { step: 1, stepName: '数据分析与策略制定', status: 'pending', details: '准备分析用户数据和制定分组策略...', progress: 0 },
            { step: 2, stepName: '2男4女组分配', status: 'pending', details: '准备分配2男4女混合组...', progress: 0 },
            { step: 3, stepName: '3男3女组分配', status: 'pending', details: '准备分配3男3女混合组...', progress: 0 },
            { step: 4, stepName: '全女组分配', status: 'pending', details: '准备处理全女组分配...', progress: 0 },
            { step: 5, stepName: '局部优化调整', status: 'pending', details: '准备进行组间优化调整...', progress: 0 },
            { step: 6, stepName: '完成验证', status: 'pending', details: '准备验证最终结果...', progress: 0 },
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
        { step: 1, stepName: '数据分析与策略制定', status: 'pending', details: '准备分析用户数据和制定分组策略...', progress: 0 },
        { step: 2, stepName: '2男4女组分配', status: 'pending', details: '准备分配2男4女混合组...', progress: 0 },
        { step: 3, stepName: '3男3女组分配', status: 'pending', details: '准备分配3男3女混合组...', progress: 0 },
        { step: 4, stepName: '全女组分配', status: 'pending', details: '准备处理全女组分配...', progress: 0 },
        { step: 5, stepName: '局部优化调整', status: 'pending', details: '准备进行组间优化调整...', progress: 0 },
        { step: 6, stepName: '完成验证', status: 'pending', details: '准备验证最终结果...', progress: 0 },
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

  // 注意：已删除LLM调用函数，现在使用纯算法方法

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

  // 开始算法匹配流程（全新算法实现）
  const startMatching = useCallback(async () => {
    if (userData.length === 0) return
    
    setAppState('matching')
    setErrors([])

    // 检查基础配置（不再需要LLM）
    const currentRules = rules.hardRules
    if (!currentRules || currentRules.groupSize < 2) {
      setErrors(['分组规则配置无效，请检查规则管理设置'])
      return
    }
    
    try {
      // 导入算法模块
      const { AlgorithmicMatcher } = await import('../algorithms/AlgorithmicMatcher')
      
      // 算法配置
      const algorithmConfig = {
        maxAgeGap: currentRules.maxAgeGap,
        groupSize: currentRules.groupSize,
        enableLocalOptimization: true,
        maxExecutionTime: 30000 // 30秒超时
      }

      // 执行算法匹配
      const result = await AlgorithmicMatcher.executeMatching(
        userData,
        algorithmConfig,
        (progress) => {
          // 将算法进度转换为UI进度
          const phaseMap = {
            'ANALYZING': { step: 1, name: '数据分析与策略制定' },
            'MIXED_2M4F': { step: 2, name: '2男4女组分配' },
            'MIXED_3M3F': { step: 3, name: '3男3女组分配' },
            'ALL_FEMALE': { step: 4, name: '全女组分配' },
            'OPTIMIZING': { step: 5, name: '局部优化调整' },
            'COMPLETED': { step: 6, name: '完成验证' }
          }
          
          const phaseInfo = phaseMap[progress.phase]
          if (phaseInfo) {
            const status = progress.phase === 'COMPLETED' ? 'completed' : 'running'
            updateProgress(phaseInfo.step, status, progress.message, progress.progress)
          }
        }
      )
      
      // 设置最终结果
      setMatchingResult(result)
      updateProgress(6, 'completed', '算法分组全部完成！', 100)
      setAppState('results')
      
    } catch (error) {
      console.error('算法匹配失败:', error)
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      setErrors([`算法匹配失败: ${errorMessage}`])
      
      // 找到当前正在执行的步骤并标记为错误
      const currentStep = matchingProgress.findIndex(p => p.status === 'running')
      if (currentStep >= 0) {
        updateProgress(currentStep + 1, 'error', `执行失败: ${errorMessage}`, 0)
      }
    }
  }, [userData, rules.hardRules, matchingProgress, updateProgress])

  // 注意：已删除AI相关函数，现在使用纯算法方法

  // 注意：已删除传统年龄约束验证函数，现在由算法模块内部处理

  // 注意：已删除AI分组生成函数，现在使用纯算法方法

  // 注意：已删除简单分组后备方案，现在由算法模块内部处理

  // 注意：已删除AI审批和优化函数，现在使用纯算法方法

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
      { step: 1, stepName: '数据分析与策略制定', status: 'pending', details: '准备分析用户数据和制定分组策略...', progress: 0 },
      { step: 2, stepName: '2男4女组分配', status: 'pending', details: '准备分配2男4女混合组...', progress: 0 },
      { step: 3, stepName: '3男3女组分配', status: 'pending', details: '准备分配3男3女混合组...', progress: 0 },
      { step: 4, stepName: '全女组分配', status: 'pending', details: '准备处理全女组分配...', progress: 0 },
      { step: 5, stepName: '局部优化调整', status: 'pending', details: '准备进行组间优化调整...', progress: 0 },
      { step: 6, stepName: '完成验证', status: 'pending', details: '准备验证最终结果...', progress: 0 },
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
        <h1 className="main-title">T46 智能社交分组系统</h1>
        <p className="main-subtitle">上传Excel文件，体验严密的算法分组匹配</p>
        
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
            disabled={userData.length === 0 || !rules.hardRules}
          >
            🚀 开始智能算法匹配 ({userData.length} 位用户)
          </button>
          {!rules.hardRules && (
            <div className="config-warning">
              ⚠️ 请先在规则管理页面配置分组参数
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
          <h1 className="page-title">智能算法匹配进行中...</h1>
          <p className="page-subtitle">请耐心等待，严密算法正在为您计算最优分组方案</p>
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