import { GitlabProjectDTO } from "./Gitlab/ProjectDTO";

export interface ProjectDTO extends GitlabProjectDTO{
    yamlMetadata:{
        hasMetadata:boolean
        content:Record<string,any>
        text:string
    }
}