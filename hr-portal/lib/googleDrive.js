import { google } from 'googleapis';

// Reuses the same service account already configured for Sheets, just
// with the Drive scope added, no new credential. Files are uploaded into
// one dedicated folder (GOOGLE_DRIVE_TRIPS_FOLDER_ID) and made viewable
// by anyone with the link, since the Trip Itineraries preview (PDF
// iframe, plain <img>) needs a link Google will actually render inline.

let cachedClient = null;

function getDriveClient() {
  if (cachedClient) return cachedClient;
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  cachedClient = google.drive({ version: 'v3', auth });
  return cachedClient;
}

const FOLDER_ID = process.env.GOOGLE_DRIVE_TRIPS_FOLDER_ID;

// Extracts a Drive file ID out of any of the preview/view URL shapes this
// app generates, so a re-upload can find and delete the old file.
export function extractDriveFileId(url) {
  if (!url) return null;
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export async function uploadTripFile(buffer, filename, mimeType) {
  if (!FOLDER_ID) {
    throw new Error('GOOGLE_DRIVE_TRIPS_FOLDER_ID is not set in your environment variables.');
  }
  const drive = getDriveClient();

  const { Readable } = await import('stream');
  const res = await drive.files.create({
    requestBody: { name: filename, parents: [FOLDER_ID] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: 'id',
  });
  const fileId = res.data.id;

  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  const isImage = mimeType.startsWith('image/');
  const previewUrl = isImage
    ? `https://drive.google.com/uc?export=view&id=${fileId}`
    : `https://drive.google.com/file/d/${fileId}/preview`;

  return { fileId, previewUrl };
}

export async function deleteTripFile(fileId) {
  if (!fileId) return;
  const drive = getDriveClient();
  try {
    await drive.files.delete({ fileId });
  } catch {
    // Already gone, or never existed, either way there's nothing left to
    // clean up, this is best effort so a stale file doesn't block the
    // re-upload it's being replaced by.
  }
}
