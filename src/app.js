const express = require('express')
const sequelize = require('./config/database')

const app = express()
const port = process.env.PORT || 3000

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const routes = require('./routes')

app.get('/', (req, res) => {
  res.json({ code: 0, message: '欢迎使用三角洲行动API' })
})

app.use('/', routes)

const startServer = async () => {
  try {
    await sequelize.sync({ alter: true })
    console.log('Database synchronized successfully.')
    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`)
    })
  } catch (error) {
    console.error('Unable to connect to the database:', error)
  }
}

startServer()

module.exports = app
