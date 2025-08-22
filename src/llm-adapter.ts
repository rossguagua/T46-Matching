import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'

export interface LLMResponse {
  text: string
  error?: string
}

export interface LLMConfig {
  provider: 'gemini' | 'deepseek' | 'openai'
  model: string
  temperature: number
  maxTokens?: number
  apiKey: string
}

class LLMAdapter {
  async generateContent(prompt: string, config: LLMConfig): Promise<LLMResponse> {
    try {
      if (config.provider === 'deepseek') {
        const deepseekAI = new OpenAI({
          baseURL: 'https://api.deepseek.com/v1',
          apiKey: config.apiKey,
          dangerouslyAllowBrowser: true
        })
        
        const response = await deepseekAI.chat.completions.create({
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: config.temperature,
          max_tokens: config.maxTokens || 2000,
        })

        const text = response.choices[0]?.message?.content || ''
        console.log(`🤖 DeepSeek响应长度: ${text.length}`)
        return { text }
      } 
      else if (config.provider === 'gemini') {
        const geminiAI = new GoogleGenerativeAI(config.apiKey)
        const model = geminiAI.getGenerativeModel({ 
          model: config.model,
          generationConfig: { 
            temperature: config.temperature,
            maxOutputTokens: config.maxTokens 
          }
        })
        
        const result = await model.generateContent(prompt)
        const response = result.response
        
        if (!response.candidates || response.candidates.length === 0) {
          throw new Error(`Gemini返回空响应: ${JSON.stringify(response)}`)
        }
        
        const candidate = response.candidates[0]
        if (candidate.finishReason === 'SAFETY') {
          throw new Error('Gemini响应被安全过滤器拦截')
        }
        
        const text = response.text()
        console.log(`🤖 Gemini响应长度: ${text.length}`)
        return { text }
      } 
      else if (config.provider === 'openai') {
        const openaiAI = new OpenAI({
          apiKey: config.apiKey,
          dangerouslyAllowBrowser: true
        })
        
        const response = await openaiAI.chat.completions.create({
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: config.temperature,
          max_tokens: config.maxTokens || 2000,
        })

        const text = response.choices[0]?.message?.content || ''
        console.log(`🤖 OpenAI响应长度: ${text.length}`)
        return { text }
      }
      else {
        throw new Error(`不支持的LLM提供商: ${config.provider}`)
      }
    } catch (error) {
      console.error(`❌ LLM API调用失败详情:`)
      console.error(`  提供商: ${config.provider}`)
      console.error(`  模型: ${config.model}`)
      console.error(`  错误类型: ${error instanceof Error ? error.constructor.name : typeof error}`)
      console.error(`  错误信息: ${error instanceof Error ? error.message : String(error)}`)
      
      if (error instanceof Error && error.stack) {
        console.error(`  错误堆栈: ${error.stack}`)
      }
      
      // 针对不同错误类型提供更有用的信息
      let friendlyMessage = error instanceof Error ? error.message : String(error)
      
      if (friendlyMessage.includes('401') || friendlyMessage.includes('Unauthorized')) {
        friendlyMessage = `API密钥无效或已过期 (${config.provider})`
      } else if (friendlyMessage.includes('429') || friendlyMessage.includes('quota')) {
        friendlyMessage = `API配额已用完或请求过于频繁 (${config.provider})`
      } else if (friendlyMessage.includes('400') || friendlyMessage.includes('Bad Request')) {
        friendlyMessage = `请求格式错误，可能是模型名称不正确 (${config.provider}: ${config.model})`
      } else if (friendlyMessage.includes('network') || friendlyMessage.includes('fetch')) {
        friendlyMessage = `网络连接失败，请检查网络连接 (${config.provider})`
      } else if (friendlyMessage.includes('SAFETY')) {
        friendlyMessage = `Gemini内容安全过滤器拦截了响应，请尝试调整输入内容`
      } else if (friendlyMessage.includes('Resource has been exhausted')) {
        friendlyMessage = `Gemini API配额已耗尽，请检查配额限制或稍后重试`
      } else if (config.provider === 'gemini' && friendlyMessage.includes('models/')) {
        friendlyMessage = `Gemini模型名称可能不正确: ${config.model}，请检查模型是否存在`
      }
      
      return { 
        text: '', 
        error: friendlyMessage
      }
    }
  }

  getAvailableModels(): { [provider: string]: string[] } {
    return {
      deepseek: ['deepseek-v3'],
      gemini: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'],
      openai: ['gpt-4o', 'gpt-4o-mini']
    }
  }
}

export default LLMAdapter