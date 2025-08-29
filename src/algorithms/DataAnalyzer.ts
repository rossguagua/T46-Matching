// 数据分析器 - 负责解析问卷数据和制定分组策略
import { UserData } from '../types/matching'

export interface GenderStats {
  totalUsers: number
  males: number
  females: number
  femalesAcceptAllFemale: number
  femalesRejectAllFemale: number
  femalesNeutral: number
  genderRatio: number // females/males
}

export interface AgeStats {
  minAge: number
  maxAge: number
  ageRange: number
  ageGroups: Map<number, UserData[]> // 按年龄聚类
  averageAge: number
}

export interface GroupingStrategy {
  strategy: 'MIXED_PRIORITY' | 'GENDER_CONSTRAINED' | 'AGE_CONSTRAINED'
  recommendedMixedGroups2M4F: number // 推荐的2男4女组数
  recommendedMixedGroups3M3F: number // 推荐的3男3女组数
  recommendedAllFemaleGroups: number // 推荐的全女组数
  expectedUnassigned: number
  reasoning: string
  details: string
}

export class DataAnalyzer {
  
  /**
   * 分析用户数据的性别分布
   */
  static analyzeGenderDistribution(userData: UserData[]): GenderStats {
    if (!userData || userData.length === 0) {
      throw new Error('用户数据为空，无法进行分析')
    }

    let males = 0
    let females = 0
    let femalesAcceptAllFemale = 0
    let femalesRejectAllFemale = 0
    let femalesNeutral = 0

    for (const user of userData) {
      const gender = this.normalizeGender(user.性别)
      
      if (gender === 'male') {
        males++
      } else if (gender === 'female') {
        females++
        
        // 分析"是否接受全女"字段
        const acceptsAllFemale = this.parseAllFemaleAcceptance(user)
        if (acceptsAllFemale === true) {
          femalesAcceptAllFemale++
        } else if (acceptsAllFemale === false) {
          femalesRejectAllFemale++
        } else {
          femalesNeutral++
        }
      }
      // 忽略未知性别用户（在后续处理中会放入待分配）
    }

    const totalUsers = males + females
    const genderRatio = males > 0 ? females / males : Infinity

    return {
      totalUsers,
      males,
      females,
      femalesAcceptAllFemale,
      femalesRejectAllFemale,
      femalesNeutral,
      genderRatio
    }
  }

  /**
   * 分析年龄分布和聚类
   */
  static analyzeAgeDistribution(userData: UserData[], maxAgeGap: number): AgeStats {
    if (!userData || userData.length === 0) {
      throw new Error('用户数据为空，无法进行年龄分析')
    }

    const ages = userData
      .map(user => this.normalizeAge(user.年龄))
      .filter(age => age !== null) as number[]

    if (ages.length === 0) {
      throw new Error('没有有效的年龄数据')
    }

    const minAge = Math.min(...ages)
    const maxAge = Math.max(...ages)
    const ageRange = maxAge - minAge
    const averageAge = ages.reduce((sum, age) => sum + age, 0) / ages.length

    // 创建年龄聚类 - 基于最大年龄差进行聚类
    const ageGroups = this.createAgeClusters(userData, maxAgeGap)

    return {
      minAge,
      maxAge,
      ageRange,
      ageGroups,
      averageAge
    }
  }

  /**
   * 制定分组策略
   */
  static calculateGroupingStrategy(
    genderStats: GenderStats, 
    ageStats: AgeStats, 
    groupSize: number
  ): GroupingStrategy {
    const { males, females, femalesAcceptAllFemale } = genderStats
    
    // 策略决策逻辑
    let strategy: GroupingStrategy['strategy'] = 'MIXED_PRIORITY'
    let recommendedMixedGroups2M4F = 0
    let recommendedMixedGroups3M3F = 0
    let recommendedAllFemaleGroups = 0
    
    // Phase 1: 计算理论最优正常组分配
    console.log(`📊 策略计算：${males}男${females}女，女性/男性比例=${(females/males).toFixed(2)}`)
    
    if (females >= males * 2) {
      // 女性充足，倾向2男4女
      const possible2M4F = Math.min(Math.floor(males / 2), Math.floor(females / 4))
      recommendedMixedGroups2M4F = possible2M4F
      console.log(`💡 女性充足策略：最多可组成${possible2M4F}个2男4女组`)
      
      const remainingMales = males - (possible2M4F * 2)
      const remainingFemales = females - (possible2M4F * 4)
      console.log(`🔢 2男4女分配后剩余：${remainingMales}男${remainingFemales}女`)
      
      // 剩余用户尝试3男3女
      const possible3M3F = Math.min(Math.floor(remainingMales / 3), Math.floor(remainingFemales / 3))
      recommendedMixedGroups3M3F = possible3M3F
      console.log(`💡 剩余用户可组成${possible3M3F}个3男3女组`)
      
    } else {
      // 性别比例接近或男性更多，倾向3男3女
      const possible3M3F = Math.min(Math.floor(males / 3), Math.floor(females / 3))
      recommendedMixedGroups3M3F = possible3M3F
      console.log(`💡 均衡策略：最多可组成${possible3M3F}个3男3女组`)
      
      const remainingMales = males - (possible3M3F * 3)
      const remainingFemales = females - (possible3M3F * 3)
      console.log(`🔢 3男3女分配后剩余：${remainingMales}男${remainingFemales}女`)
      
      // 剩余女性尝试2男4女（如果还有足够男性）
      const possible2M4F = Math.min(Math.floor(remainingMales / 2), Math.floor(remainingFemales / 4))
      recommendedMixedGroups2M4F = possible2M4F
      console.log(`💡 剩余用户可组成${possible2M4F}个2男4女组`)
    }
    
    // Phase 2: 计算剩余用户和全女组需求
    const usedMales = recommendedMixedGroups2M4F * 2 + recommendedMixedGroups3M3F * 3
    const usedFemales = recommendedMixedGroups2M4F * 4 + recommendedMixedGroups3M3F * 3
    const remainingFemales = females - usedFemales
    
    // 只有当剩余女性较多且有足够愿意接受全女组的用户时才考虑全女组
    if (remainingFemales >= groupSize && femalesAcceptAllFemale >= groupSize) {
      const possibleAllFemaleGroups = Math.min(
        Math.floor(remainingFemales / groupSize),
        Math.floor(femalesAcceptAllFemale / groupSize)
      )
      recommendedAllFemaleGroups = possibleAllFemaleGroups
    }
    
    // 计算预期的待分配人数
    const totalAssigned = (recommendedMixedGroups2M4F + recommendedMixedGroups3M3F + recommendedAllFemaleGroups) * groupSize
    const expectedUnassigned = genderStats.totalUsers - totalAssigned
    
    // 生成策略说明
    let reasoning = `基于${males}男${females}女的比例分析：`
    if (recommendedMixedGroups2M4F > 0) reasoning += ` ${recommendedMixedGroups2M4F}个2男4女组`
    if (recommendedMixedGroups3M3F > 0) reasoning += ` ${recommendedMixedGroups3M3F}个3男3女组`
    if (recommendedAllFemaleGroups > 0) reasoning += ` ${recommendedAllFemaleGroups}个全女组`
    if (expectedUnassigned > 0) reasoning += `，预计${expectedUnassigned}人待分配`
    
    const details = `接受全女组的女性：${femalesAcceptAllFemale}人，年龄范围：${ageStats.minAge}-${ageStats.maxAge}岁`
    
    return {
      strategy,
      recommendedMixedGroups2M4F,
      recommendedMixedGroups3M3F,
      recommendedAllFemaleGroups,
      expectedUnassigned,
      reasoning,
      details
    }
  }

  // ===================== 私有辅助方法 =====================

  /**
   * 标准化性别字段
   */
  private static normalizeGender(gender: any): 'male' | 'female' | 'unknown' {
    if (!gender) return 'unknown'
    
    const genderStr = String(gender).toLowerCase().trim()
    
    if (genderStr.includes('男') || genderStr.includes('male') || genderStr === 'm') {
      return 'male'
    } else if (genderStr.includes('女') || genderStr.includes('female') || genderStr === 'f') {
      return 'female'
    }
    
    return 'unknown'
  }

  /**
   * 标准化年龄字段
   */
  private static normalizeAge(age: any): number | null {
    if (age === null || age === undefined || age === '') return null
    
    const ageNum = Number(age)
    if (isNaN(ageNum) || ageNum < 0 || ageNum > 150) return null
    
    return Math.floor(ageNum)
  }

  /**
   * 解析"是否接受全女"字段
   */
  private static parseAllFemaleAcceptance(user: UserData): boolean | null {
    // 尝试多种可能的字段名
    const possibleFields = [
      '是否接受全女',
      '是否接受全女局',
      '接受全女组',
      '全女组',
      'accept_all_female',
      'all_female'
    ]
    
    for (const field of possibleFields) {
      const value = user[field]
      if (value !== undefined && value !== null && value !== '') {
        return this.parseYesNoValue(value)
      }
    }
    
    return null // 字段不存在或为空
  }

  /**
   * 解析是/否值
   */
  private static parseYesNoValue(value: any): boolean | null {
    if (value === null || value === undefined || value === '') return null
    
    const valueStr = String(value).toLowerCase().trim()
    
    // 明确的肯定回答
    if (['是', '接受', 'yes', 'y', '1', 'true', '可以', '愿意'].includes(valueStr)) {
      return true
    }
    
    // 明确的否定回答
    if (['否', '不接受', 'no', 'n', '0', 'false', '不可以', '不愿意'].includes(valueStr)) {
      return false
    }
    
    return null // 模糊或未知回答
  }

  /**
   * 创建年龄聚类
   */
  private static createAgeClusters(userData: UserData[], maxAgeGap: number): Map<number, UserData[]> {
    const clusters = new Map<number, UserData[]>()
    
    // 按年龄排序
    const sortedUsers = userData
      .filter(user => this.normalizeAge(user.年龄) !== null)
      .sort((a, b) => {
        const ageA = this.normalizeAge(a.年龄)!
        const ageB = this.normalizeAge(b.年龄)!
        return ageA - ageB
      })
    
    let currentClusterBase = -1
    
    for (const user of sortedUsers) {
      const age = this.normalizeAge(user.年龄)!
      
      // 寻找合适的聚类
      let assignedToCluster = false
      for (const [baseAge, cluster] of clusters.entries()) {
        const minAgeInCluster = Math.min(...cluster.map(u => this.normalizeAge(u.年龄)!))
        const maxAgeInCluster = Math.max(...cluster.map(u => this.normalizeAge(u.年龄)!))
        
        // 检查加入这个聚类后是否仍满足年龄差约束
        const newMinAge = Math.min(minAgeInCluster, age)
        const newMaxAge = Math.max(maxAgeInCluster, age)
        
        if (newMaxAge - newMinAge <= maxAgeGap) {
          cluster.push(user)
          assignedToCluster = true
          break
        }
      }
      
      // 如果没有合适的聚类，创建新聚类
      if (!assignedToCluster) {
        clusters.set(age, [user])
      }
    }
    
    return clusters
  }
}