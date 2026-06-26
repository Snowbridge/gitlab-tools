export function gitPushOutputIndicatesTransfer(output: string): boolean {
    return /->|\[new branch\]|\[new tag\]|\[deleted\]/i.test(output)
}
