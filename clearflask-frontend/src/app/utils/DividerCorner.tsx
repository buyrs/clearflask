import { Divider, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import DividerVertical from './DividerVertical';

const styles = (theme: Theme) => createStyles({
  title: {
    margin: theme.spacing(1),
  },
  dividerHorizontal: {
    gridArea: 'divider-horizontal',
  },
  dividerVertical: {
    gridArea: 'divider-vertical',
  },
  heightTransition: {
    transition: (props: Props) => theme.transitions.create('height', props.isExplorer ? { duration: theme.explorerExpandTimeout } : undefined),
  },
  widthTransition: {
    transition: (props: Props) => theme.transitions.create('min-width', props.isExplorer ? { duration: theme.explorerExpandTimeout } : undefined),
  },
});

interface Props {
  className?: string;
  innerClassName?: string;
  title?: string;
  header?: React.ReactNode;
  width?: string;
  height?: string;
  rtl?: boolean;
  isExplorer?: boolean
}

class DividerCorner extends Component<Props & WithStyles<typeof styles, true>> {

  render() {
    return (
      <div className={this.props.className} style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: this.props.rtl ? 'flex-end' : 'flex-start',
      }}>
        <div className={this.props.classes.widthTransition} style={{
          minWidth: this.props.width || '24px',
          display: 'inline-block',
        }}>
          {this.props.title !== undefined ? (
            <Typography variant='overline' className={this.props.classes.title}>
              {this.props.title}
            </Typography>
          ) : null}
          {this.props.header}
          <Divider />
        </div>
        <div style={{
          display: 'flex',
          width: '100%',
          flexDirection: this.props.rtl ? 'row-reverse' : 'row',
        }}>
          <div style={{
            display: 'flex',
          }}>
            <DividerVertical
              className={this.props.classes.heightTransition}
              style={{ height: this.props.height || '24px' }}
            />
          </div>
          <div style={{ width: '100%' }} className={this.props.innerClassName}>
            {this.props.children}
          </div>
        </div>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(DividerCorner);
