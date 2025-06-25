import { createTransport } from "nodemailer";
import { MailOptions } from "nodemailer/lib/json-transport";

import { config, hpcConfigMap } from "../../configs/config";
import { UserInfo } from "../models";

/**
 * Sends a request for a user accessing an hpc to admins of the hpc.
 * @param link approval link
 * @param user user making the request
 * @param approval whether or not this is an approval (vs. a denial) request
 * @param hpc hpc the request is for
 * @param userInfo info of the user
 */
export async function sendRequest(
  link: string, 
  user: string, 
  approval: boolean, 
  hpc: string,
  userInfo?: UserInfo
) {
  const transporter = createTransport({
    host: config.smtp_server,
    port: 25,
    secure: false,
    tls: {
      rejectUnauthorized: false,
    }
  });

  for (const email of hpcConfigMap[hpc].admins) {
    let mailOptions: MailOptions;
    if (approval) {
      console.assert(userInfo !== undefined, "should require user info registration before allowing a request to go through");

      mailOptions = {
        from: config.confirmation_email,
        to: email,
        subject: `Approval request for ${user}`,
        text: `This is a admin request to confirm the placing of ${user} onto the CyberGISX deny list. Please click the following link to do so ${link}.
        
        For more information, here are the recorded details about the user:
        
        name: ${userInfo?.name}
        email: ${userInfo?.email}
        access id: ${userInfo?.access_eppn}`,
        replyTo: "no-reply@illinois.edu",
      };
    } else {
      mailOptions = {
        from: config.confirmation_email,
        to: email,
        subject: `Denial request for ${user}`,
        text: `This is a admin request to confirm the placing of ${user} onto the CyberGISX deny list. Please click the following link to do so ${link}.`,
        replyTo: "no-reply@illinois.edu",
      };
    }

    const info = await transporter.sendMail(mailOptions);

    if (info.rejected.length !== 0) {
      console.error(`Error sending confirmation email for user ${user} to admin email ${email}`);
    }
  }
}