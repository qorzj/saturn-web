import { apiClient } from './api-client';

/**
 * Generate a unique file key for Qiniu upload
 */
function generateFileKey(file: File): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = file.name.split('.').pop() || 'jpg';
  return `${timestamp}-${random}.${ext}`;
}

/**
 * Upload image to Qiniu Cloud
 * @param file - Image file to upload
 * @returns The public URL of the uploaded image
 */
export async function uploadImageToQiniu(file: File): Promise<string> {
  // Validate file type
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files are allowed');
  }

  // Validate file size (5MB max)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    throw new Error('Image size must be less than 5MB');
  }

  // Generate unique key
  const key = generateFileKey(file);

  // Get upload token from backend
  const { data: tokenData, error: tokenError } = await apiClient.GET('/api/qiniu/uptoken', {
    params: {
      query: { key },
    },
  });

  if (tokenError || !tokenData) {
    throw new Error('Failed to get upload token');
  }

  // Upload to Qiniu
  const formData = new FormData();
  formData.append('file', file);
  formData.append('token', tokenData.uptoken);
  formData.append('key', key);

  // Use the correct regional upload domain for lessweb bucket (华南 z2 region)
  const uploadResponse = await fetch('https://up-z2.qiniup.com', {
    method: 'POST',
    body: formData,
  });

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload image to Qiniu');
  }

  const uploadResult = await uploadResponse.json();

  // Construct public URL
  // Format: https://img.binfer.net/{path_prefix}/{key}
  const publicUrl = `https://img.binfer.net/ucimg/${uploadResult.key}`;

  return publicUrl;
}
