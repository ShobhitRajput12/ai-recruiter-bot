const nodemailer = require("nodemailer");

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("SMTP configuration is missing");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass
    }
  });
}

async function sendOtpEmail({ to, otp }) {
  const allowDevFallback =
    process.env.NODE_ENV !== "production" &&
    process.env.DEV_OTP_FALLBACK === "true";

  const from =
    process.env.SMTP_FROM ||
    (process.env.SMTP_USER ? `Hirebud AI <${process.env.SMTP_USER}>` : undefined);

  if (!from) {
    throw new Error("SMTP_FROM is not set");
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if ((!host || !user || !pass) && allowDevFallback) {
    console.warn("SMTP configuration missing. Using DEV_OTP_FALLBACK.");
    console.log(`DEV OTP for ${to}: ${otp}`);
    return;
  }

  const transporter = getTransporter();

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2 style="color: #222;">Verify your Hirebud AI account</h2>
      <p>Use the OTP below to verify your email address:</p>
      <div style="font-size: 28px; font-weight: 700; letter-spacing: 4px; margin: 16px 0;">
        ${otp}
      </div>
      <p>This code expires in 5 minutes. If you did not request this, you can ignore this email.</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from,
      to,
      subject: "Your Hirebud AI verification code",
      html
    });
  } catch (err) {
    if (allowDevFallback) {
      console.warn("SMTP send failed. Using DEV_OTP_FALLBACK.", err.message);
      console.log(`DEV OTP for ${to}: ${otp}`);
      return;
    }
    throw err;
  }
}

module.exports = {
  sendOtpEmail
};
