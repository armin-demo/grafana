package dashboardview

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
)

func (s *DashboardViewService) registerAPIEndpoints() {
	s.RouteRegister.Group("/api/user/dashboard-views", func(entities routing.RouteRegister) {
		entities.Get("/", middleware.ReqSignedIn, routing.Wrap(s.getViewsHandler))
		entities.Post("/dashboard/uid/:uid", middleware.ReqSignedIn, routing.Wrap(s.recordViewHandler))
		entities.Delete("/", middleware.ReqSignedIn, routing.Wrap(s.clearViewsHandler))
	})
}

// swagger:route GET /user/dashboard-views signed_in_user getDashboardViews
//
// Get recently viewed dashboard UIDs.
//
// Returns dashboard UIDs ordered by most recently viewed first.
//
// Responses:
// 200: getDashboardViewsResponse
// 401: unauthorisedError
// 500: internalServerError
func (s *DashboardViewService) getViewsHandler(c *contextmodel.ReqContext) response.Response {
	limit := c.QueryInt("limit")
	if limit <= 0 {
		limit = maxDashboardViewsPerUser
	}

	uids, err := s.GetDashboardViews(c.Req.Context(), c.SignedInUser, limit)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get dashboard views", err)
	}

	return response.JSON(http.StatusOK, GetDashboardViewsResponse{DashboardUIDs: uids})
}

// swagger:route POST /user/dashboard-views/dashboard/uid/{dashboard_uid} signed_in_user recordDashboardView
//
// Record a dashboard view.
//
// Records that the signed-in user viewed the given dashboard.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 500: internalServerError
func (s *DashboardViewService) recordViewHandler(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":uid"]
	if uid == "" {
		return response.Error(http.StatusBadRequest, "Invalid dashboard UID", nil)
	}

	err := s.RecordDashboardView(c.Req.Context(), c.SignedInUser, uid)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to record dashboard view", err)
	}

	return response.Success("Dashboard view recorded")
}

// swagger:route DELETE /user/dashboard-views signed_in_user clearDashboardViews
//
// Clear dashboard view history.
//
// Deletes all recorded dashboard views for the signed-in user in the current org.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 500: internalServerError
func (s *DashboardViewService) clearViewsHandler(c *contextmodel.ReqContext) response.Response {
	err := s.ClearDashboardViews(c.Req.Context(), c.SignedInUser)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to clear dashboard views", err)
	}

	return response.Success("Dashboard view history cleared")
}
