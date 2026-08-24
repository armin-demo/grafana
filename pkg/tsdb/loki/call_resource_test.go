package loki

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/tracing"
	"github.com/stretchr/testify/require"
)

type fakeResourceSender struct {
	resp *backend.CallResourceResponse
}

func (f *fakeResourceSender) Send(resp *backend.CallResourceResponse) error {
	f.resp = resp
	return nil
}

func testCallResourceDS(t *testing.T, onReq func(*http.Request)) *datasourceInfo {
	t.Helper()
	client := &http.Client{
		Transport: &mockedRoundTripper{
			statusCode:    http.StatusOK,
			contentType:   "application/json",
			responseBytes: []byte(`{"status":"success","data":[]}`),
			requestCallback: func(req *http.Request) {
				if onReq != nil {
					onReq(req)
				}
			},
		},
	}
	return &datasourceInfo{HTTPClient: client, URL: "http://loki.example"}
}

func TestIsAllowedLokiCallResourcePath(t *testing.T) {
	allowed := []string{
		"labels",
		"series",
		"index/stats",
		"index/volume",
		"index/volume_range",
		"patterns",
		"status/buildinfo",
		"format_query",
		"detected_fields",
		"label/job/values",
		"label/%2Fjob/values",
		"detected_field/foo/values",
	}
	for _, p := range allowed {
		require.True(t, isAllowedLokiCallResourcePath(p), p)
	}

	denied := []string{
		"",
		"rules",
		"config",
		"query",
		"query_range",
		"tail",
		"status/config",
		"label/job/values/extra",
		"label//values",
		"detected_field/foo/values/extra",
	}
	for _, p := range denied {
		require.False(t, isAllowedLokiCallResourcePath(p), p)
	}
}

func TestCallResource_DeniesRulerAndAdminPaths(t *testing.T) {
	called := false
	ds := testCallResourceDS(t, func(_ *http.Request) { called = true })
	logger := backend.NewLoggerWith("logger", "loki test")
	tracer := tracing.DefaultTracer()

	denied := []string{"rules", "config", "query_range", "status/config", "../rules"}
	for _, url := range denied {
		called = false
		sender := &fakeResourceSender{}
		err := callResource(context.Background(), &backend.CallResourceRequest{
			Method: http.MethodGet,
			Path:   strings.Split(url, "?")[0],
			URL:    url,
		}, sender, ds, logger, tracer)
		require.NoError(t, err, url)
		require.NotNil(t, sender.resp, url)
		require.True(t, sender.resp.Status == http.StatusForbidden || sender.resp.Status == http.StatusBadRequest, url)
		require.False(t, called, "must not proxy %s", url)
	}
}

func TestCallResource_AllowsQueryEditorMetadata(t *testing.T) {
	var gotPath string
	ds := testCallResourceDS(t, func(req *http.Request) {
		gotPath = req.URL.Path
	})
	logger := backend.NewLoggerWith("logger", "loki test")
	tracer := tracing.DefaultTracer()

	cases := []struct {
		url      string
		wantPath string
	}{
		{url: "labels?start=1", wantPath: "/loki/api/v1/labels"},
		{url: "series", wantPath: "/loki/api/v1/series"},
		{url: "index/stats", wantPath: "/loki/api/v1/index/stats"},
		{url: "label/job/values", wantPath: "/loki/api/v1/label/job/values"},
		{url: "detected_fields", wantPath: "/loki/api/v1/detected_fields"},
		{url: "detected_field/foo/values", wantPath: "/loki/api/v1/detected_field/foo/values"},
	}
	for _, tc := range cases {
		gotPath = ""
		sender := &fakeResourceSender{}
		err := callResource(context.Background(), &backend.CallResourceRequest{
			Method: http.MethodGet,
			Path:   strings.Split(tc.url, "?")[0],
			URL:    tc.url,
		}, sender, ds, logger, tracer)
		require.NoError(t, err, tc.url)
		require.Equal(t, http.StatusOK, sender.resp.Status, tc.url)
		require.Equal(t, tc.wantPath, gotPath, tc.url)
	}
}

func TestCallResource_SuggestionsStillHandled(t *testing.T) {
	var gotPath string
	ds := testCallResourceDS(t, func(req *http.Request) {
		gotPath = req.URL.Path
	})
	sender := &fakeResourceSender{}
	err := callResource(context.Background(), &backend.CallResourceRequest{
		Method: http.MethodPost,
		Path:   "suggestions",
		URL:    "suggestions",
		Body:   []byte(`{"query":""}`),
	}, sender, ds, backend.NewLoggerWith("logger", "loki test"), tracing.DefaultTracer())
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, sender.resp.Status)
	require.Equal(t, "/loki/api/v1/labels", gotPath)
}

func TestCallResource_PercentEncodedTraversalDenied(t *testing.T) {
	called := false
	ds := testCallResourceDS(t, func(_ *http.Request) { called = true })
	sender := &fakeResourceSender{}
	err := callResource(context.Background(), &backend.CallResourceRequest{
		Method: http.MethodGet,
		Path:   "label/%2e%2e/rules",
		URL:    "label/%2e%2e/rules",
	}, sender, ds, backend.NewLoggerWith("logger", "loki test"), tracing.DefaultTracer())
	require.NoError(t, err)
	require.NotEqual(t, http.StatusOK, sender.resp.Status)
	require.False(t, called)
}
