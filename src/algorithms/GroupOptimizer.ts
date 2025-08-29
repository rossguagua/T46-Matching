// 分组优化算法 - 负责执行智能分组分配和优化
import { UserData, Group } from '../types/matching'
import { ConstraintValidator, ValidationResult } from './ConstraintValidator'
import { GenderStats, AgeStats, GroupingStrategy } from './DataAnalyzer'

export interface GroupingResult {
  groups: Group[]
  unassigned: UserData[]
  totalScore: number
  executionStats: ExecutionStats
  strategy: string
  reasoning: string
}

export interface ExecutionStats {
  totalUsers: number
  assignedUsers: number
  unassignedUsers: number
  mixedGroups2M4F: number
  mixedGroups3M3F: number
  allFemaleGroups: number
  averageAgeGap: number
  maxAgeGap: number
  executionTimeMs: number
  iterationsPerformed: number
}

export interface UserPool {
  males: UserData[]
  femalesAcceptAllFemale: UserData[]
  femalesRejectAllFemale: UserData[]
  femalesNeutral: UserData[]
  unknownGender: UserData[]
}

export class GroupOptimizer {
  
  /**
   * 执行完整的分组优化算法
   */
  static optimizeGrouping(
    userData: UserData[],
    genderStats: GenderStats,
    ageStats: AgeStats,
    strategy: GroupingStrategy,
    maxAgeGap: number,
    groupSize: number
  ): GroupingResult {
    const startTime = Date.now()
    
    if (!userData || userData.length === 0) {
      throw new Error('用户数据为空，无法进行分组')
    }

    // Phase 1: 创建用户池
    const userPools = this.createUserPools(userData)
    
    // Phase 2: 回溯分配策略 - 尝试不同分组顺序，选择最优结果
    console.log(`🚀 开始回溯分配，理论目标：${strategy.recommendedMixedGroups2M4F}个2M4F + ${strategy.recommendedMixedGroups3M3F}个3M3F + ${strategy.recommendedAllFemaleGroups}个全女组`)
    
    // 尝试不同的分组策略顺序
    const strategies = [
      ['ALL_FEMALE', '2M4F', '3M3F'],
      ['2M4F', 'ALL_FEMALE', '3M3F'], 
      ['2M4F', '3M3F', 'ALL_FEMALE'],
      ['3M3F', '2M4F', 'ALL_FEMALE'],
      ['3M3F', 'ALL_FEMALE', '2M4F'],
      ['ALL_FEMALE', '3M3F', '2M4F']
    ]
    
    let bestResult = { groups: [], unassigned: [], score: 0, iterationsPerformed: 0 }
    
    for (let i = 0; i < strategies.length; i++) {
      const strategyOrder = strategies[i]
      console.log(`🔄 尝试策略${i + 1}：${strategyOrder.join(' -> ')}`)
      
      // 为这个策略创建用户池副本
      const userPoolsCopy = this.cloneUserPools(userPools)
      const result = this.executeStrategy(userPoolsCopy, strategyOrder, strategy, maxAgeGap, groupSize)
      
      console.log(`📊 策略${i + 1}结果：${result.groups.length}组，${result.unassigned.length}人未分配，评分${result.score.toFixed(1)}`)
      
      // 选择最优结果：优先分组数量，其次评分
      if (result.groups.length > bestResult.groups.length || 
          (result.groups.length === bestResult.groups.length && result.score > bestResult.score)) {
        bestResult = {
          groups: result.groups,
          unassigned: result.unassigned,
          score: result.score,
          iterationsPerformed: result.iterationsPerformed
        }
        console.log(`✅ 策略${i + 1}成为当前最优方案`)
      }
    }
    
    let groups = bestResult.groups
    let iterationsPerformed = bestResult.iterationsPerformed
    
    console.log(`🎯 最终选择方案：${groups.length}组，评分${bestResult.score.toFixed(1)}`)

    // Phase 3: 补充全女组分配（如果还有剩余推荐数量）
    const remainingAllFemaleTarget = strategy.recommendedAllFemaleGroups - groups.filter(g => g.description === '全女组').length
    if (remainingAllFemaleTarget > 0) {
      const allFemaleGroups = this.allocateAllFemaleGroups(
        userPools, remainingAllFemaleTarget, maxAgeGap, groupSize
      )
      groups.push(...allFemaleGroups.groups)
      iterationsPerformed += allFemaleGroups.iterations
    }

    // Phase 4: 收集剩余未分配用户 - 从最优结果中获取
    const unassigned = bestResult.unassigned

    // Phase 5: 局部优化
    const optimizationResult = this.performLocalOptimization(groups, unassigned, maxAgeGap, groupSize)
    groups = optimizationResult.groups
    iterationsPerformed += optimizationResult.iterations

    // 计算执行统计
    const executionTimeMs = Date.now() - startTime
    const validation = ConstraintValidator.validateGroupingPlan(groups, unassigned, maxAgeGap, groupSize)
    
    const executionStats: ExecutionStats = {
      totalUsers: userData.length,
      assignedUsers: groups.reduce((sum, g) => sum + g.members.length, 0),
      unassignedUsers: unassigned.length,
      mixedGroups2M4F: validation.details.genderDistribution.mixedGroups2M4F,
      mixedGroups3M3F: validation.details.genderDistribution.mixedGroups3M3F,
      allFemaleGroups: validation.details.genderDistribution.allFemaleGroups,
      averageAgeGap: validation.details.averageAgeGap,
      maxAgeGap: validation.details.maxAgeGap,
      executionTimeMs,
      iterationsPerformed
    }

    return {
      groups,
      unassigned,
      totalScore: validation.score,
      executionStats,
      strategy: strategy.reasoning,
      reasoning: this.generateReasoningText(executionStats, validation)
    }
  }

  // ===================== Phase 1: 用户池管理 =====================

  /**
   * 创建分类用户池
   */
  private static createUserPools(userData: UserData[]): UserPool {
    const pools: UserPool = {
      males: [],
      femalesAcceptAllFemale: [],
      femalesRejectAllFemale: [],
      femalesNeutral: [],
      unknownGender: []
    }

    userData.forEach(user => {
      const gender = this.normalizeGender(user.性别)
      
      if (gender === 'male') {
        pools.males.push(user)
      } else if (gender === 'female') {
        const acceptsAllFemale = this.parseAllFemaleAcceptance(user)
        if (acceptsAllFemale === true) {
          pools.femalesAcceptAllFemale.push(user)
        } else if (acceptsAllFemale === false) {
          pools.femalesRejectAllFemale.push(user)
        } else {
          pools.femalesNeutral.push(user)
        }
      } else {
        pools.unknownGender.push(user)
      }
    })

    // 按年龄排序每个池，便于后续处理
    Object.values(pools).forEach(pool => {
      pool.sort((a: UserData, b: UserData) => {
        const ageA = this.normalizeAge(a.年龄) || 999
        const ageB = this.normalizeAge(b.年龄) || 999
        return ageA - ageB
      })
    })

    return pools
  }

  // ===================== Phase 2: 正常组分配 =====================

  /**
   * 分配2男4女组
   */
  private static allocateMixedGroups2M4F(
    userPools: UserPool, 
    targetCount: number, 
    maxAgeGap: number, 
    groupSize: number
  ) {
    console.log(`🔵 开始分配2男4女组，目标：${targetCount}组，最大年龄差：${maxAgeGap}岁`)
    console.log(`📊 可用用户池：男性${userPools.males.length}人，拒绝全女${userPools.femalesRejectAllFemale.length}人，中立${userPools.femalesNeutral.length}人，接受全女${userPools.femalesAcceptAllFemale.length}人`)
    
    const groups: Group[] = []
    let iterations = 0
    const maxIterations = targetCount * 50 // 防止无限循环

    while (groups.length < targetCount && iterations < maxIterations) {
      iterations++
      console.log(`🔄 第${iterations}次迭代，已创建${groups.length}组，目标${targetCount}组`)

      // 检查是否还有足够的用户
      if (userPools.males.length < 2) {
        console.log(`❌ 男性用户不足：只有${userPools.males.length}人，需要2人`)
        break
      }
      
      const availableFemales = [
        ...userPools.femalesRejectAllFemale,
        ...userPools.femalesNeutral,
        ...userPools.femalesAcceptAllFemale
      ]
      if (availableFemales.length < 4) {
        console.log(`❌ 女性用户不足：只有${availableFemales.length}人，需要4人`)
        break
      }
      
      console.log(`👥 当前可用：男性${userPools.males.length}人，女性${availableFemales.length}人`)

      // 选择2个男性
      let selectedMales = this.selectOptimalUsers(userPools.males, 2, maxAgeGap)
      if (selectedMales.length < 2) {
        // 如果优化选择失败，尝试简单选择前2个
        if (userPools.males.length >= 2) {
          const simpleSelection = userPools.males.slice(0, 2)
          if (this.calculateAgeGap(simpleSelection) <= maxAgeGap) {
            selectedMales = simpleSelection
          } else {
            break
          }
        } else {
          break
        }
      }

      // 选择4个女性（优先不接受全女组的女性）
      let selectedFemales = this.selectOptimalUsers(availableFemales, 4, maxAgeGap)
      if (selectedFemales.length < 4) {
        // 如果优化选择失败，尝试简单选择前4个
        if (availableFemales.length >= 4) {
          const simpleSelection = availableFemales.slice(0, 4)
          if (this.calculateAgeGap(simpleSelection) <= maxAgeGap) {
            selectedFemales = simpleSelection
          } else {
            break
          }
        } else {
          break
        }
      }

      // 检查组合的年龄约束
      const groupMembers = [...selectedMales, ...selectedFemales]
      const memberAges = groupMembers.map(m => this.normalizeAge(m.年龄))
      const ageGap = Math.max(...memberAges) - Math.min(...memberAges)
      console.log(`🧮 验证组合：年龄${memberAges}，年龄差${ageGap}岁，限制${maxAgeGap}岁`)
      
      if (!ConstraintValidator.canUsersFormGroup(groupMembers, maxAgeGap, groupSize)) {
        console.log(`❌ 约束验证失败，跳过这次组合`)
        // 如果当前选择不满足约束，尝试重新选择
        continue
      }

      // 创建组并从池中移除用户
      const group: Group = {
        id: `mixed_2m4f_${groups.length + 1}`,
        name: `混合组${groups.length + 1}`,
        members: groupMembers,
        description: '2男4女组',
        compatibility_score: this.calculateGroupScore(groupMembers, maxAgeGap)
      }

      console.log(`✅ 成功创建第${groups.length + 1}组，成员年龄：${memberAges}`)
      groups.push(group)
      this.removeUsersFromPools(userPools, groupMembers)
    }

    return { groups, iterations }
  }

  /**
   * 分配3男3女组
   */
  private static allocateMixedGroups3M3F(
    userPools: UserPool, 
    targetCount: number, 
    maxAgeGap: number, 
    groupSize: number
  ) {
    console.log(`🟡 开始分配3男3女组，目标：${targetCount}组，最大年龄差：${maxAgeGap}岁`)
    console.log(`📊 可用用户池：男性${userPools.males.length}人，女性总计${userPools.femalesRejectAllFemale.length + userPools.femalesNeutral.length + userPools.femalesAcceptAllFemale.length}人`)
    
    const groups: Group[] = []
    let iterations = 0
    const maxIterations = targetCount * 50

    while (groups.length < targetCount && iterations < maxIterations) {
      iterations++
      console.log(`🔄 3M3F第${iterations}次迭代，已创建${groups.length}组，目标${targetCount}组`)

      // 检查是否还有足够的用户
      if (userPools.males.length < 3) {
        console.log(`❌ 3M3F男性用户不足：只有${userPools.males.length}人，需要3人`)
        break
      }
      
      const availableFemales = [
        ...userPools.femalesRejectAllFemale,
        ...userPools.femalesNeutral,
        ...userPools.femalesAcceptAllFemale
      ]
      if (availableFemales.length < 3) {
        console.log(`❌ 3M3F女性用户不足：只有${availableFemales.length}人，需要3人`)
        break
      }
      
      console.log(`👥 3M3F当前可用：男性${userPools.males.length}人，女性${availableFemales.length}人`)

      // 选择3个男性
      let selectedMales = this.selectOptimalUsers(userPools.males, 3, maxAgeGap)
      console.log(`👨 3M3F选择男性结果：${selectedMales.length}人`)
      if (selectedMales.length < 3) {
        // 如果优化选择失败，尝试简单选择前3个
        if (userPools.males.length >= 3) {
          const simpleSelection = userPools.males.slice(0, 3)
          const ageGap = this.calculateAgeGap(simpleSelection)
          console.log(`🔄 3M3F尝试简单选择3男，年龄差${ageGap}岁`)
          if (ageGap <= maxAgeGap) {
            selectedMales = simpleSelection
            console.log(`✅ 3M3F简单选择3男成功`)
          } else {
            console.log(`❌ 3M3F简单选择3男年龄差过大，退出`)
            break
          }
        } else {
          break
        }
      }

      // 选择3个女性
      let selectedFemales = this.selectOptimalUsers(availableFemales, 3, maxAgeGap)
      console.log(`👩 3M3F选择女性结果：${selectedFemales.length}人`)
      if (selectedFemales.length < 3) {
        // 如果优化选择失败，尝试简单选择前3个
        if (availableFemales.length >= 3) {
          const simpleSelection = availableFemales.slice(0, 3)
          const ageGap = this.calculateAgeGap(simpleSelection)
          console.log(`🔄 3M3F尝试简单选择3女，年龄差${ageGap}岁`)
          if (ageGap <= maxAgeGap) {
            selectedFemales = simpleSelection
            console.log(`✅ 3M3F简单选择3女成功`)
          } else {
            console.log(`❌ 3M3F简单选择3女年龄差过大，退出`)
            break
          }
        } else {
          break
        }
      }

      // 检查组合的年龄约束
      const groupMembers = [...selectedMales, ...selectedFemales]
      const memberAges = groupMembers.map(m => this.normalizeAge(m.年龄))
      const combinedAgeGap = Math.max(...memberAges) - Math.min(...memberAges)
      console.log(`🧮 3M3F验证组合：年龄${memberAges}，年龄差${combinedAgeGap}岁，限制${maxAgeGap}岁`)
      
      if (!ConstraintValidator.canUsersFormGroup(groupMembers, maxAgeGap, groupSize)) {
        console.log(`❌ 3M3F约束验证失败，跳过这次组合`)
        continue
      }

      // 创建组并从池中移除用户
      const group: Group = {
        id: `mixed_3m3f_${groups.length + 1}`,
        name: `混合组${groups.length + 1}`,
        members: groupMembers,
        description: '3男3女组',
        compatibility_score: this.calculateGroupScore(groupMembers, maxAgeGap)
      }

      groups.push(group)
      this.removeUsersFromPools(userPools, groupMembers)
    }

    return { groups, iterations }
  }

  // ===================== Phase 3: 全女组分配 =====================

  /**
   * 分配全女组（仅在必要时）
   */
  private static allocateAllFemaleGroups(
    userPools: UserPool, 
    targetCount: number, 
    maxAgeGap: number, 
    groupSize: number
  ) {
    const groups: Group[] = []
    let iterations = 0
    const maxIterations = targetCount * 30

    while (groups.length < targetCount && iterations < maxIterations) {
      iterations++

      // 优先从接受全女组的女性中选择
      const selectedFemales = this.selectOptimalUsers(userPools.femalesAcceptAllFemale, groupSize, maxAgeGap)
      
      // 如果接受全女组的女性不够，从中立态度的女性中补充
      if (selectedFemales.length < groupSize) {
        const needed = groupSize - selectedFemales.length
        const additionalFemales = this.selectOptimalUsers(userPools.femalesNeutral, needed, maxAgeGap)
        selectedFemales.push(...additionalFemales)
      }

      if (selectedFemales.length < groupSize) break

      // 检查年龄约束
      if (!ConstraintValidator.canUsersFormGroup(selectedFemales, maxAgeGap, groupSize)) {
        continue
      }

      // 创建全女组
      const group: Group = {
        id: `all_female_${groups.length + 1}`,
        name: `全女组${groups.length + 1}`,
        members: selectedFemales,
        description: '全女组',
        compatibility_score: this.calculateGroupScore(selectedFemales, maxAgeGap)
      }

      groups.push(group)
      this.removeUsersFromPools(userPools, selectedFemales)
    }

    return { groups, iterations }
  }

  // ===================== Phase 4: 局部优化 =====================

  /**
   * 执行局部优化 - 通过成员交换改善整体分配
   */
  private static performLocalOptimization(
    groups: Group[], 
    unassigned: UserData[], 
    maxAgeGap: number, 
    groupSize: number
  ) {
    let optimizedGroups = [...groups]
    let iterations = 0
    const maxIterations = 100
    let improved = true

    while (improved && iterations < maxIterations) {
      improved = false
      iterations++

      // 尝试组间成员交换
      for (let i = 0; i < optimizedGroups.length; i++) {
        for (let j = i + 1; j < optimizedGroups.length; j++) {
          const swapResult = this.tryGroupMemberSwap(optimizedGroups[i], optimizedGroups[j], maxAgeGap)
          if (swapResult.improved) {
            optimizedGroups[i] = swapResult.group1
            optimizedGroups[j] = swapResult.group2
            improved = true
          }
        }
      }
    }

    return { groups: optimizedGroups, iterations }
  }

  /**
   * 尝试两个组之间的成员交换
   */
  private static tryGroupMemberSwap(group1: Group, group2: Group, maxAgeGap: number) {
    const originalScore1 = this.calculateGroupScore(group1.members, maxAgeGap)
    const originalScore2 = this.calculateGroupScore(group2.members, maxAgeGap)
    const originalTotalScore = originalScore1 + originalScore2

    let bestSwap: { member1: UserData; member2: UserData; newScore: number } | null = null

    // 尝试所有可能的单成员交换
    for (const member1 of group1.members) {
      for (const member2 of group2.members) {
        // 创建交换后的新组
        const newGroup1Members = group1.members.map(m => m === member1 ? member2 : m)
        const newGroup2Members = group2.members.map(m => m === member2 ? member1 : m)

        // 检查交换后是否仍满足约束
        if (!ConstraintValidator.canUsersFormGroup(newGroup1Members, maxAgeGap, 6) ||
            !ConstraintValidator.canUsersFormGroup(newGroup2Members, maxAgeGap, 6)) {
          continue
        }

        // 计算交换后的分数
        const newScore1 = this.calculateGroupScore(newGroup1Members, maxAgeGap)
        const newScore2 = this.calculateGroupScore(newGroup2Members, maxAgeGap)
        const newTotalScore = newScore1 + newScore2

        // 如果改善了整体分数，记录这个交换
        if (newTotalScore > originalTotalScore && (!bestSwap || newTotalScore > bestSwap.newScore)) {
          bestSwap = { member1, member2, newScore: newTotalScore }
        }
      }
    }

    // 如果找到了更好的交换，执行它
    if (bestSwap) {
      const newGroup1: Group = {
        ...group1,
        members: group1.members.map(m => m === bestSwap.member1 ? bestSwap.member2 : m),
        compatibility_score: this.calculateGroupScore(
          group1.members.map(m => m === bestSwap.member1 ? bestSwap.member2 : m), maxAgeGap
        )
      }
      const newGroup2: Group = {
        ...group2,
        members: group2.members.map(m => m === bestSwap.member2 ? bestSwap.member1 : m),
        compatibility_score: this.calculateGroupScore(
          group2.members.map(m => m === bestSwap.member2 ? bestSwap.member1 : m), maxAgeGap
        )
      }
      return { group1: newGroup1, group2: newGroup2, improved: true }
    }

    return { group1, group2, improved: false }
  }

  // ===================== 回溯算法辅助方法 =====================

  /**
   * 复制用户池
   */
  private static cloneUserPools(userPools: UserPool): UserPool {
    return {
      males: [...userPools.males],
      femalesAcceptAllFemale: [...userPools.femalesAcceptAllFemale],
      femalesRejectAllFemale: [...userPools.femalesRejectAllFemale],
      femalesNeutral: [...userPools.femalesNeutral],
      unknownGender: [...userPools.unknownGender]
    }
  }

  /**
   * 执行特定策略顺序
   */
  private static executeStrategy(
    userPools: UserPool, 
    strategyOrder: string[], 
    strategy: any, 
    maxAgeGap: number, 
    groupSize: number
  ) {
    const groups: Group[] = []
    let iterationsPerformed = 0

    // 根据策略顺序执行分组
    for (const groupType of strategyOrder) {
      let targetCount = 0
      
      if (groupType === '2M4F') {
        targetCount = strategy.recommendedMixedGroups2M4F
      } else if (groupType === '3M3F') {
        targetCount = strategy.recommendedMixedGroups3M3F  
      } else if (groupType === 'ALL_FEMALE') {
        targetCount = strategy.recommendedAllFemaleGroups
      }

      console.log(`  🎯 执行${groupType}，目标${targetCount}组`)

      // 尝试创建这种类型的组
      for (let i = 0; i < targetCount; i++) {
        const candidate = this.tryCreateGroup(userPools, groupType, maxAgeGap, groupSize)
        if (candidate) {
          groups.push(candidate.group)
          this.removeUsersFromPools(userPools, candidate.usersToRemove)
          iterationsPerformed++
          console.log(`    ✅ 创建${groupType}第${i+1}组成功`)
        } else {
          console.log(`    ❌ 无法创建${groupType}第${i+1}组，停止该类型`)
          break
        }
      }
    }

    const unassigned = this.collectUnassignedUsers(userPools)
    const score = groups.reduce((sum, g) => sum + (g.compatibility_score || 0), 0) / Math.max(groups.length, 1)
    
    return {
      groups,
      unassigned,
      score,
      iterationsPerformed
    }
  }

  /**
   * 尝试创建指定类型的组
   */
  private static tryCreateGroup(
    userPools: UserPool, 
    groupType: '2M4F' | '3M3F' | 'ALL_FEMALE', 
    maxAgeGap: number, 
    groupSize: number
  ) {
    if (groupType === '2M4F') {
      return this.tryCreate2M4F(userPools, maxAgeGap, groupSize)
    } else if (groupType === '3M3F') {
      return this.tryCreate3M3F(userPools, maxAgeGap, groupSize)
    } else if (groupType === 'ALL_FEMALE') {
      return this.tryCreateAllFemale(userPools, maxAgeGap, groupSize)
    }
    return null
  }

  /**
   * 尝试创建2男4女组 - 优先成功率
   */
  private static tryCreate2M4F(userPools: UserPool, maxAgeGap: number, groupSize: number) {
    const availableFemales = [
      ...userPools.femalesRejectAllFemale,
      ...userPools.femalesNeutral,
      ...userPools.femalesAcceptAllFemale
    ]

    // 策略1: 先尝试简单的顺序选择（年龄排序后的前n个）
    const sortedMales = [...userPools.males].sort((a, b) => (this.normalizeAge(a.年龄) || 0) - (this.normalizeAge(b.年龄) || 0))
    const sortedFemales = [...availableFemales].sort((a, b) => (this.normalizeAge(a.年龄) || 0) - (this.normalizeAge(b.年龄) || 0))
    
    // 尝试最简单的组合：按年龄排序后直接取前面的
    for (let mStart = 0; mStart <= Math.min(sortedMales.length - 2, 5); mStart++) {
      for (let fStart = 0; fStart <= Math.min(sortedFemales.length - 4, 10); fStart++) {
        const malesCombo = sortedMales.slice(mStart, mStart + 2)
        const femalesCombo = sortedFemales.slice(fStart, fStart + 4)
        const groupMembers = [...malesCombo, ...femalesCombo]
        
        if (ConstraintValidator.canUsersFormGroup(groupMembers, maxAgeGap, groupSize)) {
          const score = this.calculateGroupScore(groupMembers, maxAgeGap)
          return {
            group: {
              id: `dynamic_2m4f_${Date.now()}`,
              name: `2男4女组`,
              members: groupMembers,
              description: '2男4女组',
              compatibility_score: score
            },
            usersToRemove: groupMembers,
            score: score
          }
        }
      }
    }

    // 策略2: 如果简单选择失败，尝试更宽松的组合（限制数量）
    const limitedMalesCombos = this.getAllCombinations(userPools.males, 2).slice(0, 20)
    const limitedFemalesCombos = this.getAllCombinations(availableFemales, 4).slice(0, 30)

    for (const malesCombo of limitedMalesCombos) {
      for (const femalesCombo of limitedFemalesCombos) {
        const groupMembers = [...malesCombo, ...femalesCombo]
        
        if (ConstraintValidator.canUsersFormGroup(groupMembers, maxAgeGap, groupSize)) {
          const score = this.calculateGroupScore(groupMembers, maxAgeGap)
          return {
            group: {
              id: `dynamic_2m4f_${Date.now()}`,
              name: `2男4女组`,
              members: groupMembers,
              description: '2男4女组',
              compatibility_score: score
            },
            usersToRemove: groupMembers,
            score: score
          }
        }
      }
    }

    return null
  }

  /**
   * 尝试创建3男3女组 - 优先成功率
   */
  private static tryCreate3M3F(userPools: UserPool, maxAgeGap: number, groupSize: number) {
    const availableFemales = [
      ...userPools.femalesRejectAllFemale,
      ...userPools.femalesNeutral,
      ...userPools.femalesAcceptAllFemale
    ]

    // 策略1: 简单顺序选择
    const sortedMales = [...userPools.males].sort((a, b) => (this.normalizeAge(a.年龄) || 0) - (this.normalizeAge(b.年龄) || 0))
    const sortedFemales = [...availableFemales].sort((a, b) => (this.normalizeAge(a.年龄) || 0) - (this.normalizeAge(b.年龄) || 0))
    
    for (let mStart = 0; mStart <= Math.min(sortedMales.length - 3, 5); mStart++) {
      for (let fStart = 0; fStart <= Math.min(sortedFemales.length - 3, 10); fStart++) {
        const malesCombo = sortedMales.slice(mStart, mStart + 3)
        const femalesCombo = sortedFemales.slice(fStart, fStart + 3)
        const groupMembers = [...malesCombo, ...femalesCombo]
        
        if (ConstraintValidator.canUsersFormGroup(groupMembers, maxAgeGap, groupSize)) {
          const score = this.calculateGroupScore(groupMembers, maxAgeGap)
          return {
            group: {
              id: `dynamic_3m3f_${Date.now()}`,
              name: `3男3女组`,
              members: groupMembers,
              description: '3男3女组',
              compatibility_score: score
            },
            usersToRemove: groupMembers,
            score: score
          }
        }
      }
    }

    // 策略2: 有限组合尝试
    const limitedMalesCombos = this.getAllCombinations(userPools.males, 3).slice(0, 20)
    const limitedFemalesCombos = this.getAllCombinations(availableFemales, 3).slice(0, 30)

    for (const malesCombo of limitedMalesCombos) {
      for (const femalesCombo of limitedFemalesCombos) {
        const groupMembers = [...malesCombo, ...femalesCombo]
        
        if (ConstraintValidator.canUsersFormGroup(groupMembers, maxAgeGap, groupSize)) {
          const score = this.calculateGroupScore(groupMembers, maxAgeGap)
          return {
            group: {
              id: `dynamic_3m3f_${Date.now()}`,
              name: `3男3女组`,
              members: groupMembers,
              description: '3男3女组',
              compatibility_score: score
            },
            usersToRemove: groupMembers,
            score: score
          }
        }
      }
    }

    return null
  }

  /**
   * 尝试创建全女组
   */
  private static tryCreateAllFemale(userPools: UserPool, maxAgeGap: number, groupSize: number) {
    const combinations = this.getAllCombinations(userPools.femalesAcceptAllFemale, groupSize)

    let bestGroup = null
    let bestScore = -1
    let bestUsersToRemove = []

    for (const combo of combinations) {
      if (ConstraintValidator.canUsersFormGroup(combo, maxAgeGap, groupSize)) {
        const score = this.calculateGroupScore(combo, maxAgeGap)
        
        if (score > bestScore) {
          bestScore = score
          bestUsersToRemove = combo
          bestGroup = {
            id: `dynamic_all_female_${Date.now()}`,
            name: `全女组`,
            members: combo,
            description: '全女组',
            compatibility_score: score
          }
        }
      }
      
      if (combinations.length > 100) break
    }

    return bestGroup ? { group: bestGroup, usersToRemove: bestUsersToRemove, score: bestScore } : null
  }

  /**
   * 获取数组的所有组合
   */
  private static getAllCombinations<T>(array: T[], size: number): T[][] {
    if (size === 0) return [[]]
    if (array.length === 0) return []
    
    const combinations: T[][] = []
    const firstElement = array[0]
    const restElements = array.slice(1)
    
    // 包含第一个元素的组合
    const smallerCombinations = this.getAllCombinations(restElements, size - 1)
    for (const combo of smallerCombinations) {
      combinations.push([firstElement, ...combo])
    }
    
    // 不包含第一个元素的组合
    const otherCombinations = this.getAllCombinations(restElements, size)
    combinations.push(...otherCombinations)
    
    // 限制组合数量
    return combinations.slice(0, 200)
  }

  // ===================== 辅助方法 =====================

  /**
   * 选择最优用户组合 - 优先保证成功分组而非年龄最优
   */
  private static selectOptimalUsers(pool: UserData[], count: number, maxAgeGap: number): UserData[] {
    if (pool.length < count) return []

    // 如果池中用户数量刚好等于需要数量，直接返回（如果满足年龄约束）
    if (pool.length === count) {
      if (this.checkAgeConstraint(pool, maxAgeGap)) {
        return [...pool]
      } else {
        return []
      }
    }

    // 策略1: 优先尝试滑动窗口找到年龄集中的组合
    let bestCombination: UserData[] = []
    let bestAgeGap = Infinity

    for (let i = 0; i <= pool.length - count; i++) {
      const candidate = pool.slice(i, i + count)
      const ageGap = this.calculateAgeGap(candidate)
      
      if (ageGap <= maxAgeGap && ageGap < bestAgeGap) {
        bestAgeGap = ageGap
        bestCombination = candidate
      }
    }

    // 如果滑动窗口找到了合适组合，返回
    if (bestCombination.length > 0) {
      return bestCombination
    }

    // 策略2: 如果滑动窗口失败，使用更灵活的贪婪选择
    // 按年龄排序后，尝试从不同起点选择用户
    const sortedPool = [...pool].sort((a, b) => {
      const ageA = this.normalizeAge(a.年龄) || 999
      const ageB = this.normalizeAge(b.年龄) || 999
      return ageA - ageB
    })

    // 尝试多个起始点的组合
    for (let startIdx = 0; startIdx <= sortedPool.length - count; startIdx++) {
      const candidate = []
      let currentIdx = startIdx
      
      // 贪婪选择：从起始点开始，选择能保持年龄差在限制内的用户
      while (candidate.length < count && currentIdx < sortedPool.length) {
        const tempCandidate = [...candidate, sortedPool[currentIdx]]
        if (this.calculateAgeGap(tempCandidate) <= maxAgeGap) {
          candidate.push(sortedPool[currentIdx])
        }
        currentIdx++
      }
      
      if (candidate.length === count) {
        return candidate
      }
    }

    // 策略3: 最后尝试从头部直接取用户（如果满足约束）
    const headCandidate = pool.slice(0, count)
    if (this.calculateAgeGap(headCandidate) <= maxAgeGap) {
      return headCandidate
    }

    return []
  }

  /**
   * 从用户池中移除已分配的用户
   */
  private static removeUsersFromPools(userPools: UserPool, users: UserData[]) {
    const userIds = new Set(users.map(u => this.getUserId(u)))
    
    userPools.males = userPools.males.filter(u => !userIds.has(this.getUserId(u)))
    userPools.femalesAcceptAllFemale = userPools.femalesAcceptAllFemale.filter(u => !userIds.has(this.getUserId(u)))
    userPools.femalesRejectAllFemale = userPools.femalesRejectAllFemale.filter(u => !userIds.has(this.getUserId(u)))
    userPools.femalesNeutral = userPools.femalesNeutral.filter(u => !userIds.has(this.getUserId(u)))
    userPools.unknownGender = userPools.unknownGender.filter(u => !userIds.has(this.getUserId(u)))
  }

  /**
   * 收集剩余未分配用户
   */
  private static collectUnassignedUsers(userPools: UserPool): UserData[] {
    return [
      ...userPools.males,
      ...userPools.femalesAcceptAllFemale,
      ...userPools.femalesRejectAllFemale,
      ...userPools.femalesNeutral,
      ...userPools.unknownGender
    ]
  }

  /**
   * 计算组的质量分数 - 优先分组成功率
   */
  private static calculateGroupScore(members: UserData[], maxAgeGap: number): number {
    if (members.length === 0) return 0

    let score = 0

    // 基础分组成功奖励 (60分) - 只要能组成有效组就给高分
    const genderValidation = ConstraintValidator.validateGenderRatio ? 
      ConstraintValidator.validateGenderRatio(members) : { isValid: true }
    if (genderValidation.isValid) {
      score += 60 // 性别比例正确就给高分
    }

    // 年龄约束满足奖励 (25分) - 满足基本年龄约束即可
    const ageGap = this.calculateAgeGap(members)
    if (ageGap <= maxAgeGap) {
      score += 25 // 满足年龄约束就给分
      
      // 年龄差越小额外奖励 (0-15分)
      const ageBonus = Math.max(0, 15 * (1 - ageGap / maxAgeGap))
      score += ageBonus
    }

    // 年龄集中度奖励 (0-15分) - 这个权重最小
    const ageVariance = this.calculateAgeVariance(members)
    const varianceScore = Math.max(0, 15 - ageVariance * 2)
    score += varianceScore

    return Math.min(100, Math.max(0, score))
  }

  /**
   * 生成推理文本
   */
  private static generateReasoningText(stats: ExecutionStats, validation: ValidationResult): string {
    const efficiency = ((stats.assignedUsers / stats.totalUsers) * 100).toFixed(1)
    
    let reasoning = `算法执行完成：${stats.totalUsers}名用户中成功分配${stats.assignedUsers}名（${efficiency}%），`
    reasoning += `生成${stats.mixedGroups2M4F}个2男4女组、${stats.mixedGroups3M3F}个3男3女组`
    
    if (stats.allFemaleGroups > 0) {
      reasoning += `、${stats.allFemaleGroups}个全女组`
    }
    
    reasoning += `。平均年龄差${stats.averageAgeGap.toFixed(1)}岁，`
    reasoning += `执行${stats.iterationsPerformed}次迭代，耗时${stats.executionTimeMs}ms。`
    
    if (stats.unassignedUsers > 0) {
      reasoning += `剩余${stats.unassignedUsers}名用户待手动分配。`
    }
    
    return reasoning
  }

  // ===================== 通用工具方法 =====================

  private static checkAgeConstraint(users: UserData[], maxAgeGap: number): boolean {
    const ages = users.map(u => this.normalizeAge(u.年龄)).filter(age => age !== null) as number[]
    if (ages.length === 0) return false
    const minAge = Math.min(...ages)
    const maxAge = Math.max(...ages)
    return (maxAge - minAge) <= maxAgeGap
  }

  private static calculateAgeGap(users: UserData[]): number {
    const ages = users.map(u => this.normalizeAge(u.年龄)).filter(age => age !== null) as number[]
    if (ages.length === 0) return Infinity
    return Math.max(...ages) - Math.min(...ages)
  }

  private static calculateAgeVariance(users: UserData[]): number {
    const ages = users.map(u => this.normalizeAge(u.年龄)).filter(age => age !== null) as number[]
    if (ages.length <= 1) return 0
    const mean = ages.reduce((sum, age) => sum + age, 0) / ages.length
    const variance = ages.reduce((sum, age) => sum + Math.pow(age - mean, 2), 0) / ages.length
    return Math.sqrt(variance)
  }

  private static getUserId(user: UserData): string {
    return `${user.自选昵称 || user.姓名 || 'unknown'}_${user.年龄}_${user.性别}`
  }

  private static normalizeAge(age: any): number | null {
    if (age === null || age === undefined || age === '') return null
    const ageNum = Number(age)
    if (isNaN(ageNum) || ageNum < 0 || ageNum > 150) return null
    return Math.floor(ageNum)
  }

  private static normalizeGender(gender: any): 'male' | 'female' | 'unknown' {
    if (!gender) return 'unknown'
    const genderStr = String(gender).toLowerCase().trim()
    if (genderStr.includes('男') || genderStr.includes('male') || genderStr === 'm') return 'male'
    if (genderStr.includes('女') || genderStr.includes('female') || genderStr === 'f') return 'female'
    return 'unknown'
  }

  private static parseAllFemaleAcceptance(user: UserData): boolean | null {
    const possibleFields = ['是否接受全女', '是否接受全女局', '接受全女组', '全女组']
    for (const field of possibleFields) {
      const value = user[field]
      if (value !== undefined && value !== null && value !== '') {
        const valueStr = String(value).toLowerCase().trim()
        if (['是', '接受', 'yes', 'y', '1', 'true', '可以', '愿意'].includes(valueStr)) return true
        if (['否', '不接受', 'no', 'n', '0', 'false', '不可以', '不愿意'].includes(valueStr)) return false
      }
    }
    return null
  }
}