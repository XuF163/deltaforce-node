const express = require('express')
const router = express.Router()

const { getQrSig, getAction, getAccessToken } = require('../controllers/qqController')

router.get('/sig', getQrSig)
router.post('/sig', getQrSig)
router.get('/status', getAction)
router.post('/status', getAction)
router.post('/access', getAccessToken)
router.get('/access', getAccessToken)

module.exports = router
