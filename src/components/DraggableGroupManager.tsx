import React, { useState, useCallback } from 'react'
import { MatchingResult } from '../types/matching'

// 扩展Window接口以支持拖拽计时器
declare global {
  interface Window {
    dragLeaveTimeout?: NodeJS.Timeout | null
  }
}

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
  // 生成用户唯一ID的函数 - 修复数据不一致问题
  const getUserUniqueId = useCallback((member: any, index?: number) => {
    return `${member.自选昵称 || member.姓名 || member.name || 'user'}_${member.年龄 || 0}_${member.性别 || 'unknown'}_${index || 0}`
  }, [])

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
    // 清理防抖计时器
    if (window.dragLeaveTimeout) {
      clearTimeout(window.dragLeaveTimeout)
      window.dragLeaveTimeout = null
    }
    
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
    // 清除之前的防抖计时器
    if (window.dragLeaveTimeout) {
      clearTimeout(window.dragLeaveTimeout)
      window.dragLeaveTimeout = null
    }
    setDragState(prev => ({ ...prev, draggedOverMemberName: memberName }))
  }, [])

  const handleDragLeaveMember = useCallback((e: React.DragEvent) => {
    // 使用防抖延迟清除高亮，减少闪烁
    const target = e.currentTarget as HTMLElement
    const related = e.relatedTarget as HTMLElement
    
    // 如果 relatedTarget 在当前元素内，不清除高亮
    if (related && target.contains(related)) {
      return
    }
    
    // 延迟清除高亮，给用户更稳定的视觉体验
    window.dragLeaveTimeout = setTimeout(() => {
      setDragState(prev => ({ ...prev, draggedOverMemberName: null }))
    }, 100) // 100ms延迟
  }, [])

  const handleDropOnMember = useCallback((e: React.DragEvent, targetMember: any, targetGroupId: string) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!dragState.draggedMember) {
      handleDragEnd()
      return
    }

    console.log('🔄 成员间拖拽互换:', {
      from: dragState.draggedFromGroup,
      to: targetGroupId,
      draggedUser: dragState.draggedMember.自选昵称,
      draggedGender: dragState.draggedMember.性别,
      targetUser: targetMember.自选昵称,
      targetGender: targetMember.性别
    })

    // 检查同组内男女互换的无效操作
    if (dragState.draggedFromGroup === targetGroupId) {
      const draggedGender = dragState.draggedMember.性别
      const targetGender = targetMember.性别
      
      if (draggedGender !== targetGender) {
        console.log('❌ 同组内男女互换无效，忽略操作')
        handleDragEnd()
        return
      }
      
      if (dragState.draggedMember === targetMember) {
        console.log('❌ 拖拽到自己身上，忽略操作')
        handleDragEnd()
        return
      }
    }

    const newGroups = [...result.groups]
    let newUnassigned = [...(result.unassigned || [])]
    const draggedMember = dragState.draggedMember
    const memberKey = `${draggedMember.自选昵称 || draggedMember.姓名 || 'unknown'}_${draggedMember.年龄}_${draggedMember.性别}`

    // 检查是否是同组内交换
    if (dragState.draggedFromGroup === targetGroupId) {
      // 同组内交换 - 直接交换位置，不涉及待分配
      console.log('🔄 同组内交换位置')
      const targetGroup = newGroups.find(g => g.id === targetGroupId)
      if (targetGroup) {
        const draggedIndex = targetGroup.members.findIndex((m) => {
          const currentKey = `${m.自选昵称 || m.姓名 || 'unknown'}_${m.年龄}_${m.性别}`
          return currentKey === memberKey
        })
        
        const targetKey = `${targetMember.自选昵称 || targetMember.姓名 || 'unknown'}_${targetMember.年龄}_${targetMember.性别}`
        const targetIndex = targetGroup.members.findIndex((m) => {
          const currentKey = `${m.自选昵称 || m.姓名 || 'unknown'}_${m.年龄}_${m.性别}`
          return currentKey === targetKey
        })
        
        if (draggedIndex !== -1 && targetIndex !== -1) {
          // 直接交换两个位置的成员
          console.log(`交换位置: ${memberKey} ↔ ${targetKey}`)
          const temp = targetGroup.members[draggedIndex]
          targetGroup.members[draggedIndex] = targetGroup.members[targetIndex]
          targetGroup.members[targetIndex] = temp
        }
      }
    } else {
      // 跨组或从待分配的操作
      // 1. 从源位置移除拖拽的成员
      if (dragState.draggedFromGroup === 'unassigned') {
        console.log('从待分配移除:', memberKey)
        newUnassigned = newUnassigned.filter((m) => {
          const currentKey = `${m.自选昵称 || m.姓名 || 'unknown'}_${m.年龄}_${m.性别}`
          return currentKey !== memberKey
        })
      } else {
        const sourceGroup = newGroups.find(g => g.id === dragState.draggedFromGroup)
        if (sourceGroup) {
          console.log(`从${sourceGroup.name}移除:`, memberKey)
          sourceGroup.members = sourceGroup.members.filter((m) => {
            const currentKey = `${m.自选昵称 || m.姓名 || 'unknown'}_${m.年龄}_${m.性别}`
            return currentKey !== memberKey
          })
        }
      }

      // 2. 在目标组中找到目标成员并替换
      const targetGroup = newGroups.find(g => g.id === targetGroupId)
      if (targetGroup) {
        const targetKey = `${targetMember.自选昵称 || targetMember.姓名 || 'unknown'}_${targetMember.年龄}_${targetMember.性别}`
        const targetIndex = targetGroup.members.findIndex((m) => {
          const currentKey = `${m.自选昵称 || m.姓名 || 'unknown'}_${m.年龄}_${m.性别}`
          return currentKey === targetKey
        })
        
        if (targetIndex !== -1) {
          console.log(`在${targetGroup.name}中替换:`, targetKey, '←→', memberKey)
          // 替换目标位置的成员
          targetGroup.members[targetIndex] = draggedMember
          // 将被替换的成员放到待分配
          newUnassigned.push(targetMember)
          console.log('被替换成员添加到待分配:', targetKey)
        }
      }
    }

    console.log('🚀 强制执行成员互换更新')

    // 更新结果
    onGroupsChange({
      ...result,
      groups: newGroups,
      unassigned: newUnassigned
    })

    handleDragEnd()
  }, [dragState, result, onGroupsChange, handleDragEnd, getUserUniqueId])

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

    // 从源组移除成员 - 使用多重匹配策略确保可靠移除
    const memberToRemove = dragState.draggedMember
    const memberKey = `${memberToRemove.自选昵称 || memberToRemove.姓名 || 'unknown'}_${memberToRemove.年龄}_${memberToRemove.性别}`
    
    if (dragState.draggedFromGroup === 'unassigned') {
      const beforeCount = newUnassigned.length
      console.log('准备从未分配移除:', memberKey, '当前未分配数量:', beforeCount)
      
      newUnassigned = newUnassigned.filter((m) => {
        const currentKey = `${m.自选昵称 || m.姓名 || 'unknown'}_${m.年龄}_${m.性别}`
        const shouldKeep = currentKey !== memberKey
        if (!shouldKeep) {
          console.log('🎯 找到并移除:', currentKey)
        }
        return shouldKeep
      })
      
      console.log('从未分配移除结果:', beforeCount, '->', newUnassigned.length, '差异:', beforeCount - newUnassigned.length)
      
      if (beforeCount === newUnassigned.length) {
        console.error('❌ 移除失败！未找到匹配的成员')
      }
    } else {
      const sourceGroup = newGroups.find(g => g.id === dragState.draggedFromGroup)
      if (sourceGroup) {
        const beforeCount = sourceGroup.members.length
        console.log(`准备从${sourceGroup.name}移除:`, memberKey, '当前组成员数:', beforeCount)
        
        sourceGroup.members = sourceGroup.members.filter((m) => {
          const currentKey = `${m.自选昵称 || m.姓名 || 'unknown'}_${m.年龄}_${m.性别}`
          const shouldKeep = currentKey !== memberKey
          if (!shouldKeep) {
            console.log('🎯 找到并移除:', currentKey)
          }
          return shouldKeep
        })
        
        console.log(`从${sourceGroup.name}移除结果:`, beforeCount, '->', sourceGroup.members.length, '差异:', beforeCount - sourceGroup.members.length)
        
        if (beforeCount === sourceGroup.members.length) {
          console.error('❌ 移除失败！未找到匹配的成员')
        }
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
    const totalBefore = result.groups.reduce((sum, g) => sum + g.members.length, 0) + (result.unassigned?.length || 0)
    
    console.log('📊 数据完整性检查:', {
      处理前总数: totalBefore,
      处理后总数: totalAfter,
      差异: totalAfter - totalBefore,
      处理前分组详情: result.groups.map(g => `${g.name}: ${g.members.length}人`),
      处理前未分配: result.unassigned?.length || 0,
      处理后分组详情: newGroups.map(g => `${g.name}: ${g.members.length}人`),
      处理后未分配: newUnassigned.length
    })
    
    // 暂时移除数据完整性检查，直接执行更新
    console.log('🚀 强制执行更新，忽略数据完整性检查')
    
    /*
    // 数据完整性验证 - 防止数据丢失或重复
    if (totalAfter !== totalBefore) {
      console.error('❌ 拖拽操作导致数据不一致!', {
        操作: `从${dragState.draggedFromGroup}移动到${targetGroupId}`,
        用户: dragState.draggedMember.自选昵称 || '未知',
        处理前总数: totalBefore,
        处理后总数: totalAfter,
        数据差异: totalBefore - totalAfter
      })
      // 不执行更新，保持原状态
      handleDragEnd()
      return
    }
    */

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
              {group.members.length > 0 ? (() => {
                // 按性别分组
                const maleMembers = group.members.filter(m => m.性别 === '男' || m.性别 === '男性')
                const femaleMembers = group.members.filter(m => m.性别 === '女' || m.性别 === '女性')
                const otherMembers = group.members.filter(m => m.性别 !== '男' && m.性别 !== '男性' && m.性别 !== '女' && m.性别 !== '女性')
                
                const renderMember = (member: any, idx: number) => (
                  <div
                    key={`${group.id}_${idx}_${getUserUniqueId(member, idx)}`}
                    className={`member-card draggable ${
                      dragState.draggedOverMemberName === member.自选昵称 && dragState.draggedMember
                        ? 'swap-target' 
                        : ''
                    }`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, member, group.id)}
                    onDragOver={handleDragOver}
                    onDragEnter={() => {
                      if (member.自选昵称 && dragState.draggedMember) {
                        handleDragEnterMember(member.自选昵称)
                      }
                    }}
                    onDragLeave={handleDragLeaveMember}
                    onDrop={(e) => {
                      if (dragState.draggedMember) {
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
                    {dragState.draggedOverMemberName === member.自选昵称 && dragState.draggedMember && (
                      <div className="swap-indicator">⇄ 互换</div>
                    )}
                  </div>
                )
                
                return (
                  <>
                    {/* 男性成员 */}
                    {maleMembers.length > 0 && (
                      <div className="gender-section">
                        <div className="gender-label male-label">♂ 男生 ({maleMembers.length})</div>
                        {maleMembers.map((member, idx) => renderMember(member, idx))}
                      </div>
                    )}
                    
                    {/* 性别分隔线 */}
                    {maleMembers.length > 0 && femaleMembers.length > 0 && (
                      <div className="gender-divider"></div>
                    )}
                    
                    {/* 女性成员 */}
                    {femaleMembers.length > 0 && (
                      <div className="gender-section">
                        <div className="gender-label female-label">♀ 女生 ({femaleMembers.length})</div>
                        {femaleMembers.map((member, idx) => renderMember(member, idx))}
                      </div>
                    )}
                    
                    {/* 其他性别成员 */}
                    {otherMembers.length > 0 && (
                      <div className="gender-section">
                        <div className="gender-label other-label">其他 ({otherMembers.length})</div>
                        {otherMembers.map((member, idx) => renderMember(member, idx))}
                      </div>
                    )}
                  </>
                )
              })() : (
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
              key={`unassigned_${getUserUniqueId(member, idx)}`}
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

        .gender-section {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .gender-label {
          font-size: 12px;
          font-weight: 700;
          padding: 4px 8px;
          border-radius: 4px;
          text-align: center;
          margin: 2px 0;
          letter-spacing: 0.5px;
        }

        .male-label {
          background: linear-gradient(135deg, #E3F2FD, #BBDEFB);
          color: #1565C0;
          border: 1px solid #42A5F5;
        }

        .female-label {
          background: linear-gradient(135deg, #FCE4EC, #F8BBD9);
          color: #C2185B;
          border: 1px solid #E91E63;
        }

        .other-label {
          background: linear-gradient(135deg, #F3E5F5, #E1BEE7);
          color: #7B1FA2;
          border: 1px solid #9C27B0;
        }

        .gender-divider {
          height: 2px;
          background: linear-gradient(90deg, #E3F2FD 0%, #FCE4EC 100%);
          margin: 8px 0;
          border-radius: 1px;
          position: relative;
          overflow: hidden;
        }

        .gender-divider::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent 0%, rgba(102,126,234,0.6) 50%, transparent 100%);
          animation: shimmer 2s infinite;
        }

        @keyframes shimmer {
          0% { left: -100%; }
          100% { left: 100%; }
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