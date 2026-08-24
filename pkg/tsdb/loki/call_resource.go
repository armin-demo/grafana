package loki

import (
	"regexp"
	"strings"
)

// Query-editor metadata endpoints that CallResource may proxy to Loki.
// /rules and other ruler/admin APIs are intentionally omitted: plugin.json
// requires alert.rules.external:read for those, but CallResource is only
// gated by datasources:query at the HTTP API layer.
var allowedLokiCallResourceExact = map[string]struct{}{
	"labels":             {},
	"series":             {},
	"index/stats":        {},
	"index/volume":       {},
	"index/volume_range": {},
	"patterns":           {},
	"status/buildinfo":   {},
	"format_query":       {},
	"detected_fields":    {},
}

var (
	lokiLabelValuesPath         = regexp.MustCompile(`^label/[^/]+/values$`)
	lokiDetectedFieldValuesPath = regexp.MustCompile(`^detected_field/[^/]+/values$`)
)

func isAllowedLokiCallResourcePath(rel string) bool {
	rel = strings.Trim(rel, "/")
	if rel == "" {
		return false
	}
	if _, ok := allowedLokiCallResourceExact[rel]; ok {
		return true
	}
	return lokiLabelValuesPath.MatchString(rel) || lokiDetectedFieldValuesPath.MatchString(rel)
}
