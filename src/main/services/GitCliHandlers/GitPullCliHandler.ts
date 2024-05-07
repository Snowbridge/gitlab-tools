import { AbstractGitCliHandler } from "./AbstractGitCliHandler";

export class GitPullCliHandler extends AbstractGitCliHandler {

    getCommand(): string {
        return `git pull ${this.flags} ${this.localPath}`
    }

}