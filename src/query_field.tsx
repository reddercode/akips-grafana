import { ExploreQueryFieldProps, SelectableValue } from '@grafana/data';
import { QueryField, SlatePrism, Select, Switch, Input } from '@grafana/ui';
import React from 'react';
import Slate from 'slate';
import Prism from 'prismjs';
import { DataSource } from './datasource';
import { Query, QueryType } from './types';
import syntax from './syntax';
import {} from '@emotion/core'; // https://github.com/grafana/grafana/issues/26512

interface AKIPSQueryFieldProps extends ExploreQueryFieldProps<DataSource, Query> {
  extOptions?: boolean;
}

interface AKIPSQueryFieldState {
  devices?: Array<SelectableValue<string>> | null;
  children?: Array<SelectableValue<string>> | null;
  attributes?: Array<SelectableValue<string>> | null;
}

const QUERY_TYPES: Array<SelectableValue<QueryType>> = [
  { label: 'Time series', value: 'time_series' },
  { label: 'Table', value: 'table' },
  // TODO csv
];

export class AKIPSQueryField extends React.PureComponent<AKIPSQueryFieldProps, AKIPSQueryFieldState> {
  plugins: Slate.Plugin[];

  constructor(props: AKIPSQueryFieldProps) {
    super(props);

    this.plugins = [
      SlatePrism({
        onlyIn: (node: Slate.Node) => node instanceof Slate.Block && node.type === 'code_block',
        getSyntax: () => 'akips',
      }),
    ];

    Prism.languages.akips = syntax;
    this.state = {};
  }

  componentDidMount() {
    const { query, onChange } = this.props;

    if (!query.query && onChange) {
      const q: Query = { ...query, query: DataSource.DEFAULT_QUERY };
      onChange(q);
    }

    this.updateDevices();
    if (query.device) {
      this.updateChildren(query.device);
      if (query.child) {
        this.updateAttributes(query.device, query.child);
      }
    }
  }

  private async updateDevices() {
    const { datasource } = this.props;
    const result = (await datasource.metricFindQuery('mlist device *')).map<SelectableValue<string>>((value) => ({
      label: value.text,
      value: value.text,
    }));

    this.setState({
      devices: result,
    });
  }

  private async updateChildren(dev: string) {
    const { datasource } = this.props;
    const result = (await datasource.metricFindQuery(`mlist * "${dev}" *`)).map<SelectableValue<string>>((value) => ({
      label: value.text,
      value: value.text,
    }));

    this.setState({
      children: result,
    });
  }

  private async updateAttributes(dev: string, child: string) {
    const { datasource } = this.props;
    const result = (await datasource.metricFindQuery(`mlist * "${dev}" "${child}" *`)).map<SelectableValue<string>>(
      (value) => ({
        label: value.text,
        value: value.text,
      })
    );

    this.setState({
      attributes: result,
    });
  }

  private changeQuery(values: Partial<Query>, override?: boolean) {
    const { query, onChange, onRunQuery } = this.props;
    const q: Query = { ...query, ...values };
    if (onChange) {
      onChange(q);
    }
    if (override && onRunQuery && DataSource.shouldUpdate(q)) {
      onRunQuery();
    }
  }

  private onChangeDevice = (option: SelectableValue<string> | null) => {
    this.setState(
      {
        children: null,
        attributes: null,
      },
      () => {
        this.changeQuery({ device: option ? option.value : undefined, child: undefined, attribute: undefined });
        if (option && option.value) {
          this.updateChildren(option.value);
        }
      }
    );
  };

  private onChangeChild = (option: SelectableValue<string> | null) => {
    const { query } = this.props;
    this.setState(
      {
        attributes: null,
      },
      () => {
        this.changeQuery({ child: option ? option.value : undefined, attribute: undefined }, true);
        if (option && option.value && query.device) {
          this.updateAttributes(query.device, option.value);
        }
      }
    );
  };

  private onChangeSingle = (evt?: React.SyntheticEvent<HTMLInputElement>) => {
    if (evt) {
      const value = evt.currentTarget.checked;
      this.changeQuery({ singleValue: value }, true);
    }
  };

  private onChangeOmitParents = (evt?: React.SyntheticEvent<HTMLInputElement>) => {
    if (evt) {
      const value = evt.currentTarget.checked;
      this.changeQuery({ omitParents: value }, true);
    }
  };

  private onChangeLegendRegex = (evt?: React.SyntheticEvent<HTMLInputElement>) => {
    if (evt) {
      const value = evt.currentTarget.checked;
      this.changeQuery({ legendRegex: value }, true);
    }
  };

  private selectedDevice(): SelectableValue<string> | undefined {
    const { query } = this.props;
    return this.state.devices && query.device
      ? this.state.devices.find((option) => option.value === query.device)
      : undefined;
  }

  private selectedChild(): SelectableValue<string> | undefined {
    const { query } = this.props;
    return this.state.children && query.child
      ? this.state.children.find((option) => option.value === query.child)
      : undefined;
  }

  private selectedAttribute(): SelectableValue<string> | undefined {
    const { query } = this.props;
    return this.state.attributes && query.attribute
      ? this.state.attributes.find((option) => option.value === query.attribute)
      : undefined;
  }

  private queryType(): SelectableValue<string> {
    const { query } = this.props;
    return QUERY_TYPES.find((option) => option.value === query.queryType) || QUERY_TYPES[0];
  }

  private extOptions(): JSX.Element | null {
    const { query } = this.props;
    return (
      <>
        <Switch label="Single value" checked={query.singleValue || false} onChange={this.onChangeSingle} />
        {query.queryType && query.queryType === 'table' ? (
          <Switch label="Omit parents" checked={query.omitParents || false} onChange={this.onChangeOmitParents} />
        ) : null}
        {!query.queryType || query.queryType === 'time_series' ? (
          <>
            <label className="gf-form-label">Legend</label>
            <Input
              value={query.legendFormat}
              onChange={(event) => this.changeQuery({ legendFormat: event.currentTarget.value }, true)}
              placeholder={query.legendRegex ? 'Enter a regex' : ''}
            />
            <Switch label="Regex" checked={query.legendRegex || false} onChange={this.onChangeLegendRegex} />
          </>
        ) : null}
      </>
    );
  }

  render() {
    const { query } = this.props;
    return (
      <>
        <div className="gf-form-inline">
          <div className="gf-form gf-form--grow">
            <label className="gf-form-label">Device</label>
            <Select
              key={`_device_key_${query.device}`} // https://stackoverflow.com/questions/50412843/how-to-programmatically-clear-reset-react-select
              options={this.state.devices || undefined}
              onChange={this.onChangeDevice}
              value={this.selectedDevice()}
              placeholder="Select device"
            />
          </div>
          <div className="gf-form gf-form--grow">
            <label className="gf-form-label">Child</label>
            <Select
              key={`_child_key_${query.child}`}
              options={this.state.children || undefined}
              onChange={this.onChangeChild}
              value={this.selectedChild()}
              placeholder="Select a child (interface)"
            />
          </div>
          <div className="gf-form gf-form--grow">
            <label className="gf-form-label">Attribute</label>
            <Select
              key={`_attribute_key_${query.attribute}`}
              options={this.state.attributes || undefined}
              onChange={(option) => this.changeQuery({ attribute: option ? option.value : undefined }, true)}
              value={this.selectedAttribute()}
              placeholder="Select an attribute"
            />
          </div>
        </div>
        <div className="gf-form-inline">
          <div className="gf-form gf-form--grow flex-shrink-1">
            <label className="gf-form-label">Query</label>
            <QueryField
              query={query.query}
              additionalPlugins={this.plugins}
              onChange={(value) => this.changeQuery({ query: value })}
              onRunQuery={this.props.onRunQuery}
              onBlur={this.props.onBlur}
              placeholder="Enter an AKiPS query"
              portalOrigin="akips"
              syntaxLoaded
            />
          </div>
        </div>
        <div className="gf-form-inline">
          <div className="gf-form">
            <label className="gf-form-label">Format</label>
            <Select
              isSearchable={false}
              options={QUERY_TYPES}
              onChange={(option) => this.changeQuery({ queryType: option.value as QueryType }, true)}
              value={this.queryType()}
            />
            {this.props.extOptions ? this.extOptions() : null}
          </div>
        </div>
      </>
    );
  }
}
