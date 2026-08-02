const { google } = require('googleapis');

async function main() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  const drive = google.drive({ version: 'v3', auth });

  try {
    const res = await drive.files.list({
      q: "'14ohdOqFW0QkUJyAMK8b_k2MI8fnXF6yg' in parents",
      fields: 'files(id, name, mimeType, parents)',
    });
    console.log(JSON.stringify(res.data.files, null, 2));
    
    // Also check the folder itself
    const folderRes = await drive.files.get({
      fileId: '14ohdOqFW0QkUJyAMK8b_k2MI8fnXF6yg',
      fields: 'id, name, parents'
    });
    console.log("Folder info:", JSON.stringify(folderRes.data, null, 2));

  } catch (err) {
    console.error(err);
  }
}

main();
