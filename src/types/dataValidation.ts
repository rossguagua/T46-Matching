// 数据验证相关类型定义

export interface DataIssue {
  row: number           // 数据行号
  column: string        // 列名
  type: 'critical' | 'warning' | 'suggestion'  // 问题级别
  message: string       // 问题描述
  value: any           // 当前值
  suggestion?: any     // 建议值
  autoFixable: boolean // 是否可自动修复
}

export interface DataQualityReport {
  score: number        // 0-100 数据质量总分
  totalRows: number    // 总行数
  validRows: number    // 有效行数
  issues: {
    critical: DataIssue[]    // 关键问题（必须修复）
    warning: DataIssue[]     // 警告（建议修复）
    suggestion: DataIssue[]  // 建议（可选优化）
  }
  stats: {
    completeness: number     // 完整度 0-100
    consistency: number      // 一致性 0-100
    validity: number        // 有效性 0-100
    uniqueness: number      // 唯一性 0-100
  }
  fieldAnalysis: {
    [field: string]: {
      filled: number        // 填充数
      empty: number         // 空值数
      unique: number        // 唯一值数
      issues: number        // 问题数
    }
  }
  recommendations: string[]  // 改进建议
}

export interface ValidationRules {
  required: string[]         // 必填字段
  age: {
    min: number
    max: number
  }
  gender: {
    acceptedValues: string[]
    mappings: { [key: string]: string }  // 自动映射规则
  }
  duplicateCheck: boolean    // 是否检查重复
}

export const DEFAULT_VALIDATION_RULES: ValidationRules = {
  required: ['自选昵称', '性别', '出生年份'],
  age: {
    min: 18,
    max: 40
  },
  gender: {
    acceptedValues: ['男', '女', '其他'],
    mappings: {
      '男性': '男',
      '女性': '女',
      'M': '男',
      'F': '女',
      'Male': '男',
      'Female': '女',
      '1': '男',
      '0': '女'
    }
  },
  duplicateCheck: true
}

export interface DataProcessor {
  validate: (data: any[]) => DataQualityReport
  autoFix: (data: any[], issues: DataIssue[]) => any[]
  clean: (data: any[]) => any[]
}