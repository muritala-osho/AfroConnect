const nodemailer = require('nodemailer');
const path = require('path');

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Brand palette — Emerald Blue
const BRAND = {
  gradientStart: '#059669',   // emerald
  gradientEnd:   '#0EA5E9',   // sky blue
  primary:       '#059669',
  primaryLight:  '#E8FAF5',
  accent:        '#0EA5E9',
  accentLight:   '#E0F2FE',
};

// Reusable logo block (CID inline)
const LOGO_BLOCK = `
  <img src="cid:afroconnect-logo"
       alt="AfroConnect"
       width="80" height="80"
       style="border-radius: 16px; display: block; margin: 0 auto 14px auto;" />
`;

// Reusable header section
const emailHeader = (title, subtitle = '') => `
  <tr>
    <td style="background: linear-gradient(135deg, ${BRAND.gradientStart} 0%, ${BRAND.gradientEnd} 100%);
               padding: 40px 30px; text-align: center;">
      ${LOGO_BLOCK}
      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.3px;">
        ${title}
      </h1>
      ${subtitle ? `<p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.88); font-size: 15px;">${subtitle}</p>` : ''}
    </td>
  </tr>
`;

// Reusable footer
const emailFooter = () => `
  <tr>
    <td style="background-color: #F8F9FA; padding: 28px 40px; border-top: 1px solid #E9ECEF; text-align: center;">
      <p style="margin: 0 0 10px 0; color: #666666; font-size: 13px;">
        Need help? <a href="mailto:support@afroconnect.app"
          style="color: ${BRAND.primary}; text-decoration: none; font-weight: 600;">
          support@afroconnect.app
        </a>
      </p>
      <div style="margin: 12px 0;">
        <a href="#" style="color: #999999; font-size: 11px; text-decoration: none; margin: 0 8px;">Privacy Policy</a>
        <span style="color: #CCCCCC;">|</span>
        <a href="#" style="color: #999999; font-size: 11px; text-decoration: none; margin: 0 8px;">Terms of Service</a>
      </div>
      <p style="margin: 0; color: #AAAAAA; font-size: 11px; line-height: 1.5;">
        © 2025 AfroConnect. All rights reserved.<br/>
        Making meaningful connections across Africa and beyond.
      </p>
    </td>
  </tr>
`;

// Email shell wrapper
const emailShell = (bodyRows) => `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f0f4f8;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f8;padding:40px 20px;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0"
            style="background-color:#ffffff;border-radius:16px;overflow:hidden;
                   box-shadow:0 6px 24px rgba(0,0,0,0.10);">
            ${bodyRows}
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
`;

// ─── OTP Email ────────────────────────────────────────────────────────────────
const getOTPEmailTemplate = (userName, otpCode) => emailShell(`
  ${emailHeader('AfroConnect', 'Connect with Your Perfect Match')}
  <tr>
    <td style="padding: 48px 40px;">
      <h2 style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 22px; font-weight: 700;">
        Hello ${userName || 'there'}! 👋
      </h2>
      <p style="margin: 0 0 28px 0; color: #555555; font-size: 16px; line-height: 1.7;">
        We received a request to verify your email address.
        Use the code below to complete your registration:
      </p>

      <!-- OTP Box -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding: 28px 0;">
            <div style="background: linear-gradient(135deg, ${BRAND.primaryLight} 0%, ${BRAND.accentLight} 100%);
                        border: 2px dashed ${BRAND.accent};
                        border-radius: 14px; padding: 28px 32px; display: inline-block;">
              <p style="margin: 0 0 8px 0; color: #555555; font-size: 13px;
                         text-transform: uppercase; letter-spacing: 1.2px; font-weight: 600;">
                Your Verification Code
              </p>
              <p style="margin: 0; color: ${BRAND.primary}; font-size: 44px; font-weight: 800;
                         letter-spacing: 10px; font-family: 'Courier New', monospace;">
                ${otpCode}
              </p>
            </div>
          </td>
        </tr>
      </table>

      <p style="margin: 20px 0; color: #555555; font-size: 15px; line-height: 1.7;">
        This code expires in <strong style="color: ${BRAND.primary};">10 minutes</strong>.
        If you didn't request this, please ignore this email.
      </p>

      <div style="background-color: #FFF9E6; border-left: 4px solid #F59E0B;
                  padding: 14px 18px; margin: 24px 0; border-radius: 6px;">
        <p style="margin: 0; color: #92400E; font-size: 13px; line-height: 1.6;">
          <strong>🔒 Security Tip:</strong> Never share this code with anyone.
          AfroConnect will never ask for your verification code.
        </p>
      </div>
    </td>
  </tr>
  ${emailFooter()}
`);

// ─── Welcome Email ────────────────────────────────────────────────────────────
const getWelcomeEmailTemplate = (userName) => emailShell(`
  ${emailHeader('Welcome to AfroConnect! 🎉')}
  <tr>
    <td style="padding: 48px 40px;">
      <h2 style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 22px; font-weight: 700;">
        Hi ${userName}! 👋
      </h2>
      <p style="margin: 0 0 20px 0; color: #555555; font-size: 16px; line-height: 1.7;">
        We're thrilled to have you join our community! AfroConnect is more than just a dating
        app — it's a platform where authentic connections happen.
      </p>

      <h3 style="margin: 28px 0 14px 0; color: #1a1a1a; font-size: 17px; font-weight: 700;">
        Get Started:
      </h3>
      <ul style="color: #555555; font-size: 15px; line-height: 1.9; padding-left: 20px; margin: 0 0 32px 0;">
        <li>Complete your profile with great photos</li>
        <li>Share your interests and what makes you unique</li>
        <li>Start swiping to find your perfect match</li>
        <li>Send friend requests and start chatting</li>
      </ul>

      <div style="text-align: center; margin: 36px 0;">
        <a href="#" style="display: inline-block;
           background: linear-gradient(135deg, ${BRAND.gradientStart} 0%, ${BRAND.gradientEnd} 100%);
           color: #ffffff; text-decoration: none; padding: 16px 42px;
           border-radius: 32px; font-size: 16px; font-weight: 700; letter-spacing: 0.3px;">
          Complete Your Profile →
        </a>
      </div>

      <p style="margin: 24px 0 0 0; color: #AAAAAA; font-size: 14px; text-align: center; font-style: italic;">
        "Your perfect match is just a swipe away!" 💚
      </p>
    </td>
  </tr>
  ${emailFooter()}
`);

// ─── Password Reset Email ─────────────────────────────────────────────────────
const getPasswordResetEmailTemplate = (userName, resetLink) => emailShell(`
  ${emailHeader('Password Reset Request')}
  <tr>
    <td style="padding: 48px 40px;">
      <h2 style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 22px; font-weight: 700;">
        Hi ${userName},
      </h2>
      <p style="margin: 0 0 24px 0; color: #555555; font-size: 16px; line-height: 1.7;">
        We received a request to reset your password.
        Click the button below to create a new one:
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetLink}" style="display: inline-block;
           background: linear-gradient(135deg, ${BRAND.gradientStart} 0%, ${BRAND.gradientEnd} 100%);
           color: #ffffff; text-decoration: none; padding: 16px 42px;
           border-radius: 32px; font-size: 16px; font-weight: 700;">
          Reset Password
        </a>
      </div>

      <p style="margin: 20px 0; color: #555555; font-size: 14px; line-height: 1.7;">
        This link expires in <strong>30 minutes</strong>.
        If you didn't request a password reset, you can safely ignore this email.
      </p>

      <div style="background-color: #FFF9E6; border-left: 4px solid #F59E0B;
                  padding: 14px 18px; margin: 20px 0; border-radius: 6px;">
        <p style="margin: 0; color: #92400E; font-size: 13px;">
          For security, never share your password or reset link with anyone.
        </p>
      </div>
    </td>
  </tr>
  ${emailFooter()}
`);

// ─── Ban Notification ─────────────────────────────────────────────────────────
const getBanNotificationTemplate = (userName, reason) => emailShell(`
  <tr>
    <td style="background: linear-gradient(135deg, #DC2626 0%, #EF4444 100%);
               padding: 40px 30px; text-align: center;">
      ${LOGO_BLOCK}
      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
        Account Suspended
      </h1>
    </td>
  </tr>
  <tr>
    <td style="padding: 48px 40px;">
      <h2 style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 22px;">Hi ${userName},</h2>
      <p style="margin: 0 0 20px 0; color: #555555; font-size: 16px; line-height: 1.7;">
        Your AfroConnect account has been suspended due to a violation of our Community Guidelines.
      </p>
      <p style="margin: 0 0 20px 0; color: #555555; font-size: 16px; line-height: 1.7;">
        <strong>Reason:</strong> ${reason || 'Violation of community guidelines'}
      </p>
      <div style="background-color: #FFF9E6; border-left: 4px solid #F59E0B;
                  padding: 14px 18px; margin: 20px 0; border-radius: 6px;">
        <p style="margin: 0; color: #92400E; font-size: 14px; line-height: 1.6;">
          <strong>What happens next?</strong> You can submit an appeal through the AfroConnect
          app to have your case reviewed by our team.
        </p>
      </div>
      <p style="margin: 16px 0; color: #555555; font-size: 15px; line-height: 1.7;">
        If you believe this was a mistake, submit an appeal with your explanation.
        Our team will respond within 5–7 business days.
      </p>
    </td>
  </tr>
  ${emailFooter()}
`);

// ─── Unban Notification ───────────────────────────────────────────────────────
const getUnbanNotificationTemplate = (userName) => emailShell(`
  ${emailHeader("You're Back! 🎉")}
  <tr>
    <td style="padding: 48px 40px;">
      <h2 style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 22px;">Hi ${userName},</h2>
      <p style="margin: 0 0 20px 0; color: #555555; font-size: 16px; line-height: 1.7;">
        Great news! Your appeal has been approved and your account has been restored.
        You can now log back into AfroConnect.
      </p>
      <div style="background-color: ${BRAND.primaryLight}; border-left: 4px solid ${BRAND.primary};
                  padding: 14px 18px; margin: 20px 0; border-radius: 6px;">
        <p style="margin: 0; color: #065F46; font-size: 14px; line-height: 1.6;">
          <strong>Welcome back!</strong> Please review our Community Guidelines to ensure
          you understand our policies.
        </p>
      </div>
      <p style="margin: 16px 0; color: #555555; font-size: 15px; line-height: 1.7;">
        We're excited to have you back. Remember to treat all members with respect
        and follow our guidelines.
      </p>
    </td>
  </tr>
  ${emailFooter()}
`);

// ─── Appeal Decision ──────────────────────────────────────────────────────────
const getAppealDecisionTemplate = (userName, approved, adminResponse) => {
  const headerBg  = approved ? `linear-gradient(135deg, ${BRAND.gradientStart} 0%, ${BRAND.gradientEnd} 100%)` : 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)';
  const noteBg    = approved ? BRAND.primaryLight : '#FEE2E2';
  const noteBorder= approved ? BRAND.primary      : '#DC2626';
  const noteText  = approved ? '#065F46'           : '#991B1B';
  const title     = approved ? 'Appeal Approved ✓' : 'Appeal Decision';

  return emailShell(`
    <tr>
      <td style="background: ${headerBg}; padding: 40px 30px; text-align: center;">
        ${LOGO_BLOCK}
        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">${title}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 48px 40px;">
        <h2 style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 22px;">Hi ${userName},</h2>
        <p style="margin: 0 0 20px 0; color: #555555; font-size: 16px; line-height: 1.7;">
          Your appeal has been reviewed by our team. Here is their decision:
        </p>
        <div style="background-color: ${noteBg}; border-left: 4px solid ${noteBorder};
                    padding: 14px 18px; margin: 20px 0; border-radius: 6px;">
          <p style="margin: 0; color: ${noteText}; font-size: 14px; line-height: 1.7;">
            ${adminResponse || (approved
              ? 'Your appeal has been approved. Your account has been restored.'
              : 'Your appeal has been reviewed. Please review our Community Guidelines for next steps.'
            )}
          </p>
        </div>
        ${!approved ? `
        <p style="margin: 16px 0; color: #555555; font-size: 15px; line-height: 1.7;">
          You can submit a new appeal in 30 days if you wish to challenge this decision.
        </p>` : ''}
      </td>
    </tr>
    ${emailFooter()}
  `);
};

// ─── Logo attachment helper ───────────────────────────────────────────────────
const logoAttachment = () => ({
  filename: 'afroconnect-logo.png',
  path: path.join(__dirname, '../../frontend/assets/afroconnect-logo.png'),
  cid: 'afroconnect-logo',
});

// ─── Send functions ───────────────────────────────────────────────────────────
const sendOTPEmail = async (email, userName, otpCode) => {
  try {
    const info = await transporter.sendMail({
      from: `"AfroConnect" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔐 Your AfroConnect Verification Code',
      html: getOTPEmailTemplate(userName, otpCode),
      attachments: [logoAttachment()],
    });
    console.log('OTP email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending OTP email:', error);
    throw new Error('Failed to send OTP email');
  }
};

const sendWelcomeEmail = async (email, userName) => {
  try {
    const info = await transporter.sendMail({
      from: `"AfroConnect" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🎉 Welcome to AfroConnect — Let\'s Find Your Match!',
      html: getWelcomeEmailTemplate(userName),
      attachments: [logoAttachment()],
    });
    console.log('Welcome email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw new Error('Failed to send welcome email');
  }
};

const sendPasswordResetEmail = async (email, userName, resetToken) => {
  try {
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const info = await transporter.sendMail({
      from: `"AfroConnect" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔒 Reset Your AfroConnect Password',
      html: getPasswordResetEmailTemplate(userName, resetLink),
      attachments: [logoAttachment()],
    });
    console.log('Password reset email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};

const sendBanNotificationEmail = async (email, userName, reason) => {
  try {
    const info = await transporter.sendMail({
      from: `"AfroConnect" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '⚠️ Your AfroConnect Account Has Been Suspended',
      html: getBanNotificationTemplate(userName, reason),
      attachments: [logoAttachment()],
    });
    console.log('Ban notification email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending ban notification email:', error);
    throw new Error('Failed to send ban notification email');
  }
};

const sendUnbanNotificationEmail = async (email, userName) => {
  try {
    const info = await transporter.sendMail({
      from: `"AfroConnect" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '✓ Your Appeal Was Approved — Welcome Back!',
      html: getUnbanNotificationTemplate(userName),
      attachments: [logoAttachment()],
    });
    console.log('Unban notification email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending unban notification email:', error);
    throw new Error('Failed to send unban notification email');
  }
};

const sendAppealDecisionEmail = async (email, userName, approved, adminResponse) => {
  try {
    const info = await transporter.sendMail({
      from: `"AfroConnect" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: approved ? '✓ Your Appeal Was Approved!' : '⚠️ Appeal Decision',
      html: getAppealDecisionTemplate(userName, approved, adminResponse),
      attachments: [logoAttachment()],
    });
    console.log('Appeal decision email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending appeal decision email:', error);
    throw new Error('Failed to send appeal decision email');
  }
};

// ─── Verification Approved ────────────────────────────────────────────────────
const getVerificationApprovedTemplate = (userName) => emailShell(`
  ${emailHeader('Identity Verified! ✓', 'You are now a verified AfroConnect member')}
  <tr>
    <td style="padding: 48px 40px;">
      <h2 style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 22px; font-weight: 700;">
        Congratulations, ${userName}! 🎉
      </h2>
      <p style="margin: 0 0 20px 0; color: #555555; font-size: 16px; line-height: 1.7;">
        Your ID verification has been reviewed and approved by our team.
        You now have the <strong style="color: ${BRAND.primary};">Verified Badge</strong> on your profile!
      </p>
      <div style="background-color: ${BRAND.primaryLight}; border-left: 4px solid ${BRAND.primary};
                  padding: 14px 18px; margin: 24px 0; border-radius: 6px;">
        <p style="margin: 0; color: #065F46; font-size: 14px; line-height: 1.6;">
          <strong>What this means:</strong> Your verified badge signals trust to other members,
          increases your match rate, and gives you priority visibility in search results.
        </p>
      </div>
      <p style="margin: 20px 0; color: #555555; font-size: 15px; line-height: 1.7;">
        Thank you for taking the time to verify your identity — it makes AfroConnect a safer
        and more authentic space for everyone.
      </p>
    </td>
  </tr>
  ${emailFooter()}
`);

// ─── Verification Rejected ────────────────────────────────────────────────────
const getVerificationRejectedTemplate = (userName, reason) => emailShell(`
  <tr>
    <td style="background: linear-gradient(135deg, #F59E0B 0%, #EF4444 100%);
               padding: 40px 30px; text-align: center;">
      ${LOGO_BLOCK}
      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Verification Update</h1>
    </td>
  </tr>
  <tr>
    <td style="padding: 48px 40px;">
      <h2 style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 22px;">Hi ${userName},</h2>
      <p style="margin: 0 0 20px 0; color: #555555; font-size: 16px; line-height: 1.7;">
        Thank you for submitting your verification request. Unfortunately, after reviewing your
        submission, our team was unable to approve it at this time.
      </p>
      <div style="background-color: #FFF9E6; border-left: 4px solid #F59E0B;
                  padding: 14px 18px; margin: 20px 0; border-radius: 6px;">
        <p style="margin: 0; color: #92400E; font-size: 14px; line-height: 1.6;">
          <strong>Reason:</strong> ${reason || 'The submitted photos did not meet our verification requirements.'}
        </p>
      </div>
      <h3 style="margin: 28px 0 12px 0; color: #1a1a1a; font-size: 16px;">How to reapply successfully:</h3>
      <ul style="color: #555555; font-size: 14px; line-height: 1.9; padding-left: 20px; margin: 0 0 24px 0;">
        <li>Use a clear, front-facing photo of a valid government ID</li>
        <li>Ensure the ID is not expired, blurry, or partially covered</li>
        <li>Take your selfie in good lighting with your face clearly visible</li>
        <li>Make sure both photos are recent and unedited</li>
      </ul>
      <p style="margin: 16px 0; color: #555555; font-size: 15px; line-height: 1.7;">
        You can resubmit your verification from the <strong>Profile → Verification</strong> section
        of the AfroConnect app. We look forward to verifying you!
      </p>
    </td>
  </tr>
  ${emailFooter()}
`);

// ─── Warning Email ─────────────────────────────────────────────────────────────
const getWarningEmailTemplate = (userName, reason) => emailShell(`
  <tr>
    <td style="background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
               padding: 40px 30px; text-align: center;">
      ${LOGO_BLOCK}
      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Community Guideline Warning</h1>
    </td>
  </tr>
  <tr>
    <td style="padding: 48px 40px;">
      <h2 style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 22px;">Hi ${userName},</h2>
      <p style="margin: 0 0 20px 0; color: #555555; font-size: 16px; line-height: 1.7;">
        Our moderation team has reviewed a report related to your account and issued an official
        warning for behaviour that violates our Community Guidelines.
      </p>
      <div style="background-color: #FFF9E6; border-left: 4px solid #F59E0B;
                  padding: 14px 18px; margin: 20px 0; border-radius: 6px;">
        <p style="margin: 0; color: #92400E; font-size: 14px; line-height: 1.6;">
          <strong>Reason:</strong> ${reason || 'Behaviour that violates AfroConnect Community Guidelines.'}
        </p>
      </div>
      <p style="margin: 16px 0; color: #555555; font-size: 15px; line-height: 1.7;">
        This is a formal warning. If similar behaviour continues, your account may be suspended
        or permanently banned. Please review our <strong>Community Guidelines</strong> in the app.
      </p>
      <p style="margin: 16px 0; color: #AAAAAA; font-size: 13px;">
        If you believe this warning was issued in error, you can submit an appeal through the app.
      </p>
    </td>
  </tr>
  ${emailFooter()}
`);

// ─── Suspension Email ──────────────────────────────────────────────────────────
const getSuspensionEmailTemplate = (userName, reason, durationDays) => emailShell(`
  <tr>
    <td style="background: linear-gradient(135deg, #DC2626 0%, #F59E0B 100%);
               padding: 40px 30px; text-align: center;">
      ${LOGO_BLOCK}
      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Account Temporarily Suspended</h1>
    </td>
  </tr>
  <tr>
    <td style="padding: 48px 40px;">
      <h2 style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 22px;">Hi ${userName},</h2>
      <p style="margin: 0 0 20px 0; color: #555555; font-size: 16px; line-height: 1.7;">
        Following a review of your account, your access to AfroConnect has been
        temporarily suspended for <strong>${durationDays || 7} day${durationDays !== 1 ? 's' : ''}</strong>.
      </p>
      <div style="background-color: #FFF9E6; border-left: 4px solid #F59E0B;
                  padding: 14px 18px; margin: 20px 0; border-radius: 6px;">
        <p style="margin: 0; color: #92400E; font-size: 14px; line-height: 1.6;">
          <strong>Reason:</strong> ${reason || 'Repeated violation of AfroConnect Community Guidelines.'}
        </p>
      </div>
      <p style="margin: 16px 0; color: #555555; font-size: 15px; line-height: 1.7;">
        Your account will be automatically restored after the suspension period.
        During this time you will not be able to log in or access your matches and messages.
      </p>
      <p style="margin: 16px 0; color: #555555; font-size: 15px; line-height: 1.7;">
        If you believe this suspension was made in error, you can submit an appeal through the AfroConnect app.
        Our team will respond within 5–7 business days.
      </p>
    </td>
  </tr>
  ${emailFooter()}
`);

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const sendVerificationApprovedEmail = async (email, userName) => {
  try {
    const info = await transporter.sendMail({
      from: `"AfroConnect" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '✓ Your AfroConnect Profile is Verified!',
      html: getVerificationApprovedTemplate(userName),
      attachments: [logoAttachment()],
    });
    console.log('Verification approved email sent:', info.messageId);
    return { success: true };
  } catch (error) {
    console.error('Error sending verification approved email:', error);
  }
};

const sendVerificationRejectedEmail = async (email, userName, reason) => {
  try {
    const info = await transporter.sendMail({
      from: `"AfroConnect" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '⚠️ AfroConnect Verification Update',
      html: getVerificationRejectedTemplate(userName, reason),
      attachments: [logoAttachment()],
    });
    console.log('Verification rejected email sent:', info.messageId);
    return { success: true };
  } catch (error) {
    console.error('Error sending verification rejected email:', error);
  }
};

const sendWarningEmail = async (email, userName, reason) => {
  try {
    const info = await transporter.sendMail({
      from: `"AfroConnect" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '⚠️ Community Guideline Warning — AfroConnect',
      html: getWarningEmailTemplate(userName, reason),
      attachments: [logoAttachment()],
    });
    console.log('Warning email sent:', info.messageId);
    return { success: true };
  } catch (error) {
    console.error('Error sending warning email:', error);
  }
};

const sendSuspensionEmail = async (email, userName, reason, durationDays) => {
  try {
    const info = await transporter.sendMail({
      from: `"AfroConnect" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '⛔ Your AfroConnect Account Has Been Temporarily Suspended',
      html: getSuspensionEmailTemplate(userName, reason, durationDays),
      attachments: [logoAttachment()],
    });
    console.log('Suspension email sent:', info.messageId);
    return { success: true };
  } catch (error) {
    console.error('Error sending suspension email:', error);
  }
};

module.exports = {
  sendOTPEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendBanNotificationEmail,
  sendUnbanNotificationEmail,
  sendAppealDecisionEmail,
  sendVerificationApprovedEmail,
  sendVerificationRejectedEmail,
  sendWarningEmail,
  sendSuspensionEmail,
  generateOTP,
};
