package azuremonitor

import (
	"fmt"
	"regexp"
	"strings"
)

// ARM metric namespaces are provider/type tokens (e.g. microsoft.compute/virtualmachines).
var armMetricNamespace = regexp.MustCompile(`(?i)^[a-z0-9][a-z0-9._/-]{0,255}$`)

func escapeKQLString(s string) string {
	return strings.ReplaceAll(s, `'`, `''`)
}

func quoteKQLString(s string) string {
	return "'" + escapeKQLString(s) + "'"
}

func validateMetricNamespace(ns string) error {
	if !armMetricNamespace.MatchString(ns) {
		return fmt.Errorf("azure monitor: invalid metric namespace")
	}
	return nil
}
