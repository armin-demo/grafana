package dashboardview

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func setupTestService(t *testing.T) *DashboardViewService {
	t.Helper()

	sqlStore, _ := db.InitTestDBWithCfg(t)
	return &DashboardViewService{
		store: sqlStore,
		Cfg:   setting.NewCfg(),
		log:   nil,
		now:   func() time.Time { return time.Unix(1700000000, 0) },
	}
}

func TestRecordAndGetDashboardViews(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()
	signedInUser := &user.SignedInUser{UserID: 1, OrgID: 1}

	require.NoError(t, s.RecordDashboardView(ctx, signedInUser, "dash-a"))
	s.now = func() time.Time { return time.Unix(1700000001, 0) }
	require.NoError(t, s.RecordDashboardView(ctx, signedInUser, "dash-b"))
	s.now = func() time.Time { return time.Unix(1700000002, 0) }
	require.NoError(t, s.RecordDashboardView(ctx, signedInUser, "dash-a"))

	uids, err := s.GetDashboardViews(ctx, signedInUser, 10)
	require.NoError(t, err)
	require.Equal(t, []string{"dash-a", "dash-b"}, uids)
}

func TestClearDashboardViews(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()
	signedInUser := &user.SignedInUser{UserID: 1, OrgID: 1}

	require.NoError(t, s.RecordDashboardView(ctx, signedInUser, "dash-a"))
	require.NoError(t, s.ClearDashboardViews(ctx, signedInUser))

	uids, err := s.GetDashboardViews(ctx, signedInUser, 10)
	require.NoError(t, err)
	require.Empty(t, uids)
}

func TestEnforceRowLimit(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()
	signedInUser := &user.SignedInUser{UserID: 1, OrgID: 1}

	baseTime := time.Unix(1700000000, 0)
	for i := 0; i < maxDashboardViewsPerUser+5; i++ {
		idx := i
		s.now = func() time.Time { return baseTime.Add(time.Duration(idx) * time.Second) }
		require.NoError(t, s.RecordDashboardView(ctx, signedInUser, fmt.Sprintf("dash-%03d", idx)))
	}

	uids, err := s.GetDashboardViews(ctx, signedInUser, maxDashboardViewsPerUser+10)
	require.NoError(t, err)
	require.Len(t, uids, maxDashboardViewsPerUser)
}
