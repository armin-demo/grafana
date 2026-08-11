---
description: Provision Git Sync repository and connection resources with Kubernetes manifests, Helm, and Argo CD, without using the gcx CLI.
keywords:
  - set up
  - git integration
  - git sync
  - github
  - kubernetes
  - helm
  - argocd
  - gitops
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Set up Git Sync with Kubernetes and Argo CD
weight: 220
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/git-sync/git-sync-setup/set-up-kubernetes
aliases:
---

# Set up Git Sync with Kubernetes and Argo CD

If you run Grafana on Kubernetes and deploy it with Helm, you can provision your Git Sync `Repository` and `Connection` resources with the same GitOps workflow you use for the rest of your manifests. This lets platform engineers keep Git Sync configuration in a Git repository and have a tool such as Argo CD apply it, without installing or running the `gcx` CLI.

This page explains how Git Sync resources map to the Grafana API and shows how to apply your manifests with a Kubernetes `Job` that you can run as a Helm hook or an Argo CD sync hook.

## Before you begin

Before you begin, ensure you have the following:

- A Grafana instance running on Kubernetes, version 12.1 or later, with Git Sync enabled.
- Administrator permissions on the Grafana instance.
- A Grafana service account token with the `Admin` role, or a service account with the `provisioning.repositories:*` permissions. Refer to [Service account tokens](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/service-accounts/#service-account-tokens) to create one.
- `kubectl` and, optionally, Helm and Argo CD installed and configured.

## How Git Sync resources map to the Grafana API

Git Sync `Repository` and `Connection` resources use the Kubernetes resource model, but they aren't Custom Resource Definitions (CRDs) that live in your cluster's API server. Instead, Grafana serves them from its own Kubernetes-compatible API under the `provisioning.grafana.app` group:

- Create a repository: `POST /apis/provisioning.grafana.app/v0alpha1/namespaces/{namespace}/repositories`
- Create a connection: `POST /apis/provisioning.grafana.app/v0alpha1/namespaces/{namespace}/connections`

Because Grafana exposes a standard Kubernetes API, any Kubernetes client, including `kubectl`, `curl`, or Argo CD, can apply these manifests when you point it at the Grafana API endpoint and authenticate with a Grafana service account token.

In a single-organization Grafana instance, use `default` as the `{namespace}`. The `gcx resources push` command wraps these same API calls, so the workflow on this page produces an identical result without the CLI.

{{< admonition type="note" >}}

Because these resources live in Grafana's API server and not in your cluster, Argo CD can't treat them as native cluster CRDs. Apply them through a `Job` as shown on this page, or register the Grafana API server as an external Argo CD cluster.

{{< /admonition >}}

## Store your Git Sync manifests

Keep your `Repository` and `Connection` manifests in the same Git repository as the rest of your Kubernetes configuration. The following example defines a GitHub repository that syncs to a folder:

```yaml
apiVersion: provisioning.grafana.app/v0alpha1
kind: Repository
metadata:
  name: dashboards-repository
  namespace: default
spec:
  title: Dashboards repository
  type: github
  github:
    url: https://github.com/<ORG>/<REPO>
    branch: main
    path: grafana/
  sync:
    enabled: true
    target: folder
    intervalSeconds: 60
  workflows:
    - write
secure:
  token:
    create: <GIT_PAT>
```

Replace the placeholders with your values:

- _`<ORG>`_: The organization or user that owns the GitHub repository.
- _`<REPO>`_: The name of the GitHub repository.
- _`<GIT_PAT>`_: A Git provider personal access token. Store this value in a Kubernetes `Secret` rather than committing it to Git.

For the full list of repository types and fields, refer to [Set up Git Sync as code](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/git-sync-setup/set-up-code/).

## Apply the manifests with a Kubernetes Job

The following approach mounts your manifests from a `ConfigMap` and applies them to Grafana with a `Job`. You can run this `Job` on its own, as a Helm hook, or as an Argo CD sync hook.

First, store your Grafana API endpoint and service account token in a `Secret`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: grafana-provisioning-credentials
  namespace: grafana
type: Opaque
stringData:
  GRAFANA_URL: http://grafana.grafana.svc:3000
  GRAFANA_TOKEN: <GRAFANA_SERVICE_ACCOUNT_TOKEN>
```

Replace the placeholders with your values:

- _`GRAFANA_URL`_: The in-cluster URL of your Grafana service.
- _`GRAFANA_SERVICE_ACCOUNT_TOKEN`_: A Grafana service account token with permissions to manage repositories.

Next, store the repository manifest in a `ConfigMap`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-gitsync-manifests
  namespace: grafana
data:
  repository.yaml: |
    apiVersion: provisioning.grafana.app/v0alpha1
    kind: Repository
    metadata:
      name: dashboards-repository
      namespace: default
    spec:
      title: Dashboards repository
      type: github
      github:
        url: https://github.com/<ORG>/<REPO>
        branch: main
        path: grafana/
      sync:
        enabled: true
        target: folder
        intervalSeconds: 60
      workflows:
        - write
```

Finally, create the `Job` that applies each manifest to the Grafana API:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: grafana-gitsync-apply
  namespace: grafana
spec:
  backoffLimit: 3
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: apply
          image: curlimages/curl:8.11.0
          envFrom:
            - secretRef:
                name: grafana-provisioning-credentials
          volumeMounts:
            - name: manifests
              mountPath: /manifests
          command:
            - /bin/sh
            - -c
            - |
              set -eu
              for file in /manifests/*.yaml; do
                name=$(grep -m1 '^  name:' "$file" | awk '{print $2}')
                echo "Applying repository $name"
                # Try to update an existing repository, otherwise create it.
                status=$(curl -sS -o /tmp/out -w '%{http_code}' \
                  -X PUT \
                  -H "Authorization: Bearer ${GRAFANA_TOKEN}" \
                  -H "Content-Type: application/yaml" \
                  --data-binary "@${file}" \
                  "${GRAFANA_URL}/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/${name}") || true
                if [ "$status" = "404" ]; then
                  curl -sS --fail-with-body \
                    -X POST \
                    -H "Authorization: Bearer ${GRAFANA_TOKEN}" \
                    -H "Content-Type: application/yaml" \
                    --data-binary "@${file}" \
                    "${GRAFANA_URL}/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories"
                elif [ "$status" -ge 400 ]; then
                  cat /tmp/out
                  exit 1
                fi
              done
      volumes:
        - name: manifests
          configMap:
            name: grafana-gitsync-manifests
```

The `Job` reads each manifest from the mounted `ConfigMap`, then updates the repository with a `PUT` request or creates it with a `POST` request if it doesn't exist yet. This makes the `Job` safe to run again on every deployment.

## Run the Job as a Helm hook

If you deploy Grafana with Helm, add the Helm hook annotations to the `Job` so it runs after each install or upgrade. Helm applies the `ConfigMap` and `Secret` first, then runs the `Job`:

```yaml
metadata:
  name: grafana-gitsync-apply
  namespace: grafana
  annotations:
    helm.sh/hook: post-install,post-upgrade
    helm.sh/hook-weight: '5'
    helm.sh/hook-delete-policy: before-hook-creation,hook-succeeded
```

## Run the Job as an Argo CD sync hook

If you deploy with Argo CD, add the Argo CD hook annotations so the `Job` runs as a `PostSync` step after Argo CD applies your manifests:

```yaml
metadata:
  name: grafana-gitsync-apply
  namespace: grafana
  annotations:
    argocd.argoproj.io/hook: PostSync
    argocd.argoproj.io/hook-delete-policy: HookSucceeded
```

Commit the `ConfigMap`, `Secret` reference, and `Job` to the Git repository that Argo CD tracks. On each sync, Argo CD applies the manifests and the `Job` pushes your Git Sync configuration into Grafana.

## Verify setup

To confirm that Grafana created your repository, query the Grafana API with your service account token:

```sh
curl -sS \
  -H "Authorization: Bearer <GRAFANA_SERVICE_ACCOUNT_TOKEN>" \
  http://<GRAFANA_URL>/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories
```

You can also open the Grafana UI and select **Administration** > **Provisioning** to confirm the repository appears and reports a healthy sync status.

## Next steps

Now that you provision Git Sync with your GitOps workflow, refer to the following resources to learn more:

- [Set up Git Sync as code](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/git-sync-setup/set-up-code/) for the full `Repository` and `Connection` reference.
- [Set up Git Sync with Terraform](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/git-sync-setup/set-up-terraform/) for an alternative infrastructure-as-code workflow.
- [Git Sync key concepts](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/key-concepts/) for details about repositories, connections, and sync targets.
