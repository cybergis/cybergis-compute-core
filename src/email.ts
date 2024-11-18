import { createTransport } from "nodemailer";

async function main() {
  const transporter = createTransport({
    host: "outbound-relays.techservices.illinois.edu",
    port: 25,
    secure: false,
    tls: {
      rejectUnauthorized: false,
    }
  });
  
  const mailOptions = {
    from: "ianz2@illinois.edu", // Replace with your valid email address
    to: "yianzhang14@gmail.com", // Replace with recipient email
    subject: "Test Email from Nodemailer",
    text: "Hello! This is a test email sent using Nodemailer and outbound-relays.",
    replyTo: "no-reply@illinois.edu", // Optional: Set reply-to email address
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(info);
}

void main();