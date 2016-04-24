var express  = require('express');
var fs       = require('fs');
var router   = express.Router();

var views;
fs.readdir('.viewsMin/pages/view', function(err, data) {;
  views = data;
});

var titles = {
  home: 'Home',
  index: 'Home',
  login: 'Login',
  register: 'Register'
};

// api //
router.get('/api', function(req, res, next) {
  if (req.session.loggedin) {
    API.getAPIs(req.session.user.id, function(err, apis) {
      res.render('view/api', _.merge(defaultVars, {apis}));
    });
  } else {
    res.render('index', defaultVars);
  }
});


// list //
router.get('/list', function(req, res, next) {
  if (req.session.loggedin) {
    List.getLists(req.session.user.id, function(err, lists) {
      res.render('view/list', _.merge(defaultVars, {lists}));
    });
  } else {
    res.render('index', defaultVars);
  }
});

module.exports = router;
