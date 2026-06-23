import { Am } from '@softwarepatterns/am';

const am = new Am();

export async function loadLoginMethodsForEmail() {
  const emailCheck = await am.checkEmail({
    clientId: 'cid_example',
    email: 'user@example.com',
  });

  const loginMethods = await am.loginMethods({
    clientId: 'cid_example',
  });

  return {
    emailCheck,
    loginMethods,
  };
}

export async function prepareCsrfProtectedPost() {
  await am.csrfSession();
  return am.csrfToken();
}
