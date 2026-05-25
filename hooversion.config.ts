export default {
  branches: ["main"],
  packages: [
    {
      name: "@openhoo/mouserhoo",
      path: ".",
      type: "node",
      manifest: "package.json",
      changelog: "CHANGELOG.md",
      scopes: ["@openhoo/mouserhoo", "mouserhoo"],
      dependencies: [],
    },
  ],
  hooks: {
    afterVersion: ["bun install --lockfile-only --ignore-scripts"],
  },
  github: {
    releases: true,
  },
};
