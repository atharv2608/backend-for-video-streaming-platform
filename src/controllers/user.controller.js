import jwt from "jsonwebtoken"
import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/User.model.js"
import {uploadOnCloudinary, deleteFromCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import mongoose from "mongoose"

const generateAccessandRefreshTokens = async(userId)=>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        //save refresh token to db
        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave: false}) 
        //In the above code we are only adding refresh token in the db. Since many fields are required in user model it can give error hence we give validateBeforSave as false so it wont validate

        return {accessToken, refreshToken}
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating access and refresh tokens")
    }
}


const registerUser = asyncHandler(async (req, res)=>{
    //get user details from frontend
    //validation - not empty and others
    // check if user already exist: username, email
    //check for images, avatar
    //upload them to cloudinary, check avatar is uploaded
    //retrieve URL from cloudinary
    //create user object - create entry in db
    //remove password and refresh token field from response that is supposed to be sent to the frontend
    // check for user creation
    // return response


    //1) Get user details
    const {fullName, email, username, password } = req.body
    

    //2) Validations
    //can check each field like this but there is also a modern way to do it. Mentioned below
    // if(fullName === ""){
    //     throw new ApiError(400, "Fullname is required")
    // }
    
    if(
        [fullName, email, username, password].some((field)=>{
            return field?.trim() === ""
        })
    ){
        throw new ApiError(400, "Please fill all details")
    }

    //3) Check if user exists
    const existedUser = await User.findOne({
        $or: [{email}, {username}]
    })
    if(existedUser){
        throw new ApiError(409, "User with similar credentials exist")
    }
    console.log(req.files);
    //4) Check for images/avatar
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImagePath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
        
    }

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    }

    //5) Upload them to cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    //If avatar is not uploaded in db it will cause errors as it is required field. So check if avatar is uploaded or not
    if(!avatar){
        throw new ApiError(400, "Avatar file is required")
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    //check if user is created and remove password and other unnecessary fields
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering")
    }

    //returning response
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )

})

const loginUser = asyncHandler(async (req, res) =>{
    //Steps
    //1) Req body for data
    //2) Username or email
    //3) Find the user
    //4) Password check
    //5) Access and refresh token generation
    //6) Send tokens via secure cookies

    const {email, username, password} = req.body
    
    if (!username && !email) {
        throw new ApiError(400, "username or email is required")
    }

    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if (!user) {
        throw new ApiError(404, "User does not exist")
    }

   const isPasswordValid = await user.isPasswordCorrect(password)

   if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials")
    }

   const {accessToken, refreshToken} = await generateAccessandRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )

})

const logoutUser = asyncHandler(async(req, res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        }, 
        {
            new: true
        }
    )

    const options = {
        httpOnly :true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"))

})

const refreshAccessToken = asyncHandler(async (req, res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorised request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id).select(
            "-password"
        )

        if(!user){
            throw new ApiError(401, "Invalid Refresh Token")
        }

        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh token is expired")
        }
    
        const options = {
            httpOnly :true,
            secure: true
        }

        const {accessToken, refreshToken} = await generateAccessandRefreshTokens(user._id)
        console.log("Refresh Token New: ", refreshToken);
        console.log("Access Token New: ",accessToken);
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken: refreshToken},
                "Access Token Refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid Token")
    }

})

const changeCurrentPassword = asyncHandler(async(req, res)=>{
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400, "Invalid Password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(
        new ApiResponse(200, {}, "Password Sent Successfully")
    )
})

const getCurrentUser = asyncHandler(async (req, res)=>{
    return res
    .status(200)
    .json(
        new ApiResponse(200, req.user, "Current User fetched!")
    )
})

const updateAccountDetails = asyncHandler(async (req, res)=>{
    const {fullName, email} = req.body
    if(!fullName || !email){
        throw new ApiError(400, "Atleast one field is required to update")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullName : fullName,
                email
            }
        },
        {
            new: true
        }
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Account Details Updated Successfully")
    )
})

const updateUserAvatar = asyncHandler(async(req, res)=>{
    const oldAvatarFetch = await User.findById(req.user?._id).select("avatar")
    const oldAvatarUrl = oldAvatarFetch?.avatar
    const avatarLocalPath = req.files?.avatar[0]?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is missing")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400, "Error while uploading avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {
            new: true
        }
    ).select("-password")
    
    await deleteFromCloudinary(oldAvatarUrl)
    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Avatar Updated Successfully")
    )
})


const forgotPassword = asyncHandler(async(req, res)=>{
    const {email} = req.body
    if(!email){
        throw new ApiError(400, "Email is required")
    }
    const user = await User.findOne({email})
    if(!user){
        throw new ApiError(404, "User does not exist")
    }
    try{
        const resetToken = user.generateResetToken();
        console.log("Reset Token:" , resetToken);

        const options = {
            httpOnly: true,
            secure: true
        }

        return res
        .status(200)
        .cookie("resetToken", resetToken, options)
        .json(
            new ApiResponse(200, {}, "Check your email for reset link")
        )
    } 
    catch(error){
        throw new ApiError(500, "Something went wrong while generating reset tokens")
    }
})

const resetPassword = asyncHandler(async(req, res)=>{
    const token = req.params.token
    const {newPassword} = req.body
    if(!token){
        throw new ApiError(401, "Unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(token, process.env.RESET_TOKEN_SECRET)
        const user = await User.findById(decodedToken?._id)
        if(!user){
            throw new ApiError(401, "Invalid access token");
        }
        user.password = newPassword
        await user.save({validateBeforeSave: false})
    
        return res
        .status(200)
        .json(
            new ApiResponse(200, {}, "Password reset successfully")
        )
    } catch (error) {
        throw new ApiError(401, "Invalid Access Token")
    }

})

const getUserChannelProfile = asyncHandler(async(req, res)=>{
    const {username} = req.params
    if(!username?.trim()){
        throw new ApiError(400, "User name is missing")
    }

    const channel = await User.aggregate([
        {
            $match:{
                username: username?.toLowerCase()
            }
        },
        {
            //returns all the documents containing the user id in channel field
            $lookup:{
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            //returns all the documents containing the user id in subscribers field
            $lookup:{
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscribers",
                as: "subscribedTo"
            }
        },
        {
            $addFields:{
                subscibersCount:{
                    $size: "$subscribers"
                },
                channelsSubscribedToCount:{
                    $size: "$subscribedTo"
                },
                isSubscribed:{
                    $cond:{
                        //$subscribers are the documents. And in the document we are searching for subscriber id as user id.
                        //Hence we did $subscriber.subscriber
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true, 
                        else: false
                    }
                }
            }
        },
        {
            $project:{
                fullName: 1,
                username: 1,
                subscibersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                email:1,
                coverImage: 1 
            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404, "Channel not found")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "Channel fetched successfully")
    )
})

const getWatchHistory = asyncHandler(async(req, res)=>{
    const user = await User.aggregate([
        {
            $match: {
                _id: mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup:{
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline:[
                    {
                        $lookup:{
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline:[
                                {
                                    $project:{
                                        avatar: 1,
                                        username: 1,
                                        fullName: 1

                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    if(!user){
        throw new ApiError(404, "User not found")
    }
    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch history fetched successfully"
        )
    )
})

export {registerUser, 
    loginUser, 
    logoutUser, 
    refreshAccessToken, 
    changeCurrentPassword, 
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    forgotPassword,
    resetPassword,
    getUserChannelProfile,
    getWatchHistory
}