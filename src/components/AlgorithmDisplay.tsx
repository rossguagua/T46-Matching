import React from 'react'

const AlgorithmDisplay: React.FC = () => {
  return (
    <div style={{ 
      fontFamily: 'monospace', 
      padding: '20px', 
      backgroundColor: '#f5f5f5',
      maxWidth: '1200px',
      margin: '0 auto',
      lineHeight: '1.6'
    }}>
      <h1 style={{ color: '#2c3e50', textAlign: 'center' }}>T46分组算法详解</h1>
      
      {/* 算法概览 */}
      <section style={{ marginBottom: '30px', backgroundColor: 'white', padding: '20px', borderRadius: '8px' }}>
        <h2 style={{ color: '#e74c3c' }}>🎯 算法目标</h2>
        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2c3e50' }}>
          最大化分组成功率 &gt; 年龄匹配完美性
        </div>
        <p>通过回溯算法尝试6种分组策略，选择能分配最多人的方案</p>
      </section>

      {/* 优先级梯度 */}
      <section style={{ marginBottom: '30px', backgroundColor: 'white', padding: '20px', borderRadius: '8px' }}>
        <h2 style={{ color: '#3498db' }}>📊 分组优先级梯度</h2>
        
        <div style={{ marginBottom: '15px' }}>
          <h3 style={{ color: '#e67e22' }}>🏆 全局优先级</h3>
          <ol style={{ fontSize: '16px' }}>
            <li><strong>组数量最多</strong> - 能分配更多人的策略获胜</li>
            <li><strong>相同组数时比较总评分</strong> - 质量更高的获胜</li>
          </ol>
        </div>

        <div>
          <h3 style={{ color: '#9b59b6' }}>🎯 单组评分体系 (总分100分)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px' }}>
            
            <div style={{ border: '2px solid #e74c3c', padding: '15px', borderRadius: '8px' }}>
              <h4 style={{ color: '#e74c3c', margin: '0 0 10px 0' }}>第一层: 基础分组成功 (60分)</h4>
              <ul style={{ margin: 0 }}>
                <li>性别比例正确: <strong>60分</strong></li>
                <li>2男4女 / 3男3女 / 全女组</li>
                <li><em>最重要的基础分</em></li>
              </ul>
            </div>

            <div style={{ border: '2px solid #f39c12', padding: '15px', borderRadius: '8px' }}>
              <h4 style={{ color: '#f39c12', margin: '0 0 10px 0' }}>第二层: 年龄约束 (25分)</h4>
              <ul style={{ margin: 0 }}>
                <li>满足年龄差限制: <strong>25分</strong></li>
                <li>不满足直接0分</li>
                <li><em>死规矩，不能违反</em></li>
              </ul>
            </div>

            <div style={{ border: '2px solid #27ae60', padding: '15px', borderRadius: '8px' }}>
              <h4 style={{ color: '#27ae60', margin: '0 0 10px 0' }}>第三层: 年龄优化 (0-15分)</h4>
              <ul style={{ margin: 0 }}>
                <li>年龄差越小分数越高</li>
                <li>公式: 15 × (1 - 年龄差/上限)</li>
                <li><em>锦上添花</em></li>
              </ul>
            </div>

            <div style={{ border: '2px solid #8e44ad', padding: '15px', borderRadius: '8px' }}>
              <h4 style={{ color: '#8e44ad', margin: '0 0 10px 0' }}>第四层: 年龄集中度 (0-15分)</h4>
              <ul style={{ margin: 0 }}>
                <li>年龄方差越小越好</li>
                <li>公式: max(0, 15 - 方差 × 2)</li>
                <li><em>权重最小</em></li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 回溯算法 */}
      <section style={{ marginBottom: '30px', backgroundColor: 'white', padding: '20px', borderRadius: '8px' }}>
        <h2 style={{ color: '#e74c3c' }}>🔄 回溯算法策略</h2>
        <p>尝试6种不同的分组顺序，严格遵守年龄约束，选择最优结果：</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '10px' }}>
          {[
            ['ALL_FEMALE', '2M4F', '3M3F'],
            ['2M4F', 'ALL_FEMALE', '3M3F'], 
            ['2M4F', '3M3F', 'ALL_FEMALE'],
            ['3M3F', '2M4F', 'ALL_FEMALE'],
            ['3M3F', 'ALL_FEMALE', '2M4F'],
            ['ALL_FEMALE', '3M3F', '2M4F']
          ].map((strategy, index) => (
            <div key={index} style={{ 
              backgroundColor: '#ecf0f1', 
              padding: '10px', 
              borderRadius: '5px',
              textAlign: 'center',
              border: '1px solid #bdc3c7'
            }}>
              <strong>策略 {index + 1}</strong><br/>
              {strategy.join(' → ')}
            </div>
          ))}
        </div>
      </section>

      {/* 算法流程 */}
      <section style={{ marginBottom: '30px', backgroundColor: 'white', padding: '20px', borderRadius: '8px' }}>
        <h2 style={{ color: '#2c3e50' }}>⚙️ 详细算法流程</h2>
        
        <div style={{ fontSize: '14px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#e74c3c' }}>1. 数据预处理</h3>
            <pre style={{ backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '5px', overflow: 'auto' }}>
{`// 用户池分类
males: 男性用户
femalesAcceptAllFemale: 接受全女组的女性
femalesRejectAllFemale: 拒绝全女组的女性  
femalesNeutral: 中立态度的女性
unknownGender: 性别未知用户`}
            </pre>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#3498db' }}>2. 策略理论计算</h3>
            <pre style={{ backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '5px', overflow: 'auto' }}>
{`if (女性数 >= 男性数 × 2) {
  // 女性充足，倾向2男4女
  推荐2M4F = min(男性数÷2, 女性数÷4)
  剩余用户尝试3M3F
} else {
  // 性别均衡，倾向3男3女
  推荐3M3F = min(男性数÷3, 女性数÷3)
  剩余用户尝试2M4F
}`}
            </pre>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#27ae60' }}>3. 回溯分配执行</h3>
            <pre style={{ backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '5px', overflow: 'auto' }}>
{`for (每种策略顺序) {
  用户池副本 = 复制原始用户池
  
  for (策略中的每种组合类型) {
    while (还有目标数量 && 有足够用户) {
      候选组合 = tryCreateGroup(类型, 年龄限制, 组大小)
      
      if (候选组合存在 && 满足所有约束) {
        创建组合，从用户池移除用户
      } else {
        停止该类型分配
      }
    }
  }
  
  记录结果(组数, 未分配用户, 总分)
}

选择组数最多的结果`}
            </pre>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#f39c12' }}>4. 组合创建策略</h3>
            <pre style={{ backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '5px', overflow: 'auto' }}>
{`tryCreateGroup(类型, 年龄限制, 组大小) {
  // 策略1: 简单顺序选择
  按年龄排序用户
  for (不同起始位置) {
    选择连续用户组合
    if (满足年龄约束 && 性别约束) {
      return 组合
    }
  }
  
  // 策略2: 有限组合搜索  
  尝试有限数量的用户组合
  return 第一个满足约束的组合
}`}
            </pre>
          </div>

          <div>
            <h3 style={{ color: '#9b59b6' }}>5. 约束验证</h3>
            <pre style={{ backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '5px', overflow: 'auto' }}>
{`canUsersFormGroup(用户组合, 最大年龄差, 组大小) {
  // 检查人数
  if (用户数 != 组大小) return false
  
  // 检查年龄约束 (死规矩)
  年龄差 = max(年龄) - min(年龄)
  if (年龄差 > 最大年龄差) return false
  
  // 检查性别比例
  return validateGenderRatio(用户组合).isValid
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* 关键特性 */}
      <section style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px' }}>
        <h2 style={{ color: '#e74c3c' }}>✨ 关键算法特性</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
          
          <div style={{ border: '1px solid #3498db', padding: '15px', borderRadius: '8px' }}>
            <h4 style={{ color: '#3498db', margin: '0 0 10px 0' }}>🎯 成功率优先</h4>
            <p style={{ margin: 0, fontSize: '14px' }}>
              基础分组成功奖励占60%权重，确保能分配更多人比年龄完美更重要
            </p>
          </div>

          <div style={{ border: '1px solid #e74c3c', padding: '15px', borderRadius: '8px' }}>
            <h4 style={{ color: '#e74c3c', margin: '0 0 10px 0' }}>⚖️ 严格约束</h4>
            <p style={{ margin: 0, fontSize: '14px' }}>
              年龄差限制是死规矩，算法绝不会为了分组成功而违反年龄约束
            </p>
          </div>

          <div style={{ border: '1px solid #27ae60', padding: '15px', borderRadius: '8px' }}>
            <h4 style={{ color: '#27ae60', margin: '0 0 10px 0' }}>🔄 全局最优</h4>
            <p style={{ margin: 0, fontSize: '14px' }}>
              通过尝试6种策略顺序，避免局部最优，找到能分配最多人的方案
            </p>
          </div>

          <div style={{ border: '1px solid #f39c12', padding: '15px', borderRadius: '8px' }}>
            <h4 style={{ color: '#f39c12', margin: '0 0 10px 0' }}>🚀 高效执行</h4>
            <p style={{ margin: 0, fontSize: '14px' }}>
              优先尝试简单顺序选择，避免过度复杂的组合搜索，快速找到可行解
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default AlgorithmDisplay