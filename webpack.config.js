import path from 'node:path';
import ESLintLoader from 'eslint-webpack-plugin';
import NodemonPlugin from 'nodemon-webpack-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import NodeExternals from 'webpack-node-externals';

export default {
  entry: ['./'],
  target: 'node',
  output: {
    filename: 'server.js',
    path: path.resolve(import.meta.dirname, 'bin'),
    publicPath: '/bin/'
  },
  externals: [NodeExternals()],
  devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.(m|c)?(js)$/,
        exclude: /node_modules/,
        use: ['babel-loader']
      }
    ]
  },
  optimization: {
    minimize: process.env.ENV !== 'local',
    minimizer: [
      new TerserPlugin({
        test: /\.(m|c)?(js)$/,
        extractComments: true,
        terserOptions: {
          compress: {
            ecma: '2024',
            drop_console: process.env.ENV === 'prod'
          }
        }
      })
    ]
  },
  plugins: [
    new ESLintLoader({
      fix: true,
      files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
      configType: 'flat'
    }),
    new NodemonPlugin({
      // If using more than one entry, you can specify
      // which output file will be restarted.
      script: './bin/server.js',

      // What to watch.
      watch: path.resolve('./bin'),

      // Arguments to pass to the script being watched.
      args: ['demo'],

      // Node arguments.
      // nodeArgs: ['--debug=9222'],

      // Files to ignore.
      ignore: ['*.js.map'],

      // Extensions to watch.
      ext: 'js,njk,json,mjs,cjs',

      // Unlike the cli option, delay here is in milliseconds (also note that it's a string).
      // Here's 1 second delay:
      delay: '1000',

      // Detailed log.
      verbose: true,

      // Environment variables to pass to the script to be restarted
      env: {
        NODE_ENV: 'development'
      },

      nodemonConfig: {
        legacyWatch: true
      }
    })
  ],
  resolve: {
    extensions: ['*', '.js', '.mjs', '.cjs']
  }
};
