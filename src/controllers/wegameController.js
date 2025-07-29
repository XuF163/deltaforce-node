const axios = require('axios')
const { wrapper: axiosCookieJarSupport } = require('axios-cookiejar-support')
const { CookieJar } = require('tough-cookie')
const Access = require('../models/Access')
const { getParams, formatResponse } = require('../utils/requestUtils')

axiosCookieJarSupport(axios)

const getQrToken = (qrSig) => {
  let hash = 0
  for (let i = 0; i < qrSig.length; i++) {
    hash += ((hash << 5) & 2147483647) + qrSig.charCodeAt(i) & 2147483647
    hash &= 2147483647
  }
  return hash & 2147483647
}

const getMillisecondTimestamp = () => {
  return new Date().getTime()
}

const getQrSig = async (req, res) => {
  const jar = new CookieJar()
  const client = axios.create({
    jar,
    withCredentials: true,
    validateStatus: () => true,
    redirect: false
  })

  try {
    const loginParams = {
      s_url: 'https://www.wegame.com.cn/login/callback.html?t=qq&c=0&a=0',
      appid: 1600001063,
      daid: 733,
      style: 20,
      pt_no_auth: 0,
      target: 'self',
      hide_close_icon: 1,
      hide_border: 1
    }
    await client.get('https://xui.ptlogin2.qq.com/cgi-bin/xlogin', { params: loginParams })

    const qrParams = {
      appid: 1600001063,
      e: 2,
      l: 'M',
      s: 3,
      d: 72,
      v: 4,
      t: Math.random(), // 动态生成的值，与PHP版本保持一致
      daid: 733,
      pt_3rd_aid: 0,
      u1: 'https://www.wegame.com.cn/login/callback.html?t=qq&c=0&a=0'
    }
    const response = await client.get('https://xui.ptlogin2.qq.com/ssl/ptqrshow', {
      params: qrParams,
      responseType: 'arraybuffer'
    })

    if (response.status !== 200) {
      return res.json(formatResponse(-1, '获取失败'))
    }

    const cookies = await jar.getCookies('https://ptlogin2.qq.com/')
    const qrSigCookie = cookies.find(c => c.key === 'qrsig')
    const loginSigCookie = cookies.find(c => c.key === 'pt_login_sig')

    if (!qrSigCookie) {
      return res.json(formatResponse(-1, 'qrsig 获取失败'))
    }

    const qrSig = qrSigCookie.value
    const imageBase64 = Buffer.from(response.data, 'binary').toString('base64')
    const qrToken = getQrToken(qrSig)
    const loginSig = loginSigCookie ? loginSigCookie.value : null

    const cookieMap = {}
    cookies.forEach(c => {
      cookieMap[c.key] = c.value
    })

    res.json(formatResponse(0, '获取成功', {
      qrSig,
      image: imageBase64,
      token: qrToken,
      loginSig,
      cookie: cookieMap
    }))
  } catch (error) {
    res.status(500).json(formatResponse(-1, '服务器内部错误'))
  }
}

const getAction = async (req, res) => {
  const { qrToken, qrSig, loginSig, cookie: cookieStr } = getParams(req)

  if (!qrToken || !qrSig || !cookieStr) {
    return res.status(400).json(formatResponse(-1, '缺少cookie参数'))
  }

  const cookie = JSON.parse(cookieStr)
  cookie.qrsig = qrSig

  const jar = new CookieJar()
  const client = axios.create({
    jar,
    withCredentials: true,
    validateStatus: () => true
  })

  try {
    const cookieArray = Object.entries(cookie).map(([key, value]) => ({ key, value }))
    for (const c of cookieArray) {
      await jar.setCookie(`${c.key}=${c.value}`, 'https://ptlogin2.qq.com/')
    }

    const actionParams = {
      u1: 'https://www.wegame.com.cn/login/callback.html?t=qq&c=0&a=0',
      ptqrtoken: qrToken,
      ptredirect: 0,
      h: 1,
      t: 1,
      g: 1,
      from_ui: 1,
      ptlang: 2052,
      action: `0-0-${getMillisecondTimestamp()}`,
      js_ver: 25051315,
      js_type: 1,
      login_sig: loginSig,
      pt_uistyle: 40,
      aid: 1600001063,
      daid: 733,
      o1vId: '3f7262f28e2853a1549dbdd4f0008b0f',
      pt_js_version: '9fce2a54',
      _: null
    }
    const response = await client.get('https://xui.ptlogin2.qq.com/ssl/ptqrlogin', {
      params: actionParams
    })

    const result = response.data
    if (!result) {
      return res.json(formatResponse(-1, 'qrSig参数不正确'))
    }

    const matches = result.match(/ptuiCB\s*\(\s*'(.*?)'\s*,\s*'(.*?)'\s*,\s*'(.*?)'\s*,\s*'(.*?)'\s*,\s*'(.*?)'\s*,\s*'(.*?)'\s*\)/)

    if (!matches) {
      return res.json(formatResponse(-5, '响应错误'))
    }

    const code = matches[1]
    const url = matches[3]
    const message = matches[5]

    if (code === '65') return res.json(formatResponse(-2, message))
    if (code === '66') return res.json(formatResponse(1, message))
    if (code === '67') return res.json(formatResponse(2, message))
    if (code === '86') return res.json(formatResponse(-3, message))
    if (code !== '0') return res.json(formatResponse(-4, message))

    const qqMatch = url.match(/uin=([^&]*)/)
    const qq = qqMatch ? qqMatch[1] : null

    await client.get(url)

    const cookies = await jar.getCookies('https://qq.com/')
    const cookieMap = {}
    cookies.forEach(c => {
      if (c.value) {
        cookieMap[c.key] = c.value
      }
    })

    if (qq) {
      await Access.upsert({
        qq,
        cookie: JSON.stringify(cookieMap)
      })
    }

    res.json(formatResponse(0, '登录成功', {
      cookie: cookieMap
    }))
  } catch (error) {
    res.status(500).json(formatResponse(-5, '响应错误'))
  }
}

const getAccessToken = async (req, res) => {
  const { cookie } = getParams(req)

  if (!cookie) {
    return res.status(400).json(formatResponse(-1, 'cookie参数必填'))
  }

  const jar = new CookieJar()
  const client = axios.create({
    jar,
    withCredentials: true,
    validateStatus: () => true
  })

  try {
    const parsedCookie = typeof cookie === 'string' ? JSON.parse(cookie.replace(/\\/g, '')) : cookie

    const cookieArray = Object.entries(parsedCookie).map(([key, value]) => ({ key, value }))
    for (const c of cookieArray) {
      await jar.setCookie(`${c.key}=${c.value}`, 'https://qq.com/')
    }

    const payload = {
      clienttype: '1000005',
      mappid: '10001',
      mcode: '',
      config_params: {
        lang_type: 0
      },
      login_info: {
        qq_info_type: 6,
        uin: String(parsedCookie.uin).replace('o', ''),
        sig: parsedCookie.p_skey
      }
    }
    const response = await client.post('https://www.wegame.com.cn/api/middle/clientapi/auth/login_by_qq', payload, {
      headers: {
        Referer: 'https://www.wegame.com.cn/login/callback.html?t=qq&c=0&a=0'
      }
    })

    const data = response.data
    if (data.code !== 0) {
      return res.json(formatResponse(data.code, data.msg))
    }

    res.json(formatResponse(0, '获取成功', {
      tgp_id: data.data.user_id,
      tgp_ticket: data.data.wt
    }))
  } catch (error) {
    res.status(500).json(formatResponse(-1, '服务器内部错误'))
  }
}

const gift = async (req, res) => {
  const { id, ticket } = getParams(req)
  if (!id || !ticket) {
    return res.status(400).json(formatResponse(-1, '缺少参数'))
  }

  const jar = new CookieJar()
  const domain = 'wegame.com.cn'
  await jar.setCookie(`tgp_id=${id}`, `https://www.${domain}/`)
  await jar.setCookie(`tgp_ticket=${ticket}`, `https://www.${domain}/`)

  const client = axios.create({
    jar,
    withCredentials: true,
    validateStatus: () => true
  })

  try {
    const openChestPayload = {
      account_type: 1,
      from_src: 'df_web'
    }
    let response = await client.post('https://www.wegame.com.cn/api/v1/wegame.pallas.dfm.DfmSocial/OpenTreasureChest', openChestPayload, {
      headers: {
        Referer: 'https://www.wegame.com.cn/helper/df/'
      }
    })

    let data = response.data
    if (data.result.error_code !== 0) {
      return res.json(formatResponse(-1, '获取礼包失败'))
    }

    const rewards = data.rewards
    if (data.is_obtain) {
      return res.json(formatResponse(0, '已领取', rewards))
    }

    const obtainChestPayload = {
      account_type: 1,
      from_src: 'df_web'
    }
    response = await client.post('https://www.wegame.com.cn/api/v1/wegame.pallas.dfm.DfmSocial/ObtainTreasureChest', obtainChestPayload, {
      headers: {
        Referer: 'https://www.wegame.com.cn/helper/df/'
      }
    })

    data = response.data
    if (data.result.error_code !== 0) {
      return res.json(formatResponse(-1, '领取礼包失败'))
    }

    res.json(formatResponse(0, '领取成功', rewards))
  } catch (error) {
    res.status(500).json(formatResponse(-1, '服务器内部错误'))
  }
}

module.exports = {
  getQrSig,
  getAction,
  getAccessToken,
  gift
}
