"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var EmailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const common_1 = require("@nestjs/common");
const nodemailer = require("nodemailer");
const config_1 = require("@nestjs/config");
let EmailService = EmailService_1 = class EmailService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(EmailService_1.name);
        this.transporter = nodemailer.createTransport({
            host: this.configService.get('SMTP_HOST', 'smtp.gmail.com'),
            port: this.configService.get('SMTP_PORT', 587),
            secure: false,
            auth: {
                user: this.configService.get('SMTP_USER'),
                pass: this.configService.get('SMTP_PASS'),
            },
        });
    }
    async sendWelcomeEmail(email, password, fullName, username) {
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
            if (this.configService.get('SMTP_USER') && this.configService.get('SMTP_PASS')) {
                await this.transporter.sendMail(mailOptions);
                this.logger.log(`Welcome email sent to ${email}`);
            }
            else {
                this.logger.warn('SMTP not configured. Email not sent. User credentials:', { email, username, password });
            }
        }
        catch (error) {
            this.logger.error(`Failed to send welcome email to ${email}:`, error);
        }
    }
};
exports.EmailService = EmailService;
exports.EmailService = EmailService = EmailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], EmailService);
//# sourceMappingURL=email.service.js.map