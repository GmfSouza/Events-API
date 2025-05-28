import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  GetObjectCommandOutput,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';
import path from 'path';
import { S3Event, S3Handler } from 'aws-lambda';
import { Context } from 'aws-lambda';

const s3Client = new S3Client({ region: process.env.AWS_REGION });

const targetWidth: number = parseInt(process.env.TARGET_WIDTH || '200');
const targetHeight: number = parseInt(process.env.TARGET_HEIGHT || '200');
const resizedImagePrefix: string =
  process.env.RESIZED_IMAGE_PREFIX || 'resized';
const allowedExtensions: string[] = ['.jpg', '.jpeg', '.png', '.webp'];
const destinationBucketName: string | undefined =
  process.env.DESTINATION_BUCKET_NAME;

const streamToBuffer = (stream: NodeJS.ReadableStream): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });

export const handler: S3Handler = async (
  event: S3Event,
  context: Context,
): Promise<void> => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  const buckertName = event.Records[0].s3.bucket.name;
  const sourceObjectKey = decodeURIComponent(
    event.Records[0].s3.object.key.replace(/\+/g, ' '),
  );

  const extension = path.extname(sourceObjectKey).toLowerCase();
  if (!allowedExtensions.includes(extension)) {
    console.log(`Unsupported file type: ${extension}`);
    return;
  }

  if (sourceObjectKey.startsWith(resizedImagePrefix)) {
    console.log(`Skipping already resized image: ${sourceObjectKey}`);
    return;
  }

  const originalFileName = path.basename(sourceObjectKey);
  const originalPath = path.dirname(sourceObjectKey);

  let destinationObjectKey: string;
  if (originalPath === '/' || originalPath === '.') {
    destinationObjectKey = `${resizedImagePrefix}${originalFileName}`;
  } else {
    destinationObjectKey = `${originalPath}/${resizedImagePrefix}${originalFileName}`;
  }

  console.log(`Resizing image: ${sourceObjectKey} to ${destinationObjectKey}`);
  console.log(`Using bucket: ${destinationBucketName}`);

  try {
    const getObjectParams = {
      Bucket: buckertName,
      Key: sourceObjectKey,
    };

    const getObjectResult: GetObjectCommandOutput = await s3Client.send(
      new GetObjectCommand(getObjectParams),
    );
    if (!getObjectResult.Body) {
      throw new Error(`No content in ${sourceObjectKey}`);
    }

    const imageBuffer = await streamToBuffer(
      getObjectResult.Body as NodeJS.ReadableStream,
    );

    const resizedImageBuffer = await sharp(imageBuffer)
      .resize({
        width: targetWidth,
        height: targetHeight,
        fit: sharp.fit.inside,
        withoutEnlargement: true,
      })
      .toBuffer();

    const putObjectParams = {
      Bucket: destinationBucketName,
      Key: destinationObjectKey.toString(),
      Body: resizedImageBuffer,
      ContentType: getObjectResult.ContentType,
    };

    await s3Client.send(new PutObjectCommand(putObjectParams));
    console.log(`Resized image saved to ${destinationObjectKey}`);
  } catch (error) {
    console.error('Error resizing image:', error);
    throw error;
  }
};
