import { useState, useCallback } from 'react'
import Sidebar, { NavigationPage } from './components/Sidebar'
import MatchingFlow from './components/MatchingFlow'
import ProcessOverview from './components/ProcessOverview'
import RulesManagement from './components/RulesManagement'
import LLMManagement from './components/LLMManagement'
import SystemSettings from './components/SystemSettings'
import UserProfileLibrary from './components/UserProfileLibrary'
import PromptEnhancement from './components/PromptEnhancement'
// import DraggableApiMonitor from './components/DraggableApiMonitor'
// import { useApiConfig } from './hooks/useApiConfig'

// 原有的API监控接口定义
interface ApiCall {
  id: string
  model: string
  operation: string
  timestamp: number
  status: 'pending' | 'success' | 'error'
  error?: string
  retryCount?: number
  duration?: number
  provider?: string
}

interface ApiMonitorState {
  calls: ApiCall[]
  quotaStatus: {
    [model: string]: {
      used: number
      limit: number
      resetTime: number
    }
  }
  totalCalls: number
  errorCount: number
  isOnline: boolean
}

function App() {
  const [currentPage, setCurrentPage] = useState<NavigationPage>('matching')
  const [matchingState, setMatchingState] = useState<{
    preserveState: boolean
    lastCompletedStep?: string
    hasResults: boolean
    forceReset?: boolean
  }>({
    preserveState: true, // 默认启用状态保持
    hasResults: false,
    forceReset: false
  })
  
  // 流程数据状态 - 用于流程总览页面
  const [processData, setProcessData] = useState<{
    steps: any[]
    currentData?: any
  }>({
    steps: [],
    currentData: null
  })

  // 从localStorage获取匹配数据用于流程总览
  const getStoredMatchingData = useCallback(() => {
    try {
      const stored = localStorage.getItem('t46-matching-state')
      if (stored) {
        const data = JSON.parse(stored)
        return {
          userData: data.userData || [],
          profiles: data.userData ? data.userData.map((user: any, index: number) => ({
            user_id: `user_${index + 1}`,
            personality_summary: '已分析',
            ...user
          })) : [],
          proposals: data.matchingResult ? [{ groups: data.matchingResult.groups }] : [],
          reviewResults: data.matchingResult ? [{ approved: true, overall_score: data.matchingResult.overall_score }] : [],
          optimizedResult: data.matchingResult || null,
          finalResult: data.matchingResult || null
        }
      }
    } catch (error) {
      console.error('读取匹配数据失败:', error)
    }
    
    // 返回演示数据
    return {
      userData: [
        { 自选昵称: '张三', 性别: '男', 年龄: 28, 职业: '工程师' },
        { 自选昵称: '李四', 性别: '女', 年龄: 25, 职业: '设计师' },
        { 自选昵称: '王五', 性别: '男', 年龄: 30, 职业: '产品经理' },
        { 自选昵称: '赵六', 性别: '女', 年龄: 27, 职业: '运营' }
      ],
      profiles: [
        { user_id: 'user_1', personality_summary: '外向型技术专家' },
        { user_id: 'user_2', personality_summary: '创意型设计师' },
        { user_id: 'user_3', personality_summary: '领导型产品专家' },
        { user_id: 'user_4', personality_summary: '沟通型运营专家' }
      ],
      proposals: [
        { 
          groups: [
            { id: 'group_1', name: '第1组', members: [], description: '' },
            { id: 'group_2', name: '第2组', members: [], description: '' }
          ]
        }
      ],
      reviewResults: [{ approved: true, overall_score: 8.5 }],
      optimizedResult: { overall_score: 9.0 },
      finalResult: { 
        groups: [
          { members: [{}, {}] },
          { members: [{}, {}] }
        ],
        unassigned: [],
        overall_score: 9.0
      }
    }
  }, [])
  
  // API监控状态（保持原有逻辑）
  const [apiMonitor, setApiMonitor] = useState<ApiMonitorState>({
    calls: [],
    quotaStatus: {},
    totalCalls: 0,
    errorCount: 0,
    isOnline: true
  })
  // const { isConfigValid } = useApiConfig()

  // 处理匹配状态更新的回调
  const handleMatchingStateChange = useCallback((state: {
    preserveState?: boolean
    lastCompletedStep?: string
    hasResults?: boolean
  }) => {
    setMatchingState(prev => ({ ...prev, ...state }))
  }, [])

  // 重置匹配状态 - 只有点击返回按钮时调用
  const handleResetMatching = useCallback(() => {
    // 清除localStorage中的状态
    localStorage.removeItem('t46-matching-state')
    setMatchingState({
      preserveState: false,
      hasResults: false,
      forceReset: true
    })
    // 稍后重新启用状态保持
    setTimeout(() => {
      setMatchingState(prev => ({ ...prev, preserveState: true, forceReset: false }))
    }, 100)
  }, [])

  // API监控工具函数（保持原有逻辑）
  const trackApiCall = useCallback((model: string, operation: string, provider?: string): string => {
    const callId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newCall: ApiCall = {
      id: callId,
      model,
      operation,
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0,
      provider
    }
    
    setApiMonitor(prev => ({
      ...prev,
      calls: [...prev.calls.slice(-50), newCall],
      totalCalls: prev.totalCalls + 1,
      quotaStatus: {
        ...prev.quotaStatus,
        [model]: {
          ...prev.quotaStatus[model],
          used: prev.quotaStatus[model]?.used + 1 || 1,
          limit: prev.quotaStatus[model]?.limit || 1000,
          resetTime: prev.quotaStatus[model]?.resetTime || Date.now() + 60000
        }
      }
    }))
    
    return callId
  }, [])

  const updateApiCall = useCallback((callId: string, updates: Partial<ApiCall>) => {
    setApiMonitor(prev => ({
      ...prev,
      calls: prev.calls.map(call => 
        call.id === callId ? { ...call, ...updates } : call
      ),
      errorCount: updates.status === 'error' && prev.calls.find(c => c.id === callId)?.status !== 'error' 
        ? prev.errorCount + 1 
        : prev.errorCount
    }))
  }, [])

  // const resetApiMonitor = useCallback(() => {
  //   setApiMonitor(prev => ({
  //     ...prev,
  //     calls: [],
  //     totalCalls: 0,
  //     errorCount: 0,
  //     quotaStatus: Object.keys(prev.quotaStatus).reduce((acc, model) => ({
  //       ...acc,
  //       [model]: { ...prev.quotaStatus[model], used: 0 }
  //     }), {})
  //   }))
  // }, [])

  // API调用处理函数
  const handleApiCall = useCallback((model: string, operation: string, status: 'success' | 'error', duration?: number, provider?: string) => {
    const callId = trackApiCall(model, operation, provider)
    updateApiCall(callId, { 
      status, 
      duration: duration || 0,
      error: status === 'error' ? 'API调用失败' : undefined
    })
  }, [trackApiCall, updateApiCall])

  // 渲染旧版API监控组件（备用）

  // 渲染当前页面内容
  const renderPageContent = () => {
    switch (currentPage) {
      case 'matching':
        return (
          <MatchingFlow 
            onApiCall={handleApiCall} 
            preserveState={matchingState.preserveState}
            onStateChange={handleMatchingStateChange}
            onResetState={handleResetMatching}
            forceReset={matchingState.forceReset}
            onProcessDataChange={setProcessData}
          />
        )
      case 'process-overview':
        const currentData = getStoredMatchingData()
        const hasRealData = currentData.userData.length > 4 // 判断是否有真实数据
        
        return (
          <div className="page-wrapper">
            <ProcessOverview 
              steps={processData.steps.length > 0 ? processData.steps : [
                { 
                  step: 1, 
                  stepName: 'AI问卷深度分析', 
                  status: hasRealData ? 'completed' : 'pending', 
                  details: hasRealData ? `已分析${currentData.userData.length}位用户` : '准备分析用户问卷...', 
                  progress: hasRealData ? 100 : 0 
                },
                { 
                  step: 2, 
                  stepName: '用户档案标准化', 
                  status: hasRealData ? 'completed' : 'pending', 
                  details: hasRealData ? '档案标准化完成' : '准备标准化档案...', 
                  progress: hasRealData ? 100 : 0 
                },
                { 
                  step: 3, 
                  stepName: 'MatchingAgent生成方案', 
                  status: hasRealData ? 'completed' : 'running', 
                  details: hasRealData ? '分组方案已生成' : '正在生成分组方案...', 
                  progress: hasRealData ? 100 : 60 
                },
                { 
                  step: 4, 
                  stepName: 'ReviewAgent严格审批', 
                  status: hasRealData ? 'completed' : 'pending', 
                  details: hasRealData ? '方案审批通过' : '等待审批...', 
                  progress: hasRealData ? 100 : 0 
                },
                { 
                  step: 5, 
                  stepName: '智能优化循环', 
                  status: hasRealData ? 'completed' : 'pending', 
                  details: hasRealData ? '优化完成' : '准备优化...', 
                  progress: hasRealData ? 100 : 0 
                },
                { 
                  step: 6, 
                  stepName: '最终确认输出', 
                  status: hasRealData ? 'completed' : 'pending', 
                  details: hasRealData ? '最终结果已确认' : '准备生成最终结果...', 
                  progress: hasRealData ? 100 : 0 
                }
              ]}
              currentData={currentData}
            />
          </div>
        )
      case 'rules-management':
        return (
          <div className="page-wrapper">
            <RulesManagement />
          </div>
        )
      case 'llm-management':
        return (
          <div className="page-wrapper">
            <LLMManagement />
          </div>
        )
      case 'api-monitor':
        return (
          <div className="page-wrapper">
            <div className="api-monitor-page">
            <div className="page-header">
              <h1 className="page-title">📊 API监控中心</h1>
              <p className="page-subtitle">实时监控API调用状态和配额使用情况</p>
            </div>
            
            <div className="monitor-grid">
              {/* 状态概览卡片 */}
              <div className="monitor-card status-overview">
                <h3 className="card-title">🌐 系统状态</h3>
                <div className="status-indicator-large">
                  <div className={`status-circle ${apiMonitor.isOnline ? 'online' : 'offline'}`}>
                    {apiMonitor.isOnline ? '✅' : '❌'}
                  </div>
                  <span className="status-text">{apiMonitor.isOnline ? '正常运行' : '系统离线'}</span>
                </div>
              </div>

              {/* 调用统计卡片 */}
              <div className="monitor-card calls-stat">
                <h3 className="card-title">📋 调用统计</h3>
                <div className="stat-grid">
                  <div className="stat-item">
                    <div className="stat-value">{apiMonitor.totalCalls}</div>
                    <div className="stat-label">总调用</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value error">{apiMonitor.errorCount}</div>
                    <div className="stat-label">错误</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value success">
                      {apiMonitor.totalCalls - apiMonitor.errorCount}
                    </div>
                    <div className="stat-label">成功</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">
                      {apiMonitor.totalCalls > 0 
                        ? Math.round(((apiMonitor.totalCalls - apiMonitor.errorCount) / apiMonitor.totalCalls) * 100)
                        : 100}%
                    </div>
                    <div className="stat-label">成功率</div>
                  </div>
                </div>
              </div>

              {/* 模型配额卡片 */}
              <div className="monitor-card quota-status">
                <h3 className="card-title">📦 模型配额</h3>
                <div className="quota-list">
                  {Object.entries(apiMonitor.quotaStatus).map(([model, quota]: [string, any]) => {
                    const percentage = (quota.used / quota.limit) * 100
                    return (
                      <div key={model} className="quota-item">
                        <div className="quota-header">
                          <span className="model-name">{model}</span>
                          <span className="quota-text">{quota.used}/{quota.limit}</span>
                        </div>
                        <div className="quota-bar">
                          <div 
                            className="quota-fill"
                            style={{ 
                              width: `${percentage}%`,
                              background: percentage > 80 ? '#ff4444' : percentage > 50 ? '#ff9500' : '#00c851'
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                  {Object.keys(apiMonitor.quotaStatus).length === 0 && (
                    <div className="empty-state">暂无模型配额信息</div>
                  )}
                </div>
              </div>

              {/* 最近调用卡片 */}
              <div className="monitor-card recent-calls">
                <h3 className="card-title">🕒 最近调用</h3>
                <div className="calls-list">
                  {apiMonitor.calls.slice(-5).reverse().map(call => (
                    <div key={call.id} className={`call-item status-${call.status}`}>
                      <div className="call-time">
                        {new Date(call.timestamp).toLocaleTimeString()}
                      </div>
                      <div className="call-info">
                        <span className="call-model">{call.model}</span>
                        <span className="call-operation">{call.operation}</span>
                      </div>
                      <div className="call-status">
                        {call.status === 'success' && '✅'}
                        {call.status === 'error' && '❌'}
                        {call.status === 'pending' && '⏳'}
                      </div>
                    </div>
                  ))}
                  {apiMonitor.calls.length === 0 && (
                    <div className="empty-state">暂无调用记录</div>
                  )}
                </div>
              </div>
            </div>

            <div className="monitor-footer">
              <p className="monitor-tip">
                💡 提示：可拖动的API监控浮窗提供更详细的实时监控信息
              </p>
            </div>
          </div>
          </div>
        )
      case 'user-profiles':
        return (
          <div className="page-wrapper">
            <UserProfileLibrary />
          </div>
        )
      case 'prompt-enhancement':
        return (
          <div className="page-wrapper">
            <PromptEnhancement />
          </div>
        )
      case 'settings':
        return (
          <div className="page-wrapper">
            <SystemSettings />
          </div>
        )
      default:
        return <MatchingFlow onApiCall={handleApiCall} />
    }
  }

  return (
    <div className="App">
      <Sidebar
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        apiStatus={{
          isOnline: apiMonitor.isOnline,
          totalCalls: apiMonitor.totalCalls,
          errorCount: apiMonitor.errorCount
        }}
        apiCalls={apiMonitor.calls}
        quotaStatus={apiMonitor.quotaStatus}
        matchingState={matchingState}
        onResetMatching={handleResetMatching}
      />
      <main className="main-content">
        {renderPageContent()}
      </main>
    </div>
  )
}

export default App