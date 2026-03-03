import QRCode from 'qrcode';
import { storeImage } from '@/lib/image-store';

/**
 * Generates a QR code image from the given text.
 * Stores the image server-side and returns a short URL for embedding.
 */
export async function generateQrTool(
  text: string,
): Promise<{ ok: boolean; image_url?: string; error?: string }> {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return { ok: false, error: 'No text provided for QR code generation' };
  }

  try {
    const dataUrl = await QRCode.toDataURL(text.trim(), {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    // Store image and return a short URL instead of the full base64 data URL
    const id = storeImage(dataUrl);
    const imageUrl = `/api/image?id=${id}`;

    return { ok: true, image_url: imageUrl };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'QR code generation failed',
    };
  }
}
