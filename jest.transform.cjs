const tsJest = require("ts-jest");

// Jest expects the transformer module itself to expose createTransformer/process.
// ts-jest exposes it on the default export in this version.
module.exports = tsJest.default ?? tsJest;
