// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    rules: {
      'vue/multi-word-component-names': 'off',
      'no-console': 'warn',
      'vue/no-unused-components': 'warn',
    },
  },
  {
    ignores: [
      'dist/**',
      '.nuxt/**',
      '.output/**',
      'node_modules/**',
      '.nitro/**',
      'coverage/**'
    ]
  }
)
