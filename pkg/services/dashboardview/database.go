package dashboardview

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/user"
)

func (s *DashboardViewService) recordView(ctx context.Context, signedInUser *user.SignedInUser, dashboardUID string) error {
	now := s.now()

	return s.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		existing := DashboardView{}
		has, err := sess.Where("user_id = ? AND org_id = ? AND dashboard_uid = ?",
			signedInUser.UserID, signedInUser.OrgID, dashboardUID).Get(&existing)
		if err != nil {
			return err
		}

		if has {
			existing.ViewedAt = now
			_, err = sess.ID(existing.ID).Cols("viewed_at").Update(&existing)
			if err != nil {
				return err
			}
		} else {
			_, err = sess.Insert(&DashboardView{
				UserID:       signedInUser.UserID,
				OrgID:        signedInUser.OrgID,
				DashboardUID: dashboardUID,
				ViewedAt:     now,
			})
			if err != nil {
				return err
			}
		}

		return s.enforceRowLimit(sess, signedInUser.UserID, signedInUser.OrgID)
	})
}

func (s *DashboardViewService) getViews(ctx context.Context, signedInUser *user.SignedInUser, limit int) ([]string, error) {
	if limit <= 0 {
		limit = maxDashboardViewsPerUser
	}
	if limit > maxDashboardViewsPerUser {
		limit = maxDashboardViewsPerUser
	}

	var views []DashboardView
	err := s.store.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Where("user_id = ? AND org_id = ?", signedInUser.UserID, signedInUser.OrgID).
			Desc("viewed_at").
			Limit(limit).
			Find(&views)
	})
	if err != nil {
		return nil, err
	}

	uids := make([]string, 0, len(views))
	for _, view := range views {
		uids = append(uids, view.DashboardUID)
	}
	return uids, nil
}

func (s *DashboardViewService) clearViews(ctx context.Context, signedInUser *user.SignedInUser) error {
	return s.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Where("user_id = ? AND org_id = ?", signedInUser.UserID, signedInUser.OrgID).
			Delete(&DashboardView{})
		return err
	})
}

func (s *DashboardViewService) enforceRowLimit(sess *db.Session, userID, orgID int64) error {
	count, err := sess.Where("user_id = ? AND org_id = ?", userID, orgID).Count(&DashboardView{})
	if err != nil {
		return err
	}

	excess := int(count) - maxDashboardViewsPerUser
	if excess <= 0 {
		return nil
	}

	var oldestViews []DashboardView
	err = sess.Where("user_id = ? AND org_id = ?", userID, orgID).
		Asc("viewed_at").
		Limit(excess).
		Find(&oldestViews)
	if err != nil {
		return err
	}

	for _, view := range oldestViews {
		if _, err := sess.ID(view.ID).Delete(&DashboardView{}); err != nil {
			return err
		}
	}

	return nil
}
