import { exec } from 'node:child_process'
import { ExecException } from "child_process"

export abstract class AbstractGitCliHandler {
    protected flags: string
    protected localPath: string

    constructor(localPath: string, flags: string) {
        this.localPath = localPath
        this.flags = flags
    }

    async execute() {
        return new Promise<boolean>((resolve, reject): void => {
            exec(
                this.getCommand(),
                {  },
                (error: ExecException | null, stdout: string, stderr: string) => {
                    if (error)
                        return reject({ error: error, stdout: stdout, stderr: stderr })

                    resolve(true)
                }
            )
        })
    }

    abstract getCommand(): string

}