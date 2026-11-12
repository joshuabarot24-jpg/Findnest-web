export interface UploadErrorInfo {
  message: string;
  tone: "red" | "amber";
  prohibited?: boolean;
  overridable?: boolean;
}

// Turns a failed upload request into the text and color for the inline box
export function uploadErrorInfo(err: any): UploadErrorInfo {
  const data = err?.response?.data;
  const code = data?.error_code;

  if (!err?.response || err?.code === "ECONNABORTED") {
    return { tone: "red", message: "The upload took too long or the connection dropped. Please check your connection and try again." };
  }
  if (code === "IMAGE_QUALITY_LOW") {
    return { tone: "amber", overridable: true, message: data?.message || "Image quality is too low or blurry. Please upload a clear photo of the item." };
  }
  if (code === "AI_CONTENT_RESTRICTED") {
    return {
      tone: "red",
      prohibited: data?.prohibited === true,
      overridable: true,
      message: data?.message || "Upload rejected: this image contains explicit, restricted, or prohibited items that violate campus content guidelines.",
    };
  }
  if (code === "FILE_INVALID") {
    return { tone: "red", message: data?.message || "This file can't be used. Please upload a JPG, PNG or WEBP photo under 10 MB." };
  }
  return { tone: "red", message: data?.message || "The photo could not be processed right now. Please try again, or use a different photo." };
}