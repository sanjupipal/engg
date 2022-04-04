export interface createGroup {
  name: string
  number_of_weeks: number
  roll_states: string
  incidents: number
  ltmt: string
}

export interface UpdateGroupInput {
  name: string
  number_of_weeks: number
  roll_states: string
  incidents: number
  ltmt: string
}

export interface metaDataInput {
  run_at: Date
  student_count: number
}
