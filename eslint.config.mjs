import astro from 'eslint-plugin-astro';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default [
  ...astro.configs['flat/recommended'],
  {
    files: ['**/*.{jsx,tsx}'],
    ...react.configs.flat.recommended,
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.flat.recommended.rules,
      // React 17+ automatic JSX runtime: React import is not required.
      'react/react-in-jsx-scope': 'off',
      // Props are documented via JSDoc and passed from Astro; PropTypes are
      // intentionally not used in this project.
      'react/prop-types': 'off'
    }
  },
  {
    files: ['**/*.{jsx,tsx}'],
    ...reactHooks.configs.flat['recommended-latest']
  },
  {
    ignores: ['dist/', '.astro/', 'node_modules/']
  },
  prettier
];
