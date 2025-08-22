import React, { useState, useEffect, useCallback } from 'react'
import { DataValidator } from '../utils/dataValidator'
import { DataQualityReport, DataIssue } from '../types/dataValidation'

interface DataEditorProps {
  data: any[]
  onDataChange: (data: any[]) => void
  onConfirm: () => void
  onCancel: () => void
}

const DataEditor: React.FC<DataEditorProps> = ({ 
  data, 
  onDataChange, 
  onConfirm,
  onCancel 
}) => {
  const [editableData, setEditableData] = useState(data)
  const [qualityReport, setQualityReport] = useState<DataQualityReport | null>(null)
  const [selectedIssues, setSelectedIssues] = useState<Set<string>>(new Set())
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null)
  const [showOnlyIssues, setShowOnlyIssues] = useState(false)
  const [activeTab, setActiveTab] = useState<'data' | 'issues'>('data')
  
  const validator = new DataValidator()

  // 验证数据
  useEffect(() => {
    const report = validator.validate(editableData)
    setQualityReport(report)
  }, [editableData])

  // 获取所有列
  const columns = Array.from(new Set(editableData.flatMap(row => Object.keys(row))))
    .filter(col => !col.includes('__EMPTY') && col.trim())

  // 处理单元格编辑
  const handleCellEdit = (rowIndex: number, column: string, value: any) => {
    const newData = [...editableData]
    newData[rowIndex] = { ...newData[rowIndex], [column]: value }
    setEditableData(newData)
    setEditingCell(null)
  }

  // 自动修复选中的问题
  const handleAutoFix = () => {
    if (!qualityReport) return
    
    const issuesToFix: DataIssue[] = []
    
    // 收集选中的可修复问题
    selectedIssues.forEach(issueId => {
      const allIssues = [
        ...qualityReport.issues.critical,
        ...qualityReport.issues.warning,
        ...qualityReport.issues.suggestion
      ]
      const issue = allIssues.find(i => `${i.row}-${i.column}` === issueId)
      if (issue && issue.autoFixable) {
        issuesToFix.push(issue)
      }
    })
    
    if (issuesToFix.length > 0) {
      const fixedData = validator.autoFix(editableData, issuesToFix)
      setEditableData(fixedData)
      setSelectedIssues(new Set())
    }
  }

  // 一键修复所有可修复问题
  const handleFixAll = () => {
    if (!qualityReport) return
    
    const allFixableIssues = [
      ...qualityReport.issues.warning,
      ...qualityReport.issues.suggestion
    ].filter(i => i.autoFixable)
    
    if (allFixableIssues.length > 0) {
      const fixedData = validator.autoFix(editableData, allFixableIssues)
      setEditableData(fixedData)
    }
  }

  // 清洗数据
  const handleCleanData = () => {
    const cleanedData = validator.clean(editableData)
    setEditableData(cleanedData)
  }

  // 删除行
  const handleDeleteRow = (index: number) => {
    const newData = editableData.filter((_, i) => i !== index)
    setEditableData(newData)
  }

  // 添加新行
  const handleAddRow = () => {
    const newRow: any = {}
    columns.forEach(col => {
      newRow[col] = ''
    })
    setEditableData([...editableData, newRow])
  }

  // 获取单元格样式
  const getCellStyle = (rowIndex: number, column: string) => {
    if (!qualityReport) return {}
    
    const allIssues = [
      ...qualityReport.issues.critical,
      ...qualityReport.issues.warning,
      ...qualityReport.issues.suggestion
    ]
    
    const issue = allIssues.find(i => i.row === rowIndex + 1 && i.column === column)
    
    if (issue) {
      switch (issue.type) {
        case 'critical':
          return { backgroundColor: '#ffebee', borderColor: '#f44336' }
        case 'warning':
          return { backgroundColor: '#fff3e0', borderColor: '#ff9800' }
        case 'suggestion':
          return { backgroundColor: '#e3f2fd', borderColor: '#2196f3' }
      }
    }
    
    return {}
  }

  // 确认数据
  const handleConfirm = () => {
    onDataChange(editableData)
    onConfirm()
  }

  return (
    <div className="data-editor-modal">
      <div className="data-editor-container">
        <div className="editor-header">
          <h2>📊 数据质量检查与编辑</h2>
          <button className="close-btn" onClick={onCancel}>✕</button>
        </div>

        {/* 数据质量概览 */}
        {qualityReport && (
          <div className="quality-overview">
            <div className="quality-score">
              <div className={`score-circle ${qualityReport.score >= 80 ? 'good' : qualityReport.score >= 60 ? 'warning' : 'bad'}`}>
                <span className="score-number">{qualityReport.score}</span>
                <span className="score-label">数据质量分</span>
              </div>
            </div>
            
            <div className="quality-stats">
              <div className="stat-item">
                <span className="stat-label">完整度</span>
                <div className="stat-bar">
                  <div className="stat-fill" style={{ width: `${qualityReport.stats.completeness}%` }} />
                </div>
                <span className="stat-value">{qualityReport.stats.completeness}%</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">一致性</span>
                <div className="stat-bar">
                  <div className="stat-fill" style={{ width: `${qualityReport.stats.consistency}%` }} />
                </div>
                <span className="stat-value">{qualityReport.stats.consistency}%</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">有效性</span>
                <div className="stat-bar">
                  <div className="stat-fill" style={{ width: `${qualityReport.stats.validity}%` }} />
                </div>
                <span className="stat-value">{qualityReport.stats.validity}%</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">唯一性</span>
                <div className="stat-bar">
                  <div className="stat-fill" style={{ width: `${qualityReport.stats.uniqueness}%` }} />
                </div>
                <span className="stat-value">{qualityReport.stats.uniqueness}%</span>
              </div>
            </div>

            <div className="quality-summary">
              <div className="issue-counts">
                <span className="issue-count critical">
                  🔴 {qualityReport.issues.critical.length} 关键问题
                </span>
                <span className="issue-count warning">
                  🟡 {qualityReport.issues.warning.length} 警告
                </span>
                <span className="issue-count suggestion">
                  🔵 {qualityReport.issues.suggestion.length} 建议
                </span>
              </div>
              
              {qualityReport.recommendations.length > 0 && (
                <div className="recommendations">
                  {qualityReport.recommendations.map((rec, i) => (
                    <div key={i} className="recommendation">{rec}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="editor-actions">
          <div className="action-group">
            <button className="action-btn clean" onClick={handleCleanData}>
              🧹 清洗数据
            </button>
            <button className="action-btn fix-all" onClick={handleFixAll}>
              🔧 修复所有可修复问题
            </button>
            <button className="action-btn fix-selected" onClick={handleAutoFix} disabled={selectedIssues.size === 0}>
              ✔️ 修复选中 ({selectedIssues.size})
            </button>
            <button className="action-btn add-row" onClick={handleAddRow}>
              ➕ 添加行
            </button>
          </div>
          
          <div className="view-toggle">
            <label>
              <input
                type="checkbox"
                checked={showOnlyIssues}
                onChange={(e) => setShowOnlyIssues(e.target.checked)}
              />
              只显示有问题的数据
            </label>
          </div>
        </div>

        {/* 标签页切换 */}
        <div className="editor-tabs">
          <button 
            className={`tab ${activeTab === 'data' ? 'active' : ''}`}
            onClick={() => setActiveTab('data')}
          >
            数据表格 ({editableData.length}行)
          </button>
          <button 
            className={`tab ${activeTab === 'issues' ? 'active' : ''}`}
            onClick={() => setActiveTab('issues')}
          >
            问题列表 ({qualityReport ? qualityReport.issues.critical.length + qualityReport.issues.warning.length + qualityReport.issues.suggestion.length : 0})
          </button>
        </div>

        {/* 数据表格 */}
        {activeTab === 'data' && (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="row-number">#</th>
                  <th className="row-actions">操作</th>
                  {columns.map(col => (
                    <th key={col}>
                      {col}
                      {qualityReport && (
                        <span className="column-issues">
                          {qualityReport.fieldAnalysis[col] && (
                            <span className="field-stats">
                              ({qualityReport.fieldAnalysis[col].filled}/{editableData.length})
                            </span>
                          )}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {editableData
                  .filter((_, index) => {
                    if (!showOnlyIssues || !qualityReport) return true
                    const allIssues = [
                      ...qualityReport.issues.critical,
                      ...qualityReport.issues.warning,
                      ...qualityReport.issues.suggestion
                    ]
                    return allIssues.some(i => i.row === index + 1)
                  })
                  .map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      <td className="row-number">{rowIndex + 1}</td>
                      <td className="row-actions">
                        <button 
                          className="delete-row-btn"
                          onClick={() => handleDeleteRow(rowIndex)}
                          title="删除此行"
                        >
                          🗑️
                        </button>
                      </td>
                      {columns.map(col => {
                        const isEditing = editingCell?.row === rowIndex && editingCell?.col === col
                        const cellStyle = getCellStyle(rowIndex, col)
                        
                        return (
                          <td 
                            key={col}
                            style={cellStyle}
                            className="data-cell"
                            onClick={() => setEditingCell({ row: rowIndex, col })}
                          >
                            {isEditing ? (
                              <input
                                type="text"
                                value={row[col] || ''}
                                onChange={(e) => handleCellEdit(rowIndex, col, e.target.value)}
                                onBlur={() => setEditingCell(null)}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    setEditingCell(null)
                                  }
                                }}
                                autoFocus
                                className="cell-input"
                              />
                            ) : (
                              <span className="cell-value">
                                {row[col] || <span className="empty-cell">-</span>}
                              </span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 问题列表 */}
        {activeTab === 'issues' && qualityReport && (
          <div className="issues-list">
            {/* 关键问题 */}
            {qualityReport.issues.critical.length > 0 && (
              <div className="issue-section critical">
                <h3>🔴 关键问题（必须修复）</h3>
                {qualityReport.issues.critical.map((issue, i) => (
                  <div key={i} className="issue-item">
                    <span className="issue-location">第{issue.row}行 - {issue.column}</span>
                    <span className="issue-message">{issue.message}</span>
                    <span className="issue-value">当前值: {issue.value || '空'}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 警告 */}
            {qualityReport.issues.warning.length > 0 && (
              <div className="issue-section warning">
                <h3>🟡 警告（建议修复）</h3>
                {qualityReport.issues.warning.map((issue, i) => {
                  const issueId = `${issue.row}-${issue.column}`
                  return (
                    <div key={i} className="issue-item">
                      {issue.autoFixable && (
                        <input
                          type="checkbox"
                          checked={selectedIssues.has(issueId)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedIssues)
                            if (e.target.checked) {
                              newSelected.add(issueId)
                            } else {
                              newSelected.delete(issueId)
                            }
                            setSelectedIssues(newSelected)
                          }}
                        />
                      )}
                      <span className="issue-location">第{issue.row}行 - {issue.column}</span>
                      <span className="issue-message">{issue.message}</span>
                      <span className="issue-value">当前值: {issue.value || '空'}</span>
                      {issue.suggestion && (
                        <span className="issue-suggestion">建议: {issue.suggestion}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* 建议 */}
            {qualityReport.issues.suggestion.length > 0 && (
              <div className="issue-section suggestion">
                <h3>🔵 建议（可选优化）</h3>
                {qualityReport.issues.suggestion.map((issue, i) => {
                  const issueId = `${issue.row}-${issue.column}`
                  return (
                    <div key={i} className="issue-item">
                      {issue.autoFixable && (
                        <input
                          type="checkbox"
                          checked={selectedIssues.has(issueId)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedIssues)
                            if (e.target.checked) {
                              newSelected.add(issueId)
                            } else {
                              newSelected.delete(issueId)
                            }
                            setSelectedIssues(newSelected)
                          }}
                        />
                      )}
                      <span className="issue-location">第{issue.row}行 - {issue.column}</span>
                      <span className="issue-message">{issue.message}</span>
                      <span className="issue-value">当前值: {issue.value || '空'}</span>
                      {issue.suggestion && (
                        <span className="issue-suggestion">建议: {issue.suggestion}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* 底部操作 */}
        <div className="editor-footer">
          <button className="cancel-btn" onClick={onCancel}>
            取消
          </button>
          <button 
            className="confirm-btn"
            onClick={handleConfirm}
            disabled={qualityReport && qualityReport.issues.critical.length > 0}
          >
            {qualityReport && qualityReport.issues.critical.length > 0 
              ? `请先修复${qualityReport.issues.critical.length}个关键问题`
              : '确认并继续'
            }
          </button>
        </div>
      </div>
    </div>
  )
}

export default DataEditor