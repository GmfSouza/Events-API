import {
  SendEmailCommand,
  SendRawEmailCommand,
  SendRawEmailCommandInput,
  SESClient,
} from '@aws-sdk/client-ses';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ics from 'ics';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly sesClient?: SESClient;
  private canSendEmail: boolean = false;
  private apiUrl: string;
  private readonly appName = 'Compass Events';
  private readonly defaultEmail;

  constructor(private readonly configService: ConfigService) {
    const sesRegion = this.configService.get<string>('AWS_REGION');
    const sesAccessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const sesSecretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );
    const sesToken = this.configService.get<string>('AWS_SESSION_TOKEN');
    this.defaultEmail = this.configService.get<string>('SES_FROM_EMAIL');
    this.apiUrl = this.configService.get<string>(
      'API_URL',
      'http://localhost:3000',
    );

    if (
      sesRegion &&
      sesAccessKeyId &&
      sesSecretAccessKey &&
      this.defaultEmail &&
      sesToken
    ) {
      this.logger.log('SES configuration found, initializing SES client.');
      this.canSendEmail = true;
      this.sesClient = new SESClient({
        region: sesRegion,
        credentials: {
          accessKeyId: sesAccessKeyId,
          secretAccessKey: sesSecretAccessKey,
          sessionToken: sesToken,
        },
      });
    } else {
      this.logger.warn(
        'SES configuration is incomplete, email sending is disabled.',
      );
    }
  }

  private async sendEmail(
    to: string,
    subject: string,
    body: string,
    textBody?: string,
  ): Promise<void> {
    if (!this.canSendEmail || !this.sesClient) {
      this.logger.warn(
        'Email sending is disabled due to missing SES configuration.',
      );
      return;
    }

    const params = {
      Destination: {
        ToAddresses: [to],
      },
      Message: {
        Body: {
          Html: { charset: 'UTF-8', Data: body },
          ...(textBody && {
            Text: { charset: 'UTF-8', Data: textBody },
          }),
        },
        Subject: { charset: 'UTF-8', Data: subject },
      },
      Source: this.configService.get<string>('SES_FROM_EMAIL'),
    };

    try {
      const command = new SendEmailCommand(params);
      await this.sesClient.send(command);
      this.logger.log(`Email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
    }
  }

  private generateICalendarData(
    eventName: string,
    eventDateISO: string,
    eventDescription: string,
    eventId: string,
  ): string | null {
    try {
      const eventDate = new Date(eventDateISO);
      const startDateTime: ics.DateArray = [
        eventDate.getUTCFullYear(),
        eventDate.getUTCMonth() + 1,
        eventDate.getUTCDate(),
        eventDate.getUTCHours(),
        eventDate.getUTCMinutes(),
      ];

      const eventAttributes: ics.EventAttributes = {
        title: eventName,
        description: eventDescription,
        start: startDateTime,
        duration: { hours: 2 },
        status: 'CONFIRMED',
        organizer: { name: this.appName, email: this.defaultEmail! },
        uid: `${eventId}@${this.appName.toLowerCase().replace(/\s/g, '')}.com`,
      };

      const { error, value } = ics.createEvent(eventAttributes);
      if (error) {
        this.logger.error('Error generating iCalendar data:', error);
        return null;
      }
      return value || null;
    } catch (error) {
      this.logger.error('Exception generating iCalendar data:', error);
      return null;
    }
  }

  private async sendEmailWithICS(
    to: string,
    subject: string,
    body: string,
    text: string,
    icsData: string,
    eventName: string,
    from?: string,
  ): Promise<void> {
    if (!this.canSendEmail || !this.sesClient) {
      this.logger.warn(
        'Email sending is disabled due to missing SES configuration.',
      );
      return;
    }

    const fromEmail = from || this.defaultEmail;
    if (!fromEmail) {
      this.logger.error('No valid "from" email address provided.');
      return;
    }

    const boundary = `Boundary_${uuidv4().replace(/-/g, '')}`;
    const safeName = eventName.replace(/[^a-zA-Z0-9]/g, '_');

    let rawMessage = `From: ${fromEmail}\n`;
    rawMessage += `To: ${to}\n`;
    rawMessage += `Subject: ${subject}\n`;
    rawMessage += `MIME-Version: 1.0\n`;
    rawMessage += `Content-Type: multipart/mixed; boundary="${boundary}"\n\n`;

    rawMessage += `--${boundary}\n`;
    rawMessage += `Content-Type: multipart/alternative; boundary="AltBoundary_${boundary}"\n\n`;

    rawMessage += `--AltBoundary_${boundary}\n`;
    rawMessage += `Content-Type: text/plain; charset=UTF-8\n`;
    rawMessage += `Content-Transfer-Encoding: 7bit\n\n`;
    rawMessage += `${text}\n\n`;

    rawMessage += `--AltBoundary_${boundary}\n`;
    rawMessage += `Content-Type: text/html; charset=UTF-8\n`;
    rawMessage += `Content-Transfer-Encoding: 7bit\n\n`;
    rawMessage += `${body}\n\n`;
    rawMessage += `--AltBoundary_${boundary}--\n\n`;

    rawMessage += `--${boundary}\n`;
    rawMessage += `Content-Type: text/calendar; name="${safeName}.ics"\n`;
    rawMessage += `Content-Disposition: attachment; filename="${safeName}.ics"\n`;
    rawMessage += `Content-Transfer-Encoding: base64\n\n`;
    rawMessage += `${Buffer.from(icsData).toString('base64')}\n\n`;

    rawMessage += `--${boundary}--`;

    const params: SendRawEmailCommandInput = {
      Destinations: [to],
      Source: fromEmail,
      RawMessage: {
        Data: Buffer.from(rawMessage, 'utf-8'),
      },
    };

    try {
      const command = new SendRawEmailCommand(params);
      await this.sesClient.send(command);
      this.logger.log(`Email with ICS sent to ${to} for event ${eventName}`);
    } catch (error) {
      this.logger.error(`Failed to send email with ICS to ${to}:`, error);
    }
  }

  async sendEmailVerification(
    user: string,
    userEmail: string,
    token: string,
  ): Promise<void> {
    const validationLink = `${this.apiUrl}/validate-email?token=${token}`;
    const subject = 'Email Verification';
    const body = `
            <h1>Email Verification</h1>
            <p>Please click the link below to verify your email address:</p>
            <a href="${validationLink}">Verify Email</a>
        `;
    const textBody = `Hello ${user}, please click the link below to verify your email address:\n${validationLink}`;

    await this.sendEmail(userEmail, subject, body, textBody);
  }

  async sendDeletedAccountNotification(
    user: string,
    userEmail: string,
  ): Promise<void> {
    const subject = 'Account Deletion Confirmation';
    const body = `
            <h1>Account Deleted</h1>
            <p>Dear ${user},</p>
            <p>Your account has been successfully deleted.</p>
        `;
    const textBody = `Hello ${user}, your account has been successfully deleted.`;

    await this.sendEmail(userEmail, subject, body, textBody);
  }

  async sendCreatedEventEmail(
    organizerEmail: string,
    organizerName: string,
    eventName: string,
    eventDate: string,
    eventId: string,
  ): Promise<void> {
    if (!this.canSendEmail) {
      this.logger.warn(
        'Email sending is disabled due to missing SES configuration.',
      );
      return;
    }

    const formattedDate = new Date(eventDate).toLocaleDateString('pt-BR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    });

    const subject = 'Event Created Successfully';
    const body = `
            <h1>Event Created</h1>
            <p>Dear ${organizerName},</p>
            <p>Your event "${eventName}" has been created successfully.</p>
            <p>Date: ${formattedDate}</p>
            <p>Event ID: ${eventId}</p>
        `;
    const textBody = `Hello ${organizerName}, your event "${eventName}" has been created successfully on ${formattedDate}. Event ID: ${eventId}`;

    await this.sendEmail(organizerEmail, subject, body, textBody);
  }

  async sendEventDeletedEmail(
    organizerEmail: string,
    organizerName: string,
    eventName: string,
  ): Promise<void> {
    if (!this.canSendEmail) {
      this.logger.warn(
        'Email sending is disabled due to missing SES configuration.',
      );
      return;
    }

    const subject = 'Event Deleted';
    const body = `
            <h1>Event Deleted</h1>
            <p>Dear ${organizerName},</p>
            <p>Your event "${eventName}" has been deleted successfully.</p>
        `;
    const textBody = `Hello ${organizerName}, your event "${eventName}" has been deleted successfully.`;

    await this.sendEmail(organizerEmail, subject, body, textBody);
  }

  async sendRegistrationNotification(
    participantEmail: string,
    participantName: string,
    eventName: string,
    eventDate: string,
    eventDescription: string,
    eventId: string,
  ): Promise<void> {
    this.logger.log(
      `Sending registration notification to ${participantEmail} for event ${eventName}`,
    );

    const icsData = this.generateICalendarData(
      eventName,
      eventDate,
      eventDescription,
      eventId,
    );
    if (!icsData) {
      this.logger.error(
        `Failed to generate iCalendar data for event ${eventName}. Email will not be sent.`,
      );

      const subjectFallback = 'Registration Confirmation';
      const bodyFallback = `<h1>Registration Confirmation</h1>
                   <p>Dear ${participantName},</p>
                   <p>You have successfully registered for the event "${eventName}".</p>
                   <p>Event Date: ${eventDate}</p>
                   <p>Description: ${eventDescription}</p>
                   <p>Event ID: ${eventId}</p>`;
      const textFallback = `Hello ${participantName}, you have successfully registered for the event "${eventName}" on ${eventDate}. Description: ${eventDescription}. Event ID: ${eventId}`;
      await this.sendEmail(
        participantEmail,
        subjectFallback,
        bodyFallback,
        textFallback,
      );
      return;
    }

    const subject = 'Registration Confirmation';
    const body = `<h1>Registration Confirmation</h1>
            <p>Dear ${participantName},</p>
            <p>You have successfully registered for the event "${eventName}".</p>
            <p>Event Date: ${eventDate}</p>
            <p>Description: ${eventDescription}</p>
            <p>Event ID: ${eventId}</p>`;
    const text = `Hello ${participantName}, you have successfully registered for the event "${eventName}" on ${eventDate}. Description: ${eventDescription}. Event ID: ${eventId}`;

    await this.sendEmailWithICS(
      participantEmail,
      subject,
      body,
      text,
      icsData,
      eventName,
    );
  }

  async sendRegistrationCancellationNotification(
    participantEmail: string,
    participantName: string,
    eventName: string,
  ): Promise<void> {
    this.logger.log(
      `Sending registration cancellation notification to ${participantEmail} for event ${eventName}`,
    );

    const subject = 'Registration Cancellation';
    const body = `<h1>Registration Cancellation</h1>
            <p>Dear ${participantName},</p>
            <p>Your registration for the event "${eventName}" has been canceled.</p>`;
    const text = `Hello ${participantName}, your registration for the event "${eventName}" has been canceled.`;

    await this.sendEmail(participantEmail, subject, body, text);
  }
}
