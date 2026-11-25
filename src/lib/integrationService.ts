import { auth } from './firebase';

export interface ServerIntegrationCapability {
  key: string;
  label: string;
  authMode: 'api_key' | 'oauth' | 'webhook' | 'oauth_and_webhook';
  configured: boolean;
  webhookConfigured: boolean;
  requiredEnvVars: string[];
  webhookPath: string | null;
  notes: string;
}

export async function fetchServerIntegrationCapabilities(): Promise<
  ServerIntegrationCapability[]
> {
  const user = auth.currentUser;
  if (!user) return [];

  const token = await user.getIdToken();
  const res = await fetch('/api/integrations/capabilities', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error('Unable to verify backend integration capabilities.');
  }

  const data = (await res.json()) as {
    capabilities?: ServerIntegrationCapability[];
  };
  return Array.isArray(data.capabilities) ? data.capabilities : [];
}
