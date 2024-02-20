import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { COOKIE_OPTIONS } from "../constants.js";
import jwt from "jsonwebtoken";

const generateAccessRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (err) {
    throw new ApiError(
      500,
      "Something went wrong while generating Access and refresh token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  // get user details from frontend
  // validate if anything is missing
  // check if user id already exists: username,email
  // check for images (avatar, coverImage)
  // uplad images on cloudinary
  // create user object - entry in db
  // remove password and refresh token field from response
  // check for user creation
  // return response

  const { username, email, fullname, password } = req.body;

  if (
    [fullname, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });
  //   console.log(req.files);

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }
  const avatarLocalPath = req?.files?.avatar[0]?.path;
  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files?.coverImage) &&
    req.files?.coverImage?.length > 0
  ) {
    coverImageLocalPath = req.files?.coverImage[0]?.path;
  }
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  const user = await User.create({
    fullname,
    email,
    username: username?.toLowerCase(),
    password,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
  });

  const createdUser = await User.findById(user?._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, createdUser, "User registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  // get all filed from req
  // validate if any field missing (username, email, password)
  // check if user is exist or not with username or email
  // check password is valid or not
  // generate access token and refresh token
  // send res with tokens in cookie

  const { username, email, password } = req.body;

  if (!username && !email) {
    throw new ApiError(400, "Username or email is required");
  }

  if (!password) {
    throw new ApiError(400, "Password is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User does not exists");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  const { accessToken, refreshToken } = await generateAccessRefreshToken(
    user?._id
  );

  const loggedInUser = await User.findById(user?._id).select(
    "-password -refreshToken"
  );

  return res
    .status(200)
    .cookie("accessToken", accessToken, COOKIE_OPTIONS)
    .cookie("refreshToken", refreshToken, COOKIE_OPTIONS)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "User Logged In Successfully"
      )
    );
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "User fetched successfully"));
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  // get old and new password from req
  // validate all fields
  // get user and compare old password
  // set new password in user and send res

  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    throw new ApiError(400, "All fields are required");
  }

  const user = await User.findById(req.user._id);
  const isPassCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPassCorrect) {
    throw new ApiError(400, "Invalid old password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });
  return res.status(200).json(200, "Password changed successfully");
});

const logoutUser = asyncHandler(async (req, res) => {
  // remove refresh token from db
  // remove access and refresh token from cookies

  await User.findByIdAndUpdate(
    req.user?._id,
    {
      $unset: {
        refreshToken: 1, //remove the refreshToken field from the user document.
      },
    },
    {
      new: true, // return the modified document after the update operation has been applied.
    }
  );

  return res
    .status(200)
    .clearCookie("accessToken", COOKIE_OPTIONS)
    .clearCookie("refreshToken", COOKIE_OPTIONS)
    .json(new ApiResponse(200, {}, "User logged Out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  // get refresh token from frontend
  // validate token is available or not
  // decode token and get user
  // compare refrsh token
  // generate both token again
  // send res with both token
  const incomingRfreshToken = req.cookies.refreshToken || req.body.accessToken;

  if (!incomingRfreshToken) {
    throw new ApiError(401, "Unauthorized Access");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRfreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRfreshToken !== user?.refreshToken) {
      throw new ApiError(401, "RefreshToken is expired or used");
    }
    const { accessToken, refreshToken } = await generateAccessRefreshToken(
      user?._id
    );
    return res
      .status(200)
      .cookie("accessToken", accessToken, COOKIE_OPTIONS)
      .cookie("refreshToken", refreshToken, COOKIE_OPTIONS)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken },
          "Access token refreshed !!"
        )
      );
  } catch (err) {
    throw new ApiError(401, err?.message || "Unautorized access");
  }
});
export {
  registerUser,
  loginUser,
  getCurrentUser,
  changeCurrentPassword,
  logoutUser,
  refreshAccessToken,
};
