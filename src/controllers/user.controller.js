import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudnary.js";
import { ApiResponse } from "../utils/ApiResponse.js";


generateAccessandRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.gnerateRefreshToken();
        const refreshToken = user.gnerateAccessToken();
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });
        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "Cannot generate token")
    }
}


const registerUser = asyncHandler(async (req, res) => {
    //1) user ko data line
    //2) validation line: empty xa ki xaina
    //3) user already xa ki xaina check garne
    //4) images check garne
    //5) image cloudnari ma uplode garne(image check garne feri)
    //6) object create garne ra db ma entry garne(user object banaune)
    //7) password ra refresh token response bata remove garne
    //8) user create vako xa ki xaina check garne ra response return garne


    //required data
    const { fullName, email, username, password } = req.body;
    console.log(fullName, email, username, password);
    //check if all required feilds are there
    if (
        [fullName, email, username, password].some((field) => { return field?.trim() === "" })
    ) {
        throw new ApiError(400, "All fields are required")
    }
    //check if user already exists
    const existedUser = await User.findOne({ $or: [{ username }, { email }] })
    if (existedUser) {
        throw new ApiError(409, "User already existed")
    }
    //handeling avatar and coverimage
    const avatarLocalPath = req.files?.avatar[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if (!avatarLocalPath) { throw new ApiError(400, "Avatar file is required") }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required");
    }
    //creating user in database
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })
    //removing password and refreshtoken in database
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if (!createdUser) { throw new ApiError(500, "Some") }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User Registered Successfully")
    )

})





const loginUser = asyncHandler(async (req, res) => {
    //1) data line
    //2) username ki ta email check garne
    //3) user find garne
    //4) password check garne
    //5) access ra refresh token user lai dine
    //6) cookie send gardine

    const { username, email, password } = req.body;
    if (!username || !email) {
        throw new ApiError(400, "Username or Password is required");
    }

    const user = await User.findOne({ $or: [{ username }, { email }] });

    if (!user) {
        throw new ApiError(404, "User not found!");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (isPasswordValid) {
        throw new ApiError(401, "Invalid Password");
    }

    const { accessToken, refreshToken } = await generateAccessandRefreshToken(user._id);

    const loggedInUser = await User.findById(user._id);

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(200, { user: loggedInUser, accessToken, refreshToken }, "User logged in successfully")
        )

})

logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, {
        $set: {
            refreshToken: undefined
        }
    }, { new: true })
    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200).clearCookie("accessToken", options).clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User Logged Out"))

})

export { registerUser, loginUser, logoutUser }