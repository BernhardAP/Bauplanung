import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/backup')({
  beforeLoad: () => {
    throw redirect({ to: '/settings' });
  },
});
