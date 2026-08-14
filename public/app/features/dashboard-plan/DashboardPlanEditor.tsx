import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';

import { locationUtil, type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import {
  Box,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  RadioButtonGroup,
  Select,
  Stack,
  Tab,
  TabsBar,
  Text,
  useStyles2,
} from '@grafana/ui';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { useDispatch } from 'app/types/store';

import { createDashboardFromPlan } from './buildDashboard';
import {
  addPanel,
  addSection,
  countPanels,
  createDefaultPlan,
  movePanel,
  moveSection,
  removePanel,
  removeSection,
  renamePanel,
  renameSection,
  setLayout,
  setPanelVizType,
  setTitle,
} from './planModel';
import { dashboardPlanTracking } from './tracking';
import { type MoveDirection, type PlanLayout, type PlanSection, type PlanVizType } from './types';

interface DashboardPlanEditorProps {
  datasourceUid?: string;
}

function useVizOptions(): Array<SelectableValue<PlanVizType>> {
  return useMemo(
    () => [
      { value: 'timeseries', label: t('dashboard-plan.viz.timeseries', 'Time series') },
      { value: 'stat', label: t('dashboard-plan.viz.stat', 'Stat') },
      { value: 'gauge', label: t('dashboard-plan.viz.gauge', 'Gauge') },
      { value: 'bargauge', label: t('dashboard-plan.viz.bargauge', 'Bar gauge') },
      { value: 'barchart', label: t('dashboard-plan.viz.barchart', 'Bar chart') },
      { value: 'piechart', label: t('dashboard-plan.viz.piechart', 'Pie chart') },
      { value: 'table', label: t('dashboard-plan.viz.table', 'Table') },
      { value: 'text', label: t('dashboard-plan.viz.text', 'Text') },
    ],
    []
  );
}

export function DashboardPlanEditor({ datasourceUid }: DashboardPlanEditorProps) {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const vizOptions = useVizOptions();

  const [plan, setPlan] = useState(createDefaultPlan);
  const [activeSectionId, setActiveSectionId] = useState<string | undefined>(() => plan.sections[0]?.id);
  const [building, setBuilding] = useState(false);

  useEffect(() => {
    dashboardPlanTracking.opened(plan, datasourceUid);
    // Report once on mount — subsequent edits have their own events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!plan.sections.some((s) => s.id === activeSectionId)) {
      setActiveSectionId(plan.sections[0]?.id);
    }
  }, [plan, activeSectionId]);

  const layoutOptions: Array<SelectableValue<PlanLayout>> = [
    { value: 'tabs', label: t('dashboard-plan.layout.tabs', 'Tabs'), icon: 'apps' },
    { value: 'rows', label: t('dashboard-plan.layout.rows', 'Rows'), icon: 'list-ul' },
  ];

  const sectionNoun =
    plan.layout === 'tabs' ? t('dashboard-plan.noun.tab', 'tab') : t('dashboard-plan.noun.row', 'row');

  const handleLayoutChange = (layout: PlanLayout) => {
    setPlan((prev) => setLayout(prev, layout));
    dashboardPlanTracking.layoutSwitched(layout);
  };

  const handleAddSection = () => {
    setPlan((prev) => {
      const next = addSection(
        prev,
        t('dashboard-plan.new-section-title', 'Section {{number}}', { number: prev.sections.length + 1 })
      );
      const added = next.sections[next.sections.length - 1];
      setActiveSectionId(added.id);
      dashboardPlanTracking.sectionAdded(next.sections.length);
      return next;
    });
  };

  const handleRemoveSection = (sectionId: string) => {
    setPlan((prev) => {
      const next = removeSection(prev, sectionId);
      dashboardPlanTracking.sectionRemoved(next.sections.length);
      return next;
    });
  };

  const handleMoveSection = (sectionId: string, direction: MoveDirection) => {
    setPlan((prev) => moveSection(prev, sectionId, direction));
    dashboardPlanTracking.sectionMoved(direction);
  };

  const handleRenameSection = (sectionId: string, title: string) => {
    setPlan((prev) => renameSection(prev, sectionId, title));
  };

  const handleAddPanel = (sectionId: string) => {
    setPlan((prev) => addPanel(prev, sectionId, 'timeseries'));
    dashboardPlanTracking.panelAdded('timeseries');
  };

  const handleRemovePanel = (sectionId: string, panelId: string) => {
    setPlan((prev) => removePanel(prev, sectionId, panelId));
    dashboardPlanTracking.panelRemoved();
  };

  const handleMovePanel = (sectionId: string, panelId: string, direction: MoveDirection) => {
    setPlan((prev) => movePanel(prev, sectionId, panelId, direction));
    dashboardPlanTracking.panelMoved(direction);
  };

  const handleRenamePanel = (sectionId: string, panelId: string, title: string) => {
    setPlan((prev) => renamePanel(prev, sectionId, panelId, title));
  };

  const handlePanelVizChange = (sectionId: string, panelId: string, vizType: PlanVizType) => {
    setPlan((prev) => setPanelVizType(prev, sectionId, panelId, vizType));
    dashboardPlanTracking.panelVizChanged(vizType);
  };

  const handleTabSwitch = (sectionId: string, index: number) => {
    setActiveSectionId(sectionId);
    dashboardPlanTracking.tabSwitched(index);
  };

  const handleBuild = async () => {
    dashboardPlanTracking.buildClicked(plan, datasourceUid);
    setBuilding(true);
    try {
      const result = await createDashboardFromPlan(plan, datasourceUid);
      dashboardPlanTracking.buildSucceeded(result.uid);
      locationService.push(locationUtil.stripBaseFromUrl(result.url));
    } catch (error) {
      dashboardPlanTracking.buildFailed();
      dispatch(
        notifyApp(
          createErrorNotification(
            t('dashboard-plan.build-error', 'Failed to build dashboard'),
            error instanceof Error ? error : undefined
          )
        )
      );
      setBuilding(false);
    }
  };

  const totalPanels = countPanels(plan);
  const canBuild = totalPanels > 0 && !building;

  const renderPanelRow = (section: PlanSection, panelIndex: number) => {
    const panel = section.panels[panelIndex];
    return (
      <div key={panel.id} className={styles.panelRow} data-testid="dashboard-plan-panel">
        <IconButton name="draggabledots" tooltip={t('dashboard-plan.panel.drag', 'Reorder panel')} aria-hidden />
        <Input
          value={panel.title}
          onChange={(e) => handleRenamePanel(section.id, panel.id, e.currentTarget.value)}
          aria-label={t('dashboard-plan.panel.title-label', 'Panel title')}
        />
        <div className={styles.vizSelect}>
          <Select
            value={panel.vizType}
            options={vizOptions}
            onChange={(v) => v.value && handlePanelVizChange(section.id, panel.id, v.value)}
            aria-label={t('dashboard-plan.panel.viz-label', 'Panel visualization')}
          />
        </div>
        <IconButton
          name="arrow-up"
          tooltip={t('dashboard-plan.panel.move-up', 'Move panel up')}
          disabled={panelIndex === 0}
          onClick={() => handleMovePanel(section.id, panel.id, 'up')}
        />
        <IconButton
          name="arrow-down"
          tooltip={t('dashboard-plan.panel.move-down', 'Move panel down')}
          disabled={panelIndex === section.panels.length - 1}
          onClick={() => handleMovePanel(section.id, panel.id, 'down')}
        />
        <IconButton
          name="trash-alt"
          tooltip={t('dashboard-plan.panel.delete', 'Delete panel')}
          onClick={() => handleRemovePanel(section.id, panel.id)}
        />
      </div>
    );
  };

  const renderSectionBody = (section: PlanSection) => (
    <Stack direction="column" gap={1}>
      {section.panels.length === 0 ? (
        <Text color="secondary">
          <Trans i18nKey="dashboard-plan.section.empty">No panels yet. Add one to start shaping this section.</Trans>
        </Text>
      ) : (
        section.panels.map((_, index) => renderPanelRow(section, index))
      )}
      <div>
        <Button variant="secondary" fill="text" icon="plus" onClick={() => handleAddPanel(section.id)}>
          <Trans i18nKey="dashboard-plan.section.add-panel">Add panel</Trans>
        </Button>
      </div>
    </Stack>
  );

  const renderSectionHeaderControls = (section: PlanSection, index: number) => (
    <Stack direction="row" gap={1} alignItems="center">
      <Input
        value={section.title}
        onChange={(e) => handleRenameSection(section.id, e.currentTarget.value)}
        aria-label={t('dashboard-plan.section.title-label', 'Section title')}
      />
      <IconButton
        name="arrow-up"
        tooltip={t('dashboard-plan.section.move-up', 'Move {{noun}} earlier', { noun: sectionNoun })}
        disabled={index === 0}
        onClick={() => handleMoveSection(section.id, 'up')}
      />
      <IconButton
        name="arrow-down"
        tooltip={t('dashboard-plan.section.move-down', 'Move {{noun}} later', { noun: sectionNoun })}
        disabled={index === plan.sections.length - 1}
        onClick={() => handleMoveSection(section.id, 'down')}
      />
      <IconButton
        name="trash-alt"
        tooltip={t('dashboard-plan.section.delete', 'Delete {{noun}}', { noun: sectionNoun })}
        disabled={plan.sections.length <= 1}
        onClick={() => handleRemoveSection(section.id)}
      />
    </Stack>
  );

  const activeSection = plan.sections.find((s) => s.id === activeSectionId) ?? plan.sections[0];

  return (
    <Stack direction="column" gap={2}>
      <div className={styles.toolbar}>
        <Field label={t('dashboard-plan.title-label', 'Dashboard title')} className={styles.titleField} noMargin>
          <Input
            value={plan.title}
            onChange={(e) => setPlan((prev) => setTitle(prev, e.currentTarget.value))}
            aria-label={t('dashboard-plan.title-label', 'Dashboard title')}
          />
        </Field>
        <Stack direction="row" gap={1} alignItems="flex-end">
          <Field label={t('dashboard-plan.layout-label', 'Organize as')} noMargin>
            <RadioButtonGroup options={layoutOptions} value={plan.layout} onChange={handleLayoutChange} />
          </Field>
          <Button variant="secondary" icon="plus" onClick={handleAddSection}>
            {plan.layout === 'tabs' ? (
              <Trans i18nKey="dashboard-plan.add-tab">Add tab</Trans>
            ) : (
              <Trans i18nKey="dashboard-plan.add-row">Add row</Trans>
            )}
          </Button>
          <Button
            variant="primary"
            icon="apps"
            disabled={!canBuild}
            onClick={handleBuild}
            data-testid="dashboard-plan-build"
          >
            <Trans i18nKey="dashboard-plan.build">Build dashboard</Trans>
          </Button>
        </Stack>
      </div>

      {plan.sections.length === 0 ? (
        <EmptyState
          variant="call-to-action"
          message={t('dashboard-plan.no-sections', 'Your plan is empty')}
          button={
            <Button icon="plus" onClick={handleAddSection}>
              <Trans i18nKey="dashboard-plan.add-first-section">Add a section</Trans>
            </Button>
          }
        />
      ) : plan.layout === 'tabs' ? (
        <Stack direction="column" gap={1}>
          <TabsBar>
            {plan.sections.map((section, index) => (
              <Tab
                key={section.id}
                label={section.title}
                counter={section.panels.length}
                active={section.id === activeSection?.id}
                onChangeTab={() => handleTabSwitch(section.id, index)}
              />
            ))}
          </TabsBar>
          {activeSection && (
            <Card noMargin>
              <Card.Heading>
                {renderSectionHeaderControls(activeSection, plan.sections.indexOf(activeSection))}
              </Card.Heading>
              <Card.Description>{renderSectionBody(activeSection)}</Card.Description>
            </Card>
          )}
        </Stack>
      ) : (
        <Stack direction="column" gap={2}>
          {plan.sections.map((section, index) => (
            <Card key={section.id} noMargin>
              <Card.Heading>{renderSectionHeaderControls(section, index)}</Card.Heading>
              <Card.Description>{renderSectionBody(section)}</Card.Description>
            </Card>
          ))}
        </Stack>
      )}

      <Box paddingTop={1}>
        <Text color="secondary" variant="bodySmall">
          {t('dashboard-plan.summary', '{{panels}} panels across {{sections}} sections', {
            panels: totalPanels,
            sections: plan.sections.length,
          })}
        </Text>
      </Box>
    </Stack>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    toolbar: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(2),
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    }),
    titleField: css({
      marginBottom: 0,
      minWidth: 260,
      flex: '1 1 260px',
    }),
    panelRow: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(1),
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.secondary,
    }),
    vizSelect: css({
      minWidth: 160,
    }),
  };
}
