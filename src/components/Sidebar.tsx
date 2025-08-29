import React from 'react'
import SidebarApiMonitor from './SidebarApiMonitor'

export type NavigationPage = 'matching' | 'process-overview' | 'rules-management' | 'llm-management' | 'api-monitor' | 'settings' | 'user-profiles' | 'prompt-enhancement'

interface NavigationItem {
  id: NavigationPage
  label: string
  icon: string
  description: string
}

interface SidebarProps {
  currentPage: NavigationPage
  onPageChange: (page: NavigationPage) => void
  apiStatus?: {
    isOnline: boolean
    totalCalls: number
    errorCount: number
  }
  apiCalls?: any[]
  quotaStatus?: any
  matchingState?: {
    preserveState: boolean
    hasResults: boolean
  }
  onResetMatching?: () => void
}

const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    id: 'matching',
    label: '智能分组',
    icon: '🧩',
    description: '算法分组匹配'
  },
  {
    id: 'user-profiles',
    label: '用户档案库',
    icon: '👥',
    description: 'AI维度分析档案库'
  },
  {
    id: 'prompt-enhancement',
    label: 'Prompt强化',
    icon: '🚀',
    description: '维度分析提示词配置'
  },
  {
    id: 'process-overview',
    label: '流程总览',
    icon: '🔄',
    description: '匹配流程可视化监控'
  },
  {
    id: 'rules-management',
    label: '规则管理',
    icon: '📋',
    description: '匹配规则和评分标准'
  },
  {
    id: 'llm-management',
    label: 'LLM管理',
    icon: '🤖',
    description: 'API密钥和模型配置'
  },
  {
    id: 'api-monitor',
    label: 'API监控',
    icon: '📊',
    description: '实时API使用监控'
  },
  {
    id: 'settings',
    label: '系统设置',
    icon: '⚙️',
    description: '系统参数配置'
  }
]

const Sidebar: React.FC<SidebarProps> = ({ currentPage, onPageChange, apiStatus, apiCalls = [], quotaStatus = {}, matchingState, onResetMatching }) => {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-title">T46 AI</h1>
        <p className="sidebar-subtitle">智能分组系统</p>
      </div>

      <nav className="sidebar-nav">
        {NAVIGATION_ITEMS.map(item => (
          <button
            key={item.id}
            className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
            onClick={() => onPageChange(item.id)}
          >
            <div className="nav-item-icon">{item.icon}</div>
            <div className="nav-item-content">
              <div className="nav-item-label">{item.label}</div>
              <div className="nav-item-description">{item.description}</div>
              {item.id === 'matching' && matchingState?.hasResults && (
                <div className="nav-item-badge">有结果</div>
              )}
            </div>
            {item.id === 'api-monitor' && apiStatus && (
              <div className="nav-item-status">
                <div className={`status-indicator ${apiStatus.isOnline ? 'online' : 'offline'}`}>
                  {apiStatus.isOnline ? '🟢' : '🔴'}
                </div>
                {apiStatus.errorCount > 0 && (
                  <div className="error-badge">{apiStatus.errorCount}</div>
                )}
              </div>
            )}
          </button>
        ))}
      </nav>

      {/* 智能分组状态控制区 */}
      {currentPage === 'matching' && matchingState && (
        <div className="matching-controls">
          <div className="control-section">
            <h4>分组状态控制</h4>
            {matchingState.hasResults && (
              <button 
                className="control-button reset-button"
                onClick={onResetMatching}
                title="清空所有数据，重新开始匹配"
              >
                🔄 新的匹配
              </button>
            )}
          </div>
        </div>
      )}

      <div className="sidebar-footer">
        {apiStatus && (
          <SidebarApiMonitor
            calls={apiCalls}
            quotaStatus={quotaStatus}
            totalCalls={apiStatus.totalCalls}
            errorCount={apiStatus.errorCount}
            isOnline={apiStatus.isOnline}
          />
        )}
      </div>
    </div>
  )
}

export default Sidebar