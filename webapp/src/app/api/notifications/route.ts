import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'mail.privateemail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.CUSTOM_EMAIL_USER,
    pass: process.env.CUSTOM_EMAIL_PASSWORD
  }
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('Received InfluxDB notification:', body);
    
    // Extract relevant information from the InfluxDB notification
    const {
      _check_name,
      _level,
      _message,
      _measurement,
      _time,
      _value,
      ...otherFields
    } = body;

    // Determine email subject based on alert level
    const subject = `Autoponico Alert: ${_check_name || 'System Notification'} - ${_level || 'INFO'}`;
    
    // Create email body with notification details
    const emailBody = `
      <h2>Autoponico System Alert</h2>
      <p><strong>Check Name:</strong> ${_check_name || 'Unknown'}</p>
      <p><strong>Level:</strong> ${_level || 'INFO'}</p>
      <p><strong>Message:</strong> ${_message || 'No message provided'}</p>
      <p><strong>Measurement:</strong> ${_measurement || 'N/A'}</p>
      <p><strong>Value:</strong> ${_value || 'N/A'}</p>
      <p><strong>Time:</strong> ${_time || new Date().toISOString()}</p>
      
      ${Object.keys(otherFields).length > 0 ? `
        <h3>Additional Fields:</h3>
        <ul>
          ${Object.entries(otherFields).map(([key, value]) => 
            `<li><strong>${key}:</strong> ${value}</li>`
          ).join('')}
        </ul>
      ` : ''}
      
      <p><em>This is an automated notification from your Autoponico system.</em></p>
    `;

    // Send email using Nodemailer
    const emailResult = await transporter.sendMail({
      from: 'Autoponico System <hola@tucanorobotics.co>',
      to: ['jose.zdy@gmail.com', 'santiago.salgado.duque@gmail.com'],
      subject: subject,
      html: emailBody,
    });

    console.log('Email sent successfully:', emailResult);

    return NextResponse.json({
      success: true,
      message: 'Notification processed and email sent',
      emailId: emailResult.messageId
    });

  } catch (error) {
    console.error('Error processing notification:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to process notification',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, {
      status: 500
    });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'InfluxDB Notifications API endpoint is active',
    timestamp: new Date().toISOString()
  });
}