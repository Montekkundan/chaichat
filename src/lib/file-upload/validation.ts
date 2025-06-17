export const FILE_VALIDATION = {
  MAX_COUNT: 5, // Maximum number of files per message
  MAX_SIZE_MB: 2, // Maximum size per file
  ALLOWED_TYPES: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ],
};

/**
 * Filters the provided File[] according to the FILE_VALIDATION rules.
 * @param files Files picked by the user (local selection or clipboard paste)
 * @param existingCount How many files are already attached (defaults to 0)
 * @returns An object containing the files that passed validation and any error messages.
 */
export function filterValidFiles(
  files: File[],
  existingCount = 0,
): { validFiles: File[]; errors: string[] } {
  const errors: string[] = [];
  const validFiles: File[] = [];

  if (existingCount >= FILE_VALIDATION.MAX_COUNT) {
    errors.push(`You can only attach up to ${FILE_VALIDATION.MAX_COUNT} files.`);
    return { validFiles, errors };
  }

  for (const file of files) {
    // Overall count check
    if (existingCount + validFiles.length >= FILE_VALIDATION.MAX_COUNT) {
      errors.push(
        `You can only attach up to ${FILE_VALIDATION.MAX_COUNT} files at a time.`,
      );
      break;
    }

    // Mime type check
    if (!FILE_VALIDATION.ALLOWED_TYPES.includes(file.type)) {
      errors.push(`${file.name} is not an allowed image type.`);
      continue;
    }

    // Size check (convert MB to bytes)
    const maxBytes = FILE_VALIDATION.MAX_SIZE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      errors.push(
        `${file.name} is too large. Max size is ${FILE_VALIDATION.MAX_SIZE_MB}MB.`,
      );
      continue;
    }

    validFiles.push(file);
  }

  return { validFiles, errors };
} 