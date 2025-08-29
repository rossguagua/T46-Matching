// 算法主控制器 - 统一调度所有算法模块的主入口
import { UserData, MatchingResult } from '../types/matching'
import { DataAnalyzer, GenderStats, AgeStats, GroupingStrategy } from './DataAnalyzer'
import { GroupOptimizer, GroupingResult } from './GroupOptimizer'
import { ConstraintValidator, ValidationResult } from './ConstraintValidator'

export interface AlgorithmConfig {
  maxAgeGap: number
  groupSize: number
  enableLocalOptimization: boolean
  maxExecutionTime: number // 最大执行时间（毫秒）
}

export interface AlgorithmProgress {
  phase: 'ANALYZING' | 'MIXED_2M4F' | 'MIXED_3M3F' | 'ALL_FEMALE' | 'OPTIMIZING' | 'COMPLETED'
  progress: number // 0-100
  message: string
  details?: string
}

export type ProgressCallback = (progress: AlgorithmProgress) => void

export class AlgorithmicMatcher {
  
  /**
   * 执行完整的算法分组流程
   */
  static async executeMatching(
    userData: UserData[],
    config: AlgorithmConfig,
    onProgress?: ProgressCallback
  ): Promise<MatchingResult> {
    
    if (!userData || userData.length === 0) {
      throw new Error('用户数据为空，无法执行匹配算法')
    }

    if (config.groupSize < 2) {
      throw new Error('每组人数必须至少为2人')
    }

    if (config.maxAgeGap < 0) {
      throw new Error('最大年龄差不能为负数')
    }

    const startTime = Date.now()

    try {
      // Phase 1: 数据分析
      onProgress?.({
        phase: 'ANALYZING',
        progress: 10,
        message: '正在分析用户数据...',
        details: `分析${userData.length}名用户的性别比例和年龄分布`
      })

      const genderStats = DataAnalyzer.analyzeGenderDistribution(userData)
      const ageStats = DataAnalyzer.analyzeAgeDistribution(userData, config.maxAgeGap)
      const strategy = DataAnalyzer.calculateGroupingStrategy(genderStats, ageStats, config.groupSize)

      onProgress?.({
        phase: 'ANALYZING',
        progress: 25,
        message: '数据分析完成，制定分组策略',
        details: strategy.reasoning
      })

      // Phase 2: 执行分组算法
      onProgress?.({
        phase: 'MIXED_2M4F',
        progress: 35,
        message: '开始分配2男4女组...',
        details: `目标分配${strategy.recommendedMixedGroups2M4F}个2男4女组`
      })

      const groupingResult = GroupOptimizer.optimizeGrouping(
        userData,
        genderStats,
        ageStats,
        strategy,
        config.maxAgeGap,
        config.groupSize
      )

      onProgress?.({
        phase: 'OPTIMIZING',
        progress: 90,
        message: '分组完成，正在验证结果...',
        details: `生成${groupingResult.groups.length}个组，${groupingResult.unassigned.length}人待分配`
      })

      // Phase 3: 结果验证和包装
      const validationResult = ConstraintValidator.validateGroupingPlan(
        groupingResult.groups,
        groupingResult.unassigned,
        config.maxAgeGap,
        config.groupSize
      )

      // 统一组名格式 - 重新编号确保连续性
      const renamedGroups = this.renameGroupsSequentially(groupingResult.groups)

      const matchingResult: MatchingResult = {
        groups: renamedGroups,
        unassigned: groupingResult.unassigned,
        overall_score: validationResult.score,
        strategy: this.buildComprehensiveStrategy(genderStats, strategy, groupingResult, validationResult)
      }

      onProgress?.({
        phase: 'COMPLETED',
        progress: 100,
        message: '算法分组完成！',
        details: `执行时间：${Date.now() - startTime}ms，整体评分：${validationResult.score.toFixed(1)}分`
      })

      // 检查执行时间
      if (Date.now() - startTime > config.maxExecutionTime) {
        console.warn(`算法执行超时：${Date.now() - startTime}ms > ${config.maxExecutionTime}ms`)
      }

      // 记录详细执行日志
      this.logExecutionSummary(genderStats, strategy, groupingResult, validationResult)

      return matchingResult

    } catch (error) {
      onProgress?.({
        phase: 'COMPLETED',
        progress: 0,
        message: '算法执行失败',
        details: error instanceof Error ? error.message : '未知错误'
      })
      throw error
    }
  }

  /**
   * 快速评估数据质量（不执行完整分组）
   */
  static evaluateDataQuality(userData: UserData[], config: AlgorithmConfig) {
    try {
      const genderStats = DataAnalyzer.analyzeGenderDistribution(userData)
      const ageStats = DataAnalyzer.analyzeAgeDistribution(userData, config.maxAgeGap)
      const strategy = DataAnalyzer.calculateGroupingStrategy(genderStats, ageStats, config.groupSize)

      const issues: string[] = []
      const warnings: string[] = []

      // 检查数据质量问题
      if (genderStats.totalUsers < config.groupSize) {
        issues.push(`用户总数(${genderStats.totalUsers})少于每组人数(${config.groupSize})`)
      }

      if (ageStats.ageRange > config.maxAgeGap * 3) {
        warnings.push(`年龄跨度较大(${ageStats.ageRange}岁)，可能影响分组效果`)
      }

      if (strategy.expectedUnassigned > userData.length * 0.3) {
        warnings.push(`预计${strategy.expectedUnassigned}人无法分组，占比${((strategy.expectedUnassigned/userData.length)*100).toFixed(1)}%`)
      }

      return {
        quality: issues.length === 0 ? 'GOOD' : 'POOR',
        genderStats,
        ageStats,
        strategy,
        issues,
        warnings,
        recommendation: this.generateRecommendation(genderStats, ageStats, strategy)
      }
    } catch (error) {
      return {
        quality: 'ERROR',
        issues: [error instanceof Error ? error.message : '数据评估失败'],
        warnings: [],
        recommendation: '请检查数据格式是否正确'
      }
    }
  }

  /**
   * 检查特定配置下的理论最优结果
   */
  static calculateTheoreticalOptimal(userData: UserData[], config: AlgorithmConfig) {
    const genderStats = DataAnalyzer.analyzeGenderDistribution(userData)
    const strategy = DataAnalyzer.calculateGroupingStrategy(genderStats, { minAge: 0, maxAge: 100 } as AgeStats, config.groupSize)

    const theoreticalGroups = strategy.recommendedMixedGroups2M4F + strategy.recommendedMixedGroups3M3F + strategy.recommendedAllFemaleGroups
    const theoreticalAssigned = theoreticalGroups * config.groupSize
    const theoreticalUnassigned = userData.length - theoreticalAssigned

    return {
      maxPossibleGroups: theoreticalGroups,
      maxAssignedUsers: theoreticalAssigned,
      minUnassignedUsers: Math.max(0, theoreticalUnassigned),
      efficiency: (theoreticalAssigned / userData.length) * 100
    }
  }

  // ===================== 私有辅助方法 =====================

  /**
   * 重新编号组名以确保连续性
   */
  private static renameGroupsSequentially(groups: any[]) {
    return groups.map((group, index) => ({
      ...group,
      name: `第${index + 1}组`,
      id: `group_${index + 1}`
    }))
  }

  /**
   * 构建综合策略描述
   */
  private static buildComprehensiveStrategy(
    genderStats: GenderStats,
    strategy: GroupingStrategy,
    groupingResult: GroupingResult,
    validationResult: ValidationResult
  ): string {
    let strategyText = '【算法分组策略】\n'
    
    // 数据概况
    strategyText += `数据概况：${genderStats.totalUsers}名用户（${genderStats.males}男${genderStats.females}女）\n`
    strategyText += `性别比例：${(genderStats.genderRatio).toFixed(2)}（女性/男性）\n`
    strategyText += `接受全女组：${genderStats.femalesAcceptAllFemale}名女性\n\n`
    
    // 分组策略
    strategyText += `分组策略：${strategy.reasoning}\n`
    strategyText += `执行结果：${groupingResult.reasoning}\n\n`
    
    // 质量评估
    strategyText += `质量评估：整体评分${validationResult.score.toFixed(1)}分`
    if (validationResult.violations.length > 0) {
      strategyText += `，发现${validationResult.violations.length}个约束违规`
    }
    strategyText += '\n'
    
    // 执行统计
    strategyText += `执行统计：${groupingResult.executionStats.iterationsPerformed}次迭代，`
    strategyText += `${groupingResult.executionStats.executionTimeMs}ms执行时间，`
    strategyText += `平均年龄差${groupingResult.executionStats.averageAgeGap.toFixed(1)}岁`
    
    return strategyText
  }

  /**
   * 生成数据质量建议
   */
  private static generateRecommendation(
    genderStats: GenderStats,
    ageStats: AgeStats,
    strategy: GroupingStrategy
  ): string {
    const recommendations: string[] = []

    if (strategy.expectedUnassigned > 0) {
      recommendations.push(`预计有${strategy.expectedUnassigned}人无法分组，建议考虑调整分组规则或手动处理`)
    }

    if (genderStats.genderRatio > 3) {
      recommendations.push('女性比例过高，建议增加全女组的分配比例')
    } else if (genderStats.genderRatio < 0.5) {
      recommendations.push('男性比例过高，可能难以形成平衡的混合组')
    }

    if (ageStats.ageRange > 15) {
      recommendations.push('年龄跨度较大，建议适当放宽年龄差限制或进行预分层')
    }

    if (genderStats.femalesAcceptAllFemale < 6 && strategy.recommendedAllFemaleGroups > 0) {
      recommendations.push('明确接受全女组的女性较少，全女组分配可能存在困难')
    }

    return recommendations.length > 0 ? recommendations.join('；') : '数据质量良好，适合执行算法分组'
  }

  /**
   * 记录详细执行日志
   */
  private static logExecutionSummary(
    genderStats: GenderStats,
    strategy: GroupingStrategy,
    groupingResult: GroupingResult,
    validationResult: ValidationResult
  ) {
    console.group('🔧 算法分组执行摘要')
    
    console.log('📊 输入数据：', {
      总用户数: genderStats.totalUsers,
      男性: genderStats.males,
      女性: genderStats.females,
      接受全女组女性: genderStats.femalesAcceptAllFemale,
      性别比例: genderStats.genderRatio.toFixed(2)
    })
    
    console.log('🎯 分组策略：', {
      推荐2男4女组: strategy.recommendedMixedGroups2M4F,
      推荐3男3女组: strategy.recommendedMixedGroups3M3F,
      推荐全女组: strategy.recommendedAllFemaleGroups,
      预期待分配: strategy.expectedUnassigned
    })
    
    console.log('📈 执行结果：', {
      生成组数: groupingResult.groups.length,
      已分配用户: groupingResult.executionStats.assignedUsers,
      待分配用户: groupingResult.executionStats.unassignedUsers,
      整体评分: validationResult.score.toFixed(1),
      执行时间: `${groupingResult.executionStats.executionTimeMs}ms`,
      迭代次数: groupingResult.executionStats.iterationsPerformed
    })
    
    if (validationResult.violations.length > 0) {
      console.warn('⚠️ 约束违规：', validationResult.violations)
    }
    
    console.groupEnd()
  }
}