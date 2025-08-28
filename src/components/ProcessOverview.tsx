import React, { useState, useEffect } from 'react'
import '../styles/ProcessOverview.css'

interface ProcessStep {
  step: number
  stepName: string
  status: 'pending' | 'running' | 'completed' | 'error'
  details: string
  progress: number
  startTime?: number
  endTime?: number
  duration?: number
}

interface ProcessOverviewProps {
  steps: ProcessStep[]
  currentData?: {
    userData?: any[]
    profiles?: any[]
    proposals?: any[]
    reviewResults?: any[]
    optimizedResult?: any
    finalResult?: any
  }
}

const ProcessOverview: React.FC<ProcessOverviewProps> = ({ steps = [], currentData }) => {
  const [expandedStep, setExpandedStep] = useState<number | null>(null)
  const [selectedTab, setSelectedTab] = useState<'overview' | 'details'>('overview')
  
  // 获取步骤的数据统计
  const getStepStats = (stepNumber: number) => {
    switch (stepNumber) {
      case 1:
        return {
          title: 'AI问卷深度分析',
          inputLabel: '原始用户',
          outputLabel: '用户档案',
          inputCount: currentData?.userData?.length || 0,
          outputCount: currentData?.profiles?.length || 0,
          successRate: currentData?.userData?.length ? 
            Math.round((currentData?.profiles?.length || 0) / currentData.userData.length * 100) : 0
        }
      case 2:
        return {
          title: '用户档案标准化',
          inputLabel: '原始档案',
          outputLabel: '标准化档案',
          inputCount: currentData?.profiles?.length || 0,
          outputCount: currentData?.profiles?.length || 0,
          successRate: 100
        }
      case 3:
        return {
          title: 'MatchingAgent生成方案',
          inputLabel: '标准化档案',
          outputLabel: '分组方案',
          inputCount: currentData?.profiles?.length || 0,
          outputCount: currentData?.proposals?.length || 0,
          successRate: currentData?.proposals?.length ? 100 : 0
        }
      case 4:
        return {
          title: 'ReviewAgent严格审批',
          inputLabel: '待审方案',
          outputLabel: '审批结果',
          inputCount: currentData?.proposals?.length || 0,
          outputCount: currentData?.reviewResults?.length || 0,
          successRate: currentData?.reviewResults?.filter((r: any) => r.approved)?.length ? 100 : 0
        }
      case 5:
        return {
          title: '智能优化循环',
          inputLabel: '审批结果',
          outputLabel: '优化方案',
          inputCount: currentData?.reviewResults?.length || 0,
          outputCount: currentData?.optimizedResult ? 1 : 0,
          successRate: currentData?.optimizedResult ? 100 : 0
        }
      case 6:
        return {
          title: '最终确认输出',
          inputLabel: '优化方案',
          outputLabel: '最终分组',
          inputCount: currentData?.optimizedResult ? 1 : 0,
          outputCount: currentData?.finalResult?.groups?.length || 0,
          successRate: currentData?.finalResult ? 100 : 0
        }
      default:
        return {
          title: '未知步骤',
          inputLabel: '输入',
          outputLabel: '输出',
          inputCount: 0,
          outputCount: 0,
          successRate: 0
        }
    }
  }

  // 获取步骤的具体数据内容
  const getStepData = (stepNumber: number) => {
    switch (stepNumber) {
      case 1: // AI问卷深度分析
        return {
          inputs: currentData?.userData || [],
          outputs: currentData?.profiles || [],
          inputTitle: '用户问卷数据',
          outputTitle: '生成的用户档案'
        }
      case 2: // 用户档案标准化
        return {
          inputs: currentData?.profiles || [],
          outputs: currentData?.profiles || [],
          inputTitle: '原始用户档案',
          outputTitle: '标准化档案'
        }
      case 3: // MatchingAgent生成方案
        return {
          inputs: currentData?.profiles || [],
          outputs: currentData?.proposals || [],
          inputTitle: '标准化档案',
          outputTitle: '分组方案'
        }
      case 4: // ReviewAgent严格审批
        return {
          inputs: currentData?.proposals || [],
          outputs: currentData?.reviewResults || [],
          inputTitle: '待审分组方案',
          outputTitle: '审批结果'
        }
      case 5: // 智能优化循环
        return {
          inputs: currentData?.reviewResults || [],
          outputs: currentData?.optimizedResult ? [currentData.optimizedResult] : [],
          inputTitle: '审批结果',
          outputTitle: '优化后方案'
        }
      case 6: // 最终确认输出
        return {
          inputs: currentData?.optimizedResult ? [currentData.optimizedResult] : [],
          outputs: currentData?.finalResult ? [currentData.finalResult] : [],
          inputTitle: '优化方案',
          outputTitle: '最终分组结果'
        }
      default:
        return {
          inputs: [],
          outputs: [],
          inputTitle: '未知',
          outputTitle: '未知'
        }
    }
  }

  // 渲染单个数据项
  const renderDataItem = (item: any, type: string, stepNumber: number) => {
    if (!item) return null

    if (stepNumber === 1 && type === 'input') {
      // 用户数据
      return (
        <div className="data-item-card">
          <div className="data-item-header">
            <span className="data-item-name">{item.自选昵称 || item.姓名 || '未知用户'}</span>
            <span className="data-item-badge">{item.性别 || '-'} · {item.年龄 || '-'}岁</span>
          </div>
          <div className="data-item-content">
            <div className="data-item-field">
              <span className="field-label">职业：</span>
              <span className="field-value">{item.职业 || '未填写'}</span>
            </div>
            <div className="data-item-field">
              <span className="field-label">兴趣：</span>
              <span className="field-value">{item.兴趣爱好 || '未填写'}</span>
            </div>
          </div>
        </div>
      )
    }

    if (stepNumber === 1 && type === 'output') {
      // 用户档案
      return (
        <div className="data-item-card">
          <div className="data-item-header">
            <span className="data-item-name">{item.user_id || '未知档案'}</span>
            <span className="data-item-badge profile">档案</span>
          </div>
          <div className="data-item-content">
            <div className="data-item-field">
              <span className="field-label">性格总结：</span>
              <span className="field-value">{item.personality_summary || '待分析'}</span>
            </div>
            <div className="data-item-field">
              <span className="field-label">社交风格：</span>
              <span className="field-value">{item.social_style || '待分析'}</span>
            </div>
            {item.interests && item.interests.length > 0 && (
              <div className="data-item-field">
                <span className="field-label">兴趣标签：</span>
                <span className="field-value">{item.interests.join(', ')}</span>
              </div>
            )}
          </div>
        </div>
      )
    }

    if (stepNumber === 3 && type === 'output') {
      // 分组方案
      return (
        <div className="data-item-card">
          <div className="data-item-header">
            <span className="data-item-name">分组方案</span>
            <span className="data-item-badge proposal">方案</span>
          </div>
          <div className="data-item-content">
            <div className="data-item-field">
              <span className="field-label">分组数：</span>
              <span className="field-value">{item.groups?.length || 0} 个组</span>
            </div>
            {item.strategy && (
              <div className="data-item-field">
                <span className="field-label">策略：</span>
                <span className="field-value">{item.strategy}</span>
              </div>
            )}
          </div>
        </div>
      )
    }

    if (stepNumber === 4 && type === 'output') {
      // 审批结果
      return (
        <div className="data-item-card">
          <div className="data-item-header">
            <span className="data-item-name">审批结果</span>
            <span className={`data-item-badge ${item.approved ? 'approved' : 'rejected'}`}>
              {item.approved ? '通过' : '未通过'}
            </span>
          </div>
          <div className="data-item-content">
            <div className="data-item-field">
              <span className="field-label">总体评分：</span>
              <span className="field-value">{item.overall_score?.toFixed(1) || '0.0'} / 10</span>
            </div>
            {item.detailed_feedback && (
              <div className="data-item-field">
                <span className="field-label">反馈：</span>
                <span className="field-value">{item.detailed_feedback}</span>
              </div>
            )}
          </div>
        </div>
      )
    }

    if (stepNumber === 6 && type === 'output') {
      // 最终结果
      return (
        <div className="data-item-card">
          <div className="data-item-header">
            <span className="data-item-name">最终分组结果</span>
            <span className="data-item-badge final">最终</span>
          </div>
          <div className="data-item-content">
            <div className="data-item-field">
              <span className="field-label">总分组数：</span>
              <span className="field-value">{item.groups?.length || 0} 个组</span>
            </div>
            <div className="data-item-field">
              <span className="field-label">已分配人数：</span>
              <span className="field-value">
                {item.groups?.reduce((sum: number, g: any) => sum + (g.members?.length || 0), 0) || 0} 人
              </span>
            </div>
            <div className="data-item-field">
              <span className="field-label">未分配人数：</span>
              <span className="field-value">{item.unassigned?.length || 0} 人</span>
            </div>
            <div className="data-item-field">
              <span className="field-label">整体评分：</span>
              <span className="field-value">{item.overall_score?.toFixed(1) || '0.0'} / 10</span>
            </div>
          </div>
        </div>
      )
    }

    // 默认渲染
    return (
      <div className="data-item-card">
        <div className="data-item-content">
          <pre className="data-item-json">{JSON.stringify(item, null, 2)}</pre>
        </div>
      </div>
    )
  }

  // 获取步骤状态图标
  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✅'
      case 'running': return '🔄'
      case 'error': return '❌'
      case 'pending': return '⏳'
      default: return '⏳'
    }
  }

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch(status) {
      case 'completed': return '#28a745'
      case 'running': return '#ffc107'
      case 'error': return '#dc3545'
      case 'pending': return '#6c757d'
      default: return '#6c757d'
    }
  }

  // 计算总体统计
  const totalStats = {
    completedSteps: steps.filter(s => s.status === 'completed').length,
    totalSteps: steps.length,
    totalUsers: currentData?.userData?.length || 0,
    totalGroups: currentData?.finalResult?.groups?.length || 0,
    successRate: currentData?.finalResult ? 100 : 0
  }

  return (
    <div className="process-overview">
      <div className="page-header">
        <h1 className="page-title">🔄 AI匹配流程总览</h1>
        <p className="page-subtitle">查看每个处理步骤的详细输入输出和执行状态</p>
      </div>

      {/* 快速状态概览 */}
      <div className="status-overview">
        <div className="overview-card">
          <div className="overview-icon">📊</div>
          <div className="overview-content">
            <div className="overview-value">
              {totalStats.completedSteps} / {totalStats.totalSteps}
            </div>
            <div className="overview-label">完成步骤</div>
          </div>
        </div>
        <div className="overview-card">
          <div className="overview-icon">👥</div>
          <div className="overview-content">
            <div className="overview-value">{totalStats.totalUsers}</div>
            <div className="overview-label">处理用户</div>
          </div>
        </div>
        <div className="overview-card">
          <div className="overview-icon">🎯</div>
          <div className="overview-content">
            <div className="overview-value">{totalStats.totalGroups}</div>
            <div className="overview-label">生成分组</div>
          </div>
        </div>
        <div className="overview-card">
          <div className="overview-icon">✨</div>
          <div className="overview-content">
            <div className="overview-value" style={{ color: totalStats.successRate === 100 ? '#28a745' : '#ffc107' }}>
              {totalStats.successRate}%
            </div>
            <div className="overview-label">完成度</div>
          </div>
        </div>
      </div>

      {/* 步骤卡片网格 */}
      <div className="steps-grid">
        {steps.map(step => {
          const stats = getStepStats(step.step)
          const data = getStepData(step.step)
          const isExpanded = expandedStep === step.step

          return (
            <div key={step.step} className={`step-card ${step.status} ${isExpanded ? 'expanded' : ''}`}>
              {/* 卡片头部 */}
              <div className="card-header">
                <div className="step-identity">
                  <div className="step-icon">{getStepIcon(step.status)}</div>
                  <div className="step-details">
                    <h3 className="step-name">步骤 {step.step}: {stats.title}</h3>
                    <span className="step-status" style={{ color: getStatusColor(step.status) }}>
                      {step.details}
                    </span>
                  </div>
                </div>
                
                <div className="card-actions">
                  <button
                    className="expand-btn"
                    onClick={() => setExpandedStep(isExpanded ? null : step.step)}
                  >
                    {isExpanded ? '收起' : '查看详情'}
                  </button>
                </div>
              </div>

              {/* 数据统计 */}
              <div className="step-stats">
                <div className="stat-item">
                  <span className="stat-label">{stats.inputLabel}</span>
                  <span className="stat-value">{stats.inputCount}</span>
                </div>
                <div className="stat-arrow">→</div>
                <div className="stat-item">
                  <span className="stat-label">{stats.outputLabel}</span>
                  <span className="stat-value">{stats.outputCount}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">成功率</span>
                  <span className="stat-value" style={{ 
                    color: stats.successRate === 100 ? '#28a745' : stats.successRate > 50 ? '#ffc107' : '#dc3545' 
                  }}>
                    {stats.successRate}%
                  </span>
                </div>
              </div>

              {/* 进度条 */}
              {step.status === 'running' && (
                <div className="progress-container">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${step.progress}%` }}
                    />
                  </div>
                  <span className="progress-text">{step.progress}%</span>
                </div>
              )}

              {/* 展开的详细内容 */}
              {isExpanded && (
                <div className="step-expanded-content">
                  <div className="data-tabs">
                    <button 
                      className={`tab-btn ${selectedTab === 'overview' ? 'active' : ''}`}
                      onClick={() => setSelectedTab('overview')}
                    >
                      概览
                    </button>
                    <button 
                      className={`tab-btn ${selectedTab === 'details' ? 'active' : ''}`}
                      onClick={() => setSelectedTab('details')}
                    >
                      详细数据
                    </button>
                  </div>

                  {selectedTab === 'overview' ? (
                    <div className="overview-content">
                      <div className="data-summary">
                        <h4>📥 输入: {data.inputTitle} ({data.inputs.length}条)</h4>
                        <h4>📤 输出: {data.outputTitle} ({data.outputs.length}条)</h4>
                      </div>
                    </div>
                  ) : (
                    <div className="details-content">
                      <div className="data-section">
                        <h4 className="section-title">📥 输入数据 ({data.inputs.length}条)</h4>
                        <div className="data-list">
                          {data.inputs.slice(0, 5).map((item, index) => (
                            <div key={index}>
                              {renderDataItem(item, 'input', step.step)}
                            </div>
                          ))}
                          {data.inputs.length > 5 && (
                            <div className="more-indicator">还有 {data.inputs.length - 5} 条数据...</div>
                          )}
                          {data.inputs.length === 0 && (
                            <div className="no-data">暂无输入数据</div>
                          )}
                        </div>
                      </div>

                      <div className="data-section">
                        <h4 className="section-title">📤 输出数据 ({data.outputs.length}条)</h4>
                        <div className="data-list">
                          {data.outputs.slice(0, 5).map((item, index) => (
                            <div key={index}>
                              {renderDataItem(item, 'output', step.step)}
                            </div>
                          ))}
                          {data.outputs.length > 5 && (
                            <div className="more-indicator">还有 {data.outputs.length - 5} 条数据...</div>
                          )}
                          {data.outputs.length === 0 && (
                            <div className="no-data">暂无输出数据</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ProcessOverview