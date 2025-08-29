// 约束验证器 - 负责验证分组是否满足所有约束条件
import { UserData, Group } from '../types/matching'

export interface ValidationResult {
  isValid: boolean
  violations: ValidationViolation[]
  score: number // 0-100分，用于优化比较
  details: ValidationDetails
}

export interface ValidationViolation {
  type: 'AGE_GAP' | 'GROUP_SIZE' | 'GENDER_RATIO' | 'ALL_FEMALE_CONSTRAINT'
  severity: 'ERROR' | 'WARNING'
  message: string
  groupId?: string
  affectedUsers?: string[]
}

export interface ValidationDetails {
  totalGroups: number
  totalUsers: number
  averageAgeGap: number
  maxAgeGap: number
  genderDistribution: {
    mixedGroups2M4F: number
    mixedGroups3M3F: number
    allFemaleGroups: number
  }
  constraintCompliance: {
    ageConstraints: number // 满足年龄约束的组数
    genderConstraints: number // 满足性别约束的组数
    sizeConstraints: number // 满足人数约束的组数
  }
}

export class ConstraintValidator {
  
  /**
   * 验证整个分组方案是否满足约束
   */
  static validateGroupingPlan(
    groups: Group[], 
    unassigned: UserData[], 
    maxAgeGap: number, 
    groupSize: number
  ): ValidationResult {
    const violations: ValidationViolation[] = []
    let totalScore = 0
    let validGroups = 0

    // 验证每个组
    const groupValidations = groups.map(group => this.validateSingleGroup(group, maxAgeGap, groupSize))
    
    // 收集所有违规信息
    groupValidations.forEach(validation => {
      violations.push(...validation.violations)
      if (validation.isValid) validGroups++
      totalScore += validation.score
    })

    // 计算平均分数
    const averageScore = groups.length > 0 ? totalScore / groups.length : 0

    // 生成详细信息
    const details = this.generateValidationDetails(groups, groupValidations)

    return {
      isValid: violations.filter(v => v.severity === 'ERROR').length === 0,
      violations,
      score: averageScore,
      details
    }
  }

  /**
   * 验证单个组是否满足约束
   */
  static validateSingleGroup(group: Group, maxAgeGap: number, groupSize: number): ValidationResult {
    const violations: ValidationViolation[] = []
    let score = 100 // 开始满分，违规则扣分

    if (!group || !group.members) {
      violations.push({
        type: 'GROUP_SIZE',
        severity: 'ERROR',
        message: '组数据无效',
        groupId: group?.id
      })
      return {
        isValid: false,
        violations,
        score: 0,
        details: this.createEmptyDetails()
      }
    }

    const members = group.members
    const memberCount = members.length

    // 1. 验证组大小
    if (memberCount !== groupSize) {
      violations.push({
        type: 'GROUP_SIZE',
        severity: 'ERROR',
        message: `组${group.name}人数不正确：${memberCount}人，要求${groupSize}人`,
        groupId: group.id,
        affectedUsers: members.map(m => m.自选昵称 || m.姓名 || '未知')
      })
      score -= 30
    }

    // 2. 验证年龄约束
    const ageValidation = this.validateAgeConstraints(members, maxAgeGap)
    if (!ageValidation.isValid) {
      violations.push({
        type: 'AGE_GAP',
        severity: 'ERROR',
        message: `组${group.name}年龄差过大：${ageValidation.ageGap}岁，最大允许${maxAgeGap}岁`,
        groupId: group.id,
        affectedUsers: members.map(m => m.自选昵称 || m.姓名 || '未知')
      })
      score -= 25
    } else if (ageValidation.ageGap > maxAgeGap * 0.8) {
      // 年龄差接近上限时给出警告
      violations.push({
        type: 'AGE_GAP',
        severity: 'WARNING',
        message: `组${group.name}年龄差较大：${ageValidation.ageGap}岁`,
        groupId: group.id
      })
      score -= 5
    }

    // 3. 验证性别比例
    const genderValidation = this.validateGenderRatio(members)
    if (!genderValidation.isValid) {
      violations.push({
        type: 'GENDER_RATIO',
        severity: 'ERROR',
        message: `组${group.name}性别比例不正确：${genderValidation.males}男${genderValidation.females}女，${genderValidation.reason}`,
        groupId: group.id,
        affectedUsers: members.map(m => m.自选昵称 || m.姓名 || '未知')
      })
      score -= 25
    }

    // 4. 如果是全女组，验证成员是否都接受全女组
    if (genderValidation.isAllFemale) {
      const allFemaleValidation = this.validateAllFemaleGroupConsent(members)
      if (!allFemaleValidation.isValid) {
        violations.push({
          type: 'ALL_FEMALE_CONSTRAINT',
          severity: 'WARNING',
          message: `全女组${group.name}中有成员未明确接受全女组`,
          groupId: group.id,
          affectedUsers: allFemaleValidation.nonConsentingUsers
        })
        score -= 10
      }
    }

    // 年龄方差奖励 - 年龄越集中分数越高
    const ageVariance = this.calculateAgeVariance(members)
    const varianceBonus = Math.max(0, 10 - ageVariance) // 方差越小奖励越多
    score += varianceBonus

    return {
      isValid: violations.filter(v => v.severity === 'ERROR').length === 0,
      violations,
      score: Math.max(0, Math.min(100, score)),
      details: this.createEmptyDetails() // 单组验证不需要完整详情
    }
  }

  /**
   * 检查两个用户是否可以在同一组（年龄兼容性）
   */
  static canUsersBeInSameGroup(user1: UserData, user2: UserData, maxAgeGap: number): boolean {
    const age1 = this.normalizeAge(user1.年龄)
    const age2 = this.normalizeAge(user2.年龄)
    
    if (age1 === null || age2 === null) return false
    
    return Math.abs(age1 - age2) <= maxAgeGap
  }

  /**
   * 检查一组用户是否可以组成有效组
   */
  static canUsersFormGroup(users: UserData[], maxAgeGap: number, groupSize: number): boolean {
    if (users.length !== groupSize) return false
    
    // 检查年龄约束
    const ages = users.map(u => this.normalizeAge(u.年龄)).filter(age => age !== null) as number[]
    if (ages.length !== users.length) return false
    
    const minAge = Math.min(...ages)
    const maxAge = Math.max(...ages)
    if (maxAge - minAge > maxAgeGap) return false
    
    // 检查性别比例
    const genderValidation = this.validateGenderRatio(users)
    return genderValidation.isValid
  }

  // ===================== 私有辅助方法 =====================

  /**
   * 验证年龄约束
   */
  private static validateAgeConstraints(members: UserData[], maxAgeGap: number) {
    const ages = members.map(m => this.normalizeAge(m.年龄)).filter(age => age !== null) as number[]
    
    if (ages.length === 0) {
      return { isValid: false, ageGap: Infinity, reason: '没有有效年龄数据' }
    }
    
    if (ages.length !== members.length) {
      return { isValid: false, ageGap: Infinity, reason: '部分成员年龄数据无效' }
    }
    
    const minAge = Math.min(...ages)
    const maxAge = Math.max(...ages)
    const ageGap = maxAge - minAge
    
    return {
      isValid: ageGap <= maxAgeGap,
      ageGap,
      reason: ageGap > maxAgeGap ? `年龄差${ageGap}岁超过限制${maxAgeGap}岁` : '年龄约束满足'
    }
  }

  /**
   * 验证性别比例
   */
  public static validateGenderRatio(members: UserData[]) {
    let males = 0
    let females = 0
    let unknown = 0

    members.forEach(member => {
      const gender = this.normalizeGender(member.性别)
      if (gender === 'male') males++
      else if (gender === 'female') females++
      else unknown++
    })

    const total = males + females + unknown
    const isAllFemale = males === 0 && females === total && unknown === 0
    const is2M4F = males === 2 && females === 4 && unknown === 0
    const is3M3F = males === 3 && females === 3 && unknown === 0

    let isValid = false
    let reason = ''

    if (unknown > 0) {
      reason = `有${unknown}人性别未知`
    } else if (isAllFemale) {
      isValid = true
      reason = '全女组'
    } else if (is2M4F) {
      isValid = true
      reason = '2男4女组'
    } else if (is3M3F) {
      isValid = true
      reason = '3男3女组'
    } else {
      reason = `性别比例${males}:${females}不符合要求`
    }

    return {
      isValid,
      males,
      females,
      unknown,
      isAllFemale,
      is2M4F,
      is3M3F,
      reason
    }
  }

  /**
   * 验证全女组成员是否都同意
   */
  private static validateAllFemaleGroupConsent(members: UserData[]) {
    const nonConsentingUsers: string[] = []
    
    members.forEach(member => {
      const consent = this.parseAllFemaleAcceptance(member)
      if (consent === false) {
        nonConsentingUsers.push(member.自选昵称 || member.姓名 || '未知用户')
      }
      // null表示未明确表态，这里我们允许
    })

    return {
      isValid: nonConsentingUsers.length === 0,
      nonConsentingUsers
    }
  }

  /**
   * 计算年龄方差
   */
  private static calculateAgeVariance(members: UserData[]): number {
    const ages = members.map(m => this.normalizeAge(m.年龄)).filter(age => age !== null) as number[]
    
    if (ages.length <= 1) return 0
    
    const mean = ages.reduce((sum, age) => sum + age, 0) / ages.length
    const variance = ages.reduce((sum, age) => sum + Math.pow(age - mean, 2), 0) / ages.length
    
    return Math.sqrt(variance)
  }

  /**
   * 生成验证详情
   */
  private static generateValidationDetails(groups: Group[], validations: ValidationResult[]): ValidationDetails {
    let mixedGroups2M4F = 0
    let mixedGroups3M3F = 0
    let allFemaleGroups = 0
    let ageConstraints = 0
    let genderConstraints = 0
    let sizeConstraints = 0
    let totalAgeGap = 0

    groups.forEach((group, index) => {
      const validation = validations[index]
      
      // 统计组类型
      const genderRatio = this.validateGenderRatio(group.members)
      if (genderRatio.is2M4F) mixedGroups2M4F++
      else if (genderRatio.is3M3F) mixedGroups3M3F++
      else if (genderRatio.isAllFemale) allFemaleGroups++
      
      // 统计约束满足情况
      const hasAgeViolation = validation.violations.some(v => v.type === 'AGE_GAP' && v.severity === 'ERROR')
      const hasGenderViolation = validation.violations.some(v => v.type === 'GENDER_RATIO' && v.severity === 'ERROR')
      const hasSizeViolation = validation.violations.some(v => v.type === 'GROUP_SIZE' && v.severity === 'ERROR')
      
      if (!hasAgeViolation) ageConstraints++
      if (!hasGenderViolation) genderConstraints++
      if (!hasSizeViolation) sizeConstraints++
      
      // 计算平均年龄差
      const ageValidation = this.validateAgeConstraints(group.members, Infinity)
      totalAgeGap += ageValidation.ageGap
    })

    return {
      totalGroups: groups.length,
      totalUsers: groups.reduce((sum, g) => sum + g.members.length, 0),
      averageAgeGap: groups.length > 0 ? totalAgeGap / groups.length : 0,
      maxAgeGap: Math.max(...groups.map(g => this.validateAgeConstraints(g.members, Infinity).ageGap)),
      genderDistribution: {
        mixedGroups2M4F,
        mixedGroups3M3F,
        allFemaleGroups
      },
      constraintCompliance: {
        ageConstraints,
        genderConstraints,
        sizeConstraints
      }
    }
  }

  private static createEmptyDetails(): ValidationDetails {
    return {
      totalGroups: 0,
      totalUsers: 0,
      averageAgeGap: 0,
      maxAgeGap: 0,
      genderDistribution: {
        mixedGroups2M4F: 0,
        mixedGroups3M3F: 0,
        allFemaleGroups: 0
      },
      constraintCompliance: {
        ageConstraints: 0,
        genderConstraints: 0,
        sizeConstraints: 0
      }
    }
  }

  // ===================== 通用辅助方法 =====================

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