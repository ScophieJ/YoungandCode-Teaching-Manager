import crypto from 'node:crypto';

export interface BackendProviderCapability {
  key: string;
  label: string;
  authMode: 'api_key' | 'oauth' | 'webhook' | 'oauth_and_webhook';
  configured: boolean;
  webhookConfigured: boolean;
  requiredEnvVars: string[];
  webhookPath: string | null;
  notes: string;
}

function hasEnv(name: string): boolean {
  const val = process.env[name];
  return typeof val === 'string' && val.trim().length > 0;
}

export function getIntegrationCapabilitiesSnapshot(): BackendProviderCapability[] {
  return [
    {
      key: 'gemini_ai',
      label: 'Gemini AI (Server Engine)',
      authMode: 'api_key',
      configured: hasEnv('GEMINI_API_KEY'),
      webhookConfigured: false,
      requiredEnvVars: ['GEMINI_API_KEY'],
      webhookPath: null,
      notes:
        'Server-side Gemini API key used only when generating teacher-initiated class and monthly progress reports.',
    },
    {
      key: 'google_workspace',
      label: 'Google Workspace (Classroom / Docs / Drive)',
      authMode: 'oauth',
      configured:
        hasEnv('GOOGLE_OAUTH_CLIENT_ID') && hasEnv('GOOGLE_OAUTH_CLIENT_SECRET'),
      webhookConfigured: false,
      requiredEnvVars: ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET'],
      webhookPath: null,
      notes:
        'Direct links work without credentials. OAuth API sync requires client credentials and explicit scope authorization.',
    },
    {
      key: 'youtube',
      label: 'YouTube Data API',
      authMode: 'api_key',
      configured: hasEnv('YOUTUBE_API_KEY'),
      webhookConfigured: false,
      requiredEnvVars: ['YOUTUBE_API_KEY'],
      webhookPath: null,
      notes:
        'Video links attach directly without an API key; metadata lookup requires a server-side YouTube API key.',
    },
    {
      key: 'miro',
      label: 'Miro Boards API',
      authMode: 'oauth',
      configured: hasEnv('MIRO_CLIENT_ID') && hasEnv('MIRO_CLIENT_SECRET'),
      webhookConfigured: false,
      requiredEnvVars: ['MIRO_CLIENT_ID', 'MIRO_CLIENT_SECRET'],
      webhookPath: null,
      notes:
        'Board links work immediately via Direct Link. REST board syncing requires Miro OAuth client credentials on the backend.',
    },
    {
      key: 'zoom',
      label: 'Zoom Meetings & Webhooks',
      authMode: 'oauth_and_webhook',
      configured: hasEnv('ZOOM_CLIENT_ID') && hasEnv('ZOOM_CLIENT_SECRET'),
      webhookConfigured: hasEnv('ZOOM_WEBHOOK_SECRET_TOKEN'),
      requiredEnvVars: [
        'ZOOM_CLIENT_ID',
        'ZOOM_CLIENT_SECRET',
        'ZOOM_WEBHOOK_SECRET_TOKEN',
      ],
      webhookPath: '/api/integrations/webhooks/zoom',
      notes:
        'Meeting links work immediately via Direct Link. Live meeting webhooks require a Zoom webhook verification secret.',
    },
    {
      key: 'microsoft',
      label: 'Microsoft Graph (Teams / OneNote)',
      authMode: 'oauth',
      configured:
        hasEnv('MICROSOFT_CLIENT_ID') && hasEnv('MICROSOFT_CLIENT_SECRET'),
      webhookConfigured: false,
      requiredEnvVars: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'],
      webhookPath: null,
      notes:
        'Meeting and notebook URLs work via Direct Link. Microsoft Graph API sync requires Entra ID client credentials.',
    },
    {
      key: 'canva',
      label: 'Canva Connect',
      authMode: 'oauth',
      configured: hasEnv('CANVA_CLIENT_ID') && hasEnv('CANVA_CLIENT_SECRET'),
      webhookConfigured: false,
      requiredEnvVars: ['CANVA_CLIENT_ID', 'CANVA_CLIENT_SECRET'],
      webhookPath: null,
      notes:
        'Design folder links work immediately. Automated asset APIs require Canva Connect OAuth credentials.',
    },
    {
      key: 'notion',
      label: 'Notion API',
      authMode: 'oauth',
      configured:
        hasEnv('NOTION_OAUTH_CLIENT_ID') && hasEnv('NOTION_OAUTH_CLIENT_SECRET'),
      webhookConfigured: false,
      requiredEnvVars: ['NOTION_OAUTH_CLIENT_ID', 'NOTION_OAUTH_CLIENT_SECRET'],
      webhookPath: null,
      notes:
        'Workspace links work immediately. Automated page reads require Notion OAuth credentials.',
    },
    {
      key: 'github',
      label: 'GitHub OAuth & Webhooks',
      authMode: 'oauth_and_webhook',
      configured: hasEnv('GITHUB_CLIENT_ID') && hasEnv('GITHUB_CLIENT_SECRET'),
      webhookConfigured: hasEnv('GITHUB_WEBHOOK_SECRET'),
      requiredEnvVars: [
        'GITHUB_CLIENT_ID',
        'GITHUB_CLIENT_SECRET',
        'GITHUB_WEBHOOK_SECRET',
      ],
      webhookPath: '/api/integrations/webhooks/github',
      notes:
        'Repository URLs work immediately via Direct Link. Signed push/assignment webhooks require GITHUB_WEBHOOK_SECRET.',
    },
  ];
}

const WEBHOOK_SECRET_ENV_MAP: Record<string, { envVar: string; headerName: string }> = {
  github: { envVar: 'GITHUB_WEBHOOK_SECRET', headerName: 'x-hub-signature-256' },
  zoom: { envVar: 'ZOOM_WEBHOOK_SECRET_TOKEN', headerName: 'x-zm-signature' },
  padlet: { envVar: 'PADLET_WEBHOOK_SECRET', headerName: 'x-padlet-signature' },
};

export function isSupportedWebhookProvider(providerId: string): boolean {
  return Object.prototype.hasOwnProperty.call(WEBHOOK_SECRET_ENV_MAP, providerId);
}

export function verifyWebhookSignature(
  providerId: string,
  rawBody: Buffer,
  headers: Record<string, string | string[] | undefined>
): { ok: boolean; status: number; message: string } {
  const config = WEBHOOK_SECRET_ENV_MAP[providerId];
  if (!config) {
    return {
      ok: false,
      status: 404,
      message: `No webhook handler is registered for provider "${providerId}".`,
    };
  }

  const secret = process.env[config.envVar]?.trim();
  if (!secret) {
    return {
      ok: false,
      status: 503,
      message: `Webhook receiver for ${providerId} is not configured yet. Set ${config.envVar} in your server environment to verify incoming events.`,
    };
  }

  const rawSigHeader = headers[config.headerName];
  const signature = Array.isArray(rawSigHeader) ? rawSigHeader[0] : rawSigHeader;
  if (!signature || typeof signature !== 'string') {
    return {
      ok: false,
      status: 401,
      message: `Missing required webhook signature header (${config.headerName}).`,
    };
  }

  const expectedHex = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  const expectedPrefixed = `sha256=${expectedHex}`;

  const suppliedBuf = Buffer.from(signature.trim());
  const expectedBuf = Buffer.from(
    signature.trim().startsWith('sha256=') ? expectedPrefixed : expectedHex
  );

  if (
    suppliedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(suppliedBuf, expectedBuf)
  ) {
    return {
      ok: false,
      status: 401,
      message: 'Invalid webhook signature.',
    };
  }

  return {
    ok: true,
    status: 200,
    message: `Verified ${providerId} webhook event.`,
  };
}
