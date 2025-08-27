import React, { useState, useRef, useEffect } from 'react'
import ApiMonitor from './APIMonitor'

interface DraggableApiMonitorProps {
  calls: any[]
  quotaStatus: any
  totalCalls: number
  errorCount: number
  isOnline: boolean
  onReset: () => void
}

const DraggableApiMonitor: React.FC<DraggableApiMonitorProps> = (props) => {
  const [position, setPosition] = useState({ x: window.innerWidth - 320, y: window.innerHeight - 400 })
  const [isDragging, setIsDragging] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // 从localStorage恢复位置
    const savedPosition = localStorage.getItem('api-monitor-position')
    if (savedPosition) {
      try {
        const pos = JSON.parse(savedPosition)
        setPosition(pos)
      } catch (e) {
        console.error('Failed to parse saved position')
      }
    }

    const savedMinimized = localStorage.getItem('api-monitor-minimized')
    if (savedMinimized === 'true') {
      setIsMinimized(true)
    }
  }, [])

  useEffect(() => {
    // 保存位置到localStorage
    localStorage.setItem('api-monitor-position', JSON.stringify(position))
  }, [position])

  useEffect(() => {
    // 保存最小化状态
    localStorage.setItem('api-monitor-minimized', String(isMinimized))
  }, [isMinimized])

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('drag-handle')) {
      setIsDragging(true)
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      })
      e.preventDefault()
    }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = Math.max(0, Math.min(window.innerWidth - 320, e.clientX - dragStart.x))
        const newY = Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragStart.y))
        setPosition({ x: newX, y: newY })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, dragStart])

  const getStatusColor = () => {
    if (props.errorCount > 0) return '#ff4444'
    if (Object.values(props.quotaStatus).some((q: any) => q.used / q.limit > 0.8)) return '#ff9500'
    return '#00c851'
  }

  const getStatusIcon = () => {
    if (props.errorCount > 0) return '🔴'
    if (Object.values(props.quotaStatus).some((q: any) => q.used / q.limit > 0.8)) return '🟡'
    return '🟢'
  }

  return (
    <div
      ref={containerRef}
      className={`draggable-api-monitor ${isMinimized ? 'minimized' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 9999,
        width: isMinimized ? 'auto' : '300px',
        maxHeight: isMinimized ? 'auto' : '400px',
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        border: `2px solid ${getStatusColor()}`,
        overflow: 'hidden',
        transition: isDragging ? 'none' : 'box-shadow 0.3s ease',
        cursor: isDragging ? 'grabbing' : 'default'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* 拖动手柄和控制栏 */}
      <div
        className="drag-handle"
        style={{
          padding: '10px 15px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          cursor: 'grab',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>{getStatusIcon()}</span>
          <span style={{ fontWeight: 600 }}>API监控</span>
          {isMinimized && (
            <span style={{ fontSize: '12px', opacity: 0.9 }}>
              {props.totalCalls} 调用 | {props.errorCount} 错误
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsMinimized(!isMinimized)
            }}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              width: '24px',
              height: '24px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px'
            }}
          >
            {isMinimized ? '▼' : '▲'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              // 重置位置到右下角
              setPosition({ 
                x: window.innerWidth - 320, 
                y: window.innerHeight - 400 
              })
            }}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              width: '24px',
              height: '24px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px'
            }}
            title="重置位置"
          >
            ⟲
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      {!isMinimized && (
        <div style={{ 
          maxHeight: '350px', 
          overflowY: 'auto',
          background: 'white'
        }}>
          <ApiMonitor {...props} />
        </div>
      )}
    </div>
  )
}

export default DraggableApiMonitor