// Runs once after all test suites. Nothing to clean up globally —
// each test file truncates its own tables in afterEach/afterAll.
module.exports = async () => {};
