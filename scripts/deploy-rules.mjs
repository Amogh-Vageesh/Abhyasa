// Deploys firestore.rules via the Firebase Rules REST API (works with the default Admin SDK service account)
import { readFileSync } from 'node:fs';
import { GoogleAuth } from 'google-auth-library';

const project = process.argv[2] || 'abhyasa-3fe1d';
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
const client = await auth.getClient();
const base = `https://firebaserules.googleapis.com/v1/projects/${project}`;
const content = readFileSync('firestore.rules', 'utf8');

const rs = await client.request({ url: `${base}/rulesets`, method: 'POST', data: { source: { files: [{ name: 'firestore.rules', content }] } } });
const rulesetName = rs.data.name;
console.log('Created', rulesetName);

const releaseName = `projects/${project}/releases/cloud.firestore`;
try {
  await client.request({ url: `${base}/releases/cloud.firestore`, method: 'PATCH', data: { release: { name: releaseName, rulesetName } } });
} catch (e) {
  if (e.response?.status !== 404) throw e;
  await client.request({ url: `${base}/releases`, method: 'POST', data: { name: releaseName, rulesetName } });
}
console.log('Firestore rules released');

// ---- Storage rules + CORS (only once a Storage bucket exists; needs the Blaze plan) ----
const bucket = `${project}.firebasestorage.app`;
try {
  await client.request({ url: `https://storage.googleapis.com/storage/v1/b/${bucket}?fields=cors`, method: 'PATCH',
    data: { cors: [{ origin: ['*'], method: ['GET', 'HEAD'], responseHeader: ['Content-Type', 'Content-Length'], maxAgeSeconds: 3600 }] } });
  const srs = await client.request({ url: `${base}/rulesets`, method: 'POST', data: { source: { files: [{ name: 'storage.rules', content: readFileSync('storage.rules', 'utf8') }] } } });
  const relName = `projects/${project}/releases/firebase.storage/${bucket}`;
  try {
    await client.request({ url: `${base}/releases/firebase.storage/${bucket}`, method: 'PATCH', data: { release: { name: relName, rulesetName: srs.data.name } } });
  } catch (e) {
    if (e.response?.status !== 404) throw e;
    await client.request({ url: `${base}/releases`, method: 'POST', data: { name: relName, rulesetName: srs.data.name } });
  }
  console.log('Storage CORS + rules released');
} catch (e) {
  console.log(`Storage not set up yet (${e.response?.status || e.message}) — skipping storage rules/CORS. Enable Storage in Firebase to allow PDF uploads.`);
}
