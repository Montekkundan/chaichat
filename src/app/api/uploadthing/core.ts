import { createUploadthing, type FileRouter } from "uploadthing/next";
import { FILE_VALIDATION } from "~/lib/file-upload/validation";

const f = createUploadthing();

export const uploadRouter = {
  chatFiles: f({
    image: {
      maxFileSize: "2MB",
      maxFileCount: FILE_VALIDATION.MAX_COUNT,
    },
  })
    .middleware(async () => ({}))
    .onUploadComplete(async ({ file }) => {
      console.log("Upload complete", file.url);
    }),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter; 