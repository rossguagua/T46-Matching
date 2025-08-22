import React, { useState, useCallback } from 'react'
import { MatchingResult, MatchingGroup } from '../types/matching'

interface DraggableGroupManagerProps {
  result: MatchingResult
  onGroupsChange: (newResult: MatchingResult) => void
}

interface DragState {
  isDragging: boolean
  draggedMember: any
  draggedFromGroup: string | 'unassigned'
  draggedOverGroup: string | 'unassigned' | null
}

const DraggableGroupManager: React.FC<DraggableGroupManagerProps> = ({ result, onGroupsChange }) => {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedMember: null,
    draggedFromGroup: '',
    draggedOverGroup: null
  })

  const handleDragStart = useCallback((e: React.DragEvent, member: any, groupId: string | 'unassigned') => {
    setDragState({
      isDragging: true,
      draggedMember: member,
      draggedFromGroup: groupId,
      draggedOverGroup: null
    })
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragEnd = useCallback(() => {
    setDragState({
      isDragging: false,
      draggedMember: null,
      draggedFromGroup: '',
      draggedOverGroup: null
    })
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDragEnter = useCallback((groupId: string | 'unassigned') => {
    setDragState(prev => ({ ...prev, draggedOverGroup: groupId }))
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragState(prev => ({ ...prev, draggedOverGroup: null }))
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, targetGroupId: string | 'unassigned') => {
    e.preventDefault()
    
    if (!dragState.draggedMember || dragState.draggedFromGroup === targetGroupId) {
      handleDragEnd()
      return
    }

    const newGroups = [...result.groups]
    let newUnassigned = [...(result.unassigned || [])]

    // 从源组移除成员
    if (dragState.draggedFromGroup === 'unassigned') {
      newUnassigned = newUnassigned.filter(m => 
        m.自选昵称 !== dragState.draggedMember.自选昵称
      )
    } else {
      const sourceGroup = newGroups.find(g => g.id === dragState.draggedFromGroup)
      if (sourceGroup) {
        sourceGroup.members = sourceGroup.members.filter(m => 
          m.自选昵称 !== dragState.draggedMember.自选昵称
        )
      }
    }

    // 添加到目标组
    if (targetGroupId === 'unassigned') {
      newUnassigned.push(dragState.draggedMember)
    } else {
      const targetGroup = newGroups.find(g => g.id === targetGroupId)
      if (targetGroup) {
        targetGroup.members.push(dragState.draggedMember)
      }
    }

    // 更新结果
    onGroupsChange({
      ...result,
      groups: newGroups,
      unassigned: newUnassigned
    })

    handleDragEnd()
  }, [dragState, result, onGroupsChange, handleDragEnd])

  return (
    <div className="draggable-groups-container">
      <div className="groups-grid">
        {result.groups.map((group) => (
          <div 
            key={group.id} 
            className={`group-card draggable ${
              dragState.draggedOverGroup === group.id ? 'drag-over' : ''
            }`}
            onDragOver={handleDragOver}
            onDragEnter={() => handleDragEnter(group.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, group.id)}
          >
            <div className="group-header">
              <h3 className="group-title">{group.name}</h3>
              <div className="group-stats">
                <span className="member-count">{group.members.length}人</span>
                <span className="group-score">
                  匹配度: {group.compatibility_score?.toFixed(2) || '0.00'}
                </span>
              </div>
            </div>
            <div className="group-description">{group.description}</div>
            <div className="group-members">
              {group.members.map((member, idx) => (
                <div
                  key={idx}
                  className="member-card draggable"
                  draggable
                  onDragStart={(e) => handleDragStart(e, member, group.id)}
                >
                  <div className="member-name">{member.自选昵称}</div>
                  <div className="member-info">
                    {member.年龄}岁 · {member.性别} · {member.职业}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {result.unassigned && result.unassigned.length > 0 && (
        <div 
          className={`unassigned-section draggable ${
            dragState.draggedOverGroup === 'unassigned' ? 'drag-over' : ''
          }`}
          onDragOver={handleDragOver}
          onDragEnter={() => handleDragEnter('unassigned')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'unassigned')}
        >
          <h3>待分组用户 ({result.unassigned.length}人)</h3>
          <div className="unassigned-members">
            {result.unassigned.map((member, idx) => (
              <div
                key={idx}
                className="member-card draggable"
                draggable
                onDragStart={(e) => handleDragStart(e, member, 'unassigned')}
              >
                <div className="member-name">{member.自选昵称}</div>
                <div className="member-info">
                  {member.年龄}岁 · {member.性别} · {member.职业}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .draggable-groups-container {
          padding: 20px;
        }

        .groups-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }

        .group-card.draggable {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          border: 2px solid transparent;
          transition: all 0.3s ease;
        }

        .group-card.draggable.drag-over {
          border-color: #667eea;
          background: linear-gradient(135deg, rgba(102,126,234,0.05) 0%, rgba(118,75,162,0.05) 100%);
          transform: scale(1.02);
        }

        .group-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          padding-bottom: 10px;
          border-bottom: 2px solid #f0f0f0;
        }

        .group-title {
          font-size: 18px;
          font-weight: 700;
          color: #333;
          margin: 0;
        }

        .group-stats {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .member-count {
          background: #f0f0f0;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }

        .group-score {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }

        .group-description {
          font-size: 13px;
          color: #666;
          margin-bottom: 15px;
          font-style: italic;
        }

        .group-members {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .member-card.draggable {
          background: #f8f9fa;
          padding: 10px;
          border-radius: 8px;
          cursor: move;
          transition: all 0.2s ease;
          border: 1px solid #e0e0e0;
        }

        .member-card.draggable:hover {
          background: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          transform: translateY(-2px);
        }

        .member-card.draggable:active {
          opacity: 0.5;
        }

        .member-name {
          font-weight: 600;
          font-size: 14px;
          color: #333;
          margin-bottom: 4px;
        }

        .member-info {
          font-size: 12px;
          color: #666;
        }

        .unassigned-section.draggable {
          background: #f8f9fa;
          border-radius: 12px;
          padding: 20px;
          border: 2px dashed #ddd;
          transition: all 0.3s ease;
        }

        .unassigned-section.draggable.drag-over {
          border-color: #667eea;
          background: white;
        }

        .unassigned-section h3 {
          color: #666;
          margin-bottom: 15px;
          font-size: 16px;
        }

        .unassigned-members {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 10px;
        }
      `}</style>
    </div>
  )
}

export default DraggableGroupManager