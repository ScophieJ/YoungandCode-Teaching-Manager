import {
  IntegrationCategory,
  IntegrationConnectionStatus,
  IntegrationMethod,
  type IntegrationAccentColor,
} from '../types/teaching';

export interface IntegrationCategoryMeta {
  id: IntegrationCategory;
  label: string;
  shortLabel: string;
  description: string;
}

export const INTEGRATION_CATEGORIES: IntegrationCategoryMeta[] = [
  {
    id: IntegrationCategory.VIDEO_CONFERENCING,
    label: 'Video Conferencing & Online Classes',
    shortLabel: 'Video & Classes',
    description: 'Live teaching rooms, virtual classrooms, and screen-sharing links.',
  },
  {
    id: IntegrationCategory.LMS,
    label: 'Learning Management Systems (LMS)',
    shortLabel: 'LMS',
    description: 'Course rosters, classroom streams, and assignment distribution tools.',
  },
  {
    id: IntegrationCategory.AI_TOOLS,
    label: 'AI Assistants & AI Tools',
    shortLabel: 'AI Tools',
    description: 'AI tutoring helpers, lesson drafting engines, and study aids.',
  },
  {
    id: IntegrationCategory.DOCUMENTS_STORAGE,
    label: 'Document Creation & Storage',
    shortLabel: 'Docs & Notes',
    description: 'Shared lesson notes, digital notebooks, and collaborative handouts.',
  },
  {
    id: IntegrationCategory.MATH_WHITEBOARDS,
    label: 'Mathematics & Interactive Whiteboards',
    shortLabel: 'Math & Boards',
    description: 'Interactive graphing, geometry canvases, and problem-solving boards.',
  },
  {
    id: IntegrationCategory.CODING_TOOLS,
    label: 'Coding & Programming Tools',
    shortLabel: 'Coding Tools',
    description: 'Sandboxes, repositories, block coding, and interactive code lessons.',
  },
  {
    id: IntegrationCategory.DESIGN_CREATIVITY,
    label: 'Design & Creativity Tools',
    shortLabel: 'Design',
    description: 'Visual worksheets, slide decks, diagrams, and creative projects.',
  },
  {
    id: IntegrationCategory.COMMUNICATION,
    label: 'Communication & Collaboration',
    shortLabel: 'Communication',
    description: 'Parent updates, discussion boards, and collaborative channels.',
  },
  {
    id: IntegrationCategory.ASSESSMENT_QUIZZES,
    label: 'Assessment & Quizzes',
    shortLabel: 'Assessments',
    description: 'Live formative quizzes, exit tickets, and knowledge checks.',
  },
  {
    id: IntegrationCategory.FILE_SHARING,
    label: 'File Storage & Sharing',
    shortLabel: 'File Storage',
    description: 'Cloud folders for worksheets, recordings, and project assets.',
  },
  {
    id: IntegrationCategory.PRODUCTIVITY_SCHEDULING,
    label: 'Productivity & Scheduling',
    shortLabel: 'Scheduling',
    description: 'Curriculum wikis, calendars, and lesson organization workspaces.',
  },
  {
    id: IntegrationCategory.OTHER,
    label: 'Other Teaching Tools',
    shortLabel: 'Other Tools',
    description: 'Any additional websites, simulators, or subject-specific platforms.',
  },
];

export function getIntegrationCategoryMeta(
  category: IntegrationCategory | string
): IntegrationCategoryMeta {
  return (
    INTEGRATION_CATEGORIES.find((c) => c.id === category) ??
    INTEGRATION_CATEGORIES[INTEGRATION_CATEGORIES.length - 1]
  );
}

export interface IntegrationMethodMeta {
  id: IntegrationMethod;
  label: string;
  shortDescription: string;
  honestNote: string;
}

export const INTEGRATION_METHOD_META: Record<IntegrationMethod, IntegrationMethodMeta> = {
  [IntegrationMethod.DIRECT_LINK]: {
    id: IntegrationMethod.DIRECT_LINK,
    label: 'Direct Link',
    shortDescription: 'Save and launch workspace or meeting URLs directly from YoungAndCode.',
    honestNote:
      'Works immediately with no external API keys or OAuth setup. Does not exchange student data automatically.',
  },
  [IntegrationMethod.OAUTH]: {
    id: IntegrationMethod.OAUTH,
    label: 'OAuth 2.0',
    shortDescription: 'Delegated authorization flow using server-managed OAuth client credentials.',
    honestNote:
      'Requires official OAuth client credentials and approved scopes configured on the backend before live token exchange.',
  },
  [IntegrationMethod.API]: {
    id: IntegrationMethod.API,
    label: 'API Integration',
    shortDescription: 'Server-to-server data exchange using backend-stored API credentials.',
    honestNote:
      'API keys are stored exclusively on the backend server environment and never exposed in browser code.',
  },
  [IntegrationMethod.WEBHOOK]: {
    id: IntegrationMethod.WEBHOOK,
    label: 'Webhooks',
    shortDescription: 'Receive signed event notifications from supported external tools.',
    honestNote:
      'Requires a provider signing secret configured on the backend so incoming webhook payloads are verified.',
  },
  [IntegrationMethod.CUSTOM]: {
    id: IntegrationMethod.CUSTOM,
    label: 'Custom Integration',
    shortDescription: 'User-defined application entry supporting direct links or planned API docs.',
    honestNote:
      'Connects any external website or learning tool to your teaching workflow immediately.',
  },
};

export function formatIntegrationMethodLabel(method: IntegrationMethod | string): string {
  return (
    INTEGRATION_METHOD_META[method as IntegrationMethod]?.label ?? 'Direct Link'
  );
}

export function formatIntegrationStatusLabel(
  status: IntegrationConnectionStatus | string
): string {
  switch (status) {
    case IntegrationConnectionStatus.CONNECTED:
      return 'Connected';
    case IntegrationConnectionStatus.CONFIGURATION_REQUIRED:
      return 'Config Required';
    case IntegrationConnectionStatus.DISCONNECTED:
    default:
      return 'Disconnected';
  }
}

export interface IntegrationProviderDefinition {
  catalogId: string;
  name: string;
  providerVendor: string;
  shortTagline: string;
  description: string;
  category: IntegrationCategory;
  iconKey: string;
  accentColor: IntegrationAccentColor;
  defaultWebsiteUrl: string;
  defaultLoginUrl: string;
  apiDocsUrl: string;
  defaultMethod: IntegrationMethod;
  supportedMethods: IntegrationMethod[];
  capabilities: string[];
  requestedPermissions: string[];
  teachingUseCases: string[];
  serverCapabilityKey?: string;
  setupRequirements: string;
}

export const INTEGRATION_CATALOG: IntegrationProviderDefinition[] = [
  {
    catalogId: 'google_classroom',
    name: 'Google Classroom',
    providerVendor: 'Google',
    shortTagline: 'Courses, classwork streams & assignment links',
    description:
      'Save your Google Classroom course URLs for quick access or prepare Workspace OAuth scopes to sync coursework metadata.',
    category: IntegrationCategory.LMS,
    iconKey: 'google_classroom',
    accentColor: 'emerald',
    defaultWebsiteUrl: 'https://classroom.google.com',
    defaultLoginUrl: 'https://accounts.google.com',
    apiDocsUrl: 'https://developers.google.com/classroom',
    defaultMethod: IntegrationMethod.DIRECT_LINK,
    supportedMethods: [IntegrationMethod.DIRECT_LINK, IntegrationMethod.OAUTH, IntegrationMethod.API],
    capabilities: [
      'Open Google Classroom course URLs directly from YoungAndCode',
      'Attach classwork links to homework assignments',
      'Architecture ready for Google Workspace OAuth coursework reads',
    ],
    requestedPermissions: [
      'Direct Link: None (browser launch only)',
      'OAuth (when enabled): classroom.courses.readonly, classroom.coursework.students.readonly',
    ],
    teachingUseCases: ['Homework Management', 'Student Profiles'],
    serverCapabilityKey: 'google_workspace',
    setupRequirements:
      'Direct Link works immediately. Automated assignment sync requires Google Workspace OAuth authorization and explicit teacher consent.',
  },
  {
    catalogId: 'google_meet',
    name: 'Google Meet',
    providerVendor: 'Google',
    shortTagline: 'Live 1-on-1 & group class video rooms',
    description:
      'Store dedicated meeting room links for Mathematics and Technology lessons and launch classes directly.',
    category: IntegrationCategory.VIDEO_CONFERENCING,
    iconKey: 'google_meet',
    accentColor: 'teal',
    defaultWebsiteUrl: 'https://meet.google.com',
    defaultLoginUrl: 'https://meet.google.com',
    apiDocsUrl: 'https://developers.google.com/meet/api',
    defaultMethod: IntegrationMethod.DIRECT_LINK,
    supportedMethods: [IntegrationMethod.DIRECT_LINK, IntegrationMethod.OAUTH],
    capabilities: [
      'Save recurring student meeting room links',
      'Attach meeting URLs into lesson plans & class prep',
    ],
    requestedPermissions: ['Direct Link: Saved room URL only'],
    teachingUseCases: ['Lesson Planning', 'Class Documentation'],
    serverCapabilityKey: 'google_workspace',
    setupRequirements:
      'Works immediately via Direct Link. Paste your dedicated Google Meet URL when connecting.',
  },
  {
    catalogId: 'google_docs',
    name: 'Google Docs',
    providerVendor: 'Google',
    shortTagline: 'Shared worksheets, lesson notes & feedback docs',
    description:
      'Link live Google Docs lesson handouts, coding notes, and student worksheets directly to lesson plans and homework.',
    category: IntegrationCategory.DOCUMENTS_STORAGE,
    iconKey: 'google_docs',
    accentColor: 'blue',
    defaultWebsiteUrl: 'https://docs.google.com',
    defaultLoginUrl: 'https://docs.google.com',
    apiDocsUrl: 'https://developers.google.com/docs/api',
    defaultMethod: IntegrationMethod.DIRECT_LINK,
    supportedMethods: [IntegrationMethod.DIRECT_LINK, IntegrationMethod.OAUTH, IntegrationMethod.API],
    capabilities: [
      'Attach Google Docs links to lesson plans and homework',
      'Open shared lesson notes during live Class Documentation',
    ],
    requestedPermissions: [
      'Direct Link: Saved document or folder URL',
      'OAuth (optional future): drive.file (selected files only)',
    ],
    teachingUseCases: ['Lesson Planning', 'Class Documentation', 'Homework'],
    serverCapabilityKey: 'google_workspace',
    setupRequirements:
      'Direct Link works immediately with any Google Docs folder or template URL.',
  },
  {
    catalogId: 'google_drive',
    name: 'Google Drive',
    providerVendor: 'Google',
    shortTagline: 'Organized student folders & resource packs',
    description:
      'Quick access to shared student folders containing math worksheets, coding assets, and project files.',
    category: IntegrationCategory.FILE_SHARING,
    iconKey: 'google_drive',
    accentColor: 'blue',
    defaultWebsiteUrl: 'https://drive.google.com',
    defaultLoginUrl: 'https://drive.google.com',
    apiDocsUrl: 'https://developers.google.com/drive',
    defaultMethod: IntegrationMethod.DIRECT_LINK,
    supportedMethods: [IntegrationMethod.DIRECT_LINK, IntegrationMethod.OAUTH],
    capabilities: [
      'Open root teaching Drive or student folders',
      'Attach resource links onto Student Profiles',
    ],
    requestedPermissions: ['Direct Link: Saved Drive URL only'],
    teachingUseCases: ['Student Profiles', 'Lesson Planning'],
    serverCapabilityKey: 'google_workspace',
    setupRequirements:
      'Direct Link works immediately by saving your teaching Drive folder URL.',
  },
  {
    catalogId: 'youtube',
    name: 'YouTube',
    providerVendor: 'Google',
    shortTagline: 'Video tutorials for math & technology lessons',
    description:
      'Curate instructional video playlists and tutorials to attach directly to Technology and Mathematics lessons and homework.',
    category: IntegrationCategory.OTHER,
    iconKey: 'youtube',
    accentColor: 'rose',
    defaultWebsiteUrl: 'https://www.youtube.com',
    defaultLoginUrl: 'https://studio.youtube.com',
    apiDocsUrl: 'https://developers.google.com/youtube/v3',
    defaultMethod: IntegrationMethod.DIRECT_LINK,
    supportedMethods: [IntegrationMethod.DIRECT_LINK, IntegrationMethod.API],
    capabilities: [
      'Attach tutorial or playlist links to Technology & Math lessons',
      'One-click attach YouTube videos into Homework resources',
    ],
    requestedPermissions: ['Direct Link: Saved playlist/channel URL only'],
    teachingUseCases: ['Lesson Planning', 'Homework', 'Student Profiles'],
    serverCapabilityKey: 'youtube',
    setupRequirements:
      'Direct Link works immediately. Optional YouTube Data API search requires a server-side YOUTUBE_API_KEY.',
  },
  {
    catalogId: 'miro',
    name: 'Miro',
    providerVendor: 'Miro',
    shortTagline: 'Visual whiteboards for math diagrams & system flows',
    description:
      'Connect your Miro workspace or math boards so you can attach boards to Mathematics lesson plans and live sessions.',
    category: IntegrationCategory.MATH_WHITEBOARDS,
    iconKey: 'miro',
    accentColor: 'amber',
    defaultWebsiteUrl: 'https://miro.com/app/dashboard/',
    defaultLoginUrl: 'https://miro.com/login/',
    apiDocsUrl: 'https://developers.miro.com/docs/rest-api-reference',
    defaultMethod: IntegrationMethod.DIRECT_LINK,
    supportedMethods: [IntegrationMethod.DIRECT_LINK, IntegrationMethod.OAUTH, IntegrationMethod.API],
    capabilities: [
      'Attach Miro boards directly to Mathematics lesson plans & homework',
      'Open interactive whiteboard during live Class Documentation',
    ],
    requestedPermissions: [
      'Direct Link: Saved board/team URL',
      'OAuth (when configured): boards:read',
    ],
    teachingUseCases: ['Mathematics Lessons', 'Homework', 'Class Documentation'],
    serverCapabilityKey: 'miro',
    setupRequirements:
      'Direct Link works immediately with your Miro team or board URL. Miro REST API sync requires MIRO_CLIENT_ID and MIRO_CLIENT_SECRET on the backend.',
  },
  {
    catalogId: 'zoom',
    name: 'Zoom',
    providerVendor: 'Zoom',
    shortTagline: 'HD video classes, breakout rooms & whiteboards',
    description:
      'Save your Personal Meeting Room or scheduled class link so you can launch Zoom sessions straight from your teaching workspace.',
    category: IntegrationCategory.VIDEO_CONFERENCING,
    iconKey: 'zoom',
    accentColor: 'blue',
    defaultWebsiteUrl: 'https://zoom.us',
    defaultLoginUrl: 'https://zoom.us/signin',
    apiDocsUrl: 'https://developers.zoom.us/docs/api/',
    defaultMethod: IntegrationMethod.DIRECT_LINK,
    supportedMethods: [
      IntegrationMethod.DIRECT_LINK,
      IntegrationMethod.OAUTH,
      IntegrationMethod.WEBHOOK,
    ],
    capabilities: [
      'Launch scheduled Zoom class room links from Lesson Plans',
      'Architecture ready for Zoom meeting.ended webhook verification',
    ],
    requestedPermissions: [
      'Direct Link: Saved meeting room URL',
      'OAuth/Webhook (when configured): meeting:read, webhook verification token',
    ],
    teachingUseCases: ['Lesson Planning', 'Class Documentation'],
    serverCapabilityKey: 'zoom',
    setupRequirements:
      'Direct Link works immediately. Automated meeting webhooks require ZOOM_WEBHOOK_SECRET_TOKEN configured on the server.',
  },
  {
    catalogId: 'ms_teams',
    name: 'Microsoft Teams',
    providerVendor: 'Microsoft',
    shortTagline: 'Online classes, chat & Microsoft Education channels',
    description:
      'Connect Microsoft Teams channels or meeting links for online lessons and student/parent communication.',
    category: IntegrationCategory.VIDEO_CONFERENCING,
    iconKey: 'ms_teams',
    accentColor: 'indigo',
    defaultWebsiteUrl: 'https://teams.microsoft.com',
    defaultLoginUrl: 'https://login.microsoftonline.com',
    apiDocsUrl: 'https://learn.microsoft.com/en-us/graph/teams-concept-overview',
    defaultMethod: IntegrationMethod.DIRECT_LINK,
    supportedMethods: [IntegrationMethod.DIRECT_LINK, IntegrationMethod.OAUTH],
    capabilities: [
      'Launch Teams class meetings and team channels directly',
      'Attach Teams meeting links to lesson plans',
    ],
    requestedPermissions: ['Direct Link: Saved Teams URL only'],
    teachingUseCases: ['Lesson Planning', 'Communication'],
    serverCapabilityKey: 'microsoft',
    setupRequirements:
      'Direct Link works immediately. Microsoft Graph OAuth requires MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET.',
  },
  {
    catalogId: 'ms_onenote',
    name: 'Microsoft OneNote',
    providerVendor: 'Microsoft',
    shortTagline: 'Structured math & coding class notebooks',
    description:
      'Link digital class notebooks with handwritten math workings, diagrams, and topic tabs directly to YoungAndCode.',
    category: IntegrationCategory.DOCUMENTS_STORAGE,
    iconKey: 'ms_onenote',
    accentColor: 'violet',
    defaultWebsiteUrl: 'https://www.onenote.com/notebooks',
    defaultLoginUrl: 'https://login.microsoftonline.com',
    apiDocsUrl: 'https://learn.microsoft.com/en-us/graph/integrate-with-onenote',
    defaultMethod: IntegrationMethod.DIRECT_LINK,
    supportedMethods: [IntegrationMethod.DIRECT_LINK, IntegrationMethod.OAUTH],
    capabilities: [
      'Open OneNote class notebooks during live lessons',
      'Attach notebook links to student learning resources',
    ],
    requestedPermissions: ['Direct Link: Saved OneNote share/notebook URL'],
    teachingUseCases: ['Class Documentation', 'Student Profiles'],
    serverCapabilityKey: 'microsoft',
    setupRequirements:
      'Direct Link works immediately with your OneNote notebook URL.',
  },
  {
    catalogId: 'canva',
    name: 'Canva',
    providerVendor: 'Canva',
    shortTagline: 'Visual slides, math posters & creative worksheets',
    description:
      'Save your Canva Education workspace or template folders to prepare engaging visual slides and design projects.',
    category: IntegrationCategory.DESIGN_CREATIVITY,
    iconKey: 'canva',
    accentColor: 'teal',
    defaultWebsiteUrl: 'https://www.canva.com',
    defaultLoginUrl: 'https://www.canva.com/login',
    apiDocsUrl: 'https://www.canva.dev/docs/connect/',
    defaultMethod: IntegrationMethod.DIRECT_LINK,
    supportedMethods: [IntegrationMethod.DIRECT_LINK, IntegrationMethod.OAUTH],
    capabilities: [
      'Open Canva design folders when building lesson materials',
      'Attach design templates to Technology & creative lessons',
    ],
    requestedPermissions: ['Direct Link: Saved Canva project/folder URL'],
    teachingUseCases: ['Lesson Planning', 'Student Profiles'],
    serverCapabilityKey: 'canva',
    setupRequirements:
      'Direct Link works immediately. Canva Connect OAuth requires CANVA_CLIENT_ID and CANVA_CLIENT_SECRET.',
  },
  {
    catalogId: 'padlet',
    name: 'Padlet',
    providerVendor: 'Padlet',
    shortTagline: 'Collaborative pinboards & showcase walls',
    description:
      'Connect Padlet boards where students showcase coding projects, math reflections, and collaborative ideas.',
    category: IntegrationCategory.COMMUNICATION,
    iconKey: 'padlet',
    accentColor: 'rose',
    defaultWebsiteUrl: 'https://padlet.com',
    defaultLoginUrl: 'https://padlet.com/auth/login',
    apiDocsUrl: 'https://padlet.dev/',
    defaultMethod: IntegrationMethod.DIRECT_LINK,
    supportedMethods: [IntegrationMethod.DIRECT_LINK, IntegrationMethod.API, IntegrationMethod.WEBHOOK],
    capabilities: [
      'Attach Padlet showcase walls to lessons and homework',
      'Open collaborative class walls in one click',
    ],
    requestedPermissions: ['Direct Link: Saved Padlet board URL'],
    teachingUseCases: ['Homework', 'Student Profiles'],
    setupRequirements:
      'Direct Link works immediately. Automated Padlet API access requires a Padlet developer API key on the backend.',
  },
  {
    catalogId: 'kahoot',
    name: 'Kahoot!',
    providerVendor: 'Kahoot!',
    shortTagline: 'Interactive live math & coding review quizzes',
    description:
      'Save your Kahoot! creator library or challenge links for quick formative assessment games at the end of lessons.',
    category: IntegrationCategory.ASSESSMENT_QUIZZES,
    iconKey: 'kahoot',
    accentColor: 'violet',
    defaultWebsiteUrl: 'https://create.kahoot.it',
    defaultLoginUrl: 'https://create.kahoot.it/auth/login',
    apiDocsUrl: '',
    defaultMethod: IntegrationMethod.DIRECT_LINK,
    supportedMethods: [IntegrationMethod.DIRECT_LINK],
    capabilities: [
      'Launch interactive review quizzes directly from Lesson Plans',
      'Attach challenge links into Homework assignments',
    ],
    requestedPermissions: ['Direct Link: Saved Kahoot library or quiz URL'],
    teachingUseCases: ['Lesson Planning', 'Homework'],
    setupRequirements:
      'Kahoot! operates via Direct Link in this workspace (no public teacher API required).',
  },
  {
    catalogId: 'quizizz',
    name: 'Quizizz',
    providerVendor: 'Quizizz',
    shortTagline: 'Self-paced quizzes, math drills & exit tickets',
    description:
      'Connect Quizizz quiz collections for self-paced practice homework and quick concept checks.',
    category: IntegrationCategory.ASSESSMENT_QUIZZES,
    iconKey: 'quizizz',
    accentColor: 'indigo',
    defaultWebsiteUrl: 'https://quizizz.com',
    defaultLoginUrl: 'https://quizizz.com/login',
    apiDocsUrl: '',
    defaultMethod: IntegrationMethod.DIRECT_LINK,
    supportedMethods: [IntegrationMethod.DIRECT_LINK],
    capabilities: [
      'Attach self-paced Quizizz links to Homework',
      'Open quiz collections from Lesson Planning',
    ],
    requestedPermissions: ['Direct Link: Saved Quizizz URL only'],
    teachingUseCases: ['Homework', 'Lesson Planning'],
    setupRequirements:
      'Works immediately via Direct Link. Save your Quizizz library or assignment link.',
  },
  {
    catalogId: 'notion',
    name: 'Notion',
    providerVendor: 'Notion',
    shortTagline: 'Curriculum roadmaps, syllabus & teaching wikis',
    description:
      'Link your Notion curriculum database or student roadmap pages so lesson plans and reference notes stay one click away.',
    category: IntegrationCategory.PRODUCTIVITY_SCHEDULING,
    iconKey: 'notion',
    accentColor: 'slate',
    defaultWebsiteUrl: 'https://www.notion.so',
    defaultLoginUrl: 'https://www.notion.so/login',
    apiDocsUrl: 'https://developers.notion.com/',
    defaultMethod: IntegrationMethod.DIRECT_LINK,
    supportedMethods: [IntegrationMethod.DIRECT_LINK, IntegrationMethod.OAUTH, IntegrationMethod.API],
    capabilities: [
      'Open Notion curriculum pages from Lesson Plans & Class Documentation',
      'Architecture ready for Notion OAuth database integration',
    ],
    requestedPermissions: [
      'Direct Link: Saved Notion workspace/page URL',
      'OAuth (when configured): Read selected curriculum pages only',
    ],
    teachingUseCases: ['Lesson Planning', 'Class Documentation'],
    serverCapabilityKey: 'notion',
    setupRequirements:
      'Direct Link works immediately. Notion API sync requires NOTION_OAUTH_CLIENT_ID and NOTION_OAUTH_CLIENT_SECRET on the backend.',
  },
  {
    catalogId: 'github',
    name: 'GitHub',
    providerVendor: 'GitHub',
    shortTagline: 'Student code repositories, exercises & commits',
    description:
      'Connect GitHub repositories or Classroom starter code so you can review student programming work during Technology classes.',
    category: IntegrationCategory.CODING_TOOLS,
    iconKey: 'github',
    accentColor: 'slate',
    defaultWebsiteUrl: 'https://github.com',
    defaultLoginUrl: 'https://github.com/login',
    apiDocsUrl: 'https://docs.github.com/en/rest',
    defaultMethod: IntegrationMethod.DIRECT_LINK,
    supportedMethods: [
      IntegrationMethod.DIRECT_LINK,
      IntegrationMethod.OAUTH,
      IntegrationMethod.API,
      IntegrationMethod.WEBHOOK,
    ],
    capabilities: [
      'Attach GitHub repos to Technology lesson plans & homework',
      'Supports verified push/PR webhook receiver architecture on backend',
    ],
    requestedPermissions: [
      'Direct Link: Saved organization or repository URL',
      'OAuth/Webhook (when configured): read:user, repo (selected repositories)',
    ],
    teachingUseCases: ['Technology Lessons', 'Homework', 'Student Profiles'],
    serverCapabilityKey: 'github',
    setupRequirements:
      'Direct Link works immediately. Automated GitHub webhooks/OAuth require GITHUB_WEBHOOK_SECRET or GITHUB_CLIENT_ID/SECRET on the backend.',
  },
  {
    catalogId: 'sololearn',
    name: 'SoloLearn',
    providerVendor: 'SoloLearn',
    shortTagline: 'Interactive coding courses & mobile practice',
    description:
      'Bookmark SoloLearn Python, HTML/CSS, and JavaScript practice tracks to share with Technology students.',
    category: IntegrationCategory.CODING_TOOLS,
    iconKey: 'sololearn',
    accentColor: 'teal',
    defaultWebsiteUrl: 'https://www.sololearn.com',
    defaultLoginUrl: 'https://www.sololearn.com/users/login',
    apiDocsUrl: '',
    defaultMethod: IntegrationMethod.DIRECT_LINK,
    supportedMethods: [IntegrationMethod.DIRECT_LINK],
    capabilities: [
      'Attach SoloLearn course links to Technology homework & student resources',
      'Open coding track exercises directly from workspace',
    ],
    requestedPermissions: ['Direct Link: Saved course/profile URL only'],
    teachingUseCases: ['Homework', 'Student Profiles'],
    setupRequirements:
      'Works immediately via Direct Link (SoloLearn does not provide a public student sync API).',
  },
  {
    catalogId: 'geogebra',
    name: 'GeoGebra',
    providerVendor: 'GeoGebra',
    shortTagline: 'Interactive geometry, graphing & math applets',
    description:
      'Save GeoGebra calculators or geometry constructions to launch live visual demonstrations in Mathematics lessons.',
    category: IntegrationCategory.MATH_WHITEBOARDS,
    iconKey: 'geogebra',
    accentColor: 'indigo',
    defaultWebsiteUrl: 'https://www.geogebra.org/calculator',
    defaultLoginUrl: 'https://www.geogebra.org/signin',
    apiDocsUrl: 'https://wiki.geogebra.org/en/Reference:GeoGebra_Apps_API',
    defaultMethod: IntegrationMethod.DIRECT_LINK,
    supportedMethods: [IntegrationMethod.DIRECT_LINK],
    capabilities: [
      'Launch GeoGebra interactive math tools during live classes',
      'Attach saved math constructions to Lesson Plans & Homework',
    ],
    requestedPermissions: ['Direct Link: Saved GeoGebra resource URL only'],
    teachingUseCases: ['Mathematics Lessons', 'Homework'],
    setupRequirements: 'Works immediately via Direct Link.',
  },
  {
    catalogId: 'desmos',
    name: 'Desmos',
    providerVendor: 'Desmos',
    shortTagline: 'Graphing calculator & classroom math activities',
    description:
      'Connect Desmos Graphing Calculator or Activity Builder links for interactive algebra and coordinate geometry.',
    category: IntegrationCategory.MATH_WHITEBOARDS,
    iconKey: 'desmos',
    accentColor: 'emerald',
    defaultWebsiteUrl: 'https://www.desmos.com/calculator',
    defaultLoginUrl: 'https://teacher.desmos.com',
    apiDocsUrl: 'https://www.desmos.com/api',
    defaultMethod: IntegrationMethod.DIRECT_LINK,
    supportedMethods: [IntegrationMethod.DIRECT_LINK],
    capabilities: [
      'Attach Desmos graph or Teacher Activity links to Math lessons',
      'Open graphing workspace directly during Class Documentation',
    ],
    requestedPermissions: ['Direct Link: Saved Desmos URL only'],
    teachingUseCases: ['Mathematics Lessons', 'Homework'],
    setupRequirements: 'Works immediately via Direct Link.',
  },
  {
    catalogId: 'replit',
    name: 'Replit',
    providerVendor: 'Replit',
    shortTagline: 'Browser-based Python & web coding sandboxes',
    description:
      'Link live Replit coding environments so Technology students can practice Python, HTML, and JavaScript without local setup.',
    category: IntegrationCategory.CODING_TOOLS,
    iconKey: 'replit',
    accentColor: 'orange',
    defaultWebsiteUrl: 'https://replit.com',
    defaultLoginUrl: 'https://replit.com/login',
    apiDocsUrl: '',
    defaultMethod: IntegrationMethod.DIRECT_LINK,
    supportedMethods: [IntegrationMethod.DIRECT_LINK],
    capabilities: [
      'Attach coding starter repls to Technology lessons & homework',
      'Launch student sandboxes in one click during class',
    ],
    requestedPermissions: ['Direct Link: Saved Replit URL only'],
    teachingUseCases: ['Technology Lessons', 'Homework'],
    setupRequirements: 'Works immediately via Direct Link.',
  },
  {
    catalogId: 'scratch',
    name: 'Scratch',
    providerVendor: 'MIT Scratch Foundation',
    shortTagline: 'Visual block coding for young learners',
    description:
      'Save Scratch studios or project templates for foundational programming lessons with younger students.',
    category: IntegrationCategory.CODING_TOOLS,
    iconKey: 'scratch',
    accentColor: 'orange',
    defaultWebsiteUrl: 'https://scratch.mit.edu',
    defaultLoginUrl: 'https://scratch.mit.edu/login/',
    apiDocsUrl: '',
    defaultMethod: IntegrationMethod.DIRECT_LINK,
    supportedMethods: [IntegrationMethod.DIRECT_LINK],
    capabilities: [
      'Attach Scratch starter projects to Technology lessons & homework',
      'Open student project studios from Student Profiles',
    ],
    requestedPermissions: ['Direct Link: Saved Scratch project or studio URL'],
    teachingUseCases: ['Technology Lessons', 'Student Profiles'],
    setupRequirements: 'Works immediately via Direct Link.',
  },
  {
    catalogId: 'gemini_ai',
    name: 'Gemini AI Engine',
    providerVendor: 'Google Gemini (Server-Side)',
    shortTagline: 'Powers Class & Monthly Academic Progress Reports',
    description:
      'Server-side Gemini API integration used when you explicitly trigger Class AI Reports and Monthly Progress Reports.',
    category: IntegrationCategory.AI_TOOLS,
    iconKey: 'gemini',
    accentColor: 'violet',
    defaultWebsiteUrl: 'https://ai.google.dev',
    defaultLoginUrl: 'https://aistudio.google.com',
    apiDocsUrl: 'https://ai.google.dev/gemini-api/docs',
    defaultMethod: IntegrationMethod.API,
    supportedMethods: [IntegrationMethod.API],
    capabilities: [
      'Analyzes saved class documentation into structured Class Reports',
      'Synthesizes longitudinal Monthly Academic Progress Reports',
      'Requires explicit teacher review & approval before saving',
    ],
    requestedPermissions: [
      'Teacher-initiated analysis only (student data never auto-sent in background)',
    ],
    teachingUseCases: ['Class Documentation', 'Monthly Reports'],
    serverCapabilityKey: 'gemini_ai',
    setupRequirements:
      'Uses GEMINI_API_KEY stored securely on the backend server (never exposed to browser code).',
  },
];

export const CUSTOM_ICON_OPTIONS: Array<{
  key: string;
  label: string;
}> = [
  { key: 'globe', label: 'Website / Globe' },
  { key: 'calculator', label: 'Mathematics' },
  { key: 'code', label: 'Coding / Tech' },
  { key: 'video', label: 'Video / Live Class' },
  { key: 'book', label: 'Curriculum / Docs' },
  { key: 'sparkles', label: 'AI / Smart Tool' },
  { key: 'layers', label: 'Whiteboard / Design' },
  { key: 'wrench', label: 'Utility / Platform' },
];

export const ACCENT_COLOR_OPTIONS: Array<{
  id: IntegrationAccentColor;
  label: string;
  swatchClass: string;
}> = [
  { id: 'blue', label: 'Electric Blue', swatchClass: 'bg-blue-600' },
  { id: 'indigo', label: 'Indigo', swatchClass: 'bg-indigo-600' },
  { id: 'violet', label: 'Violet', swatchClass: 'bg-violet-600' },
  { id: 'teal', label: 'Teal', swatchClass: 'bg-teal-600' },
  { id: 'emerald', label: 'Emerald', swatchClass: 'bg-emerald-600' },
  { id: 'orange', label: 'Warm Orange', swatchClass: 'bg-orange-500' },
  { id: 'amber', label: 'Amber', swatchClass: 'bg-amber-500' },
  { id: 'rose', label: 'Rose', swatchClass: 'bg-rose-600' },
  { id: 'slate', label: 'Navy Slate', swatchClass: 'bg-slate-700' },
];
