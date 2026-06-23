import React from 'react';
import { render, waitFor } from '@testing-library/react';
import type { Am } from '@softwarepatterns/am';
import * as reactAuth from './index.js';

describe('@softwarepatterns/am-react public API', () => {
  it('exports the headless adapter surface', () => {
    expect(reactAuth.AuthProvider).toBeTypeOf('function');
    expect(reactAuth.useAuth).toBeTypeOf('function');
    expect(reactAuth.useRequiredAuth).toBeTypeOf('function');
  });

  it('exposes only auth, session, and isReady from useAuth', async () => {
    const snapshots: Array<Record<string, unknown>> = [];
    const am = {
      on: () => () => {},
      restoreSession: () => null,
      session: null,
    } as unknown as Am;

    function Observer() {
      const value = reactAuth.useAuth();

      snapshots.push(value as unknown as Record<string, unknown>);
      return null;
    }

    render(
      <reactAuth.AuthProvider am={am}>
        <Observer />
      </reactAuth.AuthProvider>,
    );

    await waitFor(() => {
      expect(snapshots.length).toBeGreaterThan(0);
    });

    const latestSnapshot = snapshots.at(-1);
    if (!latestSnapshot) {
      throw new Error('Expected auth snapshot');
    }

    expect(Object.keys(latestSnapshot).sort()).toEqual([
      'auth',
      'isReady',
      'session',
    ]);
    expect(latestSnapshot).not.toHaveProperty('isAuthChanging');
    expect(latestSnapshot).not.toHaveProperty('identityChanging');
    expect(latestSnapshot).not.toHaveProperty('runtime');
  });
});
