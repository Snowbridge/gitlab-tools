function createSpinner() {
    return {
        start: function start() {
            return this
        },
        succeed: function succeed() {},
        fail: function fail() {},
        stop: function stop() {},
    }
}

const ora = jest.fn(() => createSpinner())
ora.default = ora

module.exports = ora
