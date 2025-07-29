const axios = require('axios')
const { wrapper: axiosCookieJarSupport } = require('axios-cookiejar-support')
const { getParams, formatResponse } = require('../utils/requestUtils')

axiosCookieJarSupport(axios)

const getMicroTime = () => {
  return new Date().getTime() * 1000
}

const login = async (req, res) => {
  const client = axios.create({
    validateStatus: () => true
  })
  try {
    const loginParams = {
      appid: 'wxfa0c35392d06b82f',
      scope: 'snsapi_login',
      redirect_uri: 'https://iu.qq.com/comm-htdocs/login/milosdk/wx_pc_redirect.html?appid=wxfa0c35392d06b82f&sServiceType=undefined&originalUrl=https%3A%2F%2Fdf.qq.com%2Fcp%2Frecord202410ver%2F&oriOrigin=https%3A%2F%2Fdf.qq.com',
      state: 1,
      login_type: 'jssdk',
      self_redirect: true,
      ts: getMicroTime(),
      style: 'black'
    }
    const response = await client.get('https://open.weixin.qq.com/connect/qrconnect', {
      params: loginParams,
      headers: {
        Referer: 'https://df.qq.com/'
      }
    })

    const result = response.data
    const qrcodeMatch = result.match(/\/connect\/qrcode\/[^"\s<>]+/)
    if (!qrcodeMatch) {
      return res.status(500).json(formatResponse(-1, '无法解析二维码'))
    }
    const qrcodeUrl = `https://open.weixin.qq.com${qrcodeMatch[0]}`
    const uuid = qrcodeMatch[0].substring(16)

    res.json(formatResponse(0, '获取成功', {
      qrCode: qrcodeUrl,
      uuid
    }))
  } catch (error) {
    res.status(500).json(formatResponse(-1, '服务器内部错误'))
  }
}

const status = async (req, res) => {
  const { uuid } = getParams(req)
  if (!uuid) {
    return res.status(400).json(formatResponse(-1, '缺少参数'))
  }

  const client = axios.create({
    validateStatus: () => true
  })

  try {
    const response = await client.get('https://lp.open.weixin.qq.com/connect/l/qrconnect', {
      params: { uuid }
    })

    const result = response.data
    const errcodeMatch = result.match(/wx_errcode=(\d+);/)
    const codeMatch = result.match(/wx_code='([^']*)';/)

    const wxErrcode = errcodeMatch ? parseInt(errcodeMatch[1], 10) : null
    const wxCode = codeMatch ? codeMatch[1] : null

    if (wxErrcode === 402) {
      return res.json(formatResponse(-2, '二维码超时'))
    }
    if (wxErrcode === 408) {
      return res.json(formatResponse(1, '等待扫描'))
    }
    if (wxErrcode === 404) {
      return res.json(formatResponse(2, '已扫码'))
    }
    if (wxErrcode === 405) {
      return res.json(formatResponse(3, '扫码成功', {
        wx_errcode: wxErrcode,
        wx_code: wxCode
      }))
    }
    if (wxErrcode === 403) {
      return res.json(formatResponse(-3, '扫码被拒绝'))
    }

    res.json(formatResponse(-4, '其他错误代码', {
      wx_errcode: wxErrcode,
      wx_code: wxCode
    }))
  } catch (error) {
    res.status(500).json(formatResponse(-1, '服务器内部错误'))
  }
}

const getAccessToken = async (req, res) => {
  const { code } = getParams(req)
  if (!code) {
    return res.status(400).json(formatResponse(-1, '缺少参数'))
  }

  const client = axios.create({
    validateStatus: () => true
  })

  try {
    const tokenParams = {
      callback: '',
      appid: 'wxfa0c35392d06b82f',
      wxcode: code,
      originalUrl: 'https://df.qq.com/cp/record202410ver/',
      wxcodedomain: 'iu.qq.com',
      acctype: 'wx',
      sServiceType: 'undefined',
      _: getMicroTime()
    }
    const response = await client.get('https://apps.game.qq.com/ams/ame/codeToOpenId.php', {
      params: tokenParams,
      headers: {
        Referer: 'https://df.qq.com/'
      }
    })

    const data = response.data
    if (data.iRet === 0) {
      const sMsgData = JSON.parse(data.sMsg)
      return res.json(formatResponse(0, '获取成功', {
        access_token: sMsgData.access_token,
        refresh_token: sMsgData.refresh_token,
        openid: sMsgData.openid,
        unionid: sMsgData.unionid,
        expires_in: sMsgData.expires_in
      }))
    }
    res.status(500).json(formatResponse(-2, `获取失败: ${data.sMsg}`))
  } catch (error) {
    res.status(500).json(formatResponse(-1, '服务器内部错误'))
  }
}

module.exports = {
  login,
  status,
  getAccessToken
}
