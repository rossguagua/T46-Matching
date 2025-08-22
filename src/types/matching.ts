// 匹配相关的类型定义

export interface UserData {
  姓名?: string
  性别?: string
  年龄?: number
  兴趣爱好?: string
  职业?: string
  城市?: string
  自选昵称?: string
  [key: string]: any
}

export interface Group {
  id: string
  name: string
  members: UserData[]
  description: string
  compatibility_score?: number
}

export interface MatchingResult {
  groups: Group[]
  unassigned: UserData[]
  overall_score: number
  strategy: string
}

export interface GroupStats {
  total: number
  males: number
  females: number
  avgAge: number
  ageGap: number
  genderBalance: string
  isBalanced: boolean
  isFull: boolean
  isEmpty: boolean
}

export interface DragDropState {
  isDragging: boolean
  draggedUser: UserData | null
  sourceGroup: string | null
  targetGroup: string | null
}