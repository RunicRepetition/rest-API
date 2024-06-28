const amqp = require("amqplib")
const {connectToDb, getDbReference} = require('./lib/mongo')
const { ObjectId, GridFSBucket } = require('mongodb')
const {connectToRabbitMQ, getChannel} = require('./lib/rabbitmq')
const {getImageDownloadStreamById, updateThumbnailById, saveThumbFile, getImageInfoById} = require('./models/photo')
const jimp = require('jimp')
const { Readable } = require("node:stream")
const rabbitMqHost = process.env.RABBITMQ_HOST || "localhost"
const rabbitMqUrl = `amqp://${rabbitMqHost}`

async function run() {
    const db = getDbReference()
    await connectToRabbitMQ("images")
    console.log("Successfully connected to rabbit MQ")
    const channel = getChannel()
    channel.consume("images", async msg => {
        if (msg){
            const id = msg.content.toString()
            const downloadStream = getImageDownloadStreamById(id)
            const metadata = await getImageInfoById(id)
            const imageData = []
           downloadStream.on("data", function (data) {
                imageData.push(data)
            })
            downloadStream.on("end", async function() {
              const imgBuffer = Buffer.concat(imageData)
              const image = await jimp.read(imgBuffer)
              const thumbBuffer = await image.resize(100,100).getBufferAsync(jimp.MIME_JPEG)

            const bucket = new GridFSBucket(db, {bucketName: "thumbs"})
            const uploadStream = bucket.openUploadStream(metadata.filename, {metadata: metadata})
            Readable.from(thumbBuffer)
                .pipe(uploadStream)
                .on ("finish", (res) => {
                    const thumbId = res._id
                    console.log("tid: ", thumbId)
                })
            })
        }
        channel.ack(msg)
    })
}

connectToDb(function(){
    run()
})