# Grafana AKiPS Data Source

![Build plugin](https://github.com/reddercode/akips-grafana/workflows/Build%20plugin/badge.svg)

A AKiPS plugin for Grafana, allowing exploration and dashboarding in Grafana
using AKiPS data.

To run using docker:

```
docker run --it \
      -p 3000:3000 \
      --name=grafana \
      -e "GF_INSTALL_PLUGINS=https://github.com/reddercode/akips-grafana/releases/download/v1.0.0-test.2/akips-datasource-1.0.0-test.2.zip;akips-datasource" \
      grafana/grafana:latest
```
