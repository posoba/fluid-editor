module.exports = Object.freeze({
	root: true,
	parser: '@typescript-eslint/parser',
	plugins: ['@typescript-eslint'],
	overrides: [
	  {
		files: ['*.ts', '*.tsx'],
		parserOptions: {
		  project: ['./tsconfig.json'],
		},
		extends: [
		  'eslint:recommended',
		  'plugin:@typescript-eslint/eslint-recommended',
		  'plugin:@typescript-eslint/recommended',
		],
		rules: {
		  '@typescript-eslint/explicit-member-accessibility': 'error',
		  '@typescript-eslint/member-ordering': 'error',
		  '@typescript-eslint/consistent-type-exports': 'error',
		  '@typescript-eslint/consistent-type-imports': 'error',
		  '@typescript-eslint/explicit-module-boundary-types': 'error',
		  '@typescript-eslint/consistent-indexed-object-style': 'error',
		  '@typescript-eslint/no-duplicate-enum-values': 'error',
		  '@typescript-eslint/no-duplicate-imports': 'error',
		  '@typescript-eslint/no-explicit-any': 'error',
		  '@typescript-eslint/no-empty-function': 'off',
		},
	  },
	],
  })