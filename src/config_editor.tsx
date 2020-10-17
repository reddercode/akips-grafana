import React from 'react';
import { Field, Input, Legend } from '@grafana/ui';
import { DataSourceJsonData, DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { AKIPSSecureJSONData } from './types';
import {} from '@emotion/core'; // https://github.com/grafana/grafana/issues/26512

export class ConfigEditor extends React.PureComponent<
  DataSourcePluginOptionsEditorProps<DataSourceJsonData, AKIPSSecureJSONData>
> {
  render() {
    const { options, onOptionsChange } = this.props;
    const secureJsonData = options.secureJsonData || {};
    const isValidUrl = /^(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/.test(
      options.url
    );

    return (
      <>
        <div className="gf-form-group">
          <Legend>HTTP</Legend>
          <div className="gf-form-group">
            <Field
              required
              invalid={!isValidUrl}
              label="URL"
              description="Specify a complete HTTP URL (for example http://your_server:8080)"
            >
              <Input
                type="text"
                value={options.url}
                onChange={(event) => onOptionsChange({ ...options, url: event.currentTarget.value })}
              />
            </Field>
          </div>

          <Legend>Auth</Legend>
          <div className="gf-form-group">
            <Field label="Password" required>
              <Input
                type="password"
                value={secureJsonData.password}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  onOptionsChange({
                    ...options,
                    secureJsonData: {
                      password: event.currentTarget.value,
                    },
                  })
                }
              />
            </Field>
          </div>
        </div>
      </>
    );
  }
}
