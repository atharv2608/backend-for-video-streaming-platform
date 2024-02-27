import {v2 as cloudinary} from 'cloudinary';
import fs from "fs"
import { ApiError } from './ApiError.js';
import { ApiResponse } from './ApiResponse.js';
          
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY , 
  api_secret: process.env.CLOUDINARY_API_SECRET  
});

const uploadOnCloudinary = async (localFilePath) =>{
    try{
        if(!localFilePath) return null

        //uploads the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto" //checks the file type
        })
        // console.log("File uploaded to cloudinary");
        // console.log(response.url);
        fs.unlinkSync(localFilePath);
        return response;
    } catch(error){
        //following file removes the locally saved temporary file as the upload fails
        fs.unlinkSync(localFilePath)
        return null;
    }
}

const deleteFromCloudinary = async(url)=>{
    try{
        if(!url){
            throw new ApiError(401, "Url didn't fetched")
        }
        const publicId = url.match(/\/v\d+\/(.+)\.jpg/)[1];
        await cloudinary.uploader.destroy(publicId, (error, result)=>{
            if(error){
                throw new ApiError(500, "Something went wrong while deleting old avatar")
            }
        })
    }
    catch(error){
        throw new ApiError(500, "Internal Server error while deleting old avatar")
    }
}
export {uploadOnCloudinary, deleteFromCloudinary}