var gulp    = require('gulp');
var mocha   = require('gulp-mocha');
var uglify  = require('gulp-uglifyjs');
var concat  = require('gulp-concat');
var ejsmin  = require('gulp-ejsmin');
var through = require('through2')

gulp.task('minify-ejs-pages', () => {
  // Save the pre tag contents
  var preLocs = [];

  return gulp.src(['views/pages/*.ejs', 'views/pages/**/*.ejs'])
    .pipe(through.obj((chunk, enc, cb) => {
      var contents = chunk.contents.toString('utf8');
      var preMatches = contents.match(/<pre>((?:.|\n)*?)<\/pre>/g);

      if (preMatches) {
        preMatches.forEach(match => {
          preLocs.push(match);
          contents = contents.replace(match, 'PRE_MATCH_' + (preLocs.length-1));
        });
        chunk.contents = new Buffer(contents, 'utf8');
      }

      cb(null, chunk)
    }))
    .pipe(ejsmin())
    .pipe(through.obj((chunk, enc, cb) => {
      var contents = chunk.contents.toString('utf8');
      var search = new RegExp(/PRE_MATCH_(\d+)/g);
      var match  = search.exec(contents);

      while (match != null) {
        contents = contents.replace('PRE_MATCH_' + match[1], preLocs[match[1]]);
        match = search.exec(contents);
      }

      chunk.contents = new Buffer(contents, 'utf8');
      cb(null, chunk)
    }))
    .pipe(gulp.dest('.viewsMin/pages'))
});

gulp.task('minify-ejs-snippets', () => {
  return gulp.src('views/snippets/*.ejs')
    .pipe(ejsmin())
    .pipe(gulp.dest('.viewsMin/snippets'))
});

gulp.task('testEnv', () => {
    return process.env.spec = true;
});

gulp.task('default', ['minify-ejs-pages', 'minify-ejs-snippets']);
