package dashboardview

import "time"

const (
	maxDashboardViewsPerUser = 50
)

type DashboardView struct {
	ID           int64     `xorm:"pk autoincr 'id'"`
	UserID       int64     `xorm:"user_id"`
	OrgID        int64     `xorm:"org_id"`
	DashboardUID string    `xorm:"dashboard_uid"`
	ViewedAt     time.Time `xorm:"viewed_at"`
}

type GetDashboardViewsResponse struct {
	DashboardUIDs []string `json:"dashboardUids"`
}
