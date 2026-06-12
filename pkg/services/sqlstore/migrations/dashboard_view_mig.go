package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addDashboardViewMigrations(mg *Migrator) {
	dashboardViewV1 := Table{
		Name: "dashboard_view",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "user_id", Type: DB_BigInt, Nullable: false},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "dashboard_uid", Type: DB_NVarchar, Length: 40, Nullable: false},
			{Name: "viewed_at", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"user_id", "org_id", "dashboard_uid"}, Type: UniqueIndex},
			{Cols: []string{"user_id", "org_id", "viewed_at"}},
		},
	}

	mg.AddMigration("create dashboard_view table", NewAddTableMigration(dashboardViewV1))
	mg.AddMigration("add unique index dashboard_view.user_id_org_id_dashboard_uid",
		NewAddIndexMigration(dashboardViewV1, dashboardViewV1.Indices[0]))
	mg.AddMigration("add index dashboard_view.user_id_org_id_viewed_at",
		NewAddIndexMigration(dashboardViewV1, dashboardViewV1.Indices[1]))
}
