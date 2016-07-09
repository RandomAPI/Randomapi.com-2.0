const express  = require('express');
const _        = require('lodash');
const fs       = require('fs');
const router   = express.Router();
const settings = require('../settings.json');
const logger   = require('../utils').logger;
const multer   = require('multer');
const crypto   = require('crypto');
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, './uploads/')
  },
  filename(req, file, cb) {
    crypto.pseudoRandomBytes(16, (err, raw) => {
      cb(null, raw.toString('hex') + Date.now());
    });
  }
});
const upload = multer({ storage: storage });

const API  = require('../models/API');
const User  = require('../models/User');
const List = require('../models/List');
const Snippet = require('../models/Snippet');

// Setup defaultVars and baseURL for all routes
let defaultVars, baseURL;
router.all('*', (req, res, next) => {
  defaultVars = req.app.get('defaultVars');
  baseURL     = req.app.get('baseURL');
  if (!req.session.loggedin) {
    res.redirect(baseURL + '/');
  } else {
    next();
  }
});

router.get('/api/:ref?', (req, res, next) => {
  if (req.session.subscription.status !== 3) {
    API.getCond({ref: req.params.ref}).then(doc => {
      if (doc.owner !== req.session.user.id) {
        res.redirect(baseURL + '/view/api');
      } else {
        doc.code = fs.readFileSync('./data/apis/' + doc.id + '.api'); // Read api src into this...
        res.render('edit/api', _.merge(defaultVars, {api: doc, socket: ':' + settings.general.socket, title: `Edit API ${doc.name} [${doc.ref}]`}));
      }
    }).catch(err => {
      res.redirect(baseURL + '/view/api');
    });
  } else {
    if (req.session.subscription.status === 3) {
      res.redirect(baseURL + '/settings/subscription/paymentOverdue');
    } else {
      res.redirect(baseURL + '/');
    }
  }
});

router.post('/api/:ref', (req, res, next) => {
  if (req.session.subscription.status !== 3) {
    API.getCond({ref: req.params.ref}).then(doc => {
      if (doc.owner !== req.session.user.id) {
        res.send(baseURL + '/view/api');
      } else {
        let name = req.body.rename;
        if (name === undefined || name === "") name = doc.name;
        if (name.match(/^[a-zA-Z0-9 _\-\.+\[\]\{\}\(\)]{1,32}$/) === null) {
          req.flash('warning', 'Only 32 chars max please! Accepted chars: a-Z0-9 _-.+[]{}()');
          res.send(baseURL + '/edit/api/' + req.params.ref);
        } else {
          API.update({name}, doc.ref).then(() => {
            fs.writeFile('./data/apis/' + doc.id + '.api', req.body.code.replace(/\r\n/g, '\n').slice(0, 8192), 'utf8', err => {
              req.flash('info', `API ${name} [${doc.ref}] was updated successfully!`);
              res.send(baseURL + '/view/api');
            });
          });
        }
      }
    });
  } else {
    if (req.session.subscription.status === 3) {
      res.send(baseURL + '/settings/subscription/paymentOverdue');
    } else {
      res.send(baseURL + '/');
    }
  }
});

// list //
router.get('/list/:ref', (req, res, next) => {
  if (req.session.subscription.status !== 3) {
    List.getCond({ref: req.params.ref}).then(doc => {
      res.render('edit/list', _.merge(defaultVars, {list: doc, title: `Editing list ${doc.name} [${doc.ref}]`}));
    });
  } else {
    if (req.session.subscription.status === 3) {
      res.redirect(baseURL + '/settings/subscription/paymentOverdue');
    } else {
      res.redirect(baseURL + '/');
    }
  }
});

router.post('/list/:ref', upload.any(), (req, res, next) => {
  if (req.session.subscription.status !== 3) {
    List.getCond({ref: req.params.ref}).then(doc => {

      if (doc.owner !== req.session.user.id) {
        res.send(baseURL + '/view/list');

      } else if (req.files.length !== 0 && req.files[0].originalname.match(/(?:\.([^.]+))?$/)[1] !== 'txt') {
        req.flash('warning', 'Looks like you provided an invalid file...please try again.');
        fs.unlink('./'+ req.files[0].path);
        res.send(baseURL + '/edit/list/' + req.params.ref);

      // Is user within their tier limits?
      } else if (req.files.length !== 0 && req.session.user.memory - doc.memory + req.files[0].size > req.session.tier.memory && req.session.tier.memory !== 0) {
        req.flash('warning', 'Replacing this list would go over your List quota for the ' + req.session.tier.name + ' tier.');
        fs.unlink('./'+ req.files[0].path);
        res.send(baseURL + '/edit/list/' + req.params.ref);

      } else {
        let name = req.body.rename;
        if (name === undefined || name === "") name = doc.name;
        if (name.match(/^[a-zA-Z0-9 _\-\.+\[\]\{\}\(\)]{1,32}$/) === null) {
          req.flash('warning', 'Only 32 chars max please! Accepted chars: a-Z0-9 _-.+[]{}()');
          res.send(baseURL + '/view/api/' + req.params.ref);
        } else if (req.files.length === 0) {
          List.update({name}, doc.ref).then((asdf) => {
            req.flash('info', `List ${name} [${doc.ref}] was updated successfully!`);
            res.send(baseURL + '/view/list');
          });
        } else {
          List.update({name, memory: req.files[0].size}, doc.ref).then(() => {
            fs.rename('./'+ req.files[0].path, './data/lists/' + doc.id + '.list', err => {
              let newSize = req.files[0].size;
              let oldSize = doc.memory;

              User.incVal('memory', newSize-oldSize, req.session.user.username).then(() => {
                req.flash('info', `List ${name} [${doc.ref}] was updated successfully!`);
                res.send(baseURL + '/view/list');
              });
            });
          });
        }
      }
    });
  } else {
    if (req.session.subscription.status === 3) {
      res.send(baseURL + '/settings/subscription/paymentOverdue');
    } else {
      res.send(baseURL + '/');
    }
  }
});

// Snippets
router.get('/snippet/:ref?', (req, res, next) => {
  if (req.session.subscription.status !== 3) {
    Snippet.getCond({ref: req.params.ref}).then(doc => {
      if (doc.owner !== req.session.user.id) {
        res.redirect(baseURL + '/view/snippet');
      } else {
        doc.code = fs.readFileSync('./data/snippets/' + doc.id + '.snippet'); // Read snippet src into this...
        res.render('edit/snippet', _.merge(defaultVars, {snippet: doc, socket: ':' + settings.general.socket, title: `Edit Snippet ${doc.name}`}));
      }
    }).catch(err => {
      res.redirect(baseURL + '/view/snippet');
    });
  } else {
    if (req.session.subscription.status === 3) {
      res.redirect(baseURL + '/settings/subscription/paymentOverdue');
    } else {
      res.redirect(baseURL + '/');
    }
  }
});

router.post('/snippet/:ref', (req, res, next) => {
  if (req.session.subscription.status !== 3) {
    Snippet.getCond({ref: req.params.ref}).then(doc => {
      if (doc.owner !== req.session.user.id) {
        res.send(baseURL + '/view/snippet');
      } else {
        let name = req.body.rename;
        if (name === undefined || name === "") name = doc.name;
        if (name.match(/^[a-zA-Z0-9 _\-\.+\[\]\{\}\(\)]{1,32}$/) === null) {
          req.flash('warning', 'Only 32 chars max please! Accepted chars: a-Z0-9 _-.+[]{}()');
          res.send(baseURL + '/edit/snippet/' + req.params.ref);
        } else {
          Snippet.update({name}, doc.ref).then(() => {
            fs.writeFile('./data/snippets/' + doc.id + '.snippet', req.body.code.replace(/\r\n/g, '\n').slice(0, 8192), 'utf8', err => {
              req.flash('info', `Snippet ${name} was updated successfully!`);
              res.send(baseURL + '/view/snippet');
            });
          });
        }
      }
    });
  } else {
    if (req.session.subscription.status === 3) {
      res.send(baseURL + '/settings/subscription/paymentOverdue');
    } else {
      res.send(baseURL + '/');
    }
  }
});

module.exports = router;
