export interface S3UploadResponse {
  Location: string; 
  Key:      string;      
  Bucket:   string;   
  ETag?:    string;
}