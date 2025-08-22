import { useState, useCallback } from 'react'
import Sidebar, { NavigationPage } from './components/Sidebar'
import MatchingFlow from './components/MatchingFlow'
import RulesManagement from './components/RulesManagement'
import LLMManagement from './components/LLMManagement'
import SystemSettings from './components/SystemSettings'
import DraggableApiMonitor from './components/DraggableApiMonitor'
import { useApiConfig } from './hooks/useApiConfig'

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
  }>({
    preserveState: true, // 默认启用状态保持
    hasResults: false
  })
  
  // API监控状态（保持原有逻辑）
  const [apiMonitor, setApiMonitor] = useState<ApiMonitorState>({
    calls: [],
    quotaStatus: {},
    totalCalls: 0,
    errorCount: 0,
    isOnline: true
  })
  const [showApiDetails, setShowApiDetails] = useState(false)

  const { isConfigValid, config } = useApiConfig()

  // 处理匹配状态更新的回调
  const handleMatchingStateChange = useCallback((state: {
    preserveState?: boolean
    lastCompletedStep?: string
    hasResults?: boolean
  }) => {
    setMatchingState(prev => ({ ...prev, ...state }))
  }, [])

  // 重置匹配状态
  const handleResetMatching = useCallback(() => {
    setMatchingState({
      preserveState: false,
      hasResults: false
    })
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

  const resetApiMonitor = useCallback(() => {
    setApiMonitor(prev => ({
      ...prev,
      calls: [],
      totalCalls: 0,
      errorCount: 0,
      quotaStatus: Object.keys(prev.quotaStatus).reduce((acc, model) => ({
        ...acc,
        [model]: { ...prev.quotaStatus[model], used: 0 }
      }), {})
    }))
  }, [])

  // API调用处理函数
  const handleApiCall = useCallback((model: string, operation: string, status: 'success' | 'error', duration?: number, provider?: string) => {
    const callId = trackApiCall(model, operation, provider)
    updateApiCall(callId, { 
      status, 
      duration: duration || 0,
      error: status === 'error' ? 'API调用失败' : undefined
    })
  }, [trackApiCall, updateApiCall])

  // 渲染API监控组件
  const renderApiMonitor = () => (
    <DraggableApiMonitor
      calls={apiMonitor.calls}
      quotaStatus={apiMonitor.quotaStatus}
      totalCalls={apiMonitor.totalCalls}
      errorCount={apiMonitor.errorCount}
      isOnline={apiMonitor.isOnline}
      onReset={resetApiMonitor}
    />
  )

  // 渲染旧版API监控组件（备用）
  const renderApiMonitorOld = () => {
    const getStatusColor = () => {
      if (apiMonitor.errorCount > 0) return '#ff4444'
      if (Object.values(apiMonitor.quotaStatus).some(q => q.used / q.limit > 0.8)) return '#ff9500'
      return '#00c851'
    }

    const getStatusIcon = () => {
      if (apiMonitor.errorCount > 0) return '🔴'
      if (Object.values(apiMonitor.quotaStatus).some(q => q.used / q.limit > 0.8)) return '🟡'
      return '🟢'
    }

    const recentErrors = apiMonitor.calls.filter(call => call.status === 'error').slice(-3)
    const pendingCalls = apiMonitor.calls.filter(call => call.status === 'pending').slice(-3)

    return (
      <div className="api-monitor">
        <div 
          className="api-monitor-compact"
          onClick={() => setShowApiDetails(!showApiDetails)}
          style={{ borderColor: getStatusColor() }}
        >
          <div className="api-status">
            <span className="status-icon">{getStatusIcon()}</span>
            <span className="status-text">API {apiMonitor.isOnline ? 'Online' : 'Offline'}</span>
          </div>
          <div className="api-stats">
            <span>调用: {apiMonitor.totalCalls}</span>
            {pendingCalls.length > 0 && <span className="pending-count">进行中: {pendingCalls.length}</span>}
            {apiMonitor.errorCount > 0 && <span className="error-count">错误: {apiMonitor.errorCount}</span>}
          </div>
        </div>

        {showApiDetails && (
          <div className="api-monitor-details">
            <div className="api-details-header">
              <h4>API监控详情</h4>
              <button onClick={() => resetApiMonitor()} className="reset-button">
                🔄 重置统计
              </button>
            </div>

            <div className="quota-section">
              <h5>配额使用情况</h5>
              {Object.entries(apiMonitor.quotaStatus).map(([model, quota]) => (
                <div key={model} className="quota-item">
                  <div className="quota-model">{model}</div>
                  <div className="quota-bar">
                    <div 
                      className="quota-fill" 
                      style={{ 
                        width: `${(quota.used / quota.limit) * 100}%`,
                        backgroundColor: quota.used / quota.limit > 0.8 ? '#ff4444' : '#00c851'
                      }}
                    ></div>
                  </div>
                  <div className="quota-text">{quota.used}/{quota.limit}</div>
                </div>
              ))}
            </div>

            {pendingCalls.length > 0 && (
              <div className="pending-calls-section">
                <h5>正在调用中 ({pendingCalls.length})</h5>
                {pendingCalls.map(call => (
                  <div key={call.id} className="pending-call-item">
                    <div className="call-time">
                      {new Date(call.timestamp).toLocaleTimeString()}
                    </div>
                    <div className="call-provider">{call.provider || '未知'}</div>
                    <div className="call-model">{call.model}</div>
                    <div className="call-operation">{call.operation}</div>
                    <div className="call-status">⏳</div>
                  </div>
                ))}
              </div>
            )}

            {recentErrors.length > 0 && (
              <div className="errors-section">
                <h5>最近错误 ({recentErrors.length})</h5>
                {recentErrors.map(call => (
                  <div key={call.id} className="error-item">
                    <div className="error-time">
                      {new Date(call.timestamp).toLocaleTimeString()}
                    </div>
                    <div className="error-model">{call.model}</div>
                    <div className="error-operation">{call.operation}</div>
                    <div className="error-message">{call.error}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="recent-calls-section">
              <h5>最近调用 ({apiMonitor.calls.slice(-5).length})</h5>
              {apiMonitor.calls.slice(-5).reverse().map(call => (
                <div key={call.id} className={`call-item ${call.status}`}>
                  <div className="call-time">
                    {new Date(call.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="call-model">{call.model}</div>
                  <div className="call-operation">{call.operation}</div>
                  <div className="call-status">
                    {call.status === 'pending' && '⏳'}
                    {call.status === 'success' && '✅'}
                    {call.status === 'error' && '❌'}
                  </div>
                  {call.duration && (
                    <div className="call-duration">{call.duration}ms</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

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
          />
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
        matchingState={matchingState}
        onResetMatching={handleResetMatching}
      />
      <main className="main-content">
        {renderPageContent()}
      </main>
      <div className="api-monitor-wrapper">
        {renderApiMonitor()}
      </div>
    </div>
  )
}

export default App