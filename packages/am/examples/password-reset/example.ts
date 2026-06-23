import { Am } from '@softwarepatterns/am';

const am = new Am();

export async function requestPasswordReset() {
  await am.sendPasswordReset({
    clientId: 'cid_example',
    email: 'user@example.com',
  });
}

export async function completePasswordReset() {
  await am.resetPassword({
    token: 'password_reset_token',
    newPassword: 'new strong password',
  });
}
