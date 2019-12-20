import { QueryEditorProps } from '@grafana/data';
import { QueryField, SlatePrism } from '@grafana/ui';
import React from 'react';
import Slate from 'slate';
import Prism from 'prismjs';
import { DataSource } from './data_source';
import { TSDBQuery } from './types';
import syntax from './syntax';

type Props = QueryEditorProps<DataSource, TSDBQuery>;

interface State {
  syntaxLoaded: boolean;
}

export class QueryEditor extends React.PureComponent<Props, State> {
  plugins: Slate.Plugin[];

  constructor(props: Props, context: React.Context<any>) {
    super(props, context);

    this.plugins = [
      SlatePrism({
        onlyIn: (node: Slate.Node) => node instanceof Slate.Block && node.type === 'code_block',
        getSyntax: (node: Slate.Node) => 'akips',
      }),
    ];

    this.state = {
      syntaxLoaded: false,
    };
  }

  componentDidMount() {
    Prism.languages['akips'] = syntax;
    this.setState({ syntaxLoaded: true });
  }

  onChangeQuery = (value: string, override?: boolean) => {
    console.log('onChangeQuery', value, override);

    const { query, onChange, onRunQuery } = this.props;
    if (onChange) {
      const q: TSDBQuery = { ...query, cmd: value };
      onChange(q);
      if (override && onRunQuery) {
        onRunQuery();
      }
    }
  };

  render() {
    const { query } = this.props;
    const cmd = query.cmd || null;
    return (
      <div className="gf-form">
        <QueryField
          query={cmd}
          additionalPlugins={this.plugins}
          onChange={this.onChangeQuery}
          onRunQuery={this.props.onRunQuery}
          placeholder="Enter a AKiPS query"
          portalOrigin="akips"
          syntaxLoaded={this.state.syntaxLoaded}
        />
      </div>
    );
  }
}
