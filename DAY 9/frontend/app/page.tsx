import { headers } from 'next/headers';
import { App } from '@/components/app/app';
import { getAppConfig } from '@/lib/utils';

export default async function Page() {
  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);
  appConfig.agentName = process.env.AGENT_NAME || 'my-agent';

  return <App appConfig={appConfig} />;
}
