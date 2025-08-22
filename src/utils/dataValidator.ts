import { DataIssue, DataQualityReport, ValidationRules, DEFAULT_VALIDATION_RULES } from '../types/dataValidation'

export class DataValidator {
  private rules: ValidationRules

  constructor(rules: ValidationRules = DEFAULT_VALIDATION_RULES) {
    this.rules = rules
  }

  // 主验证函数
  validate(data: any[]): DataQualityReport {
    const issues: DataQualityReport['issues'] = {
      critical: [],
      warning: [],
      suggestion: []
    }

    const fieldAnalysis: DataQualityReport['fieldAnalysis'] = {}
    const allFields = new Set<string>()

    // 收集所有字段
    data.forEach(row => {
      Object.keys(row).forEach(field => allFields.add(field))
    })

    // 初始化字段分析
    allFields.forEach(field => {
      fieldAnalysis[field] = {
        filled: 0,
        empty: 0,
        unique: new Set<any>().size,
        issues: 0
      }
    })

    // 验证每一行
    data.forEach((row, index) => {
      // 检查必填字段
      this.checkRequiredFields(row, index, issues)
      
      // 验证年龄
      this.validateAge(row, index, issues)
      
      // 验证性别
      this.validateGender(row, index, issues)
      
      // 检查重复
      if (this.rules.duplicateCheck) {
        this.checkDuplicates(data, row, index, issues)
      }

      // 更新字段统计
      this.updateFieldStats(row, fieldAnalysis)
    })

    // 计算各维度分数
    const stats = this.calculateStats(data, issues, fieldAnalysis)
    
    // 计算总分
    const score = this.calculateScore(stats)
    
    // 生成建议
    const recommendations = this.generateRecommendations(issues, stats)

    return {
      score,
      totalRows: data.length,
      validRows: data.length - issues.critical.length,
      issues,
      stats,
      fieldAnalysis,
      recommendations
    }
  }

  // 检查必填字段
  private checkRequiredFields(row: any, index: number, issues: DataQualityReport['issues']) {
    this.rules.required.forEach(field => {
      if (!row[field] || row[field].toString().trim() === '') {
        issues.critical.push({
          row: index + 1,
          column: field,
          type: 'critical',
          message: `必填字段"${field}"为空`,
          value: row[field],
          suggestion: null,
          autoFixable: false
        })
      }
    })
  }

  // 验证年龄
  private validateAge(row: any, index: number, issues: DataQualityReport['issues']) {
    // 同时检查年龄和出生年份字段
    const age = row['年龄']
    const birthYear = row['出生年份']
    
    // 如果有出生年份，计算年龄并验证
    if (birthYear !== undefined && birthYear !== '') {
      const currentYear = new Date().getFullYear()
      const calculatedAge = currentYear - Number(birthYear)
      
      if (age !== undefined && age !== '') {
        const ageNum = Number(age)
        // 检查年龄和出生年份是否匹配
        if (Math.abs(ageNum - calculatedAge) > 1) {
          issues.warning.push({
            row: index + 1,
            column: '年龄',
            type: 'warning',
            message: `年龄(${ageNum})与出生年份(${birthYear})不匹配`,
            value: ageNum,
            suggestion: calculatedAge,
            autoFixable: true
          })
        }
      }
      
      // 检查年龄范围
      if (calculatedAge < this.rules.age.min || calculatedAge > this.rules.age.max) {
        issues.warning.push({
          row: index + 1,
          column: '出生年份',
          type: 'warning',
          message: `根据出生年份计算的年龄${calculatedAge}超出合理范围(${this.rules.age.min}-${this.rules.age.max})`,
          value: birthYear,
          suggestion: null,
          autoFixable: false
        })
      }
    } else if (age !== undefined && age !== '') {
      // 只有年龄没有出生年份
      const ageNum = Number(age)
      
      if (isNaN(ageNum)) {
        issues.critical.push({
          row: index + 1,
          column: '年龄',
          type: 'critical',
          message: `年龄"${age}"不是有效数字`,
          value: age,
          suggestion: null,
          autoFixable: false
        })
      } else if (ageNum < this.rules.age.min || ageNum > this.rules.age.max) {
        issues.warning.push({
          row: index + 1,
          column: '年龄',
          type: 'warning',
          message: `年龄${ageNum}超出合理范围(${this.rules.age.min}-${this.rules.age.max})`,
          value: ageNum,
          suggestion: Math.max(this.rules.age.min, Math.min(this.rules.age.max, ageNum)),
          autoFixable: true
        })
      }
    }
  }

  // 验证性别
  private validateGender(row: any, index: number, issues: DataQualityReport['issues']) {
    const gender = row['性别']
    if (gender !== undefined && gender !== '') {
      const genderStr = gender.toString().trim()
      
      // 检查是否需要映射
      if (this.rules.gender.mappings[genderStr]) {
        issues.suggestion.push({
          row: index + 1,
          column: '性别',
          type: 'suggestion',
          message: `性别"${genderStr}"可以标准化为"${this.rules.gender.mappings[genderStr]}"`,
          value: genderStr,
          suggestion: this.rules.gender.mappings[genderStr],
          autoFixable: true
        })
      } else if (!this.rules.gender.acceptedValues.includes(genderStr)) {
        issues.warning.push({
          row: index + 1,
          column: '性别',
          type: 'warning',
          message: `性别"${genderStr}"不在标准值列表中`,
          value: genderStr,
          suggestion: '其他',
          autoFixable: true
        })
      }
    }
  }

  // 检查重复数据
  private checkDuplicates(data: any[], row: any, index: number, issues: DataQualityReport['issues']) {
    // 检查自选昵称重复
    const nickname = row['自选昵称']
    if (nickname) {
      const duplicates = data.filter((r, i) => i !== index && r['自选昵称'] === nickname)
      if (duplicates.length > 0) {
        issues.warning.push({
          row: index + 1,
          column: '自选昵称',
          type: 'warning',
          message: `自选昵称"${nickname}"可能重复`,
          value: nickname,
          suggestion: null,
          autoFixable: false
        })
      }
    }
  }

  // 更新字段统计
  private updateFieldStats(row: any, fieldAnalysis: DataQualityReport['fieldAnalysis']) {
    Object.keys(fieldAnalysis).forEach(field => {
      const value = row[field]
      if (value !== undefined && value !== '' && value !== null) {
        fieldAnalysis[field].filled++
      } else {
        fieldAnalysis[field].empty++
      }
    })
  }

  // 计算统计指标
  private calculateStats(
    data: any[], 
    issues: DataQualityReport['issues'],
    fieldAnalysis: DataQualityReport['fieldAnalysis']
  ): DataQualityReport['stats'] {
    const totalFields = Object.keys(fieldAnalysis).length * data.length
    const filledFields = Object.values(fieldAnalysis).reduce((sum, f) => sum + f.filled, 0)
    
    const completeness = totalFields > 0 ? (filledFields / totalFields) * 100 : 0
    
    const totalIssues = issues.critical.length + issues.warning.length
    const consistency = data.length > 0 ? ((data.length - totalIssues) / data.length) * 100 : 0
    
    const criticalIssues = issues.critical.length
    const validity = data.length > 0 ? ((data.length - criticalIssues) / data.length) * 100 : 0
    
    // 检查自选昵称唯一性
    const nicknames = data.map(r => r['自选昵称']).filter(n => n)
    const uniqueNicknames = new Set(nicknames).size
    const uniqueness = nicknames.length > 0 ? (uniqueNicknames / nicknames.length) * 100 : 100

    return {
      completeness: Math.round(completeness),
      consistency: Math.round(consistency),
      validity: Math.round(validity),
      uniqueness: Math.round(uniqueness)
    }
  }

  // 计算总分
  private calculateScore(stats: DataQualityReport['stats']): number {
    const weights = {
      completeness: 0.3,
      consistency: 0.2,
      validity: 0.3,
      uniqueness: 0.2
    }
    
    const score = Object.entries(stats).reduce((sum, [key, value]) => {
      return sum + value * weights[key as keyof typeof weights]
    }, 0)
    
    return Math.round(score)
  }

  // 生成改进建议
  private generateRecommendations(
    issues: DataQualityReport['issues'],
    stats: DataQualityReport['stats']
  ): string[] {
    const recommendations: string[] = []
    
    if (issues.critical.length > 0) {
      recommendations.push(`🚨 请修复${issues.critical.length}个关键问题后再继续`)
    }
    
    if (stats.completeness < 80) {
      recommendations.push('📝 建议补充缺失的信息，提高数据完整度')
    }
    
    if (stats.uniqueness < 90) {
      recommendations.push('👥 检测到可能的重复数据，建议核实')
    }
    
    const autoFixableCount = [
      ...issues.warning,
      ...issues.suggestion
    ].filter(i => i.autoFixable).length
    
    if (autoFixableCount > 0) {
      recommendations.push(`💡 有${autoFixableCount}个问题可以自动修复`)
    }
    
    if (stats.validity === 100 && stats.completeness > 90) {
      recommendations.push('✅ 数据质量良好，可以开始智能匹配')
    }
    
    return recommendations
  }

  // 自动修复数据
  autoFix(data: any[], issues: DataIssue[]): any[] {
    const fixedData = [...data]
    const autoFixableIssues = issues.filter(i => i.autoFixable && i.suggestion !== null)
    
    autoFixableIssues.forEach(issue => {
      const rowIndex = issue.row - 1
      if (fixedData[rowIndex]) {
        fixedData[rowIndex][issue.column] = issue.suggestion
      }
    })
    
    return fixedData
  }

  // 批量清洗数据
  clean(data: any[]): any[] {
    return data.map(row => {
      const cleanedRow = { ...row }
      
      // 清理空白字符
      Object.keys(cleanedRow).forEach(key => {
        if (typeof cleanedRow[key] === 'string') {
          cleanedRow[key] = cleanedRow[key].trim()
        }
      })
      
      // 标准化性别
      if (cleanedRow['性别'] && this.rules.gender.mappings[cleanedRow['性别']]) {
        cleanedRow['性别'] = this.rules.gender.mappings[cleanedRow['性别']]
      }
      
      // 转换年龄为数字
      if (cleanedRow['年龄']) {
        const age = Number(cleanedRow['年龄'])
        if (!isNaN(age)) {
          cleanedRow['年龄'] = age
        }
      }
      
      return cleanedRow
    })
  }
}