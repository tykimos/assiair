import QRCode from 'qrcode';

/**
 * Generates a QR code image as a base64-encoded data URL from the given text.
 */
export async function generateQrTool(
  text: string,
): Promise<{ ok: boolean; data_url?: string; error?: string }> {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return { ok: false, error: 'No text provided for QR code generation' };
  }

  try {
    const dataUrl = await QRCode.toDataURL(text.trim(), {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });
    return { ok: true, data_url: dataUrl };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'QR code generation failed',
    };
  }
}
