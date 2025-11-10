require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('🔍 Testing Email Configuration...\n');

// Check environment variables
console.log('=== ENVIRONMENT VARIABLES ===');
console.log('EMAIL_HOST:', process.env.EMAIL_HOST || 'NOT SET');
console.log('EMAIL_PORT:', process.env.EMAIL_PORT || 'NOT SET');
console.log('EMAIL_USER:', process.env.EMAIL_USER || 'NOT SET');
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '***' + process.env.EMAIL_PASS.slice(-4) : 'NOT SET');
console.log('');

// Create transporter
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function testEmail() {
    try {
        console.log('📧 Testing email connection...');
        
        // Verify connection
        await transporter.verify();
        console.log('✅ SMTP connection successful!');
        
        // Send test email
        console.log('📤 Sending test email...');
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER, // Send to yourself
            subject: 'POS System - Email Test',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333; text-align: center;">POS System Email Test</h2>
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 10px;">
                        <h3 style="color: #28a745;">✅ Email Configuration Successful!</h3>
                        <p>If you received this email, your POS system email configuration is working correctly.</p>
                        <div style="background: #e9ecef; padding: 15px; border-radius: 5px; margin: 15px 0;">
                            <strong>Test Details:</strong><br>
                            - Server: ${process.env.EMAIL_HOST}<br>
                            - Port: ${process.env.EMAIL_PORT}<br>
                            - Time: ${new Date().toLocaleString()}<br>
                        </div>
                        <p style="color: #666; font-size: 12px;">This is an automated test message from your POS system.</p>
                    </div>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Test email sent successfully!');
        console.log('📨 Message ID:', info.messageId);
        console.log('👤 Sent to:', process.env.EMAIL_USER);
        
    } catch (error) {
        console.log('❌ Email test failed:');
        console.log('Error:', error.message);
        
        if (error.code === 'EAUTH') {
            console.log('\n🔧 Troubleshooting steps:');
            console.log('1. Check if 2-Factor Authentication is enabled on your Gmail');
            console.log('2. Generate an App Password (not your regular password)');
            console.log('3. Make sure EMAIL_PASS in .env is the 16-character App Password');
            console.log('4. Remove any spaces from the App Password');
        }
    }
}

testEmail();