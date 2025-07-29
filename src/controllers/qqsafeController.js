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

const getGTK = (sKey) => {
  let hash = 5381
  for (let i = 0; i < sKey.length; i++) {
    hash += (hash << 5) + sKey.charCodeAt(i)
    hash &= 0x7fffffff
  }
  return hash & 0x7fffffff
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
      appid: 716027609,
      daid: 383,
      style: 33,
      login_text: '登录',
      hide_title_bar: 1,
      hide_border: 1,
      target: 'self',
      s_url: 'https://graph.qq.com/oauth2.0/login_jump',
      pt_3rd_aid: 101944512,
      pt_feedback_link: 'https://support.qq.com/products/77942?customInfo=milo.qq.com.appid101491592',
      theme: 2,
      verify_theme: ''
    }
    await client.get('https://xui.ptlogin2.qq.com/cgi-bin/xlogin', { params: loginParams })

    const qrParams = {
      appid: 716027609,
      e: 2,
      l: 'M',
      s: 3,
      d: 72,
      v: 4,
      t: Math.random(), // 动态生成的值，与PHP版本保持一致
      daid: 383,
      pt_3rd_aid: 101944512,
      u1: 'https://graph.qq.com/oauth2.0/login_jump'
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
      u1: 'https://graph.qq.com/oauth2.0/login_jump',
      ptqrtoken: qrToken,
      ptredirect: 0,
      h: 1,
      t: 1,
      g: 1,
      from_ui: 1,
      ptlang: 2052,
      action: '0-0-1744807890273',
      js_ver: 25040111,
      js_type: 1,
      login_sig: loginSig,
      pt_uistyle: 40,
      aid: 716027609,
      daid: 383,
      pt_3rd_aid: 101944512,
      o1vId: '378b06c889d9113b39e814ca627809e3',
      pt_js_version: '530c3f68',
      _: null
    }
    const response = await client.get('https://ssl.ptlogin2.qq.com/ptqrlogin', {
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
    return res.status(400).json(formatResponse(-1, '必须填写cookie参数'))
  }

  const jar = new CookieJar()
  const client = axios.create({
    jar,
    withCredentials: true,
    validateStatus: () => true,
    maxRedirects: 0
  })

  try {
    const parsedCookie = typeof cookie === 'string' ? JSON.parse(cookie.replace(/\\/g, '')) : cookie

    const cookieArray = Object.entries(parsedCookie).map(([key, value]) => ({ key, value }))
    for (const c of cookieArray) {
      await jar.setCookie(`${c.key}=${c.value}`, 'https://qq.com/')
    }

    const pSkey = parsedCookie.p_skey
    if (!pSkey) {
      return res.status(400).json(formatResponse(-1, 'Cookie中缺少p_skey'))
    }

    const gTk = getGTK(pSkey)

    const authPayload = new URLSearchParams({
      response_type: 'code',
      client_id: '101944512',
      redirect_uri: 'https://gamesafe.qq.com/login-ui/index.html?cPageName=middle&type=QQ&backUrl=reload&appId=101944512',
      scope: 'all',
      state: 'qqconnect_2',
      switch: '',
      form_plogin: 1,
      src: 1,
      update_auth: 1,
      openapi: 1010,
      g_tk: gTk,
      auth_time: Math.floor(new Date().getTime() / 1000),
      ui: '8414A4DC-B157-42EE-84AE-84477CD7832A'
    })

    const authResponse = await client.post('https://graph.qq.com/oauth2.0/authorize', authPayload.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: 'https://xui.ptlogin2.qq.com/'
      }
    })

    const location = authResponse.headers.location
    if (!location || !location.includes('code=')) {
      return res.status(401).json(formatResponse(-1, 'Cookie过期，请重新扫码登录'))
    }

    const codeMatch = location.match(/code=([^&]*)/)
    const qcCode = codeMatch[1]

    await client.get(location)

    const tokenResponse = await client.get('https://gamesafe.qq.com/connect', {
      params: {
        code: qcCode,
        appId: 101944512,
        atype: 'QQ'
      },
      headers: {
        Referer: 'https://gamesafe.qq.com/login-ui/index.html'
      }
    })

    const data = tokenResponse.data
    if (data.ret !== 0) {
      return res.json(formatResponse(-1, `AccessToken获取失败: ${data.sMsg}`))
    }

    const allCookies = await jar.getCookies('https://gamesafe.qq.com/')
    const gsCodeCookie = allCookies.find(c => c.key === 'gs_code')
    const gsIdCookie = allCookies.find(c => c.key === 'gs_id')

    if (!gsCodeCookie || !gsIdCookie) {
      return res.status(500).json(formatResponse(-1, '获取gs_code或gs_id失败'))
    }

    const gsCode = gsCodeCookie.value
    const tempText = gsCode.split('.')[1]
    const gs = JSON.parse(Buffer.from(tempText, 'base64').toString('utf8'))
    const accessToken = gs.token

    res.json(formatResponse(0, '获取成功', {
      access_token: accessToken,
      openid: gsIdCookie.value,
      gs_code: gsCode
    }))
  } catch (error) {
    res.status(500).json(formatResponse(-1, '服务器内部错误'))
  }
}

const bannedList = async (req, res) => {
  const { openid, access_token: accessToken, code } = getParams(req)
  
  if (!openid || !accessToken) {
    return res.status(400).json(formatResponse(-1, '缺少参数'))
  }
  
  // 创建CookieJar
  const jar = new CookieJar()
  const domain = 'qq.com'
  jar.setCookieSync(`openid=${openid}`, `https://.${domain}/`)
  jar.setCookieSync(`access_token=${accessToken}`, `https://.${domain}/`)
  jar.setCookieSync(`gs_id=${openid}`, `https://.${domain}/`)
  if (code) {
    jar.setCookieSync(`gs_code=${code}`, `https://.${domain}/`)
  }
  
  const client = axios.create({
    jar,
    withCredentials: true,
    validateStatus: () => true
  })
  
  try {
    const response = await client.get('https://gamesafe.qq.com/api/proxy/punish_query', {
      params: {
        query_type: 4,
        limit: 10
      }
    })
    
    const data = response.data
    if (data.code !== 0) {
      return res.json(formatResponse(-1, '获取失败', data))
    }
    
    res.json(formatResponse(0, '获取成功', data.data))
  } catch (error) {
    res.status(500).json(formatResponse(-1, '服务器内部错误'))
  }
}

module.exports = {
  getQrSig,
  getAction,
  getAccessToken,
  bannedList
}
