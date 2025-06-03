import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private readonly sesClient?: SESClient;
    private canSendEmail: boolean = false;
    private apiUrl: string;
    

    constructor(private readonly configService: ConfigService) {
        const sesRegion = this.configService.get<string>('AWS_REGION');
        const sesAccessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
        const sesSecretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
        const sesToken = this.configService.get<string>('AWS_SESSION_TOKEN');
        const defaultEmail = this.configService.get<string>('SES_FROM_EMAIL');
        this.apiUrl = this.configService.get<string>('API_URL', 'http://localhost:3000');

        if (sesRegion && sesAccessKeyId && sesSecretAccessKey && defaultEmail && sesToken) {
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
            this.logger.warn('SES configuration is incomplete, email sending is disabled.');
        }
    }

    private async sendEmail(to: string, subject: string, body: string, textBody?: string): Promise<void> {
        if (!this.canSendEmail || !this.sesClient) {
            this.logger.warn('Email sending is disabled due to missing SES configuration.');
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

    async sendEmailVerification(user: string, userEmail: string, token: string): Promise<void> {
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

    async sendDeletedAccountNotification(user: string, userEmail: string): Promise<void> {
        const subject = 'Account Deletion Confirmation';
        const body = `
            <h1>Account Deleted</h1>
            <p>Dear ${user},</p>
            <p>Your account has been successfully deleted.</p>
        `;
        const textBody = `Hello ${user}, your account has been successfully deleted.`;

        await this.sendEmail(userEmail, subject, body, textBody);
    }

    async sendCreatedEventEmail(organizerEmail: string, organizerName: string, eventName: string, eventDate: string, eventId: string): Promise<void> {
        if(!this.canSendEmail) {
            this.logger.warn('Email sending is disabled due to missing SES configuration.');
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

    async sendEventDeletedEmail(organizerEmail: string, organizerName: string, eventName: string): Promise<void> {
        if(!this.canSendEmail) {
            this.logger.warn('Email sending is disabled due to missing SES configuration.');
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

}
