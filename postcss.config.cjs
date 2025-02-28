module.exports = {
  plugins: [
    require('postcss-discard-comments')({
      removeAll: false
    }),
    require('postcss-import'),
    require('postcss-nesting'),
    // require('tailwindcss/nesting'),
    require('@tailwindcss/postcss'),
    require('autoprefixer'),
    require('cssnano')({
      preset: [
        'default',
        {
          discardComments: {
            removeAll: false
          }
        }
      ]
    }),
  ],
};
