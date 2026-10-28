const r = require('express').Router();
const c = require('../controllers/profileController');
r.get('/', c.get);
r.put('/', c.update);
r.post('/photo', c.photo);
r.put('/password', c.password);
r.get('/notifications', c.notifications);
module.exports = r;
