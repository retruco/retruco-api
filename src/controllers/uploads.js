// Retruco-API -- HTTP API to bring out shared positions from argumented statements
// By: Paula Forteza <paula@retruco.org>
//     Emmanuel Raviart <emmanuel@retruco.org>
//
// Copyright (C) 2016, 2017 Paula Forteza & Emmanuel Raviart
// https://framagit.org/retruco/retruco-api
//
// Retruco-API is free software; you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// Retruco-API is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import crypto from "crypto"
import dataUriToBuffer from "data-uri-to-buffer"
import fs from "fs"
import gm from "gm"
import md5File from "md5-file"
import path from "path"
import os from "os"

import config from "../config"
import { wrapAsyncMiddleware } from "../model"

const imageMagick = gm.subClass({ imageMagick: true })
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "retruco-api-uploads-"))
const uploadsDir = config.uploads
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir)
const imagesDir = path.join(uploadsDir, "images")
if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir)

async function convertAndCopyImage(sourcePath, targetPath) {
  return new Promise(function(resolve, reject) {
    imageMagick(sourcePath)
      .strip()
      .write(targetPath, function(err) {
        if (err) reject(err)
        else resolve()
      })
  })
}

async function convertImageThenRespond(req, res, file) {
  let hash = md5File.sync(file.path)
  let tempFilePath = path.join(tempDir, `${hash}.png`)
  try {
    await convertAndCopyImage(file.path, tempFilePath)
  } catch (e) {
    console.log("File is not a valid image:")
    console.log(file)
    console.log(e.stack)
    res.status(400)
    res.json({
      apiVersion: "1",
      code: 400, // Bad Request
      message: `File "${file.originalname}" is not a valid image.`,
    })
    return
  }
  hash = md5File.sync(tempFilePath)
  let imageDirName = hash.slice(0, 2)
  let imageDir = path.join(imagesDir, imageDirName)
  if (!fs.existsSync(imageDir)) fs.mkdirSync(imageDir)
  let imageName = `${hash.slice(2)}.png`
  let imagePath = path.join(imageDir, imageName)
  fs.renameSync(tempFilePath, imagePath)
  res.status(201) // Created
  res.json({
    apiVersion: "1",
    data: {
      path: `/images/${imageDirName}/${imageName}`,
    },
  })
}

export const uploadImage = wrapAsyncMiddleware(async function uploadImage(req, res) {
  return await convertImageThenRespond(req, res, req.files.file)
})

export const uploadImageJson = wrapAsyncMiddleware(async function uploadImageJson(req, res) {
  let uploadBuffer = dataUriToBuffer(req.body.file)
  let hash = crypto
    .createHash("md5")
    .update(uploadBuffer)
    .digest("hex")
  let uploadFilename = `${hash}-upload`
  let uploadFilePath = path.join(tempDir, uploadFilename)
  fs.writeFileSync(uploadFilePath, uploadBuffer)
  return await convertImageThenRespond(req, res, {
    originalname: uploadFilename,
    path: uploadFilePath,
  })
})
