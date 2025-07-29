const axios = require('axios')
const { CookieJar } = require('tough-cookie')
const { wrapper: axiosCookieJarSupport } = require('axios-cookiejar-support')
const iconv = require('iconv-lite')
const ammoConfig = require('../config/ammo')
const accessoryConfig = require('../config/accessory')
const { getParams, formatResponse } = require('../utils/requestUtils')

axiosCookieJarSupport(axios)

const createCookie = (openId, accessToken, isQQ = true) => {
  const jar = new CookieJar()
  const domain = 'qq.com'
  jar.setCookieSync(`openid=${openId}`, `https://.${domain}/`)
  jar.setCookieSync(`access_token=${accessToken}`, `https://.${domain}/`)
  jar.setCookieSync(`acctype=${isQQ ? 'qc' : 'wx'}`, `https://.${domain}/`)
  jar.setCookieSync('appid=101491592', `https://.${domain}/`)
  return jar
}

const record = async (req, res) => {
  const { openid, access_token: accessToken } = getParams(req)
  const accessType = req.headers.acctype

  if (!openid || !accessToken) {
    return res.status(400).json(formatResponse(-1, '缺少参数'))
  }

  const cookie = createCookie(openid, accessToken, !accessType || accessType !== 'wx')
  const client = axios.create({
    jar: cookie,
    withCredentials: true,
    validateStatus: () => true
  })

  const gameData = {
    gun: [],
    operator: []
  }

  const types = { 4: 'gun', 5: 'operator' }

  try {
    for (const [type, key] of Object.entries(types)) {
      for (let i = 1; i <= 5; i++) {
        const payload = new URLSearchParams({
          iChartId: 319386,
          iSubChartId: 319386,
          sIdeToken: 'zMemOt',
          type,
          page: i
        })
        const response = await client.post('https://comm.ams.game.qq.com/ide/', payload)

        const data = response.data
        if (data.ret !== 0) {
          return res.json(formatResponse(-1, '获取失败'))
        }
        if (data.jData && data.jData.data) {
          gameData[key] = gameData[key].concat(data.jData.data)
        }
      }
    }
    res.json(formatResponse(0, '获取成功', gameData))
  } catch (error) {
    res.status(500).json(formatResponse(-1, '获取失败'))
  }
}

const player = async (req, res) => {
  const { openid, access_token: accessToken, season_id: seasonId = 0 } = getParams(req)
  const accessType = req.headers.acctype

  if (!openid || !accessToken) {
    return res.status(400).json(formatResponse(-1, '缺少参数'))
  }
  const cookie = createCookie(openid, accessToken, !accessType || accessType !== 'wx')
  const client = axios.create({
    jar: cookie,
    withCredentials: true,
    validateStatus: () => true
  })

  const gameData = {
    player: {},
    game: {},
    coin: 0,
    tickets: 0,
    money: 0
  }

  try {
    const playerPayload = new URLSearchParams({
      iChartId: 317814,
      iSubChartId: 317814,
      sIdeToken: 'QIRBwm',
      seasonid: seasonId
    })
    const playerResponse = await client.post('https://comm.ams.game.qq.com/ide/', playerPayload)

    const playerData = playerResponse.data
    if (playerData.ret === 0) {
      gameData.player = {
        ...playerData.jData.userData,
        charac_name: decodeURIComponent(playerData.jData.userData.charac_name)
      }
      gameData.game = playerData.jData.careerData
    }

    const currencyItems = {
      coin: 17888808888,
      tickets: 17888808889,
      money: 17020000010
    }

    for (const [key, itemId] of Object.entries(currencyItems)) {
      const currencyPayload = new URLSearchParams({
        iChartId: 319386,
        iSubChartId: 319386,
        sIdeToken: 'zMemOt',
        type: 3,
        item: itemId
      })
      const currencyResponse = await client.post('https://comm.ams.game.qq.com/ide/', currencyPayload)
      const currencyData = currencyResponse.data
      if (currencyData.ret === 0 && currencyData.jData.data[0]) {
        gameData[key] = parseInt(currencyData.jData.data[0].totalMoney, 10) || 0
      }
    }

    res.json(formatResponse(0, '获取成功', gameData))
  } catch (error) {
    res.status(500).json(formatResponse(-1, '获取失败'))
  }
}

const config = async (req, res) => {
  try {
    const payload = new URLSearchParams({
      iChartId: 352143,
      iSubChartId: 352143,
      sIdeToken: 'YWRywA',
      source: 5,
      method: 'dfm/config.list',
      param: JSON.stringify({ configType: 'all' })
    })
    const response = await axios.post('https://comm.ams.game.qq.com/ide/', payload)
    const data = response.data
    const gameData = data.ret === 0 ? data.jData.data.data.config : []
    res.json(formatResponse(0, '获取成功', gameData))
  } catch (error) {
    res.status(500).json(formatResponse(-1, '获取失败'))
  }
}

const items = async (req, res) => {
  const { type, sub_type: subType, item_id: itemId } = getParams(req)
  try {
    const payload = new URLSearchParams({
      iChartId: 352143,
      iSubChartId: 352143,
      sIdeToken: 'YWRywA',
      source: 2,
      method: 'dfm/object.list',
      param: JSON.stringify({
        primary: type || '',
        second: subType || '',
        objectID: itemId || ''
      })
    })
    const response = await axios.post('https://comm.ams.game.qq.com/ide/', payload)
    const data = response.data
    if (data.ret !== 0) {
      return res.status(500).json(formatResponse(-1, '获取失败'))
    }
    res.json(formatResponse(0, '获取成功', { list: data.jData.data.data.list || [] }))
  } catch (error) {
    res.status(500).json(formatResponse(-1, '获取失败'))
  }
}

const guns = async (req, res) => {
  const { gunId } = getParams(req)

  const normalizeCaliberCode = (code) => {
    const match = code.match(/\d+\.\d+x\d+/)
    return match ? `ammo${match[0]}` : code
  }

  try {
    const payload = new URLSearchParams({
      iChartId: 352143,
      iSubChartId: 352143,
      sIdeToken: 'YWRywA',
      source: 2,
      method: 'dfm/object.list',
      param: JSON.stringify({
        primary: 'gun',
        second: 'gunRifle',
        objectID: gunId || ''
      })
    })
    const response = await axios.post('https://comm.ams.game.qq.com/ide/', payload)

    const data = response.data
    if (data.ret !== 0) {
      return res.status(500).json(formatResponse(-1, '获取失败'))
    }

    const weapons = data.jData.data.data.list || []
    weapons.forEach(weaponData => {
      if (weaponData.gunDetail) {
        const caliber = weaponData.gunDetail.caliber.includes('ammo')
          ? weaponData.gunDetail.caliber
          : normalizeCaliberCode(weaponData.gunDetail.caliber)
        weaponData.gunDetail.caliber = caliber
        const currentAmmoConfig = ammoConfig[caliber] || {}

        if (weaponData.gunDetail.ammo) {
          weaponData.gunDetail.ammo = Object.keys(weaponData.gunDetail.ammo).map((key) => {
            const ammo = weaponData.gunDetail.ammo[key]
            const config = currentAmmoConfig[key] || {}
            return {
              objectID: ammo.objectID,
              name: config.name || '',
              grade: config.grade || ''
            }
          })
        }

        const mapAccessory = (item) => ({
          slotID: item.slotID,
          name: accessoryConfig[item.slotID] || ''
        })

        if (weaponData.gunDetail.accessory) {
          weaponData.gunDetail.accessory = weaponData.gunDetail.accessory.map(mapAccessory)
        }
        if (weaponData.gunDetail.allAccessory) {
          weaponData.gunDetail.allAccessory = weaponData.gunDetail.allAccessory.map(mapAccessory)
        }
      }
    })

    res.json(formatResponse(0, '获取成功', { weapons }))
  } catch (error) {
    res.status(500).json(formatResponse(-1, '获取失败'))
  }
}

const price = async (req, res) => {
  const { openid, access_token: accessToken, ids, recent: recentPrice } = getParams(req)
  const accessType = req.headers.acctype

  if (!openid || !accessToken || !ids) {
    return res.status(400).json(formatResponse(-1, '缺少参数'))
  }

  const cookie = createCookie(openid, accessToken, !accessType || accessType !== 'wx')
  const client = axios.create({
    jar: cookie,
    withCredentials: true,
    validateStatus: () => true
  })
  const idList = String(ids).includes(',') ? String(ids).split(',').map(Number) : [Number(ids)]

  try {
    const latestPricePayload = new URLSearchParams({
      iChartId: 352143,
      iSubChartId: 352143,
      sIdeToken: 'YWRywA',
      source: 2,
      method: 'dfm/object.price.latest',
      param: JSON.stringify({ objectID: idList })
    })
    const response = await client.post('https://comm.ams.game.qq.com/ide/', latestPricePayload)

    const data = response.data
    if (data.ret !== 0) {
      return res.json(formatResponse(-1, '获取失败,检查鉴权是否过期'))
    }

    const gameData = data.jData.data.data.dataMap
    if (Number(recentPrice) === 1) {
      for (const key in gameData) {
        const recentPricePayload = new URLSearchParams({
          iChartId: 352143,
          iSubChartId: 352143,
          sIdeToken: 'YWRywA',
          source: 2,
          method: 'dfm/object.price.recent',
          param: JSON.stringify({ objectID: key })
        })
        const recentResponse = await client.post('https://comm.ams.game.qq.com/ide/', recentPricePayload)
        const recentData = recentResponse.data
        gameData[key].recent = recentData.jData.data.data.objectPriceRecent.list || []
      }
    }

    res.json(formatResponse(0, '获取成功', gameData))
  } catch (error) {
    res.status(500).json(formatResponse(-1, '获取失败'))
  }
}

const assets = async (req, res) => {
  const { openid, access_token: accessToken } = getParams(req)
  const accessType = req.headers.acctype

  if (!openid || !accessToken) {
    return res.status(400).json(formatResponse(-1, '缺少参数'))
  }

  const cookie = createCookie(openid, accessToken, !accessType || accessType !== 'wx')
  const client = axios.create({
    jar: cookie,
    withCredentials: true,
    validateStatus: () => true
  })

  try {
    const payload = new URLSearchParams({
      iChartId: 318948,
      iSubChartId: 318948,
      sIdeToken: 'Plaqzy'
    })
    const response = await client.post('https://comm.ams.game.qq.com/ide/', payload)

    const data = response.data
    if (data.ret !== 0) {
      if (data.ret === -4000) {
        return res.json(formatResponse(-2, '您的账号由于腾讯内部错误无法使用这个功能'))
      }
      return res.json(formatResponse(-1, '获取失败,检查鉴权是否过期'))
    }

    res.json(formatResponse(0, '获取成功', {
      userData: data.jData.userData,
      weponData: data.jData.weponData,
      dCData: data.jData.dCData
    }))
  } catch (error) {
    res.status(500).json(formatResponse(-1, '获取失败'))
  }
}

const logs = async (req, res) => {
  const { openid, access_token: accessToken, type = 1 } = getParams(req)
  const accessType = req.headers.acctype

  if (!openid || !accessToken) {
    return res.status(400).json(formatResponse(-1, '缺少参数'))
  }

  const cookie = createCookie(openid, accessToken, !accessType || accessType !== 'wx')
  const client = axios.create({
    jar: cookie,
    withCredentials: true,
    validateStatus: () => true
  })

  try {
    const payload = new URLSearchParams({
      iChartId: 319386,
      iSubChartId: 319386,
      sIdeToken: 'zMemOt',
      type
    })
    const response = await client.post('https://comm.ams.game.qq.com/ide/', payload)

    const data = response.data
    if (data.ret !== 0) {
      return res.json(formatResponse(-1, '获取失败,检查鉴权是否过期'))
    }

    let responseData = data.jData.data
    if (Number(type) === 3) {
      responseData = { totalMoney: data.jData.data[0]?.totalMoney }
    }
    res.json(formatResponse(0, '获取成功', responseData))
  } catch (error) {
    res.status(500).json(formatResponse(-1, '获取失败'))
  }
}

const recent = async (req, res) => {
  const { openid, access_token: accessToken } = getParams(req)
  const accessType = req.headers.acctype

  if (!openid || !accessToken) {
    return res.status(400).json(formatResponse(-1, '缺少参数'))
  }

  const cookie = createCookie(openid, accessToken, !accessType || accessType !== 'wx')
  const client = axios.create({
    jar: cookie,
    withCredentials: true,
    validateStatus: () => true
  })

  try {
    const payload = new URLSearchParams({
      iChartId: 316969,
      iSubChartId: 316969,
      sIdeToken: 'NoOapI',
      method: 'dfm/center.recent.detail',
      source: '5',
      param: JSON.stringify({ resourceType: 'sol' })
    })
    const response = await client.post('https://comm.ams.game.qq.com/ide/', payload)

    const data = response.data
    if (data.ret !== 0) {
      return res.json(formatResponse(-1, '获取失败,检查鉴权是否过期'))
    }
    res.json(formatResponse(0, '获取成功', { solDetail: data.jData.data.data.solDetail }))
  } catch (error) {
    res.status(500).json(formatResponse(-1, '获取失败'))
  }
}

const achievement = async (req, res) => {
  const { openid, access_token: accessToken } = getParams(req)
  const accessType = req.headers.acctype

  if (!openid || !accessToken) {
    return res.status(400).json(formatResponse(-1, '缺少参数'))
  }

  const cookie = createCookie(openid, accessToken, !accessType || accessType !== 'wx')
  const client = axios.create({
    jar: cookie,
    withCredentials: true,
    validateStatus: () => true
  })

  try {
    const payload = new URLSearchParams({
      iChartId: 316969,
      iSubChartId: 316969,
      sIdeToken: 'NoOapI',
      method: 'dfm/center.person.resource',
      source: '5',
      param: JSON.stringify({
        resourceType: 'sol',
        seasonid: [1, 2, 3, 4, 5],
        isAllSeason: true
      })
    })
    const response = await client.post('https://comm.ams.game.qq.com/ide/', payload)

    const data = response.data
    if (data.ret !== 0) {
      return res.json(formatResponse(-1, '获取失败,检查鉴权是否过期'))
    }
    res.json(formatResponse(0, '获取成功', { solDetail: data.jData.data.data.solDetail || [] }))
  } catch (error) {
    res.status(500).json(formatResponse(-1, '获取失败'))
  }
}

const password = async (req, res) => {
  const { openid, access_token: accessToken } = getParams(req)
  const accessType = req.headers.acctype

  if (!openid || !accessToken) {
    return res.status(400).json(formatResponse(-1, '缺少参数'))
  }

  const cookie = createCookie(openid, accessToken, !accessType || accessType !== 'wx')
  const client = axios.create({
    jar: cookie,
    withCredentials: true,
    validateStatus: () => true
  })

  try {
    const payload = new URLSearchParams({
      iChartId: 384918,
      iSubChartId: 384918,
      sIdeToken: 'mbq5GZ',
      method: 'dist.contents',
      source: 5,
      param: JSON.stringify({
        distType: 'bannerManage',
        contentType: 'secretDay'
      })
    })
    const response = await client.post('https://comm.ams.game.qq.com/ide/', payload)
    const data = response.data
    if (data.ret !== 0) {
      return res.json(formatResponse(-1, '获取失败,检查鉴权是否过期'))
    }

    const rooms = {}
    const content = data.jData.data.data.content.secretDay.data[0].desc
    const regex = /^(.+?):(\d{4});?\s*(?:\n|$)/gmu
    const matches = content.matchAll(regex)
    for (const match of matches) {
      rooms[match[1]] = match[2]
    }
    res.json(formatResponse(0, '获取成功', rooms))
  } catch (error) {
    res.status(500).json(formatResponse(-1, '获取失败'))
  }
}

const manufacture = async (req, res) => {
  const { openid, access_token: accessToken } = getParams(req)
  const accessType = req.headers.acctype

  if (!openid || !accessToken) {
    return res.status(400).json(formatResponse(-1, '缺少参数'))
  }

  const cookie = createCookie(openid, accessToken, !accessType || accessType !== 'wx')
  const client = axios.create({
    jar: cookie,
    withCredentials: true,
    validateStatus: () => true
  })

  try {
    const payload = new URLSearchParams({
      iChartId: 365589,
      iSubChartId: 365589,
      sIdeToken: 'bQaMCQ',
      source: 5
    })
    const response = await client.post('https://comm.ams.game.qq.com/ide/', payload)

    const data = response.data
    if (data.ret !== 0) {
      return res.json(formatResponse(-1, '获取失败,检查鉴权是否过期'))
    }
    res.json(formatResponse(0, '获取成功', data.jData.data.data))
  } catch (error) {
    res.status(500).json(formatResponse(-1, '获取失败'))
  }
}

const bind = async (req, res) => {
  const { openid, access_token: accessToken } = getParams(req)
  const accessType = req.headers.acctype || 'qc'

  if (!openid || !accessToken) {
    return res.status(400).json(formatResponse(-1, '缺少参数'))
  }

  const cookie = createCookie(openid, accessToken, !accessType || accessType !== 'wx')
  const client = axios.create({
    jar: cookie,
    withCredentials: true,
    validateStatus: () => true
  })

  try {
    const bindCheckPayload = new URLSearchParams({
      iChartId: 316964,
      iSubChartId: 316964,
      sIdeToken: '95ookO'
    })
    let response = await client.post('https://comm.ams.game.qq.com/ide/', bindCheckPayload)

    let data = response.data
    if (data.ret !== 0) {
      return res.json(formatResponse(-1, '获取失败,检查鉴权是否过期'))
    }

    if (!data.jData.bindarea) {
      const roleParams = {
        needGopenid: 1,
        sAMSAcctype: accessType === 'qc' ? 'qq' : 'wx',
        sAMSAccessToken: accessToken,
        sAMSAppOpenId: openid,
        sAMSSourceAppId: '101491592',
        game: 'dfm',
        sCloudApiName: 'ams.gameattr.role',
        area: 36,
        platid: 1,
        partition: 36
      }
      const roleResponse = await client.get('https://comm.aci.game.qq.com/main', {
        params: roleParams,
        headers: {
          referer: 'https://df.qq.com/'
        },
        responseType: 'arraybuffer'
      })

      const gbkBuffer = Buffer.from(roleResponse.data, 'binary')
      const utf8String = iconv.decode(gbkBuffer, 'gbk')

      const matches = utf8String.match(/{([^}]*)}/)
      const roleData = {}
      if (matches) {
        const pairs = matches[1].matchAll(/(\w+):('[^']*'|-?\d+|[^,]*)/g)
        for (const pair of pairs) {
          const key = pair[1]
          const value = pair[2].replace(/'/g, '')
          roleData[key] = value
        }
      }

      const roleId = roleData.checkparam.split('|')[2]

      const bindSubmitPayload = new URLSearchParams({
        iChartId: 316965,
        iSubChartId: 316965,
        sIdeToken: 'sTzZS2',
        sArea: 36,
        sPlatId: 1,
        sPartition: 36,
        sCheckparam: roleData.checkparam,
        sRoleId: roleId,
        md5str: roleData.md5str
      })
      response = await client.post('https://comm.ams.game.qq.com/ide/', bindSubmitPayload)
      data = response.data
      if (data.ret !== 0) {
        return res.json(formatResponse(-1, '绑定失败'))
      } else {
        return res.json(formatResponse(1, '获取成功', { bindarea: data.jData.bindarea }))
      }
    }
    res.json(formatResponse(0, '获取成功', { bindarea: data.jData.bindarea }))
  } catch (error) {
    res.status(500).json(formatResponse(-1, '获取失败'))
  }
}

module.exports = {
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
}
