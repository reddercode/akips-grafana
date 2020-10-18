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

## Query format

### Time series

Expected command output format: `parent [child [attribute]][ = value,...]`

Command examples: `series`

In this mode the datasource produces a series of data frames, one frame per line, with two columns, a timestamp and a value. Values are expected to be integer numbers. The name of the values column will be the last non empty string in the  `parent, child, attribute` sequence. In addition all those three strings will be attached as field's labels.

### Table

Expected command output format: `parent [child [attribute]][ = value,...]`

Command examples: `mget`, `mlist`, `series`

In this mode the datasource produces a table with columns named as `Parent`, `Child`, `Attribute`, `Value #0`, ...

### CSV

Expected command output format: `value,...`

Command examples: `get`

Table columns: `Value #0`, ...