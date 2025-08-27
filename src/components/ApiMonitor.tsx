import React, { useState, useMemo } from 'react'
import '../styles/ApiMonitor.css'

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

interface ApiMonitorProps {
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
  onReset?: () => void
}

const ApiMonitor: React.FC<ApiMonitorProps> = ({
  calls,
  quotaStatus,
  totalCalls,
  errorCount,
  isOnline,
  onReset
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'calls' | 'errors' | 'quota'>('overview')
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'error' | 'pending'>('all')

  // 计算统计数据
  const stats = useMemo(() => {
    const successCalls = calls.filter(c => c.status === 'success')
    const errorCalls = calls.filter(c => c.status === 'error')
    const pendingCalls = calls.filter(c => c.status === 'pending')
    
    const avgDuration = successCalls.length > 0
      ? Math.round(successCalls.reduce((sum, c) => sum + (c.duration || 0), 0) / successCalls.length)
      : 0

    const providerStats = calls.reduce((acc, call) => {
      const provider = call.provider || 'unknown'
      if (!acc[provider]) {
        acc[provider] = { total: 0, success: 0, error: 0 }
      }
      acc[provider].total++
      if (call.status === 'success') acc[provider].success++
      if (call.status === 'error') acc[provider].error++
      return acc
    }, {} as Record<string, { total: number; success: number; error: number }>)

    const successRate = totalCalls > 0 ? Math.round((successCalls.length / totalCalls) * 100) : 0

    return {
      successCalls: successCalls.length,
      errorCalls: errorCalls.length,
      pendingCalls: pendingCalls.length,
      avgDuration,
      providerStats,
      successRate
    }
  }, [calls, totalCalls])

  // 获取状态颜色
  const getStatusColor = () => {
    if (!isOnline) return '#dc3545'
    if (errorCount > 5) return '#ffc107'
    if (stats.pendingCalls > 3) return '#17a2b8'
    return '#28a745'
  }

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

  // 过滤调用记录
  const filteredCalls = useMemo(() => {
    if (filterStatus === 'all') return calls
    return calls.filter(c => c.status === filterStatus)
  }, [calls, filterStatus])

  // 最近的错误
  const recentErrors = useMemo(() => {
    return calls.filter(c => c.status === 'error').slice(-5).reverse()
  }, [calls])

  return (
    <div className={`api-monitor-enhanced ${isExpanded ? 'expanded' : 'compact'}`}>
      {/* 紧凑视图 */}
      <div 
        className="monitor-header"
        style={{ borderColor: getStatusColor() }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="monitor-status">
          <span className="status-indicator" style={{ backgroundColor: getStatusColor() }}>
            {isOnline ? '●' : '○'}
          </span>
          <span className="status-text">
            API {isOnline ? '在线' : '离线'}
          </span>
        </div>
        
        <div className="monitor-stats">
          <div className="stat-item">
            <span className="stat-value">{totalCalls}</span>
            <span className="stat-label">调用</span>
          </div>
          {stats.pendingCalls > 0 && (
            <div className="stat-item pending">
              <span className="stat-value">{stats.pendingCalls}</span>
              <span className="stat-label">进行中</span>
            </div>
          )}
          {errorCount > 0 && (
            <div className="stat-item error">
              <span className="stat-value">{errorCount}</span>
              <span className="stat-label">错误</span>
            </div>
          )}
          <div className="stat-item">
            <span className="stat-value">{stats.successRate}%</span>
            <span className="stat-label">成功率</span>
          </div>
        </div>
        
        <button className="expand-toggle">
          {isExpanded ? '收起' : '展开'}
        </button>
      </div>

      {/* 展开视图 */}
      {isExpanded && (
        <div className="monitor-body">
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
              调用记录 ({filteredCalls.length})
            </button>
            <button 
              className={`tab ${activeTab === 'errors' ? 'active' : ''}`}
              onClick={() => setActiveTab('errors')}
            >
              错误日志 ({recentErrors.length})
            </button>
            <button 
              className={`tab ${activeTab === 'quota' ? 'active' : ''}`}
              onClick={() => setActiveTab('quota')}
            >
              配额管理
            </button>
            
            {onReset && (
              <button className="reset-btn" onClick={onReset}>
                🔄 重置
              </button>
            )}
          </div>

          {/* 概览标签 */}
          {activeTab === 'overview' && (
            <div className="tab-content overview">
              <div className="overview-grid">
                <div className="overview-card">
                  <h4>性能指标</h4>
                  <div className="metrics">
                    <div className="metric">
                      <span className="metric-label">平均响应时间</span>
                      <span className="metric-value">{formatDuration(stats.avgDuration)}</span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">成功率</span>
                      <span className="metric-value">{stats.successRate}%</span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">总调用次数</span>
                      <span className="metric-value">{totalCalls}</span>
                    </div>
                  </div>
                </div>

                <div className="overview-card">
                  <h4>提供商统计</h4>
                  <div className="provider-stats">
                    {Object.entries(stats.providerStats).map(([provider, stat]) => (
                      <div key={provider} className="provider-stat">
                        <span className="provider-name">{provider}</span>
                        <div className="provider-metrics">
                          <span className="success">✅ {stat.success}</span>
                          <span className="error">❌ {stat.error}</span>
                          <span className="total">共 {stat.total}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="overview-card">
                  <h4>实时状态</h4>
                  <div className="realtime-status">
                    <div className={`status-item ${isOnline ? 'online' : 'offline'}`}>
                      <span>连接状态</span>
                      <span>{isOnline ? '正常' : '断开'}</span>
                    </div>
                    <div className="status-item">
                      <span>活跃调用</span>
                      <span>{stats.pendingCalls}</span>
                    </div>
                    <div className="status-item">
                      <span>最近错误</span>
                      <span>{recentErrors.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 调用记录标签 */}
          {activeTab === 'calls' && (
            <div className="tab-content calls">
              <div className="calls-filter">
                <button 
                  className={filterStatus === 'all' ? 'active' : ''}
                  onClick={() => setFilterStatus('all')}
                >
                  全部 ({calls.length})
                </button>
                <button 
                  className={filterStatus === 'success' ? 'active' : ''}
                  onClick={() => setFilterStatus('success')}
                >
                  成功 ({stats.successCalls})
                </button>
                <button 
                  className={filterStatus === 'error' ? 'active' : ''}
                  onClick={() => setFilterStatus('error')}
                >
                  失败 ({stats.errorCalls})
                </button>
                <button 
                  className={filterStatus === 'pending' ? 'active' : ''}
                  onClick={() => setFilterStatus('pending')}
                >
                  进行中 ({stats.pendingCalls})
                </button>
              </div>

              <div className="calls-list">
                {filteredCalls.slice(-20).reverse().map(call => (
                  <div key={call.id} className={`call-entry ${call.status}`}>
                    <div className="call-time">{formatTime(call.timestamp)}</div>
                    <div className="call-provider">{call.provider || '-'}</div>
                    <div className="call-model">{call.model}</div>
                    <div className="call-operation">{call.operation}</div>
                    <div className="call-duration">{formatDuration(call.duration)}</div>
                    <div className={`call-status-badge ${call.status}`}>
                      {call.status === 'success' && '成功'}
                      {call.status === 'error' && '失败'}
                      {call.status === 'pending' && '处理中'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 错误日志标签 */}
          {activeTab === 'errors' && (
            <div className="tab-content errors">
              {recentErrors.length === 0 ? (
                <div className="no-errors">✅ 暂无错误记录</div>
              ) : (
                <div className="errors-list">
                  {recentErrors.map(error => (
                    <div key={error.id} className="error-entry">
                      <div className="error-header">
                        <span className="error-time">{formatTime(error.timestamp)}</span>
                        <span className="error-model">{error.model}</span>
                        <span className="error-operation">{error.operation}</span>
                      </div>
                      <div className="error-message">
                        {error.error || '未知错误'}
                      </div>
                      {error.retryCount && error.retryCount > 0 && (
                        <div className="error-retry">
                          已重试 {error.retryCount} 次
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 配额管理标签 */}
          {activeTab === 'quota' && (
            <div className="tab-content quota">
              <div className="quota-list">
                {Object.entries(quotaStatus).map(([model, quota]) => {
                  const percentage = Math.round((quota.used / quota.limit) * 100)
                  const isWarning = percentage > 80
                  const isDanger = percentage > 90
                  
                  return (
                    <div key={model} className="quota-entry">
                      <div className="quota-header">
                        <span className="quota-model">{model}</span>
                        <span className={`quota-percentage ${isDanger ? 'danger' : isWarning ? 'warning' : ''}`}>
                          {percentage}%
                        </span>
                      </div>
                      <div className="quota-bar">
                        <div 
                          className={`quota-fill ${isDanger ? 'danger' : isWarning ? 'warning' : ''}`}
                          style={{ width: `${Math.min(100, percentage)}%` }}
                        />
                      </div>
                      <div className="quota-details">
                        <span>已用: {quota.used}</span>
                        <span>限额: {quota.limit}</span>
                        <span>剩余: {quota.limit - quota.used}</span>
                      </div>
                      {quota.resetTime && (
                        <div className="quota-reset">
                          重置时间: {new Date(quota.resetTime).toLocaleString('zh-CN')}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ApiMonitor