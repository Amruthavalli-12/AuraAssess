const r = require('express').Router();

const c = require('../controllers/authController');

r.post('/login', c.login);

r.post('/create-password', c.createPassword);

r.post('/forgot-password', c.forgot);

r.post('/reset-password', c.reset);

r.post('/logout', c.logout);

module.exports = r;