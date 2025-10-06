import { AbstractGitCliHandler } from "./AbstractGitCliHandler";

export class GitPullCliHandler extends AbstractGitCliHandler {

    getCommand(): string {
        return `git -C ${this.localPath} pull ${this.flags}`
    }

}