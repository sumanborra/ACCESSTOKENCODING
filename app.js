const express = require('express')
const path = require('path')
const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const app = express()
const JWT = require('jsonwebtoken')
app.use(express.json())
let db = null
const initializationDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log(`Server Running at http://localhost:3000/`)
    })
  } catch (e) {
    console.log(`Server Error ${e.message}`)
    process.exit(1)
  }
}
initializationDbAndServer()
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const existUserDetailsQuery = `SELECT * FROM user WHERE username = '${username}';`
  const existUserDetails = await db.get(existUserDetailsQuery)
  if (existUserDetails === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const passwordMatch = await bcrypt.compare(
      password,
      existUserDetails.password,
    )
    //console.log(passwordMatch)
    if (passwordMatch === true) {
      const payload = {username: username}
      const jwtToken = JWT.sign(payload, 'MYSECRET_KEY')
      response.send({jwtToken: jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})
function authentication(request, response, next) {
  let jwtToken
  const authenticationHeaders = request.headers['authorization']
  if (authenticationHeaders !== undefined) {
    jwtToken = authenticationHeaders.split(' ')[1]
  }
  if (authenticationHeaders === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    JWT.verify(jwtToken, 'MYSECRET_KEY', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}
app.get('/states/', authentication, async (request, response) => {
  const query = `SELECT * FROM state;`
  const stateDetails = await db.all(query)
  const data = stateDetails.map(eachObject => {
    return {
      stateId: eachObject.state_id,
      stateName: eachObject.state_name,
      population: eachObject.population,
    }
  })
  response.send(data)
})
app.get('/states/:stateId/', authentication, async (request, response) => {
  const {stateId} = request.params
  const query = `SELECT * FROM state WHERE state_id = ${stateId};`
  const dataOfState = await db.get(query)
  const data = {
    stateId: dataOfState.state_id,
    stateName: dataOfState.state_name,
    population: dataOfState.population,
  }
  response.send(data)
})
app.post('/districts/', authentication, async (request, response) => {
  const detailsOfDistrict = request.body
  const {districtName, stateId, cases, cured, active, deaths} =
    detailsOfDistrict
  const query = `INSERT INTO district(district_name,state_id,cases,cured,active,deaths)
  VALUES('${districtName}',${stateId},${cases},${cured},${active},${deaths});`
  await db.run(query)
  response.send('District Successfully Added')
})
app.get(
  '/districts/:districtId/',
  authentication,
  async (request, response) => {
    const {districtId} = request.params
    const query = `SELECT * FROM district WHERE district_id =${districtId};`
    const dataOfDistrict = await db.get(query)
    const data = {
      districtId: dataOfDistrict.district_id,
      districtName: dataOfDistrict.district_name,
      stateId: dataOfDistrict.state_id,
      cases: dataOfDistrict.cases,
      cured: dataOfDistrict.cured,
      active: dataOfDistrict.active,
      deaths: dataOfDistrict.deaths,
    }
    response.send(data)
  },
)
app.delete(
  '/districts/:districtId/',
  authentication,
  async (request, response) => {
    const {districtId} = request.params
    const query = `DELETE FROM district WHERE district_id = ${districtId};`
    await db.run(query)
    response.send('District Removed')
  },
)
app.put(
  '/districts/:districtId/',
  authentication,
  async (request, response) => {
    const {districtId} = request.params
    const updateDetails = request.body
    const {districtName, stateId, cases, cured, active, deaths} = updateDetails
    const query = `UPDATE district SET 
      district_name ='${districtName}',
      state_id =${stateId},
      cases = ${cases},
      cured = ${cured},
      active = ${active},
      deaths = ${deaths}
      WHERE district_id =${districtId};`
    await db.run(query)
    response.send('District Details Updated')
  },
)
app.get(
  '/states/:stateId/stats/',
  authentication,
  async (request, response) => {
    const {stateId} = request.params
    const query = `SELECT 
   SUM(cases),
   SUM(cured),
   SUM(active),
   SUM(deaths)
   FROM district WHERE state_id =${stateId};`
    const detailsOfResult = await db.get(query)
    const data = {
      totalCases: detailsOfResult['SUM(cases)'],
      totalCured: detailsOfResult['SUM(cured)'],
      totalActive: detailsOfResult['SUM(active)'],
      totalDeaths: detailsOfResult['SUM(deaths)'],
    }
    response.send(data)
  },
)
module.exports = app
