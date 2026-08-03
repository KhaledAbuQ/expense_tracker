module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', 'node_modules', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    // Allow intentionally-discarded bindings, e.g. stripping member_id out of a
    // form payload via `const { member_id: _ignored, ...rest } = data`.
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      },
    ],
  },
  overrides: [
    {
      // Context modules intentionally export a provider component alongside its
      // hook. That costs fast-refresh granularity in this one file and is the
      // conventional shape for the pattern.
      files: ['src/context/*.tsx'],
      rules: { 'react-refresh/only-export-components': 'off' },
    },
  ],
}
