package ualert

import (
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

// DropLegacyAlertRuleVersionOrgUIDVersionIndex drops the pre-GUID unique index on
// alert_rule_version (rule_org_id, rule_uid, version) if it still exists.
//
// Soft-delete recovery clears rule_uid to ” while keeping the rule's version.
// Newly created rules share version=1, so multiple soft-deleted rows collide on
// that legacy unique index and delete fails with:
//
//	duplicate key value violates unique constraint
//	"UQE_alert_rule_version_rule_org_id_rule_uid_version"
//
// The GUID migration already dropped this index once, but some upgraded Postgres
// databases retain it. Re-running an idempotent drop (new migration ID) fixes
// those instances without affecting databases where the index is already gone.
func DropLegacyAlertRuleVersionOrgUIDVersionIndex(mg *migrator.Migrator) {
	alertRuleVersion := migrator.Table{Name: "alert_rule_version"}
	mg.AddMigration(
		"drop leftover alert_rule_version unique index on rule_org_id, rule_uid and version",
		migrator.NewDropIndexMigration(alertRuleVersion, alertRuleVersionUDX_OrgIdRuleUIDVersion),
	)
}
