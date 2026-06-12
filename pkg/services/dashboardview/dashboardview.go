package dashboardview

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideService(
	cfg *setting.Cfg,
	sqlStore db.DB,
	routeRegister routing.RouteRegister,
) *DashboardViewService {
	s := &DashboardViewService{
		store:         sqlStore,
		Cfg:           cfg,
		RouteRegister: routeRegister,
		log:           log.New("dashboard-view"),
		now:           time.Now,
	}

	s.registerAPIEndpoints()
	return s
}

type Service interface {
	RecordDashboardView(ctx context.Context, user *user.SignedInUser, dashboardUID string) error
	GetDashboardViews(ctx context.Context, user *user.SignedInUser, limit int) ([]string, error)
	ClearDashboardViews(ctx context.Context, user *user.SignedInUser) error
}

type DashboardViewService struct {
	store         db.DB
	Cfg           *setting.Cfg
	RouteRegister routing.RouteRegister
	log           log.Logger
	now           func() time.Time
}

func (s *DashboardViewService) RecordDashboardView(ctx context.Context, user *user.SignedInUser, dashboardUID string) error {
	return s.recordView(ctx, user, dashboardUID)
}

func (s *DashboardViewService) GetDashboardViews(ctx context.Context, user *user.SignedInUser, limit int) ([]string, error) {
	return s.getViews(ctx, user, limit)
}

func (s *DashboardViewService) ClearDashboardViews(ctx context.Context, user *user.SignedInUser) error {
	return s.clearViews(ctx, user)
}
