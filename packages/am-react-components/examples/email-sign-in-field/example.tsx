import { EmailAuthInput } from '@softwarepatterns/am-react-components';

export function EmailSignInFieldExample() {
  return (
    <EmailAuthInput
      name="email"
      placeholder="name@example.com"
      autoFocus
    />
  );
}
