import React, { Component } from 'react';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import InfoIcon from '@material-ui/icons/Info';
import CloseIcon from '@material-ui/icons/Close';
import green from '@material-ui/core/colors/green';
import amber from '@material-ui/core/colors/amber';
import IconButton from '@material-ui/core/IconButton';
import SnackbarContent from '@material-ui/core/SnackbarContent';
import WarningIcon from '@material-ui/icons/Warning';

interface Props {
  message:React.ReactNode|string,
  onClose?:()=>{},
  variant:'success'|'warning'|'error'|'info',
}

class Message extends Component<Props> {
  readonly variantIcon = {
    success: CheckCircleIcon,
    warning: WarningIcon,
    error: ErrorIcon,
    info: InfoIcon,
  };
  readonly styles = {
    success: {
      backgroundColor: green[600],
    },
    error: {
      backgroundColor: '#d32f2f',
    },
    info: {
      backgroundColor: '#1976d2',
    },
    warning: {
      backgroundColor: amber[700],
    },
    icon: {
      fontSize: 20,
    },
    iconVariant: {
      opacity: 0.9,
      marginRight: '8px',
    },
    message: {
      display: 'flex',
      alignItems: 'center',
    },
  };

  render() {
    const Icon = this.variantIcon[this.props.variant];
    return (
      <SnackbarContent
        style={this.styles[this.props.variant]}
        aria-describedby="client-snackbar"
        message={
          <span id="client-snackbar">
            <Icon style={{...this.styles.icon, ...this.styles.iconVariant}} />
            {this.props.message}
          </span>
        }
        action={[
          <IconButton
            key="close"
            aria-label="Close"
            color="inherit"
            onClick={this.props.onClose}
          >
            <CloseIcon style={this.styles.icon} />
          </IconButton>,
        ]}
        {...this.props}
      />
    );
  }
}

export default Message;
