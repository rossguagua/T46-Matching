// API配置相关的类型定义
export interface ApiProvider {
  id: string
  name: string
  displayName: string
  baseUrl?: string
  models: ApiModel[]
  quotaEndpoint?: string
  testPrompt: string
}

export interface ApiModel {
  id: string
  name: string
  displayName: string
  type: 'analysis' | 'generation' | 'review' | 'universal'
  maxTokens: number
  temperature: number
}

export interface ApiConfig {
  providers: {
    [providerId: string]: {
      apiKey: string
      enabled: boolean
      selectedModels: {
        analysis: string
        generation: string
        review: string
      }
    }
  }
  activeProvider: string
  lastUpdated: number
}

export interface ApiQuota {
  providerId: string
  modelId?: string
  used: number
  limit: number
  remaining: number
  resetTime?: number
  currency?: string
  cost?: number
}

export interface ApiTest {
  providerId: string
  modelId: string
  status: 'pending' | 'success' | 'error'
  responseTime?: number
  error?: string
  response?: string
  timestamp: number
}