const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    otp: {
      type: String
    },
    otpExpiry: {
      type: Date
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
