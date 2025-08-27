import React, { useState, useCallback } from 'react'
import { MatchingResult } from '../types/matching'

interface DraggableGroupManagerProps {
  result: MatchingResult
  onGroupsChange: (newResult: MatchingResult) => void
  onDeleteGroup?: (groupId: string) => void
  onCreateGroup?: () => void
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
    // 只阻止拖放默认行为，不阻止滚轮
    if (e.dataTransfer.types.includes('text/plain') || dragState.isDragging) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
    }
  }, [dragState.isDragging])

  const handleDragEnter = useCallback((groupId: string | 'unassigned') => {
    setDragState(prev => ({ ...prev, draggedOverGroup: groupId }))
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // 检查是否真正离开了组容器，而不是进入了子元素
    const currentTarget = e.currentTarget as HTMLElement
    const relatedTarget = e.relatedTarget as HTMLElement
    
    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      // 真正离开组容器
      setDragState(prev => ({ ...prev, draggedOverGroup: null, draggedOverMemberName: null }))
    }
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

    console.log('拖拽操作:', {
      from: dragState.draggedFromGroup,
      to: targetGroupId,
      member: dragState.draggedMember.自选昵称,
      总人数前: result.groups.reduce((sum, g) => sum + g.members.length, 0) + (result.unassigned?.length || 0)
    })

    const newGroups = [...result.groups]
    let newUnassigned = [...(result.unassigned || [])]

    // 从源组移除成员 - 使用昵称进行精确匹配
    if (dragState.draggedFromGroup === 'unassigned') {
      const beforeCount = newUnassigned.length
      newUnassigned = newUnassigned.filter(m => 
        m.自选昵称 !== dragState.draggedMember.自选昵称
      )
      console.log('从未分配移除:', beforeCount, '->', newUnassigned.length)
    } else {
      const sourceGroup = newGroups.find(g => g.id === dragState.draggedFromGroup)
      if (sourceGroup) {
        const beforeCount = sourceGroup.members.length
        sourceGroup.members = sourceGroup.members.filter(m => 
          m.自选昵称 !== dragState.draggedMember.自选昵称
        )
        console.log(`从${sourceGroup.name}移除:`, beforeCount, '->', sourceGroup.members.length)
      }
    }

    // 添加到目标组
    if (targetGroupId === 'unassigned') {
      newUnassigned.push(dragState.draggedMember)
      console.log('添加到未分配:', newUnassigned.length)
    } else {
      const targetGroup = newGroups.find(g => g.id === targetGroupId)
      if (targetGroup) {
        targetGroup.members.push(dragState.draggedMember)
        console.log(`添加到${targetGroup.name}:`, targetGroup.members.length)
      }
    }

    const totalAfter = newGroups.reduce((sum, g) => sum + g.members.length, 0) + newUnassigned.length
    console.log('总人数后:', totalAfter)

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
              <h3 className="group-title">第{group.id.replace('group_', '')}组</h3>
              {/* 删除组功能暂时移除 */}
              <div className="group-stats">
                <span className="member-count">{group.members.length}人</span>
                {(() => {
                  const ages = group.members.map(m => Number(m.年龄) || 0).filter(age => age > 0)
                  const ageGap = ages.length > 0 ? Math.max(...ages) - Math.min(...ages) : 0
                  return (
                    <span className={`age-gap ${ageGap > 3 ? 'warning' : 'ok'}`}>
                      年龄差: {ageGap}岁
                    </span>
                  )
                })()}
              </div>
            </div>
            <div className="group-members">
              {group.members.length > 0 ? group.members.map((member, idx) => (
                <div
                  key={`${group.id}_${idx}_${member.自选昵称 || member.name || idx}`}
                  className={`member-card draggable ${
                    dragState.draggedOverMemberName === member.自选昵称 && dragState.draggedFromGroup === 'unassigned' 
                      ? 'swap-target' 
                      : ''
                  }`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, member, group.id)}
                  onDragOver={handleDragOver}
                  onDragEnter={() => {
                    if (dragState.draggedFromGroup === 'unassigned' && member.自选昵称) {
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
                    {(member['对于现场话题和游戏的开放程度，你的接受度'] || member.开放度) && (
                      <span> · 开放度: {member['对于现场话题和游戏的开放程度，你的接受度'] || member.开放度}</span>
                    )}
                  </div>
                  {dragState.draggedOverMemberName === member.自选昵称 && dragState.draggedFromGroup === 'unassigned' && (
                    <div className="swap-indicator">⇄ 互换</div>
                  )}
                </div>
              )) : (
                <div className="empty-group-placeholder">
                  拖拽成员到此处添加
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 始终显示未分配区域，即使没有人 */}
      <div 
        className={`unassigned-section draggable ${
          dragState.draggedOverGroup === 'unassigned' ? 'drag-over' : ''
        }`}
        onDragOver={handleDragOver}
        onDragEnter={() => handleDragEnter('unassigned')}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, 'unassigned')}
      >
        <div className="unassigned-header">
          <h3>待分组用户 ({result.unassigned?.length || 0}人)</h3>
        </div>
        <div className="unassigned-members">
          {result.unassigned && result.unassigned.length > 0 ? result.unassigned.map((member, idx) => (
            <div
              key={`unassigned_${member.自选昵称 || member.name || idx}`}
              className={`member-card draggable ${
                dragState.isDragging && dragState.draggedMember === member 
                  ? 'dragging' 
                  : ''
              }`}
              draggable
              onDragStart={(e) => handleDragStart(e, member, 'unassigned')}
              style={{ 
                touchAction: 'none' // 允许拖拽但保持滚动
              }}
            >
              <div className="member-name">{member.自选昵称}</div>
              <div className="member-info">
                {member.年龄}岁 · {member.性别} · {member.职业}
                {(member['对于现场话题和游戏的开放程度，你的接受度'] || member.开放度) && (
                  <span> · 开放度: {member['对于现场话题和游戏的开放程度，你的接受度'] || member.开放度}</span>
                )}
              </div>
              {dragState.isDragging && dragState.draggedMember === member && (
                <div className="drag-hint">拖到组内成员上可互换</div>
              )}
            </div>
          )) : (
            <div className="no-unassigned">暂无待分配用户</div>
          )}
        </div>
      </div>

      <style>{`
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
          border: 3px solid #667eea !important;
          background: linear-gradient(135deg, rgba(102,126,234,0.15) 0%, rgba(118,75,162,0.15) 100%) !important;
          transform: scale(1.05) !important;
          box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4) !important;
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

        .age-gap {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }

        .age-gap.ok {
          background: #d4edda;
          color: #155724;
        }

        .age-gap.warning {
          background: #f8d7da;
          color: #721c24;
          animation: pulse-warning 2s infinite;
        }

        @keyframes pulse-warning {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
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
          cursor: grab;
          transition: all 0.2s ease;
          border: 1px solid #e0e0e0;
          position: relative;
          user-select: none;
          touch-action: pan-y;
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
          position: relative;
        }

        .unassigned-section.draggable.drag-over {
          border: 3px solid #667eea !important;
          background: linear-gradient(135deg, rgba(102,126,234,0.1) 0%, rgba(118,75,162,0.1) 100%) !important;
          transform: scale(1.02) !important;
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.3) !important;
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
          max-height: 200px;
          overflow-y: auto;
          overflow-x: hidden;
          padding-right: 10px;
          scroll-behavior: smooth;
          touch-action: pan-y;
        }
        
        .unassigned-members::-webkit-scrollbar {
          width: 6px;
        }
        
        .unassigned-members::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 3px;
        }
        
        .unassigned-members::-webkit-scrollbar-thumb {
          background: #667eea;
          border-radius: 3px;
        }
      `}</style>
    </div>
  )
}

export default DraggableGroupManager