export interface GitlabGroupDTO {
    id: number
    path: string
    full_path: string
    parent_id: number | null
    name: string
}
