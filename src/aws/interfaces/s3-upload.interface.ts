export interface S3UploadFile {
    fieldname:    string;
    originalname: string;
    encoding:     string;
    mimetype:     string;
    buffer:       Buffer;
    size:         number;
}
