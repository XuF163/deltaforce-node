const express = require('express')
const router = express.Router()

const { login, status, getAccessToken } = require('../controllers/wechatController')

router.get('/login', login)
router.post('/login', login)
router.get('/status', status)
router.post('/status', status)
router.get('/access', getAccessToken)
router.post('/access', getAccessToken)

module.exports = router
