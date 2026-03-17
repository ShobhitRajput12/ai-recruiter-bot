const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { sendOtpEmail } = require("../utils/mailer");

const router = express.Router();

function validateEmail(email) {
  return typeof email === "string" && /\S+@\S+\.\S+/.test(email);
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getOtpExpiry() {
  const minutes = Number(process.env.OTP_EXPIRY_MINUTES || 5);
  return new Date(Date.now() + minutes * 60 * 1000);
}

router.post("/register", async (req, res) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";

    if (!validateEmail(email)) {
      return res.status(400).json({ error: "Valid email is required" });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const normalizedEmail = email.toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      if (existing.isVerified) {
        return res.status(409).json({ error: "Email already registered" });
      }

      const otp = generateOtp();
      existing.otp = otp;
      existing.otpExpiry = getOtpExpiry();
      await existing.save();

      await sendOtpEmail({ to: normalizedEmail, otp });
      return res.status(200).json({
        message: "OTP re-sent to your email",
        verificationRequired: true
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const otp = generateOtp();
    const user = await User.create({
      email: normalizedEmail,
      passwordHash,
      isVerified: false,
      otp,
      otpExpiry: getOtpExpiry()
    });

    try {
      await sendOtpEmail({ to: normalizedEmail, otp });
    } catch (emailErr) {
      console.error("OTP email error:", emailErr);
      await User.deleteOne({ _id: user._id });
      return res.status(500).json({ error: "Failed to send OTP email" });
    }

    res.status(201).json({
      message: "OTP sent to your email",
      verificationRequired: true
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Failed to register" });
  }
});

router.post("/verify-otp", async (req, res) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim() : "";
    const otp = typeof req.body.otp === "string" ? req.body.otp.trim() : "";

    if (!validateEmail(email) || !otp) {
      return res.status(400).json({ error: "Email and OTP are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ error: "Invalid email or OTP" });
    }

    if (user.isVerified) {
      return res.status(200).json({ message: "Email already verified" });
    }

    if (!user.otp || !user.otpExpiry) {
      return res.status(400).json({ error: "OTP not found. Please request a new one." });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    if (user.otpExpiry.getTime() < Date.now()) {
      return res.status(400).json({ error: "OTP expired. Please request a new one." });
    }

    user.isVerified = true;
    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not set");
      return res.status(500).json({ error: "Server configuration error" });
    }

    const token = jwt.sign(
      { id: user._id.toString(), email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Email verified successfully",
      token,
      user: { id: user._id.toString(), email: user.email }
    });
  } catch (err) {
    console.error("Verify OTP error:", err);
    res.status(500).json({ error: "Failed to verify OTP" });
  }
});

router.post("/resend-otp", async (req, res) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim() : "";

    if (!validateEmail(email)) {
      return res.status(400).json({ error: "Valid email is required" });
    }

    const normalizedEmail = email.toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(400).json({ error: "Email not found" });
    }

    if (user.isVerified) {
      return res.status(200).json({ message: "Email already verified" });
    }

    const otp = generateOtp();
    user.otp = otp;
    user.otpExpiry = getOtpExpiry();
    await user.save();

    await sendOtpEmail({ to: normalizedEmail, otp });

    res.json({ message: "OTP re-sent to your email" });
  } catch (err) {
    console.error("Resend OTP error:", err);
    res.status(500).json({ error: "Failed to resend OTP" });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim() : "";

    if (!validateEmail(email)) {
      return res.status(400).json({ error: "Valid email is required" });
    }

    const normalizedEmail = email.toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (user) {
      const otp = generateOtp();
      user.otp = otp;
      user.otpExpiry = getOtpExpiry();
      await user.save();

      try {
        await sendOtpEmail({ to: normalizedEmail, otp });
      } catch (emailErr) {
        console.error("Forgot password OTP email error:", emailErr);
        return res.status(500).json({ error: "Failed to send OTP email" });
      }
    }

    return res.json({ message: "OTP sent to your email" });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Failed to process forgot password request" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim() : "";
    const otp = typeof req.body.otp === "string" ? req.body.otp.trim() : "";
    const newPassword =
      typeof req.body.newPassword === "string" ? req.body.newPassword : "";

    if (!validateEmail(email) || !otp || !newPassword) {
      return res.status(400).json({ error: "Email, OTP, and new password are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.otp || !user.otpExpiry) {
      return res.status(400).json({ error: "Invalid email or OTP" });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ error: "Invalid email or OTP" });
    }

    if (user.otpExpiry.getTime() < Date.now()) {
      return res.status(400).json({ error: "OTP expired. Please request a new one." });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";

    if (!validateEmail(email) || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!user.isVerified) {
      return res.status(403).json({ error: "Email not verified" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not set");
      return res.status(500).json({ error: "Server configuration error" });
    }

    const token = jwt.sign(
      { id: user._id.toString(), email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: { id: user._id.toString(), email: user.email }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Failed to login" });
  }
});

module.exports = router;
