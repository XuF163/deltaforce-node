const express = require('express')
const router = express.Router()

const { getQrSig, getAction, getAccessToken, bannedList } = require('../controllers/qqsafeController')

router.get('/sig', getQrSig)
router.post('/sig', getQrSig)
router.get('/status', getAction)
router.post('/status', getAction)
router.post('/access', getAccessToken)
router.get('/access', getAccessToken)

router.get('/bannedList', bannedList)
router.post('/bannedList', bannedList)

module.exports = router
