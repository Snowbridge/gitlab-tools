import { AbstractGitCliHandler } from "./AbstractGitCliHandler";

export class GitFetchCliHandler extends AbstractGitCliHandler{
    getCommand(): string {
        return `git fetch ${this.flags}`
    }
}