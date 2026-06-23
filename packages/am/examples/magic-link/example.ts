import { Am } from '@softwarepatterns/am';

const am = new Am();

export async function sendMagicLink() {
  await am.sendMagicLink({
    clientId: 'cid_example',
    email: 'user@example.com',
  });
}

export async function signInWithEmailLinkToken() {
  return am.signInWithToken('token_from_email_link');
}
