import { Am } from '@softwarepatterns/am';

const am = new Am();

export async function signInWithEmailPassword() {
  return am.signIn({
    clientId: 'cid_example',
    email: 'user@example.com',
    password: 'correct horse battery staple',
  });
}

export async function signUpWithEmailPassword() {
  return am.signUp({
    clientId: 'cid_example',
    email: 'new-user@example.com',
    password: 'correct horse battery staple',
  });
}
