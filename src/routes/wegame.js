const express = require('express')
const router = express.Router()

const { getQrSig, getAction, getAccessToken, gift } = require('../controllers/wegameController')

router.get('/sig', getQrSig)
router.get('/status', getAction)
router.post('/access', getAccessToken)
router.get('/access', getAccessToken)
router.post('/gift', gift)
router.get('/gift', gift)

module.exports = router
