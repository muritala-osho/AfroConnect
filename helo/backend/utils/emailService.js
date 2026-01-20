
const nodemailer = require('nodemailer');

// Create email transporter
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Professional OTP Email Template
const getOTPEmailTemplate = (userName, otpCode) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>AfroConnect - OTP Verification</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
              
              <!-- Header with gradient -->
              <tr>
                <td style="background: linear-gradient(135deg, #FE3C72 0%, #FF6B9D 100%); padding: 40px 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                    AfroConnect
                  </h1>
                  <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">
                    Connect with Your Perfect Match
                  </p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 50px 40px;">
                  <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px; font-weight: 600;">
                    Hello ${userName || 'there'}! 👋
                  </h2>
                  
                  <p style="margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                    We received a request to verify your email address. Use the verification code below to complete your registration:
                  </p>
                  
                  <!-- OTP Box -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding: 30px 0;">
                        <div style="background: linear-gradient(135deg, #FFF5F7 0%, #FFE8ED 100%); border: 2px dashed #FE3C72; border-radius: 12px; padding: 30px; display: inline-block;">
                          <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
                            Your Verification Code
                          </p>
                          <p style="margin: 0; color: #FE3C72; font-size: 42px; font-weight: 700; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                            ${otpCode}
                          </p>
                        </div>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="margin: 30px 0 20px 0; color: #666666; font-size: 15px; line-height: 1.6;">
                    This code will expire in <strong style="color: #FE3C72;">10 minutes</strong>. If you didn't request this code, please ignore this email.
                  </p>
                  
                  <!-- Security Note -->
                  <div style="background-color: #FFF9E6; border-left: 4px solid #FFC107; padding: 15px 20px; margin: 30px 0; border-radius: 4px;">
                    <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.5;">
                      <strong>🔒 Security Tip:</strong> Never share this code with anyone. AfroConnect will never ask for your verification code.
                    </p>
                  </div>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #F8F9FA; padding: 30px 40px; border-top: 1px solid #E9ECEF;">
                  <p style="margin: 0 0 15px 0; color: #666666; font-size: 14px; text-align: center;">
                    Need help? Contact us at 
                    <a href="mailto:support@afroconnect.com" style="color: #FE3C72; text-decoration: none;">support@afroconnect.com</a>
                  </p>
                  
                  <p style="margin: 0; color: #999999; font-size: 12px; text-align: center; line-height: 1.5;">
                    © 2025 AfroConnect. All rights reserved.<br>
                    Making meaningful connections across Africa and beyond.
                  </p>
                  
                  <!-- Social Links (optional) -->
                  <div style="text-align: center; margin-top: 20px;">
                    <a href="#" style="display: inline-block; margin: 0 10px; color: #999999; text-decoration: none; font-size: 12px;">Privacy Policy</a>
                    <span style="color: #CCCCCC;">|</span>
                    <a href="#" style="display: inline-block; margin: 0 10px; color: #999999; text-decoration: none; font-size: 12px;">Terms of Service</a>
                  </div>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

// Welcome Email Template
const getWelcomeEmailTemplate = (userName) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to AfroConnect</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
              
              <tr>
                <td style="background: linear-gradient(135deg, #FE3C72 0%, #FF6B9D 100%); padding: 50px 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 36px; font-weight: 700;">
                    Welcome to AfroConnect! 🎉
                  </h1>
                </td>
              </tr>
              
              <tr>
                <td style="padding: 50px 40px;">
                  <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px;">
                    Hi ${userName}! 👋
                  </h2>
                  
                  <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                    We're thrilled to have you join our community! AfroConnect is more than just a dating app—it's a platform where authentic connections happen.
                  </p>
                  
                  <h3 style="margin: 30px 0 15px 0; color: #333333; font-size: 18px;">
                    Get Started:
                  </h3>
                  
                  <ul style="color: #666666; font-size: 15px; line-height: 1.8; padding-left: 20px;">
                    <li>Complete your profile with great photos</li>
                    <li>Share your interests and what makes you unique</li>
                    <li>Start swiping to find your perfect match</li>
                    <li>Send friend requests and start chatting</li>
                  </ul>
                  
                  <div style="text-align: center; margin: 40px 0;">
                    <a href="#" style="display: inline-block; background: linear-gradient(135deg, #FE3C72 0%, #FF6B9D 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 30px; font-size: 16px; font-weight: 600;">
                      Complete Your Profile
                    </a>
                  </div>
                  
                  <p style="margin: 30px 0 0 0; color: #999999; font-size: 14px; text-align: center; font-style: italic;">
                    "Your perfect match is just a swipe away!" ❤️
                  </p>
                </td>
              </tr>
              
              <tr>
                <td style="background-color: #F8F9FA; padding: 30px 40px; border-top: 1px solid #E9ECEF; text-align: center;">
                  <p style="margin: 0; color: #999999; font-size: 12px;">
                    © 2025 AfroConnect. All rights reserved.
                  </p>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

// Password Reset Email Template
const getPasswordResetEmailTemplate = (userName, resetLink) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
              
              <tr>
                <td style="background: linear-gradient(135deg, #FE3C72 0%, #FF6B9D 100%); padding: 40px 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                    Password Reset Request
                  </h1>
                </td>
              </tr>
              
              <tr>
                <td style="padding: 50px 40px;">
                  <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 22px;">
                    Hi ${userName},
                  </h2>
                  
                  <p style="margin: 0 0 25px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                    We received a request to reset your password. Click the button below to create a new password:
                  </p>
                  
                  <div style="text-align: center; margin: 35px 0;">
                    <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #FE3C72 0%, #FF6B9D 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 30px; font-size: 16px; font-weight: 600;">
                      Reset Password
                    </a>
                  </div>
                  
                  <p style="margin: 25px 0; color: #666666; font-size: 14px; line-height: 1.6;">
                    This link will expire in <strong>30 minutes</strong>. If you didn't request a password reset, you can safely ignore this email.
                  </p>
                  
                  <div style="background-color: #FFF3CD; border-left: 4px solid #FFC107; padding: 15px 20px; margin: 25px 0; border-radius: 4px;">
                    <p style="margin: 0; color: #856404; font-size: 13px;">
                      For security reasons, never share your password or reset link with anyone.
                    </p>
                  </div>
                </td>
              </tr>
              
              <tr>
                <td style="background-color: #F8F9FA; padding: 25px 40px; border-top: 1px solid #E9ECEF; text-align: center;">
                  <p style="margin: 0; color: #999999; font-size: 12px;">
                    © 2025 AfroConnect. All rights reserved.
                  </p>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

// Send OTP Email
const sendOTPEmail = async (email, userName, otpCode) => {
  try {
    const mailOptions = {
      from: `"AfroConnect" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔐 Your AfroConnect Verification Code',
      html: getOTPEmailTemplate(userName, otpCode)
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('OTP email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending OTP email:', error);
    throw new Error('Failed to send OTP email');
  }
};

// Send Welcome Email
const sendWelcomeEmail = async (email, userName) => {
  try {
    const mailOptions = {
      from: `"AfroConnect" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🎉 Welcome to AfroConnect - Let\'s Find Your Match!',
      html: getWelcomeEmailTemplate(userName)
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw new Error('Failed to send welcome email');
  }
};

// Send Password Reset Email
const sendPasswordResetEmail = async (email, userName, resetToken) => {
  try {
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: `"AfroConnect" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔒 Reset Your AfroConnect Password',
      html: getPasswordResetEmailTemplate(userName, resetLink)
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};

// Ban Notification Email Template
const getBanNotificationTemplate = (userName, reason) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Account Suspended - AfroConnect</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
              <tr>
                <td style="background: linear-gradient(135deg, #FF6B6B 0%, #FF8A80 100%); padding: 40px 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Account Suspended</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 50px 40px;">
                  <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 22px;">Hi ${userName},</h2>
                  <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                    Your AfroConnect account has been suspended due to a violation of our Community Guidelines.
                  </p>
                  <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                    <strong>Reason:</strong> ${reason || 'Violation of community guidelines'}
                  </p>
                  <div style="background-color: #FFF3CD; border-left: 4px solid #FFC107; padding: 15px 20px; margin: 25px 0; border-radius: 4px;">
                    <p style="margin: 0; color: #856404; font-size: 14px;">
                      <strong>What happens next?</strong> You can submit an appeal through the AfroConnect app to have your case reviewed by our team.
                    </p>
                  </div>
                  <p style="margin: 20px 0; color: #666666; font-size: 15px;">
                    If you believe this was a mistake, please submit an appeal with your explanation. Our team will review it and respond within 5-7 business days.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background-color: #F8F9FA; padding: 30px 40px; border-top: 1px solid #E9ECEF; text-align: center;">
                  <p style="margin: 0; color: #999999; font-size: 12px;">
                    © 2025 AfroConnect. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

// Unban Notification Email Template
const getUnbanNotificationTemplate = (userName) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Appeal Was Approved - AfroConnect</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
              <tr>
                <td style="background: linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%); padding: 40px 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">You're Back! 🎉</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 50px 40px;">
                  <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 22px;">Hi ${userName},</h2>
                  <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                    Great news! Your appeal has been approved and your account has been restored. You can now log back into AfroConnect.
                  </p>
                  <div style="background-color: #E8F5E9; border-left: 4px solid #4CAF50; padding: 15px 20px; margin: 25px 0; border-radius: 4px;">
                    <p style="margin: 0; color: #2E7D32; font-size: 14px;">
                      <strong>Welcome back!</strong> Please review our Community Guidelines to ensure you understand our policies.
                    </p>
                  </div>
                  <p style="margin: 20px 0; color: #666666; font-size: 15px;">
                    We're excited to have you back in the AfroConnect community. Remember to treat all members with respect and follow our guidelines.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background-color: #F8F9FA; padding: 30px 40px; border-top: 1px solid #E9ECEF; text-align: center;">
                  <p style="margin: 0; color: #999999; font-size: 12px;">
                    © 2025 AfroConnect. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

// Appeal Decision Email Template
const getAppealDecisionTemplate = (userName, approved, adminResponse) => {
  const bgColor = approved ? '#E8F5E9' : '#FFEBEE';
  const borderColor = approved ? '#4CAF50' : '#FF6B6B';
  const title = approved ? 'Appeal Approved ✓' : 'Appeal Decision';
  const textColor = approved ? '#2E7D32' : '#C62828';
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} - AfroConnect</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
              <tr>
                <td style="background: linear-gradient(135deg, ${approved ? '#4CAF50' : '#FF6B6B'} 0%, ${approved ? '#66BB6A' : '#FF8A80'} 100%); padding: 40px 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">${title}</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 50px 40px;">
                  <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 22px;">Hi ${userName},</h2>
                  <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                    Your appeal has been reviewed by our team. Here is their decision:
                  </p>
                  <div style="background-color: ${bgColor}; border-left: 4px solid ${borderColor}; padding: 15px 20px; margin: 25px 0; border-radius: 4px;">
                    <p style="margin: 0; color: ${textColor}; font-size: 14px; line-height: 1.6;">
                      ${adminResponse || (approved ? 'Your appeal has been approved. Your account has been restored.' : 'Your appeal has been reviewed. Please review our Community Guidelines for next steps.')}
                    </p>
                  </div>
                  ${!approved ? `<p style="margin: 20px 0; color: #666666; font-size: 15px;">
                    You can submit a new appeal in 30 days if you wish to challenge this decision.
                  </p>` : ''}
                </td>
              </tr>
              <tr>
                <td style="background-color: #F8F9FA; padding: 30px 40px; border-top: 1px solid #E9ECEF; text-align: center;">
                  <p style="margin: 0; color: #999999; font-size: 12px;">
                    © 2025 AfroConnect. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

// Send Ban Notification Email
const sendBanNotificationEmail = async (email, userName, reason) => {
  try {
    const mailOptions = {
      from: `"AfroConnect" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '⚠️ Your AfroConnect Account Has Been Suspended',
      html: getBanNotificationTemplate(userName, reason)
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Ban notification email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending ban notification email:', error);
    throw new Error('Failed to send ban notification email');
  }
};

// Send Unban Notification Email
const sendUnbanNotificationEmail = async (email, userName) => {
  try {
    const mailOptions = {
      from: `"AfroConnect" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '✓ Your Appeal Was Approved - Welcome Back!',
      html: getUnbanNotificationTemplate(userName)
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Unban notification email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending unban notification email:', error);
    throw new Error('Failed to send unban notification email');
  }
};

// Send Appeal Decision Email
const sendAppealDecisionEmail = async (email, userName, approved, adminResponse) => {
  try {
    const mailOptions = {
      from: `"AfroConnect" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: approved ? '✓ Your Appeal Was Approved!' : '⚠️ Appeal Decision',
      html: getAppealDecisionTemplate(userName, approved, adminResponse)
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Appeal decision email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending appeal decision email:', error);
    throw new Error('Failed to send appeal decision email');
  }
};

// Generate OTP Code
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

module.exports = {
  sendOTPEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendBanNotificationEmail,
  sendUnbanNotificationEmail,
  sendAppealDecisionEmail,
  generateOTP
};
