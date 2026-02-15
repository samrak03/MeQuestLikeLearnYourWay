
export default {
    transform: {},
    testEnvironment: 'node',
    verbose: true,
    moduleFileExtensions: ['js', 'json', 'node'],
    roots: ['<rootDir>/tests'],
    // Handle ES modules if necessary (depends on node version, usually transform: {} is enough for recent jest)
};
