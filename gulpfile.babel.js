import gulp from 'gulp'
import fs from 'fs'
import path from 'path'
import {merge} from 'event-stream'
import map from 'map-stream'
import {spawn} from 'child_process'
const $ = require('gulp-load-plugins')()

// Tasks
gulp.task('clean', () => {
  return pipe('./tmp', $.clean())
})

gulp.task('static',
  () => gulp.src('src/static/*')
    .pipe(gulp.dest('tmp/chrome/static'))
)

gulp.task('build', (cb) => {
  $.runSequence('clean', 'styles', 'chrome', 'static', cb)
})

gulp.task('default', ['build'], () => {
  gulp.watch(['./libs/**/*', './src/**/*'], ['default'])
})

gulp.task('dist', ['build'], (cb) => {
  $.runSequence('chrome:zip', cb)
})

gulp.task('test', ['build'], (cb) => {
  const ps = spawn(
    './node_modules/.bin/mocha',
    ['--harmony', '--reporter', 'spec', '--bail', '--recursive', '--timeout', '-1']
  )
  ps.stdout.pipe(process.stdout);
  ps.stderr.pipe(process.stderr);
  ps.on('close', cb)
})

gulp.task('styles', () => {
  return pipe(
    './src/styles/octotree.less',
    $.plumber(),
    $.less({relativeUrls: true}),
    $.autoprefixer({cascade: true}),
    './tmp'
  )
})

gulp.task('lib:ondemand', (cb) => {
  const dir = './libs/ondemand'
  const code = fs.readdirSync(dir).map(file => {
    return `window['${file}'] = function () {
      ${fs.readFileSync(path.join(dir, file))}
    };\n`
  }).join('')

  fs.writeFileSync('./tmp/ondemand.js', code)

  cb()
})

// Chrome
gulp.task('chrome:template', () => {
  return buildTemplate({CHROME: true})
})

gulp.task('chrome:js', ['chrome:template', 'lib:ondemand'], () => {
  return buildJs(['./src/config/chrome/overrides.js'], {CHROME: true})
})

gulp.task('chrome', ['chrome:js'], () => {
  return merge(
    pipe('./icons/**/*', './tmp/chrome/icons'),
    pipe('./fonts/**/*', './tmp/chrome/fonts'),
    pipe(['./libs/**/*', '!./libs/ondemand{,/**}', './tmp/octotree.*', './tmp/ondemand.js', './src/config/chrome/manifest.json'], './tmp/chrome/'),
    pipe('./src/config/chrome/background.js', $.babel(), './tmp/chrome/')
  )
})

gulp.task('chrome:zip', () => {
  return pipe('./tmp/chrome/**/*', $.zip('chrome.zip'), './dist')
})

// Helpers
function pipe(src, ...transforms) {
  return transforms.reduce((stream, transform) => {
    const isDest = typeof transform === 'string'
    return stream.pipe(isDest ? gulp.dest(transform) : transform)
  }, gulp.src(src))
}

function html2js(template) {
  return map(escape)

  function escape(file, cb) {
    const path = $.util.replaceExtension(file.path, '.js')
    const content = file.contents.toString()
    const escaped = content
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\r?\n/g, "\\n' +\n    '")
    const body = template.replace('$$', escaped)

    file.path = path
    file.contents = new Buffer(body)
    cb(null, file)
  }
}

function buildJs(overrides, ctx) {
  const src = [
    './tmp/template.js',
    './src/constants.js',
    './src/adapters/adapter.js',
    './src/adapters/gitlab.js',
    './src/view.help.js',
    './src/view.error.js',
    './src/view.tree.js',
    './src/view.options.js',
    './src/util.location.js',
    './src/util.module.js',
    './src/util.async.js',
    './src/util.storage.js'
  ].concat(overrides)
   .concat('./src/octotree.js')

  return pipe(
    src,
    $.babel(),
    $.concat('octotree.js'),
    $.preprocess({context: ctx}),
    './tmp'
  )
}

function buildTemplate(ctx) {
  const LOTS_OF_SPACES = new Array(500).join(' ')

  return pipe(
    './src/template.html',
    $.preprocess({context: ctx}),
    $.replace('__SPACES__', LOTS_OF_SPACES),
    html2js('const TEMPLATE = \'$$\''),
    './tmp'
  )
}
