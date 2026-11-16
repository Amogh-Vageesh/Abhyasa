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
