// 算法流程总览 - 展示算法分组的详细执行过程
import React, { useState } from 'react'
import { AlgorithmProgress } from '../algorithms/AlgorithmicMatcher'
import { GenderStats, AgeStats, GroupingStrategy } from '../algorithms/DataAnalyzer'
import { ExecutionStats } from '../algorithms/GroupOptimizer'
import { ValidationResult } from '../algorithms/ConstraintValidator'
import '../styles/ProcessOverview.css'

interface AlgorithmStep {
  phase: AlgorithmProgress['phase']
  name: string
  status: 'pending' | 'running' | 'completed' | 'error'
  progress: number
  message: string
  details?: string
  startTime?: number
  endTime?: number
}

interface AlgorithmProcessOverviewProps {
  steps: AlgorithmStep[]
  genderStats?: GenderStats
  ageStats?: AgeStats
  strategy?: GroupingStrategy
  executionStats?: ExecutionStats
  validationResult?: ValidationResult
  totalUsers: number
  currentData?: {
    userData?: any[]
    finalResult?: any
  }
}

const AlgorithmProcessOverview: React.FC<AlgorithmProcessOverviewProps> = ({
  steps,
  genderStats,
  ageStats,
  strategy,
  executionStats,
  validationResult,
  totalUsers,
  currentData
}) => {
  const [selectedTab, setSelectedTab] = useState<'progress' | 'analysis' | 'results'>('progress')
  const [expandedStep, setExpandedStep] = useState<number | null>(null)

  // 计算总体统计
  const totalStats = {
    completedSteps: steps.filter(s => s.status === 'completed').length,
    totalSteps: steps.length,
    totalUsers,
    totalGroups: currentData?.finalResult?.groups?.length || 0,
    assignedUsers: executionStats?.assignedUsers || 0,
    unassignedUsers: executionStats?.unassignedUsers || 0,
    overallScore: validationResult?.score || 0,
    executionTime: executionStats?.executionTimeMs || 0
  }

  const renderProgressTab = () => (
    <div className="tab-content">
      {/* 总体进度卡片 */}
      <div className="overview-cards">
        <div className="overview-card">
          <div className="card-icon">📊</div>
          <div className="card-content">
            <div className="card-value">{totalStats.completedSteps} / {totalStats.totalSteps}</div>
            <div className="card-label">完成步骤</div>
          </div>
        </div>
        
        <div className="overview-card">
          <div className="card-icon">👥</div>
          <div className="card-content">
            <div className="card-value">{totalStats.totalUsers}</div>
            <div className="card-label">处理用户</div>
          </div>
        </div>
        
        <div className="overview-card">
          <div className="card-icon">🎯</div>
          <div className="card-content">
            <div className="card-value">{totalStats.totalGroups}</div>
            <div className="card-label">生成分组</div>
          </div>
        </div>
        
        <div className="overview-card">
          <div className="card-icon">⭐</div>
          <div className="card-content">
            <div className="card-value">{totalStats.overallScore.toFixed(1)}</div>
            <div className="card-label">算法评分</div>
          </div>
        </div>
      </div>

      {/* 步骤详情 */}
      <div className="steps-container">
        {steps.map((step, index) => (
          <div 
            key={index}
            className={`step-item ${step.status} ${expandedStep === index ? 'expanded' : ''}`}
            onClick={() => setExpandedStep(expandedStep === index ? null : index)}
          >
            <div className="step-header">
              <div className="step-indicator">
                {step.status === 'completed' && <span className="step-icon completed">✅</span>}
                {step.status === 'running' && <span className="step-icon running">🔄</span>}
                {step.status === 'pending' && <span className="step-icon pending">⏳</span>}
                {step.status === 'error' && <span className="step-icon error">❌</span>}
              </div>
              <div className="step-content">
                <div className="step-title">{step.name}</div>
                <div className="step-message">{step.message}</div>
                {step.status === 'running' && step.progress > 0 && (
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${step.progress}%` }}
                    ></div>
                    <span className="progress-text">{step.progress}%</span>
                  </div>
                )}
              </div>
              <div className="step-meta">
                {step.endTime && step.startTime && (
                  <span className="duration">
                    {step.endTime - step.startTime}ms
                  </span>
                )}
              </div>
            </div>
            
            {expandedStep === index && step.details && (
              <div className="step-details">
                <p>{step.details}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )

  const renderAnalysisTab = () => (
    <div className="tab-content analysis">
      {genderStats && (
        <div className="analysis-section">
          <h3>性别分析结果</h3>
          <div className="analysis-grid">
            <div className="analysis-card">
              <div className="analysis-title">用户构成</div>
              <div className="analysis-content">
                <div className="gender-breakdown">
                  <div className="gender-item">
                    <span className="gender-icon male">♂</span>
                    <span className="gender-count">{genderStats.males}</span>
                    <span className="gender-label">男性</span>
                  </div>
                  <div className="gender-item">
                    <span className="gender-icon female">♀</span>
                    <span className="gender-count">{genderStats.females}</span>
                    <span className="gender-label">女性</span>
                  </div>
                </div>
                <div className="ratio-text">
                  性别比例：{genderStats.genderRatio.toFixed(2)} (女/男)
                </div>
              </div>
            </div>
            
            <div className="analysis-card">
              <div className="analysis-title">全女组态度</div>
              <div className="analysis-content">
                <div className="attitude-breakdown">
                  <div className="attitude-item accept">
                    <span className="attitude-count">{genderStats.femalesAcceptAllFemale}</span>
                    <span className="attitude-label">接受</span>
                  </div>
                  <div className="attitude-item reject">
                    <span className="attitude-count">{genderStats.femalesRejectAllFemale}</span>
                    <span className="attitude-label">拒绝</span>
                  </div>
                  <div className="attitude-item neutral">
                    <span className="attitude-count">{genderStats.femalesNeutral}</span>
                    <span className="attitude-label">中立</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {ageStats && (
        <div className="analysis-section">
          <h3>年龄分析结果</h3>
          <div className="analysis-grid">
            <div className="analysis-card">
              <div className="analysis-title">年龄分布</div>
              <div className="analysis-content">
                <div className="age-stats">
                  <div className="age-stat">
                    <span className="stat-label">最小年龄</span>
                    <span className="stat-value">{ageStats.minAge}岁</span>
                  </div>
                  <div className="age-stat">
                    <span className="stat-label">最大年龄</span>
                    <span className="stat-value">{ageStats.maxAge}岁</span>
                  </div>
                  <div className="age-stat">
                    <span className="stat-label">年龄跨度</span>
                    <span className="stat-value">{ageStats.ageRange}岁</span>
                  </div>
                  <div className="age-stat">
                    <span className="stat-label">平均年龄</span>
                    <span className="stat-value">{ageStats.averageAge.toFixed(1)}岁</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="analysis-card">
              <div className="analysis-title">年龄聚类</div>
              <div className="analysis-content">
                <div className="cluster-info">
                  <span>共识别出 {ageStats.ageGroups.size} 个年龄聚类</span>
                  <div className="cluster-details">
                    {Array.from(ageStats.ageGroups.entries()).map(([baseAge, users]) => (
                      <div key={baseAge} className="cluster-item">
                        <span className="cluster-age">{baseAge}岁</span>
                        <span className="cluster-count">({users.length}人)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {strategy && (
        <div className="analysis-section">
          <h3>分组策略</h3>
          <div className="strategy-content">
            <div className="strategy-reasoning">
              <strong>策略说明：</strong>{strategy.reasoning}
            </div>
            <div className="strategy-details">
              <strong>详细信息：</strong>{strategy.details}
            </div>
            <div className="strategy-targets">
              <div className="target-item">
                <span className="target-label">2男4女组</span>
                <span className="target-value">{strategy.recommendedMixedGroups2M4F}个</span>
              </div>
              <div className="target-item">
                <span className="target-label">3男3女组</span>
                <span className="target-value">{strategy.recommendedMixedGroups3M3F}个</span>
              </div>
              <div className="target-item">
                <span className="target-label">全女组</span>
                <span className="target-value">{strategy.recommendedAllFemaleGroups}个</span>
              </div>
              <div className="target-item">
                <span className="target-label">预期待分配</span>
                <span className="target-value">{strategy.expectedUnassigned}人</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  const renderResultsTab = () => (
    <div className="tab-content results">
      {executionStats && (
        <div className="results-section">
          <h3>执行统计</h3>
          <div className="results-grid">
            <div className="result-card">
              <div className="result-title">分配效率</div>
              <div className="result-content">
                <div className="efficiency-chart">
                  <div className="efficiency-bar">
                    <div 
                      className="efficiency-fill assigned"
                      style={{ width: `${(executionStats.assignedUsers / executionStats.totalUsers) * 100}%` }}
                    ></div>
                  </div>
                  <div className="efficiency-stats">
                    <span className="assigned">{executionStats.assignedUsers} 已分配</span>
                    <span className="unassigned">{executionStats.unassignedUsers} 待分配</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="result-card">
              <div className="result-title">组构成分析</div>
              <div className="result-content">
                <div className="group-composition">
                  <div className="composition-item">
                    <span className="composition-label">2男4女组</span>
                    <span className="composition-value">{executionStats.mixedGroups2M4F}个</span>
                  </div>
                  <div className="composition-item">
                    <span className="composition-label">3男3女组</span>
                    <span className="composition-value">{executionStats.mixedGroups3M3F}个</span>
                  </div>
                  <div className="composition-item">
                    <span className="composition-label">全女组</span>
                    <span className="composition-value">{executionStats.allFemaleGroups}个</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="result-card">
              <div className="result-title">质量指标</div>
              <div className="result-content">
                <div className="quality-metrics">
                  <div className="metric-item">
                    <span className="metric-label">平均年龄差</span>
                    <span className="metric-value">{executionStats.averageAgeGap.toFixed(1)}岁</span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-label">最大年龄差</span>
                    <span className="metric-value">{executionStats.maxAgeGap.toFixed(1)}岁</span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-label">算法评分</span>
                    <span className="metric-value">{validationResult?.score.toFixed(1) || 0}分</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="result-card">
              <div className="result-title">性能统计</div>
              <div className="result-content">
                <div className="performance-metrics">
                  <div className="metric-item">
                    <span className="metric-label">执行时间</span>
                    <span className="metric-value">{executionStats.executionTimeMs}ms</span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-label">迭代次数</span>
                    <span className="metric-value">{executionStats.iterationsPerformed}</span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-label">平均每组耗时</span>
                    <span className="metric-value">{(executionStats.executionTimeMs / (executionStats.mixedGroups2M4F + executionStats.mixedGroups3M3F + executionStats.allFemaleGroups || 1)).toFixed(1)}ms</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {validationResult && validationResult.violations.length > 0 && (
        <div className="results-section">
          <h3>约束验证</h3>
          <div className="violations-list">
            {validationResult.violations.map((violation, index) => (
              <div key={index} className={`violation-item ${violation.severity.toLowerCase()}`}>
                <div className="violation-header">
                  <span className="violation-type">{violation.type}</span>
                  <span className="violation-severity">{violation.severity}</span>
                </div>
                <div className="violation-message">{violation.message}</div>
                {violation.affectedUsers && (
                  <div className="violation-users">
                    影响用户: {violation.affectedUsers.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="process-overview algorithm">
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">🔧 算法分组流程总览</h1>
          <p className="page-subtitle">查看算法分组的详细执行过程和结果分析</p>
        </div>

        {/* 选项卡 */}
        <div className="tab-navigation">
          <button 
            className={selectedTab === 'progress' ? 'active' : ''} 
            onClick={() => setSelectedTab('progress')}
          >
            执行进度
          </button>
          <button 
            className={selectedTab === 'analysis' ? 'active' : ''} 
            onClick={() => setSelectedTab('analysis')}
          >
            数据分析
          </button>
          <button 
            className={selectedTab === 'results' ? 'active' : ''} 
            onClick={() => setSelectedTab('results')}
          >
            结果统计
          </button>
        </div>

        {/* 选项卡内容 */}
        {selectedTab === 'progress' && renderProgressTab()}
        {selectedTab === 'analysis' && renderAnalysisTab()}
        {selectedTab === 'results' && renderResultsTab()}
      </div>
    </div>
  )
}

export default AlgorithmProcessOverview