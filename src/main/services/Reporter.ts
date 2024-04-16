import * as fs from "fs"
import { ProjectDTO } from "../common/DTO/Project"

export class Reporter {
    private target: 'json' | 'console'
    private projects: ProjectDTO[]

    constructor(projects: ProjectDTO[], target: 'json' | 'console') {
        this.target = target
        this.projects = projects
    }

    generateReport() {
        switch (this.target) {
            case 'console':
                return this.generateConsoleReport()
            case 'json':
                return this.generaJsonReport()
        }
    }
    private generateConsoleReport() {
        console.log('{  id  }\t{  path  }\t{  topics  }')
        for (let project of this.projects) {
            console.log(`${project.id}\t${project.path_with_namespace}\t${project.topics.join(',')}`)
        }
    }

    private generaJsonReport() {
        fs.writeFileSync(`gitlab-tools-report-${new Date().toISOString().replaceAll(':', '-')}.json`, JSON.stringify(this.projects), 'utf-8')
    }
}