import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/User.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import { response } from "express"

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
        
    } else {
        
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

const loginUser = asyncHandler(async (req, res)=>{
    //Steps
    //1) Req body for data
    //2) USername or email
    //3) Find the user
    //4) Password check
    //5) Access and refresh token generation
    //6) Send tokens via secure cookies

    const {email, username, password} = req.body
    if (!(username || email)) {
        throw new ApiError(400, "Username or email is required")
    }

    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if(!user){
        throw new ApiError(404, "User does not exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiError(401, "Invalid credentials")
    }

    const {accessToken, refreshToken} = await generateAccessandRefreshTokens(user._id)

    //since we updated refreshToken in db after fetching user, we need to create another instance
    const loggedInUser = await User.findById(user._id).select("-password - refreshToken")

    //Cookies
    const options = {
        httpOnly :true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(200, 
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged in successfully"
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




//Can do like this as well but use async handler because it is easy to catch errors with it
// const registerUser = async (req, res)=>{
//     res.status(200).json({message: "Ok"})
// }

export {registerUser, loginUser, logoutUser}