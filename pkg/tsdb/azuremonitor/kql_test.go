package azuremonitor

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestEscapeKQLString(t *testing.T) {
	require.Equal(t, `foo`, escapeKQLString(`foo`))
	require.Equal(t, `foo''bar`, escapeKQLString(`foo'bar`))
	require.Equal(t, `a''''b`, escapeKQLString(`a''b`))
}

func TestQuoteKQLString(t *testing.T) {
	require.Equal(t, `@'rg1'`, quoteKQLString(`rg1`))
	require.Equal(t, `@'rg'' | union SecurityResources | where x =~ '`, quoteKQLString(`rg' | union SecurityResources | where x =~ `))
	// \' must not terminate the literal (standard '...' would treat it as escaped ').
	require.Equal(t, `@'x\'' | union SecurityResources | where type =~ '`, quoteKQLString(`x\' | union SecurityResources | where type =~ `))
}

func TestValidateMetricNamespace(t *testing.T) {
	require.NoError(t, validateMetricNamespace("microsoft.compute/virtualmachines"))
	require.NoError(t, validateMetricNamespace("Microsoft.Sql/servers/databases"))
	require.Error(t, validateMetricNamespace(""))
	require.Error(t, validateMetricNamespace("microsoft.compute/virtualmachines' | where 1==1 | where type =~ '"))
	require.Error(t, validateMetricNamespace("foo bar"))
}

func TestDiscoverResourcesForAzureMonitorSQL_EscapesQuotes(t *testing.T) {
	srv := argTestServer(t, `{"data":{"columns":[{"name":"name","type":"string"},{"name":"resourceGroup","type":"string"}],"rows":[]}}`, func(kql string) {
		require.Contains(t, kql, "resourceGroup =~ @'rg'' | union SecurityResources | where type =~ '")
		require.NotContains(t, kql, `\'`)
	})
	defer srv.Close()

	_, err := discoverResourcesForAzureMonitorSQL(context.Background(), argDSInfo(srv),
		"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "rg' | union SecurityResources | where type =~ ", "microsoft.compute/virtualmachines")
	require.Error(t, err)
}

func TestDiscoverResourcesForAzureMonitorSQL_RejectsInjectedNamespace(t *testing.T) {
	called := false
	srv := argTestServer(t, `{"data":{"columns":[],"rows":[]}}`, func(string) { called = true })
	defer srv.Close()

	_, err := discoverResourcesForAzureMonitorSQL(context.Background(), argDSInfo(srv),
		"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "rg1", "microsoft.compute/virtualmachines' | union SecurityResources | where type =~ '")
	require.Error(t, err)
	require.Contains(t, err.Error(), "invalid metric namespace")
	require.False(t, called)
}

func TestListResourceGroupsForNamespace_RejectsInjectedNamespace(t *testing.T) {
	called := false
	srv := argTestServer(t, `{"data":{"columns":[],"rows":[]}}`, func(string) { called = true })
	defer srv.Close()

	_, err := listResourceGroupsForNamespace(context.Background(), argDSInfo(srv),
		"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "microsoft.compute/virtualmachines'|union x|where type =~'")
	require.Error(t, err)
	require.False(t, called)
}

func TestListRegionsForNamespace_EscapesResourceGroupQuotes(t *testing.T) {
	body := `{"data":{"columns":[{"name":"location","type":"string"}],"rows":[["eastus"]]}}`
	srv := argTestServer(t, body, func(kql string) {
		require.Contains(t, kql, "resourceGroup =~ @'rg''x'")
		require.NotContains(t, kql, `\'`)
	})
	defer srv.Close()

	out, err := listRegionsForNamespace(context.Background(), argDSInfo(srv),
		"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "microsoft.compute/virtualmachines", "rg'x")
	require.NoError(t, err)
	require.Equal(t, []string{"eastus"}, out)
}
