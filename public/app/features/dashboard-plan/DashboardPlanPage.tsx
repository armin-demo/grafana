import { useLocation } from 'react-router-dom-v5-compat';

import { t } from '@grafana/i18n';
import { Page } from 'app/core/components/Page/Page';

import { DashboardPlanEditor } from './DashboardPlanEditor';

export default function DashboardPlanPage() {
  const { search } = useLocation();
  const datasourceUid = new URLSearchParams(search).get('ds') ?? undefined;

  return (
    <Page
      navId="dashboards"
      pageNav={{
        text: t('dashboard-plan.page-title', 'Plan a dashboard'),
        subTitle: t(
          'dashboard-plan.page-subtitle',
          'Shape the structure — tabs or rows, panels, and their order — before building the dashboard.'
        ),
      }}
    >
      <Page.Contents>
        <DashboardPlanEditor datasourceUid={datasourceUid} />
      </Page.Contents>
    </Page>
  );
}
