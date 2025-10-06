import { AbstractGitCliHandler } from "./AbstractGitCliHandler";

export class GitFetchCliHandler extends AbstractGitCliHandler{
    getCommand(): string {
        return `git -C ${this.localPath} fetch ${this.flags}`
    }
}