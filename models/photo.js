/*
 * Photo schema and data accessor methods.
 */

const { ObjectId, GridFSBucket } = require('mongodb')

const { getDbReference } = require('../lib/mongo')
const { extractValidFields } = require('../lib/validation')
const { Readable } = require("node:stream")
const fs = require("node:fs")
/*
 * Schema describing required/optional fields of a photo object.
 */
const PhotoSchema = {
    businessId: { required: true },
    caption: { required: false }
}
exports.PhotoSchema = PhotoSchema

/*
 * Executes a DB query to insert a new photo into the database.  Returns
 * a Promise that resolves to the ID of the newly-created photo entry.
 */
async function insertNewPhoto(photo) {
    photo = extractValidFields(photo, PhotoSchema)
    photo.businessId = ObjectId(photo.businessId)
    const db = getDbReference()
    const collection = db.collection('photos')
    const result = await collection.insertOne(photo)
    return result.insertedId
}

exports.saveImageFile = async function (image) {
    return new Promise (function(resolve, reject) {
        const db = getDbReference()
        const bucket = new GridFSBucket(db, {bucketName: "images"})
        const metadata = {
            contentType: image.contentType,
            userId: image.userId,
            businessId: image.businessId,
            caption: image.caption
        }
        const uploadStream = bucket.openUploadStream(
            image.filename,
            {metadata: metadata}
        )
        fs.createReadStream(image.path).pipe(uploadStream)
            .on("error", function(err) {
                reject(err)
            })
            .on("finish", function(result){
                console.log("== write success, result: ", result)
                resolve(result._id)
            })
    })
}

exports.saveImageInfo = async function (image) {
    const db = getDbReference()
    const collection = db.collection('images')
    const result = await collection.insertOne(image)
    return result.insertedId
}
exports.insertNewPhoto = insertNewPhoto

/*
 * Executes a DB query to fetch a single specified photo based on its ID.
 * Returns a Promise that resolves to an object containing the requested
 * photo.  If no photo with the specified ID exists, the returned Promise
 * will resolve to null.
 */
exports.getImageInfoById = async function (id) {
    const db = getDbReference()
    // const collection = db.collection('images')
    const bucket = new GridFSBucket(db, { bucketName: "images" })
    if (!ObjectId.isValid(id)) {
        return null
    } else {
        const results = await bucket.find({ _id: new ObjectId(id) })
            .toArray()
        // const results = await collection.find({ _id: new ObjectId(id) })
        //     .toArray()
        return results[0]
    }
}

exports.getImageDownloadStreamById = function (id) {
    const db = getDbReference()
    const bucket = new GridFSBucket(db, {bucketName: `images`})
    console.log ("opening download stream for id: ")
    console.log(id)
    return bucket.openDownloadStream(new ObjectId(id))
}

exports.saveThumbFile = async function (img) {
    return new Promise (function(resolve, reject) {
        const db = getDbReference()
        const bucket = new GridFSBucket(db, {bucketName: "thumbs"})
        const uploadStream = bucket.openUploadStream(img.metadata.filename, img.metadata)
        fs.createReadStream(img.metadata.filename).pipe(uploadStream)
            .on("error", function(err) {
                reject(err)
            })
            .on("finish", function(result){
                console.log("== write success, result: ", result)
                resolve(result._id)
            })
    })
}

exports.updateThumbnailById = async function (id) {
    
}