import { Am } from '@softwarepatterns/am';

const am = new Am();

export async function acceptInvite() {
  return am.acceptInvite({
    clientId: 'cid_example',
    token: 'invite_token_from_email',
  });
}
