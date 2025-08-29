import React, { useState, useCallback } from 'react'
import { useUserDimensions } from '../hooks/useUserDimensions'
import { UserProfile } from '../types/userDimensions'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

const UserProfileLibrary: React.FC = () => {
  const {
    profiles,
    isAnalyzing,
    analyzeUsers,
    deleteProfile,
    clearAllProfiles,
    exportProfiles
  } = useUserDimensions()
  
  const [uploadingData, setUploadingData] = useState<any[]>([])
  const [showUploader, setShowUploader] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0, currentUser: '' })
  const [isDragOver, setIsDragOver] = useState(false)

  // 文件处理
  const processFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' })
        
        setUploadingData(jsonData as any[])
        setShowUploader(true)
      } catch (error) {
        console.error('文件解析错误:', error)
        alert('文件解析失败，请确保文件格式正确')
      }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  // 拖拽处理
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

  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  // 开始分析
  const startAnalysis = useCallback(async () => {
    if (uploadingData.length === 0) return

    try {
      await analyzeUsers(uploadingData, (current, total, currentUser) => {
        setAnalysisProgress({ current, total, currentUser })
      })
      
      setShowUploader(false)
      setUploadingData([])
      setAnalysisProgress({ current: 0, total: 0, currentUser: '' })
      alert(`分析完成！成功生成${uploadingData.length}个用户档案`)
    } catch (error) {
      console.error('分析失败:', error)
      alert(`分析失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }, [uploadingData, analyzeUsers])

  // 导出Excel
  const handleExport = useCallback(() => {
    const exportData = exportProfiles()
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(exportData)
    
    // 设置列宽
    const colWidths = [
      { wch: 12 }, // 昵称
      { wch: 6 },  // 年龄
      { wch: 6 },  // 性别
      { wch: 20 }, // 开朗程度
      { wch: 20 }, // 思维风格
      { wch: 25 }, // 话题偏好
      { wch: 25 }, // 社交动机
      { wch: 20 }  // 创建时间
    ]
    ws['!cols'] = colWidths
    
    XLSX.utils.book_append_sheet(wb, ws, '用户档案库')
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    saveAs(data, '用户档案库.xlsx')
  }, [exportProfiles])

  // 维度标签样式
  const getDimensionStyle = (dimension: string, value: any) => {
    const baseStyle = "px-2 py-1 rounded text-sm font-medium"
    
    switch (dimension) {
      case 'extroversion':
        if (value.score >= 8) return `${baseStyle} bg-orange-100 text-orange-800`
        if (value.score >= 5) return `${baseStyle} bg-yellow-100 text-yellow-800`
        return `${baseStyle} bg-blue-100 text-blue-800`
        
      case 'thinking':
        if (value.type === 'rational') return `${baseStyle} bg-purple-100 text-purple-800`
        if (value.type === 'intuitive') return `${baseStyle} bg-pink-100 text-pink-800`
        return `${baseStyle} bg-gray-100 text-gray-800`
        
      case 'topic':
        if (value.primary === '深度探索型') return `${baseStyle} bg-indigo-100 text-indigo-800`
        if (value.primary === '创意文化型') return `${baseStyle} bg-purple-100 text-purple-800`
        return `${baseStyle} bg-green-100 text-green-800`
        
      case 'social':
        if (value.type === 'expand') return `${baseStyle} bg-red-100 text-red-800`
        if (value.type === 'explore') return `${baseStyle} bg-blue-100 text-blue-800`
        return `${baseStyle} bg-emerald-100 text-emerald-800`
        
      default:
        return baseStyle
    }
  }

  return (
    <div className="user-profile-library">
      <div className="library-header">
        <h1 className="page-title">👥 用户档案库</h1>
        <p className="page-subtitle">基于AI维度分析的用户心理档案数据库</p>
        
        <div className="library-actions">
          <button 
            className="btn-primary"
            onClick={() => setShowUploader(true)}
          >
            ➕ 添加用户档案
          </button>
          
          {profiles.length > 0 && (
            <>
              <button 
                className="btn-secondary"
                onClick={handleExport}
              >
                📊 导出Excel
              </button>
              <button 
                className="btn-danger"
                onClick={() => {
                  if (confirm('确定要清空所有档案吗？此操作不可恢复！')) {
                    clearAllProfiles()
                  }
                }}
              >
                🗑️ 清空档案库
              </button>
            </>
          )}
        </div>
      </div>

      {/* 档案统计 */}
      {profiles.length > 0 && (
        <div className="library-stats">
          <div className="stat-card">
            <span className="stat-number">{profiles.length}</span>
            <span className="stat-label">用户档案</span>
          </div>
          
          <div className="stat-card">
            <span className="stat-number">
              {profiles.filter(p => p.dimensions.extroversion.score >= 8).length}
            </span>
            <span className="stat-label">高开朗用户</span>
          </div>
          
          <div className="stat-card">
            <span className="stat-number">
              {profiles.filter(p => p.dimensions.thinkingStyle.type === 'rational').length}
            </span>
            <span className="stat-label">理性思维用户</span>
          </div>
          
          <div className="stat-card">
            <span className="stat-number">
              {profiles.filter(p => p.dimensions.socialMotivation.type === 'expand').length}
            </span>
            <span className="stat-label">扩展型用户</span>
          </div>
        </div>
      )}

      {/* 档案列表 */}
      {profiles.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <h3>档案库为空</h3>
          <p>上传Excel文件，开始构建用户心理档案库</p>
          <button 
            className="btn-primary"
            onClick={() => setShowUploader(true)}
          >
            上传用户数据
          </button>
        </div>
      ) : (
        <div className="profiles-grid">
          {profiles.map((profile) => (
            <div key={profile.userId} className="profile-card">
              <div className="profile-header">
                <div className="profile-info">
                  <h3 className="profile-name">{profile.name}</h3>
                  <div className="profile-meta">
                    {profile.age && <span>{profile.age}岁</span>}
                    {profile.gender && <span>{profile.gender}</span>}
                  </div>
                </div>
                <button 
                  className="delete-btn"
                  onClick={() => {
                    if (confirm(`确定要删除 ${profile.name} 的档案吗？`)) {
                      deleteProfile(profile.userId)
                    }
                  }}
                  title="删除档案"
                >
                  ×
                </button>
              </div>

              <div className="dimensions-grid">
                <div className="dimension-item">
                  <span className="dimension-label">开朗程度</span>
                  <div className={getDimensionStyle('extroversion', profile.dimensions.extroversion)}>
                    {profile.dimensions.extroversion.score}/10
                    <br />
                    <small>{profile.dimensions.extroversion.label}</small>
                  </div>
                </div>

                <div className="dimension-item">
                  <span className="dimension-label">思维风格</span>
                  <div className={getDimensionStyle('thinking', profile.dimensions.thinkingStyle)}>
                    {profile.dimensions.thinkingStyle.score}/10
                    <br />
                    <small>
                      {profile.dimensions.thinkingStyle.type === 'rational' ? '理性型' :
                       profile.dimensions.thinkingStyle.type === 'intuitive' ? '感性型' : '平衡型'}
                    </small>
                  </div>
                </div>

                <div className="dimension-item">
                  <span className="dimension-label">话题偏好</span>
                  <div className={getDimensionStyle('topic', profile.dimensions.topicPreference)}>
                    {profile.dimensions.topicPreference.diversity}/10
                    <br />
                    <small>{profile.dimensions.topicPreference.primary}</small>
                  </div>
                </div>

                <div className="dimension-item">
                  <span className="dimension-label">社交动机</span>
                  <div className={getDimensionStyle('social', profile.dimensions.socialMotivation)}>
                    {profile.dimensions.socialMotivation.intensity}/10
                    <br />
                    <small>
                      {profile.dimensions.socialMotivation.type === 'expand' ? '扩展型' :
                       profile.dimensions.socialMotivation.type === 'explore' ? '探索型' : '充电型'}
                    </small>
                  </div>
                </div>
              </div>

              <div className="profile-footer">
                <small className="creation-time">
                  创建于 {new Date(profile.createdAt).toLocaleDateString()}
                </small>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 上传对话框 */}
      {showUploader && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>添加用户档案</h2>
              <button 
                className="close-btn"
                onClick={() => {
                  setShowUploader(false)
                  setUploadingData([])
                }}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              {uploadingData.length === 0 ? (
                <div 
                  className={`upload-area ${isDragOver ? 'dragover' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('profileFileInput')?.click()}
                >
                  <div className="upload-icon">📁</div>
                  <div className="upload-text">点击选择或拖拽Excel文件</div>
                  <div className="upload-subtext">支持 .xlsx 和 .xls 格式</div>
                  <input
                    id="profileFileInput"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileInputChange}
                    style={{ display: 'none' }}
                  />
                </div>
              ) : (
                <div className="upload-preview">
                  <p>准备分析 {uploadingData.length} 位用户的心理维度</p>
                  
                  {isAnalyzing && (
                    <div className="analysis-progress">
                      <div className="progress-info">
                        <span>正在分析用户档案... ({analysisProgress.current}/{analysisProgress.total})</span>
                        {analysisProgress.currentUser && (
                          <span className="current-user">当前: {analysisProgress.currentUser}</span>
                        )}
                      </div>
                      <div className="progress-bar">
                        <div 
                          className="progress-fill"
                          style={{ 
                            width: `${analysisProgress.total > 0 ? (analysisProgress.current / analysisProgress.total) * 100 : 0}%` 
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="modal-actions">
                    <button 
                      className="btn-primary"
                      onClick={startAnalysis}
                      disabled={isAnalyzing}
                    >
                      {isAnalyzing ? '分析中...' : '🧠 开始AI维度分析'}
                    </button>
                    <button 
                      className="btn-secondary"
                      onClick={() => {
                        setUploadingData([])
                        setShowUploader(false)
                      }}
                      disabled={isAnalyzing}
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .user-profile-library {
          padding: 24px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .library-header {
          margin-bottom: 32px;
        }

        .page-title {
          font-size: 32px;
          font-weight: bold;
          color: #1f2937;
          margin: 0 0 8px 0;
        }

        .page-subtitle {
          font-size: 16px;
          color: #6b7280;
          margin: 0 0 24px 0;
        }

        .library-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .btn-primary, .btn-secondary, .btn-danger {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }

        .btn-primary:hover {
          background: #2563eb;
        }

        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
        }

        .btn-secondary:hover {
          background: #e5e7eb;
        }

        .btn-danger {
          background: #ef4444;
          color: white;
        }

        .btn-danger:hover {
          background: #dc2626;
        }

        .library-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 32px;
        }

        .stat-card {
          background: white;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          text-align: center;
        }

        .stat-number {
          display: block;
          font-size: 28px;
          font-weight: bold;
          color: #3b82f6;
          margin-bottom: 4px;
        }

        .stat-label {
          color: #6b7280;
          font-size: 14px;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .empty-state h3 {
          margin: 0 0 8px 0;
          color: #374151;
        }

        .empty-state p {
          color: #6b7280;
          margin: 0 0 24px 0;
        }

        .profiles-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 20px;
        }

        .profile-card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .profile-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .profile-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 20px 20px 16px 20px;
          border-bottom: 1px solid #e5e7eb;
        }

        .profile-name {
          font-size: 18px;
          font-weight: 600;
          color: #1f2937;
          margin: 0 0 4px 0;
        }

        .profile-meta {
          display: flex;
          gap: 12px;
          font-size: 14px;
          color: #6b7280;
        }

        .delete-btn {
          background: none;
          border: none;
          font-size: 20px;
          color: #9ca3af;
          cursor: pointer;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: all 0.2s ease;
        }

        .delete-btn:hover {
          background: #fef2f2;
          color: #ef4444;
        }

        .dimensions-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          padding: 20px;
        }

        .dimension-item {
          text-align: center;
        }

        .dimension-label {
          display: block;
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 8px;
          font-weight: 500;
        }

        .profile-footer {
          padding: 16px 20px;
          border-top: 1px solid #f3f4f6;
          background: #fafafa;
        }

        .creation-time {
          color: #9ca3af;
          font-size: 12px;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: white;
          border-radius: 12px;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-header h2 {
          margin: 0;
          color: #1f2937;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          color: #9ca3af;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
        }

        .close-btn:hover {
          background: #f3f4f6;
          color: #374151;
        }

        .modal-body {
          padding: 24px;
        }

        .upload-area {
          border: 2px dashed #d1d5db;
          border-radius: 12px;
          padding: 40px 20px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .upload-area:hover, .upload-area.dragover {
          border-color: #3b82f6;
          background: #eff6ff;
        }

        .upload-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .upload-text {
          font-size: 16px;
          color: #374151;
          margin-bottom: 8px;
        }

        .upload-subtext {
          font-size: 14px;
          color: #6b7280;
        }

        .upload-preview {
          text-align: center;
        }

        .upload-preview p {
          margin-bottom: 24px;
          font-size: 16px;
          color: #374151;
        }

        .analysis-progress {
          margin-bottom: 24px;
        }

        .progress-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          font-size: 14px;
          color: #374151;
        }

        .current-user {
          color: #3b82f6;
          font-weight: 500;
        }

        .progress-bar {
          width: 100%;
          height: 8px;
          background: #f3f4f6;
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: #3b82f6;
          transition: width 0.3s ease;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
        }

        .btn-primary:disabled, .btn-secondary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}

export default UserProfileLibrary