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
  draggedOverMemberName: string | null
}

const DraggableGroupManager: React.FC<DraggableGroupManagerProps> = ({ result, onGroupsChange }) => {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedMember: null,
    draggedFromGroup: '',
    draggedOverGroup: null,
    draggedOverMemberName: null
  })

  const handleDragStart = useCallback((e: React.DragEvent, member: any, groupId: string | 'unassigned') => {
    setDragState({
      isDragging: true,
      draggedMember: member,
      draggedFromGroup: groupId,
      draggedOverGroup: null,
      draggedOverMemberName: null
    })
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragEnd = useCallback(() => {
    setDragState({
      isDragging: false,
      draggedMember: null,
      draggedFromGroup: '',
      draggedOverGroup: null,
      draggedOverMemberName: null
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
    setDragState(prev => ({ ...prev, draggedOverGroup: null, draggedOverMemberName: null }))
  }, [])

  const handleDragEnterMember = useCallback((memberName: string) => {
    setDragState(prev => ({ ...prev, draggedOverMemberName: memberName }))
  }, [])

  const handleDragLeaveMember = useCallback(() => {
    setDragState(prev => ({ ...prev, draggedOverMemberName: null }))
  }, [])

  const handleDropOnMember = useCallback((e: React.DragEvent, targetMember: any, targetGroupId: string) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!dragState.draggedMember || dragState.draggedFromGroup !== 'unassigned') {
      handleDragEnd()
      return
    }

    const newGroups = [...result.groups]
    let newUnassigned = [...(result.unassigned || [])]

    // 从未分配列表中移除拖拽的成员
    newUnassigned = newUnassigned.filter(m => 
      m.自选昵称 !== dragState.draggedMember.自选昵称
    )

    // 找到目标组并进行互换
    const targetGroup = newGroups.find(g => g.id === targetGroupId)
    if (targetGroup) {
      // 找到目标成员在组中的索引
      const targetMemberIndex = targetGroup.members.findIndex(m => 
        m.自选昵称 === targetMember.自选昵称
      )
      
      if (targetMemberIndex !== -1) {
        // 在原位置替换成员
        targetGroup.members[targetMemberIndex] = dragState.draggedMember
        // 将被替换的成员添加到未分配列表
        newUnassigned.push(targetMember)
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
                  className={`member-card draggable ${
                    dragState.draggedOverMemberName === member.自选昵称 && dragState.draggedFromGroup === 'unassigned' 
                      ? 'swap-target' 
                      : ''
                  }`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, member, group.id)}
                  onDragOver={handleDragOver}
                  onDragEnter={() => {
                    if (dragState.draggedFromGroup === 'unassigned') {
                      handleDragEnterMember(member.自选昵称)
                    }
                  }}
                  onDragLeave={handleDragLeaveMember}
                  onDrop={(e) => {
                    if (dragState.draggedFromGroup === 'unassigned') {
                      handleDropOnMember(e, member, group.id)
                    }
                  }}
                >
                  <div className="member-name">{member.自选昵称}</div>
                  <div className="member-info">
                    {member.年龄}岁 · {member.性别} · {member.职业}
                  </div>
                  {dragState.draggedOverMemberName === member.自选昵称 && dragState.draggedFromGroup === 'unassigned' && (
                    <div className="swap-indicator">⇄ 互换</div>
                  )}
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
                className={`member-card draggable ${
                  dragState.isDragging && dragState.draggedMember === member 
                    ? 'dragging' 
                    : ''
                }`}
                draggable
                onDragStart={(e) => handleDragStart(e, member, 'unassigned')}
              >
                <div className="member-name">{member.自选昵称}</div>
                <div className="member-info">
                  {member.年龄}岁 · {member.性别} · {member.职业}
                </div>
                {dragState.isDragging && dragState.draggedMember === member && (
                  <div className="drag-hint">拖到组内成员上可互换</div>
                )}
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
          position: relative;
        }

        .member-card.draggable:hover {
          background: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          transform: translateY(-2px);
        }

        .member-card.draggable:active {
          opacity: 0.5;
        }

        .member-card.draggable.swap-target {
          background: linear-gradient(135deg, rgba(255,107,53,0.1) 0%, rgba(255,142,83,0.1) 100%);
          border: 2px solid #ff6b35;
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(255,107,53,0.3);
        }

        .swap-indicator {
          position: absolute;
          top: 50%;
          right: 10px;
          transform: translateY(-50%);
          background: #ff6b35;
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          animation: pulse 1s infinite;
        }

        @keyframes pulse {
          0% { transform: translateY(-50%) scale(1); }
          50% { transform: translateY(-50%) scale(1.1); }
          100% { transform: translateY(-50%) scale(1); }
        }

        .member-card.draggable.dragging {
          opacity: 0.7;
          border: 2px dashed #667eea;
        }

        .drag-hint {
          position: absolute;
          bottom: -20px;
          left: 50%;
          transform: translateX(-50%);
          background: #667eea;
          color: white;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
          z-index: 1000;
          box-shadow: 0 2px 8px rgba(102,126,234,0.3);
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