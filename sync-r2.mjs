import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const { R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_ENDPOINT } = process.env;

if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_ENDPOINT) {
  console.error("❌ 错误: 环境变量缺失，请检查 GitHub Secrets 设置。");
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

async function sync() {
  const CONTENT_DIR = "content";
  if (!fs.existsSync(CONTENT_DIR)) fs.mkdirSync(CONTENT_DIR);

  console.log("正在尝试连接 R2...");
  try {
    const listOutput = await s3.send(new ListObjectsV2Command({ Bucket: R2_BUCKET_NAME }));
    if (!listOutput.Contents || listOutput.Contents.length === 0) {
      console.warn("⚠️ 警告: R2 存储桶中没有找到任何文件。");
      return;
    }

    for (const object of listOutput.Contents) {
      if (!object.Key.endsWith(".md")) continue;
      console.log("📥 下载:", object.Key);
      const getOutput = await s3.send(new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: object.Key }));
      const filePath = path.join(CONTENT_DIR, object.Key);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const stream = getOutput.Body;
      const fileStream = fs.createWriteStream(filePath);
      await new Promise((res, rej) => {
        stream.pipe(fileStream);
        stream.on("error", rej);
        fileStream.on("finish", res);
      });
    }
    console.log("✅ 同步成功！");
  } catch (err) {
    console.error("❌ R2 同步失败:", err.message);
    process.exit(1);
  }
}
sync();
