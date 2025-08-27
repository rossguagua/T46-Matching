import React, { useState, useMemo } from 'react'

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

interface SidebarApiMonitorProps {
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

const SidebarApiMonitor: React.FC<SidebarApiMonitorProps> = ({
  calls,
  quotaStatus,
  totalCalls,
  errorCount,
  isOnline
}) => {
  const [isHovered, setIsHovered] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'calls' | 'quota'>('overview')

  // 计算统计数据
  const stats = useMemo(() => {
    const successCalls = calls.filter(c => c.status === 'success')
    const errorCalls = calls.filter(c => c.status === 'error')
    const pendingCalls = calls.filter(c => c.status === 'pending')
    
    const avgDuration = successCalls.length > 0
      ? Math.round(successCalls.reduce((sum, c) => sum + (c.duration || 0), 0) / successCalls.length)
      : 0

    const successRate = totalCalls > 0 ? Math.round((successCalls.length / totalCalls) * 100) : 0

    return {
      successCalls: successCalls.length,
      errorCalls: errorCalls.length,
      pendingCalls: pendingCalls.length,
      avgDuration,
      successRate
    }
  }, [calls, totalCalls])

  // 格式化时间
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  // 格式化持续时间
  const formatDuration = (ms?: number) => {
    if (!ms) return '-'
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}min`
  }

  // 最近的调用
  const recentCalls = useMemo(() => {
    return calls.slice(-5).reverse()
  }, [calls])

  return (
    <div 
      className="sidebar-api-monitor"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 紧凑视图 - 始终显示 */}
      <div className="monitor-compact">
        <div className="status-item">
          <span className="status-label">API状态</span>
          <span className={`status-value ${isOnline ? 'online' : 'offline'}`}>
            {isOnline ? '在线' : '离线'}
          </span>
        </div>
        <div className="status-item">
          <span className="status-label">今日调用</span>
          <span className="status-value">
            {totalCalls}
            {errorCount > 0 && <span className="error-count">({errorCount}错误)</span>}
          </span>
        </div>
        {stats.pendingCalls > 0 && (
          <div className="status-item">
            <span className="status-label">进行中</span>
            <span className="status-value pending">{stats.pendingCalls}</span>
          </div>
        )}
      </div>

      {/* 展开视图 - 鼠标悬停时显示 */}
      <div className={`monitor-expanded ${isHovered ? 'visible' : ''}`}>
        {/* 标签导航 */}
        <div className="monitor-tabs">
          <button 
            className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            概览
          </button>
          <button 
            className={`tab ${activeTab === 'calls' ? 'active' : ''}`}
            onClick={() => setActiveTab('calls')}
          >
            调用记录
          </button>
          <button 
            className={`tab ${activeTab === 'quota' ? 'active' : ''}`}
            onClick={() => setActiveTab('quota')}
          >
            配额
          </button>
        </div>

        {/* 概览标签 */}
        {activeTab === 'overview' && (
          <div className="tab-content">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-title">成功率</div>
                <div className="stat-value-large">{stats.successRate}%</div>
              </div>
              <div className="stat-card">
                <div className="stat-title">平均响应</div>
                <div className="stat-value-large">{formatDuration(stats.avgDuration)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-title">成功/失败</div>
                <div className="stat-value-large">
                  <span className="success">{stats.successCalls}</span>
                  /
                  <span className="error">{stats.errorCalls}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 调用记录标签 */}
        {activeTab === 'calls' && (
          <div className="tab-content">
            <div className="calls-list">
              {recentCalls.length === 0 ? (
                <div className="no-calls">暂无调用记录</div>
              ) : (
                recentCalls.map(call => (
                  <div key={call.id} className={`call-item ${call.status}`}>
                    <div className="call-time">{formatTime(call.timestamp)}</div>
                    <div className="call-info">
                      <span className="call-model">{call.model}</span>
                      <span className="call-duration">{formatDuration(call.duration)}</span>
                    </div>
                    <div className={`call-status ${call.status}`}>
                      {call.status === 'success' && '✅'}
                      {call.status === 'error' && '❌'}
                      {call.status === 'pending' && '⏳'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 配额标签 */}
        {activeTab === 'quota' && (
          <div className="tab-content">
            <div className="quota-list">
              {Object.entries(quotaStatus).map(([model, quota]) => {
                const percentage = Math.round((quota.used / quota.limit) * 100)
                const isWarning = percentage > 80
                
                return (
                  <div key={model} className="quota-item">
                    <div className="quota-header">
                      <span className="quota-model">{model}</span>
                      <span className={`quota-percentage ${isWarning ? 'warning' : ''}`}>
                        {percentage}%
                      </span>
                    </div>
                    <div className="quota-bar">
                      <div 
                        className={`quota-fill ${isWarning ? 'warning' : ''}`}
                        style={{ width: `${Math.min(100, percentage)}%` }}
                      />
                    </div>
                    <div className="quota-info">
                      {quota.used}/{quota.limit}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SidebarApiMonitor