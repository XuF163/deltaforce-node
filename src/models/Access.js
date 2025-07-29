const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const Access = sequelize.define('Access', {
  qq: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },
  openid: {
    type: DataTypes.STRING,
    allowNull: true
  },
  access_token: {
    type: DataTypes.STRING,
    allowNull: true
  },
  cookie: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  refresh_token: {
    type: DataTypes.STRING,
    allowNull: true
  },
  unionid: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  timestamps: true
})

module.exports = Access
