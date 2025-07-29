/**
 * 统一参数获取工具函数
 * 同时支持从query和body获取参数
 * @param {Object} req - Express请求对象
 * @returns {Object} 合并后的参数对象
 */
const getParams = (req) => {
  return { ...req.query, ...req.body }
}

/**
 * 统一响应格式化工具函数
 * 与PHP版本保持一致的响应结构
 * @param {number} code - 状态码
 * @param {string} message - 消息
 * @param {Object} data - 业务数据
 * @returns {Object} 格式化后的响应对象
 */
const formatResponse = (code, message, data = null) => {
  const response = {
    code,
    msg: message
  }
  
  if (data !== null) {
    response.data = data
  }
  
  return response
}

module.exports = {
  getParams,
  formatResponse
}
