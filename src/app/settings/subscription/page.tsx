'use client';

import { useUser, useSession } from '@clerk/nextjs';
import { Button } from '~/components/ui/button';

export default function SubscriptionPage() {
  const { user } = useUser();
  const { session } = useSession();

  const handleDeleteAccount = async () => {
    if (confirm('Are you sure you want to delete your account?')) {
      await user?.delete();
      // Optionally redirect or show a message
    }
  };

  return (
    <div>
      <h1>Subscription Settings</h1>
      {/* ...other subscription info... */}

      <section style={{ marginTop: 48 }}>
        <h2>Security</h2>
        <Button
          variant="destructive"
          onClick={handleDeleteAccount}
        >
          Delete Account
        </Button>
        <h3>Active Device</h3>
        <ul>
          {session && (
            <li key={session.id}>
              {session.lastActiveAt ? `Last active: ${new Date(session.lastActiveAt).toLocaleString()}` : 'Active'} (Current)
            </li>
          )}
        </ul>
        {/* To list all devices, use Clerk's backend API or advanced hooks */}
      </section>
    </div>
  );
} 