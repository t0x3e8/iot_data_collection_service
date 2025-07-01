import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser
      }
    },
    rules: {
      // Error rules - these will cause linting to fail
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      'no-console': 'off', // Allow console.log for server applications
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      'no-unreachable': 'error',
      'no-undef': 'error',
      'no-redeclare': 'error',

      // Warning rules - these will show warnings but won't fail build
      'prefer-const': 'warn',
      'no-var': 'warn',
      'prefer-arrow-callback': 'warn',
      'prefer-template': 'warn',

      // Style rules
      'indent': ['warn', 2, { SwitchCase: 1 }],
      'quotes': ['warn', 'single', { allowTemplateLiterals: true }],
      'semi': ['warn', 'always'],
      'comma-dangle': ['warn', 'never'],
      'object-curly-spacing': ['warn', 'always'],
      'array-bracket-spacing': ['warn', 'never'],
      'space-before-blocks': 'warn',
      'keyword-spacing': 'warn',
      'space-infix-ops': 'warn',
      'eol-last': 'warn',
      'no-trailing-spaces': 'warn',
      'no-multiple-empty-lines': ['warn', { max: 2, maxEOF: 1 }],

      // Best practices
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-return-assign': 'error',
      'no-self-compare': 'error',
      'no-throw-literal': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-useless-call': 'error',
      'no-useless-return': 'error'
    }
  },
  {
    // Specific rules for browser/frontend files
    files: ['public/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        fetch: 'readonly',
        console: 'readonly'
      }
    },
    rules: {
      'no-undef': 'error'
    }
  },
  {
    files: ['**tests//setup.js', '**/testSetup.js'],
    languageOptions: {
      globals: {
        ...globals.jest
      }
    }
  },
  {
    // Ignore certain files
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '.nyc_output/**',
      'logs/**',
      '*.min.js'
    ]
  }
];
