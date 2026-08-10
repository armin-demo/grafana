---
aliases:
  - ../administration/image_rendering/
  - ../image-rendering/
description: Learn how to set up the Grafana image renderer to render panels and dashboards as PNG images, including in highly available deployments.
keywords:
  - grafana
  - image
  - rendering
  - renderer
  - png
  - high availability
  - HA
labels:
  products:
    - enterprise
    - oss
menuTitle: Set up image rendering
title: Set up image rendering
weight: 400
---

# Set up image rendering

Some features, such as rendering a panel or dashboard to a PNG image, or including images in alert notifications and reports, require Grafana to render the panel or dashboard on the server. Grafana doesn't ship with a rendering engine built in, so you set up the Grafana image renderer to add this capability.

This page explains how the image renderer works, how to install and configure it, and how to run it when Grafana is deployed for high availability.

The image renderer runs a headless Chromium browser to load a panel or dashboard, capture it, and return a PNG image. You can run it in two ways:

- **As a remote HTTP service:** A standalone process, usually the `grafana/grafana-image-renderer` container, that Grafana calls over HTTP. This is the recommended option for production and the only supported option for high availability.
- **As a Grafana plugin:** The renderer runs on the same host as Grafana, managed by the Grafana process. This is the simplest option for a single Grafana instance.

## Before you begin

Ensure you have the following:

- A running Grafana instance that you can restart and reconfigure.
- For the remote service option, a host or container platform that can run the `grafana/grafana-image-renderer` image. Each renderer worker uses approximately 1 GB of memory.
- Network connectivity in both directions: Grafana must reach the renderer's `/render` endpoint, and the renderer must reach Grafana to load the panels and dashboards it renders.

## Run the renderer as a remote HTTP service

Running the renderer as a separate service keeps the memory-intensive Chromium workload off your Grafana hosts and lets multiple Grafana instances share one renderer. Refer to [High availability](#high-availability) when you run more than one Grafana instance.

1. Start the renderer. The container listens on port `8081` by default:

   ```sh
   docker run -d --name grafana-image-renderer -p 8081:8081 grafana/grafana-image-renderer:latest
   ```

1. In your Grafana configuration file, point Grafana at the renderer and tell the renderer how to reach Grafana back:

   ```ini
   [rendering]
   server_url = http://<RENDERER_HOST>:8081/render
   callback_url = http://<GRAFANA_HOST>:3000/
   ```

   - _`<RENDERER_HOST>`_: The host or service name where the renderer is reachable from Grafana.
   - _`<GRAFANA_HOST>`_: A URL where Grafana is reachable from the renderer. This is the address the renderer's browser navigates to when it loads a panel or dashboard.

1. Restart Grafana to apply the configuration.

## Run the renderer as a plugin

For a single Grafana instance, you can install the renderer as a plugin so that Grafana manages its lifecycle.

1. Install the plugin:

   ```sh
   grafana-cli plugins install grafana-image-renderer
   ```

1. Restart Grafana.

Grafana starts and manages the renderer as a subprocess on the same host, so no `server_url` is required. Don't use the plugin option for high availability, because each Grafana node would run its own isolated renderer instead of sharing a scalable renderer fleet.

## Configuration

You configure the Grafana side of image rendering in the `[rendering]` and `[plugin.grafana-image-renderer]` sections of the Grafana configuration file. For the full list of options, refer to [Configure Grafana](../configure-grafana/#rendering).

The most important options for a remote renderer are:

- **`server_url`:** The URL of the remote renderer's `/render` endpoint, for example `http://renderer:8081/render`.
- **`callback_url`:** A URL where Grafana is reachable from the renderer. If the renderer runs on a different host than Grafana, you must set this so the renderer can load the content it's asked to render.
- **`renderer_token`:** A shared authentication token. Grafana sends this token with every render request, and the renderer rejects any request whose token doesn't match. Refer to [Secure the renderer](#secure-the-renderer).
- **`concurrent_render_request_limit`:** The maximum number of concurrent render requests Grafana issues. The default is `30`. Lower it if your renderer fleet is small.

You can tune the renderer service itself with environment variables, such as `RENDERING_MODE` for clustering and `AUTH_TOKEN` for authentication. Refer to the [`grafana-image-renderer` documentation](https://github.com/grafana/grafana-image-renderer) for the full list.

## Secure the renderer

Because the renderer loads and captures your dashboards, restrict access to it. Set a shared token so only Grafana can call the renderer:

1. Set the `AUTH_TOKEN` environment variable on the renderer service:

   ```sh
   docker run -d --name grafana-image-renderer -p 8081:8081 \
     -e AUTH_TOKEN=<TOKEN> \
     grafana/grafana-image-renderer:latest
   ```

1. Set the matching token in Grafana:

   ```ini
   [rendering]
   renderer_token = <TOKEN>
   ```

Replace _`<TOKEN>`_ with the same strong, random value in both places. Use the same token across every Grafana node and every renderer instance.

## High availability

When you run Grafana for high availability, run the image renderer as a shared remote service, or a fleet of renderer instances, rather than as an in-process plugin on each node. All Grafana nodes then send render requests to the same renderer service, which you can scale independently of Grafana.

The following diagram shows the topology: Grafana nodes sit behind a load balancer on a shared cluster hostname, share a database, and all call a renderer service that reaches Grafana back through the same shared hostname.

Follow these guidelines to set up image rendering in an HA deployment:

- **Use a shared remote renderer, not the plugin.** On every Grafana node, set `[rendering] server_url` to the renderer service. Put multiple renderer instances behind a load balancer and point `server_url` at that load balancer so render requests spread across the fleet.

- **Point `callback_url` at the shared cluster hostname.** Set `callback_url` to your load balancer's Grafana URL — the same shared hostname you use for [`root_url`](../configure-grafana/#root_url) — rather than to an individual node. This way the renderer reaches Grafana through the load balancer and doesn't depend on the specific node that started the render request.

- **Keep render tokens valid across all nodes.** Grafana stores the short-lived render authentication tokens in the `[remote_cache]`, which defaults to the shared primary `[database]`. Because HA deployments already share that database, any node can validate a render request that arrives through the load balancer. If you override `[remote_cache]`, use a backend shared by all nodes, such as Redis or Memcached, so render tokens stay valid cluster-wide. Refer to [`[remote_cache]`](../configure-grafana/#remote_cache).

- **Use one shared `renderer_token`.** Configure the same `renderer_token` on every Grafana node and the same `AUTH_TOKEN` on every renderer instance so authentication succeeds regardless of which node or renderer handles a request. Refer to [Secure the renderer](#secure-the-renderer).

- **Size the renderer fleet for concurrency.** Each renderer worker uses approximately 1 GB of memory. Run enough renderer instances, or workers per instance with `RENDERING_MODE=clustered`, to handle the combined render load from all Grafana nodes, and align `concurrent_render_request_limit` with that capacity.

A minimal `[rendering]` block, identical on every Grafana node in the cluster, looks like this:

```ini
[rendering]
server_url = http://renderer-lb.internal:8081/render
callback_url = https://grafana.example.com/
renderer_token = <TOKEN>
```

- **`server_url`:** The load balancer in front of your renderer fleet.
- **`callback_url`:** Your shared, load-balanced Grafana hostname, matching `root_url`.
- **`renderer_token`:** The shared token, matching `AUTH_TOKEN` on the renderers.

For the rest of the HA setup, such as the shared database, licensing, and load balancer, refer to [Set up Grafana for high availability](set-up-for-high-availability/).

## Verify the setup

To confirm image rendering works, open a dashboard panel, select the panel menu, and choose **Share**. If rendering is configured, Grafana offers to render the panel as an image. Alternatively, request a render directly:

```sh
curl -H "X-Auth-Token: <TOKEN>" "http://<RENDERER_HOST>:8081/render/version"
```

A successful response returns the renderer version.

## Troubleshooting

If images fail to render:

- Check the Grafana server logs for `Failed to take an image` or rendering errors, which include the dashboard UID, panel ID, and the underlying error.
- Confirm the renderer can reach Grafana at `callback_url`. In HA, confirm that URL points to the shared load balancer, not a single node.
- Confirm `renderer_token` in Grafana matches `AUTH_TOKEN` on the renderer.
- On Linux hosts without the bundled container image, install the system libraries that headless Chromium requires. Refer to the [`grafana-image-renderer` documentation](https://github.com/grafana/grafana-image-renderer).

## Next steps

- [Set up Grafana for high availability](set-up-for-high-availability/)
- [Configure Grafana](../configure-grafana/#rendering)
- [Share dashboards and panels](../../visualizations/dashboards/share-dashboards-panels/)
