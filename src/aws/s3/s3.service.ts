import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { S3UploadFile } from '../interfaces/s3-upload.interface';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { S3UploadResponse } from '../interfaces/s3-upload-res.interface';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly awsRegion;
  private readonly s3BucketName;
  private readonly s3ProfileImagePath: string;
  private readonly s3EventImagePath: string;

  constructor(private readonly configService: ConfigService) {
    this.awsRegion = this.configService.get<string>('AWS_REGION');
    this.s3BucketName = this.configService.get<string>('S3_BUCKET_NAME');
    this.s3ProfileImagePath = this.configService.get<string>(
      'S3_PROFILE_IMAGE_PATH',
      'user-profiles/',
    );
    this.s3EventImagePath = this.configService.get<string>(
      'S3_EVENT_IMAGE_PATH',
      'events-images/',
    );

    if (!this.awsRegion || !this.s3BucketName) {
      const errorMessage =
        'AWS_REGION or S3_BUCKET_NAME is not defined in environment variables';
      this.logger.error(errorMessage);
      throw new InternalServerErrorException(errorMessage);
    }

    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );
    const sessionToken = this.configService.get<string>('AWS_SESSION_TOKEN');

    const s3ClientConfig: {
      region: string;
      credentials?: {
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken: string;
      };
    } = {
      region: this.awsRegion,
    };

    this.s3Client = new S3Client(s3ClientConfig);
    this.logger.log(
      `S3Service initialized for bucket: ${this.s3BucketName} in region: ${this.awsRegion}`,
    );
  }

  async uploadFile(
    file: Express.Multer.File,
    destinationPath: 'user-profiles' | 'events-images' | string,
    entityId?: string,
  ): Promise<S3UploadResponse> {
    const fileExtension = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExtension}`;

    let s3KeyPrefix: string;
    if (destinationPath === 'user-profiles') {
      s3KeyPrefix = this.s3ProfileImagePath;
    } else if (destinationPath === 'event-images') {
      s3KeyPrefix = this.s3EventImagePath;
    } else {
      s3KeyPrefix = destinationPath.endsWith('/')
        ? destinationPath
        : `${destinationPath}/`;
    }

    const s3Key = `${s3KeyPrefix}${entityId}/${fileName}`;
    this.logger.log(
      `Uploading file to S3: ${s3Key} in bucket: ${this.s3BucketName}`,
    );

    const command = new PutObjectCommand({
      Bucket: this.s3BucketName,
      Key: s3Key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    try {
      const response = await this.s3Client.send(command);
      const s3Url = `https://${this.s3BucketName}.s3.${this.awsRegion}.amazonaws.com/${s3Key}`;

      this.logger.log(`File uploaded successfully to S3: ${s3Url}`);
      return {
        Location: s3Url,
        Key: s3Key,
        Bucket: this.s3BucketName,
        ETag: response.ETag,
      };
    } catch (error) {
      this.logger.error(
        `Error uploading file to S3: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to upload file to S3: ${error.message}`,
      );
    }
  }

  async deleteFile(s3Key: string): Promise<void> {
    this.logger.log(
      `Deleting file from S3: ${s3Key} in bucket: ${this.s3BucketName}`,
    );

    const command = new DeleteObjectCommand({
      Bucket: this.s3BucketName,
      Key: s3Key,
    });

    try {
      await this.s3Client.send(command);
      this.logger.log(`File deleted successfully from S3: ${s3Key}`);
    } catch (error) {
      this.logger.error(
        `Error deleting file from S3: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to delete file from S3: ${error.message}`,
      );
    }
  }
}
