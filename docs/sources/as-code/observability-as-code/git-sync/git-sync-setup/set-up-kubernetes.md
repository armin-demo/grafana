---
description: Set up Git Sync as code on Kubernetes using a GitOps workflow with Argo CD and Helm, so Git Sync Connection and Repository resources are reconciled from Git without running the CLI by hand.
keywords:
  - set up
  - git integration
  - git sync
  - kubernetes
  - gitops
  - argo cd
  - helm
  - as code
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Set up Git Sync on Kubernetes with GitOps
menuTitle: Set up on Kubernetes
weight: 205
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/git-sync/git-sync-setup/set-up-kubernetes
---

# Set up Git Sync on Kubernetes with GitOps

If you run Grafana on Kubernetes and deploy it with Helm, you can manage Git Sync entirely as code through your existing GitOps workflow. This lets platform engineers keep the `Connection` and `Repository` resources in Git and reconcile them into Grafana automatically, without a person running a CLI command.

Git Sync `Connection` and `Repository` resources belong to the Grafana `provisioning.grafana.app` API group, so they're already Kubernetes-style manifests. The challenge is that these resources live in Grafana's own application API, not in the Kubernetes API that a tool like Argo CD reconciles. This page explains how to bridge that gap: store the manifests in Git and use a Helm-managed job to apply them to Grafana with [`gcx`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/grafana-cli/gcx), the Grafana CLI.

Before you begin, ensure you have the following:

- A Grafana instance (v12 or later) running on Kubernetes, deployed with Helm.
- A GitOps controller, such as [Argo CD](https://argo-cd.readthedocs.io/) or [Flux](https://fluxcd.io/), that syncs manifests from a Git repository to your cluster.
- A Grafana service account token with permission to manage provisioning resources. Refer to [Service accounts](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/service-accounts/) to create one.
- Familiarity with [Set up Git Sync as code](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/git-sync-setup/set-up-code/) and the [Repository](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/key-concepts#git-sync-repository-resource) and [Connection](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/key-concepts#git-sync-connection-resource) resources.

## Choose an approach

There are two common ways to manage Git Sync from a Kubernetes GitOps workflow.

- **Reconcile with a Helm-managed job:** Store the `Connection` and `Repository` manifests in Git, and apply them to Grafana with a Kubernetes `Job` that runs `gcx resources push`. Argo CD reconciles the `Job` and its inputs, so a change in Git flows to Grafana without manual steps. This approach works with any Grafana deployment and is described in detail below.
- **Use the Grafana Operator:** The community [Grafana Operator](https://grafana.github.io/grafana-operator/) reconciles Grafana resources, such as dashboards, data sources, and folders, from Kubernetes custom resources. If you already run the operator, you can keep those resources in Git alongside your Git Sync manifests. Support for specific resource kinds depends on the operator version, so refer to the [Grafana Operator documentation](https://grafana.github.io/grafana-operator/docs/) for what it manages.

{{< admonition type="note" >}}

Git Sync itself is also a GitOps mechanism: once a `Repository` resource exists, Grafana continuously pulls dashboards and folders from the repository path you configure. The pattern on this page bootstraps that `Repository` resource declaratively, so both the setup and the day-to-day content stay in Git.

{{< /admonition >}}

## Reconcile Git Sync with a Helm-managed job

In this approach, your GitOps controller syncs a small set of Kubernetes objects, and a `Job` applies the Git Sync manifests to Grafana on your behalf.

The flow is:

1. You commit the `Connection` and `Repository` manifests, along with the Kubernetes objects below, to the Git repository your GitOps controller watches.
1. Argo CD (or Flux) applies those objects to the cluster.
1. A `Job` reads the manifests and runs `gcx resources push` against your in-cluster Grafana, authenticating with a service account token.
1. Grafana creates the resources and begins syncing dashboards from the configured repository path.

### Store the Git Sync manifests

Keep your `connection.yaml` and `repository.yaml` files in Git, using the same format as [Set up Git Sync as code](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/git-sync-setup/set-up-code/). Make the manifests available to the `Job` by packaging them in a `ConfigMap`. With Helm, generate the `ConfigMap` from files in your chart:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: git-sync-manifests
  namespace: <NAMESPACE>
data:
  repository.yaml: |
    apiVersion: provisioning.grafana.app/v0alpha1
    kind: Repository
    metadata:
      name: <REPOSITORY_NAME>
    spec:
      title: <REPOSITORY_TITLE>
      type: github
      sync:
        enabled: true
        intervalSeconds: 60
        target: folder
      workflows:
        - write
        - branch
      github:
        url: <GIT_REPO_URL>
        branch: <BRANCH>
        path: grafana/
```

Replace the placeholders with your values:

- _`<NAMESPACE>`_: Kubernetes namespace where Grafana runs.
- _`<REPOSITORY_NAME>`_: Unique identifier for the repository resource.
- _`<REPOSITORY_TITLE>`_: Human-readable name displayed in the Grafana UI.
- _`<GIT_REPO_URL>`_: URL of the Git repository to sync.
- _`<BRANCH>`_: Branch to sync.

{{< admonition type="caution" >}}

Don't store Git provider tokens or GitHub App private keys in a `ConfigMap`. Keep the `secure` values out of the manifest and inject them from a Kubernetes `Secret`, or set them once through the Grafana UI. Refer to [Set up Git Sync as code](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/git-sync-setup/set-up-code/) for the `secure` fields.

{{< /admonition >}}

### Store the Grafana credentials

Store the Grafana service account token in a Kubernetes `Secret` so the `Job` can authenticate. Manage the `Secret` with your usual secrets workflow, such as [External Secrets Operator](https://external-secrets.io/) or the [Argo CD Vault Plugin](https://argocd-vault-plugin.readthedocs.io/), rather than committing the raw token to Git.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: grafana-gitops-credentials
  namespace: <NAMESPACE>
type: Opaque
stringData:
  GRAFANA_TOKEN: <GRAFANA_SERVICE_ACCOUNT_TOKEN>
```

Replace the placeholders with your values:

- _`<NAMESPACE>`_: Kubernetes namespace where Grafana runs.
- _`<GRAFANA_SERVICE_ACCOUNT_TOKEN>`_: Service account token with permission to manage provisioning resources.

### Reconcile the manifests with a job

Define a `Job` that mounts the manifests and runs `gcx resources push`. When you deploy with Helm, annotate the `Job` as a `post-install` and `post-upgrade` hook so it runs on every release, and let Argo CD sync it. The example points `gcx` at the in-cluster Grafana service and reads the token from the `Secret`.

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: git-sync-bootstrap
  namespace: <NAMESPACE>
  annotations:
    argocd.argoproj.io/hook: PostSync
    helm.sh/hook: post-install,post-upgrade
    helm.sh/hook-delete-policy: before-hook-creation
spec:
  backoffLimit: 3
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: gcx-push
          image: <GCX_IMAGE>
          command: ['/bin/sh', '-c']
          args:
            - gcx resources push --path /manifests
          env:
            - name: GRAFANA_SERVER
              value: http://<GRAFANA_SERVICE>.<NAMESPACE>.svc:3000
            - name: GRAFANA_TOKEN
              valueFrom:
                secretKeyRef:
                  name: grafana-gitops-credentials
                  key: GRAFANA_TOKEN
          volumeMounts:
            - name: manifests
              mountPath: /manifests
      volumes:
        - name: manifests
          configMap:
            name: git-sync-manifests
```

Replace the placeholders with your values:

- _`<NAMESPACE>`_: Kubernetes namespace where Grafana runs.
- _`<GCX_IMAGE>`_: Container image that includes the `gcx` CLI.
- _`<GRAFANA_SERVICE>`_: Name of the Kubernetes `Service` that fronts Grafana.

{{< admonition type="note" >}}

`gcx` is under active development, so its configuration flags and environment variables can change between versions. Confirm the exact configuration mechanism, including how to set the server URL and token, for your installed version in the [`gcx` repository](https://github.com/grafana/gcx). The `GRAFANA_SERVER` and `GRAFANA_TOKEN` values above are illustrative.

{{< /admonition >}}

### Order the sync

Because the `Job` depends on the `ConfigMap` and `Secret`, make sure they exist before the `Job` runs.

- **With Argo CD:** The `PostSync` hook runs the `Job` after the other resources apply. Alternatively, use [sync waves](https://argo-cd.readthedocs.io/en/stable/user-guide/sync-waves/) to apply the `ConfigMap` and `Secret` first.
- **With Helm:** The `post-install` and `post-upgrade` hooks run the `Job` after the release's other objects are in place.

## Verify the setup

Confirm that Grafana created the resources and started syncing.

1. Check that the `Job` completed:

   ```bash
   kubectl -n <NAMESPACE> get jobs
   kubectl -n <NAMESPACE> logs job/git-sync-bootstrap
   ```

1. Confirm the repository exists in Grafana. In the UI, go to **Administration > General > Provisioning** and open the **Repositories** tab. You can also list repositories with the CLI:

   ```bash
   gcx resources get repositories
   ```

1. Verify that your dashboards appear in the synced folder under **Dashboards**.

## Next steps

- [Set up Git Sync as code](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/git-sync-setup/set-up-code/)
- [Git Sync key concepts](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/key-concepts/)
- [Git Sync deployment scenarios](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/scenarios/)
- [Grafana CLI documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/grafana-cli/)
