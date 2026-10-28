const r = require('express').Router();
const c = require('../controllers/adminController');
const crud = (path, h) => {
  r.get(path, h.list);
  r.post(path, h.create);
  if (h.one) r.get(path + '/:id', h.one);
  r.put(path + '/:id', h.update);
  r.delete(path + '/:id', h.remove);
};
crud('/teachers', c.teachers);
crud('/students', c.students);
crud('/subjects', c.subjects);
r.get('/performance', c.performance);
r.get('/stats', c.stats);
module.exports = r;
