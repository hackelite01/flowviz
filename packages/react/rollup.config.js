import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/index.ts',
  output: [
    { file: 'dist/index.esm.js', format: 'esm', sourcemap: true },
    { file: 'dist/index.cjs.js', format: 'cjs', sourcemap: true, exports: 'named' },
  ],
  external: ['react', 'react-dom', 'react/jsx-runtime', '@flowviz/core', 'd3-force'],
  plugins: [
    resolve(),
    typescript({
      tsconfig: './tsconfig.json',
    }),
  ],
};
