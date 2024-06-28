/*
 * API sub-router for businesses collection endpoints.
 */

const { Router } = require('express')
const multer = require("multer")
const crypto = require("node:crypto")
const {connectToDb} = require('../lib/mongo')
const { validateAgainstSchema } = require('../lib/validation')
const { connectToRabbitMQ, getChannel } = require('../lib/rabbitmq')
const {
    getImageInfoById,
    saveImageInfo,
    saveImageFile,
    getImageDownloadStreamById
} = require('../models/photo')

const {
    PhotoSchema,
    insertNewPhoto,
    getPhotoById
} = require('../models/photo')


const upload = multer({
    storage: multer.diskStorage({
        destination: `${__dirname}/uploads`,
        filename: (req, file, callback) => {
            const filename = crypto.pseudoRandomBytes(16).toString("hex")
            const extension = imageTypes[file.mimetype]
            callback(null, `${filename}.${extension}`)
        }
    }),
    fileFilter: (req, file, callback) => {
        callback(null, !!imageTypes[file.mimetype])
    }
})
const imageTypes = {
    "image/jpeg": "jpg",
    "image/png": "png"
}
const router = Router()

/*
 * POST /photos - Route to create a new photo.
 */
router.post('/', upload.single("image"), async function (req, res, next) {
    if (validateAgainstSchema(req.body, PhotoSchema)) {
        try {
            const image = {
                contentType: req.file.mimetype,
                filename: req.file.filename,
                path: req.file.path,
                userId: req.body.userId,
                businessId: req.body.businessId,
                caption: req.body.caption
            }
            const id = await saveImageFile(image)
            const channel = getChannel()
            channel.sendToQueue("images", Buffer.from(id.toString()))
            res.status(200).send({
                id: id
            })
        } catch (err) {
            next(err)
        }
    } else {
        res.status(400).send({
            error: "Invalid file."
        })
    }
})

/*
 * GET /photos/{id} - Route to fetch info about a specific photo.
 */
router.get('/:id', async (req, res, next) => {
    try {
        const image = await getImageInfoById(req.params.id)
        if (image){
            const resBody = {
                _id: image._id,
                filename: image.filename,
                contentType: image.metadata.contentType,
                userId: image.metadata.userId,
                businessId: image.metadata.businessId,
                caption: image.metadata.caption,
                url: `/media/images/${image.filename}`
            }
            res.status(200).send(resBody)
        } else {
            next()
        }
    } catch (err) {
        next(err)
    }
})

module.exports = router
