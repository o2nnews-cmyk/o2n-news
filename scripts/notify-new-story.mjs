// Tells every phone about the story that was just published (run by .github/workflows/notify-new-story.yml).
//
// It looks at what the last commit added under src/content/articles/, takes the newest story, and
// sends one Firebase message to the "news" topic — the same topic the app subscribes to. Nothing
// about any reader is stored or sent; Firebase simply passes the message on to whoever listens.
//
// Needs FIREBASE_SERVICE_ACCOUNT in the environment (the JSON from the Firebase console). Firebase's
// modern API wants an OAuth token, so the key signs a short-lived request for one — no extra packages.
import { createSign } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const key = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!key) {
  console.log('No FIREBASE_SERVICE_ACCOUNT secret — nothing to send.');
  process.exit(0);
}
const account = JSON.parse(key);

/* ------------------------------------------------- which story was just published */

const changed = execFileSync('git', ['diff', '--name-only', '--diff-filter=A', 'HEAD~1', 'HEAD'], { encoding: 'utf8' })
  .split('\n')
  .filter((f) => /^src\/content\/articles\/.+\/index\.md$/.test(f));

if (!changed.length) {
  console.log('No new story in this commit.');
  process.exit(0);
}

/** The bits of the front matter the notification needs. */
function readStory(file) {
  const text = readFileSync(join(ROOT, file), 'utf8');
  const front = text.split('---')[1] ?? '';
  const value = (name) => {
    const line = front.match(new RegExp(`^${name}: (.+)$`, 'm'))?.[1]?.trim() ?? '';
    return line.replace(/^['"]|['"]$/g, '').replace(/''/g, "'");
  };
  // "excerpt: >-" spreads the summary over the following indented lines.
  const folded = front.match(/^excerpt: >-\n((?:[ ]{2}.+\n)+)/m)?.[1];
  return {
    id: file.split('/').at(-2),
    title: value('title'),
    excerpt: folded ? folded.split('\n').map((l) => l.trim()).join(' ').trim() : value('excerpt'),
    draft: /^draft: true$/m.test(front),
  };
}

const story = changed.map(readStory).filter((s) => !s.draft).at(-1);
if (!story) {
  console.log('Only drafts in this commit — nothing to send.');
  process.exit(0);
}

/* --------------------------------------------------------- a token to talk to Firebase */

const base64url = (input) => Buffer.from(input).toString('base64url');

function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(JSON.stringify(claim))}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(account.private_key, 'base64url');
  return fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  })
    .then((r) => r.json())
    .then((d) => d.access_token ?? Promise.reject(new Error(`No token: ${JSON.stringify(d)}`)));
}

/* -------------------------------------------------------------------- send it */

const settingsPath = join(ROOT, 'src/data/settings.json');
const siteTitle = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, 'utf8')).site_title : 'News';

const token = await accessToken();
const res = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: {
      topic: 'news',
      notification: { title: siteTitle, body: story.title },
      // The app opens this story when the reader taps the notification.
      data: { story: story.id },
      android: {
        priority: 'HIGH',
        notification: { channel_id: 'breaking', default_sound: true },
      },
    },
  }),
});

const answer = await res.json();
if (!res.ok) {
  console.error('Firebase refused the message:', JSON.stringify(answer));
  process.exit(1);
}
console.log(`Sent: ${story.title}`);
