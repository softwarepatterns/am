import { EmailAuthInput } from '@softwarepatterns/am-react-components';

export function OverrideDefaultsExample() {
  return (
    <EmailAuthInput
      name="identifier"
      type="text"
      autoComplete="username"
    />
  );
}
