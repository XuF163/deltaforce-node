const express = require('express')
const router = express.Router()

const qqRoutes = require('./qq')
const wechatRoutes = require('./wechat')
const qqsafeRoutes = require('./qqsafe')
const wegameRoutes = require('./wegame')
const gameRoutes = require('./game')

router.use('/qq', qqRoutes)
router.use('/wechat', wechatRoutes)
router.use('/qqsafe', qqsafeRoutes)
router.use('/wegame', wegameRoutes)
router.use('/game', gameRoutes)

module.exports = router
