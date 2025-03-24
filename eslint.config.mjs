/* eslint-disable import/no-extraneous-dependencies */

import node from 'eslint-plugin-node';
import promise from 'eslint-plugin-promise';
import proposal from 'eslint-plugin-proposal';
import es from 'eslint-plugin-es';
import impprtRules from 'eslint-plugin-import';
import { fixupPluginRules } from '@eslint/compat';
import globals from 'globals';
import babelParser from '@babel/eslint-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [
  {
    ignores: ['**/public/', '**/node_modules/', '**/bin/']
  },
  ...compat.extends(
    'eslint:recommended',
    'plugin:proposal/recommended',
    'airbnb-base',
    'plugin:prettier/recommended'
  ),
  {
    plugins: {
      es: fixupPluginRules(es),
      impprtRules,
      node: fixupPluginRules(node),
      promise,
      proposal
    },

    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.commonjs,
        ...globals.jquery,
        ...globals.node,
        document: 'readonly',
        navigator: 'readonly',
        window: 'readonly',
        _: true
      },

      parser: babelParser,
      ecmaVersion: 2020,
      sourceType: 'module',

      parserOptions: {
        requireConfigFile: false,
        babelOptions: {}
      }
    },

    rules: {
      'accessor-pairs': 'error',
      camelcase: 'off',
      'constructor-super': 'error',
      'dot-notation': [
        'error',
        {
          allowKeywords: true
        }
      ],
      eqeqeq: [
        'error',
        'always',
        {
          null: 'ignore'
        }
      ],
      'handle-callback-err': ['error', '^(err|error)$'],
      'implicit-arrow-linebreak': 'off',
      'lines-between-class-members': [
        'error',
        'always',
        {
          exceptAfterSingleLine: true
        }
      ],
      'new-cap': [
        'error',
        {
          newIsCap: true,
          capIsNew: false,
          properties: true
        }
      ],
      'no-array-constructor': 'error',
      'no-async-promise-executor': 'error',
      'no-caller': 'error',
      'no-case-declarations': 'error',
      'no-class-assign': 'error',
      'no-compare-neg-zero': 'error',
      'no-cond-assign': 'error',
      'no-console': 'warn',
      'no-const-assign': 'error',
      'no-constant-condition': [
        'error',
        {
          checkLoops: false
        }
      ],
      'no-control-regex': 'error',
      'no-debugger': 'error',
      'no-delete-var': 'error',
      'no-dupe-args': 'error',
      'no-dupe-class-members': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-empty-character-class': 'error',
      'no-empty-pattern': 'error',
      'no-eval': 'error',
      'no-ex-assign': 'error',
      'no-extend-native': 'error',
      'no-extra-bind': 'error',
      'no-extra-boolean-cast': 'error',
      'no-fallthrough': 'error',
      'no-func-assign': 'error',
      'no-global-assign': 'error',
      'no-implied-eval': 'error',
      'no-inner-declarations': ['error', 'functions'],
      'no-invalid-regexp': 'error',
      'no-irregular-whitespace': 'error',
      'no-iterator': 'error',
      'no-labels': [
        'error',
        {
          allowLoop: false,
          allowSwitch: false
        }
      ],
      'no-lone-blocks': 'error',
      'no-misleading-character-class': 'error',
      'no-multi-str': 'error',
      'no-negated-in-lhs': 'error',
      'no-new': 'error',
      'no-new-func': 'error',
      'no-new-object': 'error',
      'no-new-require': 'error',
      'no-new-symbol': 'error',
      'no-new-wrappers': 'error',
      'no-obj-calls': 'error',
      'no-octal': 'error',
      'no-octal-escape': 'error',
      'no-param-reassign': 'off',
      'no-path-concat': 'error',
      'no-proto': 'error',
      'no-prototype-builtins': 'error',
      'no-redeclare': [
        'error',
        {
          builtinGlobals: false
        }
      ],
      'no-regex-spaces': 'error',
      'no-return-assign': ['error', 'except-parens'],
      'no-return-await': 'error',
      'no-self-assign': [
        'error',
        {
          props: true
        }
      ],
      'no-self-compare': 'error',
      'no-sequences': 'error',
      'no-shadow': 'off',
      'no-shadow-restricted-names': 'error',
      'no-sparse-arrays': 'error',
      // the following setting is designed to allow this rule to work regardless if prettier is using spaces or tabs
      'no-tabs': ['error', { allowIndentationTabs: true }],
      'no-template-curly-in-string': 'error',
      'no-this-before-super': 'error',
      'no-throw-literal': 'error',
      'no-undef': 'error',
      'no-undef-init': 'error',
      'no-underscore-dangle': 'off',
      'no-unmodified-loop-condition': 'error',
      'no-unneeded-ternary': [
        'error',
        {
          defaultAssignment: false
        }
      ],
      'no-unreachable': 'error',
      'no-unsafe-finally': 'error',
      'no-unsafe-negation': 'error',
      'no-unused-expressions': [
        'error',
        {
          allowShortCircuit: true,
          allowTernary: true,
          allowTaggedTemplates: true
        }
      ],
      'no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'none',
          ignoreRestSiblings: true
        }
      ],
      'no-use-before-define': [
        'error',
        {
          functions: false,
          classes: false,
          variables: false
        }
      ],
      'no-useless-call': 'error',
      'no-useless-catch': 'error',
      'no-useless-computed-key': 'error',
      'no-useless-constructor': 'error',
      'no-useless-escape': 'error',
      'no-useless-rename': 'error',
      'no-useless-return': 'error',
      'no-void': 'error',
      'no-with': 'error',
      'one-var': [
        'error',
        {
          initialized: 'never'
        }
      ],
      'prefer-const': [
        'error',
        {
          destructuring: 'all'
        }
      ],
      'prefer-promise-reject-errors': 'error',
      'spaced-comment': [
        'error',
        'always',
        {
          line: {
            markers: ['*package', '!', '/', ',', '=']
          },
          block: {
            balanced: true,
            markers: ['*package', '!', ',', ':', '::', 'flow-include'],
            exceptions: ['*']
          }
        }
      ],
      'symbol-description': 'error',
      'unicode-bom': ['error', 'never'],
      'use-isnan': 'error',
      'valid-typeof': [
        'error',
        {
          requireStringLiterals: true
        }
      ],
      yoda: ['error', 'never'],
      'es/no-async-iteration': 'error',
      'es/no-malformed-template-literals': 'error',
      'es/no-regexp-lookbehind-assertions': 'error',
      'es/no-regexp-named-capture-groups': 'error',
      'es/no-regexp-s-flag': 'error',
      'es/no-regexp-unicode-property-escapes': 'error',
      'import/export': 'error',
      'import/first': 'error',
      'import/no-absolute-path': [
        'error',
        {
          esmodule: true,
          commonjs: true,
          amd: false
        }
      ],
      'import/no-duplicates': 'error',
      'import/no-named-default': 'error',
      'import/no-webpack-loader-syntax': 'error',
      'node/no-deprecated-api': 'error',
      'node/process-exit-as-throw': 'error',
      'promise/param-names': 'error'
    }
  }
];
