/*
 * This require() statement reads environment variable values from the file
 * called .env in the project directory.  You can set up the environment
 * variables in that file to specify connection information for your own DB
 * server.
 */
require('dotenv').config()

const express = require('express')
const morgan = require('morgan')
const { connectToRabbitMQ, getChannel} = require('./lib/rabbitmq')
const {
    getImageInfoById,
    saveImageInfo,
    saveImageFile,
    getImageDownloadStreamById
} = require('./models/photo')

const api = require('./api')
const { connectToDb } = require('./lib/mongo')

const app = express()
const port = process.env.PORT || 8000

/*
 * Morgan is a popular logger.
 */
app.use(morgan('dev'))

app.use(express.json())

/*
 * All routes for the API are written in modules in the api/ directory.  The
 * top-level router lives in api/index.js.  That's what we include here, and
 * it provides all of the routes.
 */
app.use('/', api)

app.get(["/photos/media/:id.png", "/photos/media/:id.jpg"], async (req, res, next) => {
    console.log("HELLO")
    const id = req.params.id
    console.log(id)
    getImageDownloadStreamById(id)
    .on("error", function(err) {
        if (err.code === "ENOENT"){
            next()
        } else {
            next(err)
        }
    })
    .on ("file", function(file){
        res.status(200).type(file.metadata.contentType)
    })
    .pipe(res)

})

app.get("/media/thumbs/:id", async(req, res, next) => {
    const id = req.params.id
    
})

app.use('*', function (req, res, next) {
    res.status(404).json({
        error: "Requested resource " + req.originalUrl + " does not exist"
    })
})

/*
 * This route will catch any errors thrown from our API endpoints and return
 * a response with a 500 status to the client.
 */
app.use('*', function (err, req, res, next) {
    console.error("== Error:", err)
    res.status(500).send({
        err: "Server error.  Please try again later."
    })
})

connectToDb(async  () => {
    await connectToRabbitMQ("images")
    app.listen(port, function () {
        console.log("== Server is running on port", port)
    })
})
