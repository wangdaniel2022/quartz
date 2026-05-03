import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const {
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_ENDPOINT,
} = process.env;

if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_ENDPOINT) {
  console.error("Missing R2 configuration in .env file");
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const CONTENT_DIR = "content";

async function sync() {
  if (!fs.existsSync(CONTENT_DIR)) {
    fs.mkdirSync(CONTENT_DIR, { recursive: true });
  }

  try {
    const listCommand = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
    });

    const listOutput = await s3.send(listCommand);

    if (!listOutput.Contents) {
      console.log("No files found in bucket.");
      return;
    }

    for (const object of listOutput.Contents) {
      if (!object.Key.endsWith(".md")) continue;

      console.log(`Downloading ${object.Key}...`);
      const getCommand = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: object.Key,
      });

      const getOutput = await s3.send(getCommand);
      const filePath = path.join(CONTENT_DIR, object.Key);
      
      fs.mkdirSync(path.dirname(filePath), { recursive: true });

      const stream = getOutput.Body;
      const fileStream = fs.createWriteStream(filePath);
      
      await new Promise((resolve, reject) => {
        stream.pipe(fileStream);
        stream.on("error", reject);
        fileStream.on("finish", resolve);
      });
    }

    console.log("Sync complete!");
  } catch (err) {
    console.error("Error syncing from R2:", err);
  }
}

sync();
