import React, { useState, useCallback, useEffect } from 'react'
import { Group, UserData } from '../types/matching'

interface GroupAdjusterProps {
  groups: Group[]
  unassigned: UserData[]
  onGroupsChange: (groups: Group[], unassigned: UserData[]) => void
  onConfirm: () => void
  onCancel: () => void
}

interface DragItem {
  user: UserData
  sourceGroupId: string | 'unassigned'
  sourceIndex: number
}

const GroupAdjuster: React.FC<GroupAdjusterProps> = ({
  groups: initialGroups,
  unassigned: initialUnassigned,
  onGroupsChange,
  onConfirm,
  onCancel
}) => {
  const [groups, setGroups] = useState<Group[]>(initialGroups)
  const [unassigned, setUnassigned] = useState<UserData[]>(initialUnassigned)
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null)
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null)
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [groupScores, setGroupScores] = useState<{ [groupId: string]: number }>({})
  const [showRebalanceModal, setShowRebalanceModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterGender, setFilterGender] = useState<'all' | '男' | '女'>('all')
  const [highlightedGroup, setHighlightedGroup] = useState<string | null>(null)

  // 计算组统计信息
  const calculateGroupStats = useCallback((group: Group) => {
    const males = group.members.filter(m => m.性别 === '男' || m.性别 === '男性').length
    const females = group.members.filter(m => m.性别 === '女' || m.性别 === '女性').length
    const ages = group.members.map(m => Number(m.年龄) || 0).filter(age => age > 0)
    const avgAge = ages.length > 0 ? Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length) : 0
    const maxAge = Math.max(...ages)
    const minAge = Math.min(...ages)
    const ageGap = maxAge - minAge

    return {
      total: group.members.length,
      males,
      females,
      avgAge,
      ageGap,
      genderBalance: `${males}:${females}`,
      isBalanced: Math.abs(males - females) <= 1,
      isFull: group.members.length === 6,
      isEmpty: group.members.length === 0
    }
  }, [])

  // 拖拽开始
  const handleDragStart = useCallback((e: React.DragEvent, user: UserData, sourceGroupId: string | 'unassigned', sourceIndex: number) => {
    setDraggedItem({ user, sourceGroupId, sourceIndex })
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', JSON.stringify({ user, sourceGroupId, sourceIndex }))
  }, [])

  // 拖拽经过
  const handleDragOver = useCallback((e: React.DragEvent, groupId: string | 'unassigned') => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverGroup(groupId)
  }, [])

  // 拖拽离开
  const handleDragLeave = useCallback(() => {
    setDragOverGroup(null)
  }, [])

  // 拖拽放下
  const handleDrop = useCallback((e: React.DragEvent, targetGroupId: string | 'unassigned') => {
    e.preventDefault()
    setDragOverGroup(null)

    if (!draggedItem) return

    const { user, sourceGroupId } = draggedItem

    // 如果是同一个组，不做任何操作
    if (sourceGroupId === targetGroupId) {
      setDraggedItem(null)
      return
    }

    const newGroups = [...groups]
    let newUnassigned = [...unassigned]

    // 从源位置移除用户
    if (sourceGroupId === 'unassigned') {
      newUnassigned = newUnassigned.filter(u => u !== user)
    } else {
      const sourceGroup = newGroups.find(g => g.id === sourceGroupId)
      if (sourceGroup) {
        sourceGroup.members = sourceGroup.members.filter(m => m !== user)
      }
    }

    // 添加到目标位置
    if (targetGroupId === 'unassigned') {
      newUnassigned.push(user)
    } else {
      const targetGroup = newGroups.find(g => g.id === targetGroupId)
      if (targetGroup && targetGroup.members.length < 8) { // 最多8人一组
        targetGroup.members.push(user)
      }
    }

    setGroups(newGroups)
    setUnassigned(newUnassigned)
    setDraggedItem(null)
    
    // 触发分数重算
    recalculateScores(newGroups)
  }, [draggedItem, groups, unassigned])

  // 重算分数
  const recalculateScores = useCallback((currentGroups: Group[]) => {
    const newScores: { [groupId: string]: number } = {}
    
    currentGroups.forEach(group => {
      const stats = calculateGroupStats(group)
      let score = 7.0 // 基础分

      // 人数评分
      if (stats.total === 6) score += 1.0
      else if (stats.total < 3 || stats.total > 8) score -= 2.0
      else if (stats.total < 5 || stats.total > 7) score -= 0.5

      // 性别平衡评分
      if (stats.isBalanced) score += 0.5
      else if (Math.abs(stats.males - stats.females) > 2) score -= 1.0

      // 年龄差评分
      if (stats.ageGap <= 5) score += 0.5
      else if (stats.ageGap > 10) score -= 1.0

      newScores[group.id] = Math.max(0, Math.min(10, score))
    })

    setGroupScores(newScores)
  }, [calculateGroupStats])

  // 初始化分数
  useEffect(() => {
    recalculateScores(groups)
  }, [])

  // 批量移动选中的用户
  const handleBatchMove = useCallback((targetGroupId: string | 'unassigned') => {
    if (selectedUsers.size === 0) return

    const newGroups = [...groups]
    let newUnassigned = [...unassigned]
    const usersToMove: UserData[] = []

    // 收集要移动的用户
    selectedUsers.forEach(userId => {
      // 从未分配中查找
      const unassignedUser = newUnassigned.find(u => `unassigned-${u.姓名}` === userId)
      if (unassignedUser) {
        usersToMove.push(unassignedUser)
        newUnassigned = newUnassigned.filter(u => u !== unassignedUser)
      }

      // 从各组中查找
      newGroups.forEach(group => {
        const member = group.members.find(m => `${group.id}-${m.姓名}` === userId)
        if (member) {
          usersToMove.push(member)
          group.members = group.members.filter(m => m !== member)
        }
      })
    })

    // 添加到目标位置
    if (targetGroupId === 'unassigned') {
      newUnassigned.push(...usersToMove)
    } else {
      const targetGroup = newGroups.find(g => g.id === targetGroupId)
      if (targetGroup) {
        const availableSpace = 8 - targetGroup.members.length
        const toAdd = usersToMove.slice(0, availableSpace)
        targetGroup.members.push(...toAdd)
        
        // 如果空间不够，剩余的放回未分配
        if (usersToMove.length > availableSpace) {
          newUnassigned.push(...usersToMove.slice(availableSpace))
        }
      }
    }

    setGroups(newGroups)
    setUnassigned(newUnassigned)
    setSelectedUsers(new Set())
    recalculateScores(newGroups)
  }, [groups, unassigned, selectedUsers])

  // 自动平衡分组
  const handleAutoBalance = useCallback(() => {
    const allUsers = [
      ...unassigned,
      ...groups.flatMap(g => g.members)
    ]

    const groupSize = 6
    const numGroups = Math.floor(allUsers.length / groupSize)
    const newGroups: Group[] = []

    // 按性别和年龄排序
    const sortedUsers = [...allUsers].sort((a, b) => {
      if (a.性别 !== b.性别) return (a.性别 || '') < (b.性别 || '') ? -1 : 1
      return (Number(a.年龄) || 0) - (Number(b.年龄) || 0)
    })

    // 创建平衡的组
    for (let i = 0; i < numGroups; i++) {
      const group: Group = {
        id: `group_${i + 1}`,
        name: `第${i + 1}组`,
        members: [],
        description: '自动平衡分组',
        compatibility_score: 7.5
      }

      // 分配成员，尽量保持性别平衡
      for (let j = 0; j < groupSize; j++) {
        if (sortedUsers.length > 0) {
          // 交替选择不同性别
          const index = j % 2 === 0 ? 0 : sortedUsers.findIndex(u => u.性别 !== sortedUsers[0].性别)
          if (index >= 0 && index < sortedUsers.length) {
            group.members.push(sortedUsers.splice(index, 1)[0])
          } else if (sortedUsers.length > 0) {
            group.members.push(sortedUsers.shift()!)
          }
        }
      }

      newGroups.push(group)
    }

    setGroups(newGroups)
    setUnassigned(sortedUsers) // 剩余的用户
    recalculateScores(newGroups)
    setShowRebalanceModal(false)
  }, [groups, unassigned])

  // 搜索和过滤用户
  const filterUsers = useCallback((users: UserData[]) => {
    return users.filter(user => {
      const matchesSearch = !searchQuery || 
        Object.values(user).some(value => 
          String(value).toLowerCase().includes(searchQuery.toLowerCase())
        )
      
      const matchesGender = filterGender === 'all' || 
        user.性别 === filterGender || 
        (filterGender === '男' && user.性别 === '男性') ||
        (filterGender === '女' && user.性别 === '女性')

      return matchesSearch && matchesGender
    })
  }, [searchQuery, filterGender])

  // 用户选择
  const handleUserSelect = useCallback((userId: string, e: React.MouseEvent) => {
    // 防止事件冒泡影响滚动
    e.stopPropagation()
    
    if (e.shiftKey || isMultiSelectMode) {
      const newSelected = new Set(selectedUsers)
      if (newSelected.has(userId)) {
        newSelected.delete(userId)
      } else {
        newSelected.add(userId)
      }
      setSelectedUsers(newSelected)
    }
  }, [selectedUsers, isMultiSelectMode])

  // 创建新组 - 支持在待分组区域创建多个空组
  const handleCreateGroup = useCallback(() => {
    const newGroup: Group = {
      id: `group_${Date.now()}`,
      name: `新建组 ${groups.length + 1}`,
      members: [],
      description: '手动创建的分组',
      compatibility_score: 0
    }
    setGroups([...groups, newGroup])
  }, [groups])

  // 创建多个空组 - 暂时注释掉，因为不需要批量创建
  // const handleCreateMultipleGroups = useCallback((count: number) => {
  //   const newGroups: Group[] = []
  //   for (let i = 0; i < count; i++) {
  //     newGroups.push({
  //       id: `group_${Date.now()}_${i}`,
  //       name: `新建组 ${groups.length + i + 1}`,
  //       members: [],
  //       description: '手动创建的分组',
  //       compatibility_score: 0
  //     })
  //   }
  //   setGroups([...groups, ...newGroups])
  // }, [groups])

  // 删除空组
  const handleDeleteEmptyGroups = useCallback(() => {
    const newGroups = groups.filter(g => g.members.length > 0)
    setGroups(newGroups)
    recalculateScores(newGroups)
  }, [groups])

  // 确认调整
  const handleConfirm = useCallback(() => {
    onGroupsChange(groups, unassigned)
    onConfirm()
  }, [groups, unassigned, onGroupsChange, onConfirm])

  return (
    <div className="group-adjuster-modal">
      <div className="group-adjuster-container">
        <div className="adjuster-header">
          <h2>🎯 拖拽调整分组</h2>
          <div className="header-actions">
            <button className="close-btn" onClick={onCancel}>✕</button>
          </div>
        </div>

        {/* 工具栏 */}
        <div className="adjuster-toolbar">
          <div className="toolbar-left">
            <button 
              className={`multi-select-btn ${isMultiSelectMode ? 'active' : ''}`}
              onClick={() => setIsMultiSelectMode(!isMultiSelectMode)}
            >
              {isMultiSelectMode ? '退出批量选择' : '批量选择'}
            </button>
            
            {selectedUsers.size > 0 && (
              <span className="selected-count">已选中 {selectedUsers.size} 人</span>
            )}

            <button 
              className="auto-balance-btn"
              onClick={() => setShowRebalanceModal(true)}
            >
              ⚖️ 自动平衡
            </button>

            <button 
              className="create-group-btn"
              onClick={handleCreateGroup}
            >
              ➕ 新建组
            </button>

            <button 
              className="delete-empty-btn"
              onClick={handleDeleteEmptyGroups}
            >
              🗑️ 删除空组
            </button>
          </div>

          <div className="toolbar-right">
            <input
              type="text"
              className="search-input"
              placeholder="搜索用户..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            
            <select 
              className="filter-select"
              value={filterGender}
              onChange={(e) => setFilterGender(e.target.value as any)}
            >
              <option value="all">全部性别</option>
              <option value="男">男性</option>
              <option value="女">女性</option>
            </select>
          </div>
        </div>

        {/* 分组概览 */}
        <div className="groups-overview">
          <div className="overview-stats">
            <span>总人数: {groups.reduce((sum, g) => sum + g.members.length, 0) + unassigned.length}</span>
            <span>已分组: {groups.reduce((sum, g) => sum + g.members.length, 0)}</span>
            <span>未分配: {unassigned.length}</span>
            <span>平均分数: {
              Object.values(groupScores).length > 0 
                ? (Object.values(groupScores).reduce((sum, s) => sum + s, 0) / Object.values(groupScores).length).toFixed(1)
                : '0.0'
            }</span>
          </div>
        </div>

        {/* 主要内容区 - 重构为上下两部分 */}
        <div className="adjuster-content">
          {/* 分组区域 - 上半部分，可滚动 */}
          <div className="groups-section">
            <div className="groups-grid">
              {groups.map(group => {
                const stats = calculateGroupStats(group)
                const score = groupScores[group.id] || 0
                const filtered = filterUsers(group.members)
                
                return (
                  <div 
                    key={group.id}
                    className={`group-box ${dragOverGroup === group.id ? 'drag-over' : ''} ${highlightedGroup === group.id ? 'highlighted' : ''}`}
                    onDragOver={(e) => handleDragOver(e, group.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, group.id)}
                    onMouseEnter={() => setHighlightedGroup(group.id)}
                    onMouseLeave={() => setHighlightedGroup(null)}
                  >
                    <div className="group-header">
                      <h3>{group.name}</h3>
                      <div className={`group-score ${score >= 8 ? 'high' : score >= 6 ? 'medium' : 'low'}`}>
                        {score.toFixed(1)}
                      </div>
                    </div>
                    
                    <div className="group-stats">
                      <span className={`stat ${stats.isFull ? 'full' : stats.total < 3 ? 'warning' : ''}`}>
                        👥 {stats.total}人
                      </span>
                      {stats.total > 1 && (
                        <span className={`stat ${stats.ageGap > 10 ? 'warning' : ''}`}>
                          年龄跨度{stats.ageGap}岁
                        </span>
                      )}
                    </div>

                    <div className="group-members">
                      {filtered.length === 0 && group.members.length === 0 && (
                        <div className="empty-placeholder">拖拽用户到这里</div>
                      )}
                      {filtered.length === 0 && group.members.length > 0 && (
                        <div className="no-match-placeholder">没有匹配的用户</div>
                      )}
                      {(() => {
                        if (filtered.length === 0) return null
                        
                        // 按性别分组
                        const maleMembers = filtered.filter(m => m.性别 === '男' || m.性别 === '男性')
                        const femaleMembers = filtered.filter(m => m.性别 === '女' || m.性别 === '女性')
                        const otherMembers = filtered.filter(m => m.性别 !== '男' && m.性别 !== '男性' && m.性别 !== '女' && m.性别 !== '女性')
                        
                        const renderMember = (member: any, index: number) => {
                          const userId = `${group.id}-${member.姓名}`
                          const isSelected = selectedUsers.has(userId)
                          
                          return (
                            <div
                              key={index}
                              className={`member-card ${isSelected ? 'selected' : ''}`}
                              draggable
                              onDragStart={(e) => handleDragStart(e, member, group.id, index)}
                              onClick={(e) => {
                                // 只在批量选择模式或按住shift时处理选择
                                if (isMultiSelectMode || e.shiftKey) {
                                  handleUserSelect(userId, e)
                                }
                              }}
                            >
                              <span className="member-name">{member.姓名 || '未知'}</span>
                              <span className="member-info">{member.年龄}岁 {member.性别}</span>
                              {(member.开放程度 || member.能量指数) && (
                                <div className="member-traits">
                                  {member.开放程度 && (
                                    <span className="trait openness" title="开放程度">
                                      🌟 {member.开放程度}
                                    </span>
                                  )}
                                  {member.能量指数 && (
                                    <span className="trait energy" title="能量指数">
                                      ⚡ {member.能量指数}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        }
                        
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
                      })()}
                    </div>

                    {selectedUsers.size > 0 && (
                      <button 
                        className="batch-move-here"
                        onClick={() => handleBatchMove(group.id)}
                      >
                        移动选中到此组
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 待分组区域 - 固定在底部 */}
          <div className="pending-section">
            <div className="pending-header">
              <h3>🎯 待分组人员 ({unassigned.length}人)</h3>
              <div className="pending-actions">
                <button 
                  className="create-single-btn"
                  onClick={handleCreateGroup}
                  title="创建一个新的空组"
                >
                  ➕ 新建空组
                </button>
              </div>
            </div>
            
            <div 
              className={`pending-content ${dragOverGroup === 'unassigned' ? 'drag-over' : ''}`}
              onDragOver={(e) => handleDragOver(e, 'unassigned')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'unassigned')}
            >
              <div className="unassigned-members">
                {filterUsers(unassigned).map((user, index) => {
                  const userId = `unassigned-${user.姓名}`
                  const isSelected = selectedUsers.has(userId)
                  
                  return (
                    <div
                      key={index}
                      className={`member-card ${isSelected ? 'selected' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, user, 'unassigned', index)}
                      onClick={(e) => {
                        // 只在批量选择模式或按住shift时处理选择
                        if (isMultiSelectMode || e.shiftKey) {
                          handleUserSelect(userId, e)
                        }
                      }}
                    >
                      <span className="member-name">{user.姓名 || '未知'}</span>
                      <span className="member-info">{user.年龄}岁 {user.性别} {user.职业}</span>
                      {(user.开放程度 || user.能量指数) && (
                        <div className="member-traits">
                          {user.开放程度 && (
                            <span className="trait openness" title="开放程度">
                              🌟 {user.开放程度}
                            </span>
                          )}
                          {user.能量指数 && (
                            <span className="trait energy" title="能量指数">
                              ⚡ {user.能量指数}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
                
                {unassigned.length === 0 && (
                  <div className="empty-placeholder">
                    🎉 所有人员已分配完成！
                  </div>
                )}
              </div>

              {selectedUsers.size > 0 && (
                <div className="batch-actions">
                  <button 
                    className="batch-move-here"
                    onClick={() => handleBatchMove('unassigned')}
                  >
                    移动选中到待分组
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 底部操作 */}
        <div className="adjuster-footer">
          <div className="footer-info">
            <span>💡 提示：按住Shift键可批量选择，拖拽可移动用户</span>
          </div>
          <div className="footer-actions">
            <button className="cancel-btn" onClick={onCancel}>
              取消
            </button>
            <button className="confirm-btn" onClick={handleConfirm}>
              确认调整
            </button>
          </div>
        </div>
      </div>

      {/* 自动平衡确认弹窗 */}
      {showRebalanceModal && (
        <div className="rebalance-modal">
          <div className="modal-content">
            <h3>确认自动平衡</h3>
            <p>自动平衡将重新分配所有用户，尽量保证每组6人且性别平衡。</p>
            <p>当前的手动调整将被覆盖，是否继续？</p>
            <div className="modal-actions">
              <button onClick={() => setShowRebalanceModal(false)}>取消</button>
              <button onClick={handleAutoBalance}>确认平衡</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GroupAdjuster

// 添加性别分隔线样式
const genderStyles = `
.gender-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gender-label {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 6px;
  border-radius: 3px;
  text-align: center;
  margin: 2px 0;
  letter-spacing: 0.3px;
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
  margin: 6px 0;
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
  animation: shimmer-adjuster 2s infinite;
}

@keyframes shimmer-adjuster {
  0% { left: -100%; }
  100% { left: 100%; }
}
`

// 将样式添加到document
if (typeof document !== 'undefined') {
  const existingStyle = document.getElementById('gender-separator-styles')
  if (!existingStyle) {
    const styleElement = document.createElement('style')
    styleElement.id = 'gender-separator-styles'
    styleElement.textContent = genderStyles
    document.head.appendChild(styleElement)
  }
}