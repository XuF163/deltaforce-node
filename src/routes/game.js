const express = require('express')
const router = express.Router()
const {
  record,
  player,
  config,
  items,
  price,
  assets,
  logs,
  recent,
  achievement,
  password,
  manufacture,
  guns,
  bind
} = require('../controllers/gameController')

router.get('/record', record)
router.get('/player', player)
router.get('/config', config)
router.get('/items', items)
router.get('/price', price)
router.get('/assets', assets)
router.get('/logs', logs)
router.get('/recent', recent)
router.get('/achievement', achievement)
router.get('/password', password)
router.get('/manufacture', manufacture)
router.get('/guns', guns)
router.get('/bind', bind)
router.post('/record', record)
router.post('/player', player)
router.post('/config', config)
router.post('/items', items)
router.post('/price', price)
router.post('/assets', assets)
router.post('/logs', logs)
router.post('/recent', recent)
router.post('/achievement', achievement)
router.post('/password', password)
router.post('/manufacture', manufacture)
router.post('/guns', guns)
router.post('/bind', bind)

module.exports = router
