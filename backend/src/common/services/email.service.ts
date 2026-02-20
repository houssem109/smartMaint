import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(EmailService.name);

  constructor(private configService: ConfigService) {
    // Create transporter - using a simple SMTP configuration
    // For production, configure SMTP settings in .env
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST', 'smtp.gmail.com'),
      port: this.configService.get('SMTP_PORT', 587),
      secure: false, // true for 465, false for other ports
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
    });
  }

  async sendWelcomeEmail(email: string, password: string, fullName: string, username: string) {
    try {
      const mailOptions = {
        from: this.configService.get('SMTP_FROM', 'noreply@smartmaint.com'),
        to: email,
        subject: 'Welcome to SmartMaint AI - Your Account Credentials',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
              .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
              .credentials { background-color: white; padding: 20px; margin: 20px 0; border-left: 4px solid #4F46E5; }
              .credentials-item { margin: 10px 0; }
              .label { font-weight: bold; color: #666; }
              .value { color: #333; font-size: 16px; }
              .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
              .warning { background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🚀 SmartMaint AI</h1>
                <p>Maintenance Management System</p>
              </div>
              <div class="content">
                <h2>Welcome, ${fullName}!</h2>
                <p>Your account has been created successfully. Below are your login credentials:</p>
                
                <div class="credentials">
                  <div class="credentials-item">
                    <span class="label">Email:</span>
                    <div class="value">${email}</div>
                  </div>
                  <div class="credentials-item">
                    <span class="label">Username:</span>
                    <div class="value">${username}</div>
                  </div>
                  <div class="credentials-item">
                    <span class="label">Password:</span>
                    <div class="value">${password}</div>
                  </div>
                </div>

                <div class="warning">
                  <strong>⚠️ Important:</strong> Please change your password after your first login for security purposes.
                </div>

                <p>You can now log in to the SmartMaint AI system using the credentials above.</p>
                <p>If you have any questions or need assistance, please contact your system administrator.</p>
              </div>
              <div class="footer">
                <p>This is an automated message. Please do not reply to this email.</p>
                <p>&copy; ${new Date().getFullYear()} SmartMaint AI. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
Welcome to SmartMaint AI!

Your account has been created successfully.

Login Credentials:
Email: ${email}
Username: ${username}
Password: ${password}

Important: Please change your password after your first login for security purposes.

You can now log in to the SmartMaint AI system using the credentials above.

If you have any questions or need assistance, please contact your system administrator.

This is an automated message. Please do not reply to this email.
        `,
      };

      // Only send email if SMTP is configured
      if (this.configService.get('SMTP_USER') && this.configService.get('SMTP_PASS')) {
        await this.transporter.sendMail(mailOptions);
        this.logger.log(`Welcome email sent to ${email}`);
      } else {
        this.logger.warn('SMTP not configured. Email not sent. User credentials:', { email, username, password });
      }
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${email}:`, error);
      // Don't throw error - user creation should still succeed even if email fails
    }
  }
}
