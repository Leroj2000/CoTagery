/**
 * Jest pro @tagery/web. Cílí jen na čisté (browser-independent) moduly tiskové
 * vrstvy – Bluetooth/canvas se v testech nespouští, mockuje se přes `measure`
 * callbacky a přímé volání reduceru. Node prostředí stačí.
 *
 * Vlastní tsconfig (`tsconfig.jest.json`) přepíná `jsx` a `noEmit`, aby ts-jest
 * mohl moduly zkompilovat nezávisle na Next.js buildu.
 */
/** @type {import('jest').Config} */
module.exports = {
  rootDir: 'app',
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/../tsconfig.jest.json',
      },
    ],
  },
};
