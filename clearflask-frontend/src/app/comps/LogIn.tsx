import React, { Component } from 'react';
import * as Client from '../../api/client';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import { Typography, TextField, Button, List, ListItem, ListItemIcon, ListItemText, ListSubheader, Collapse, Dialog, DialogContent, DialogActions, InputAdornment, IconButton, DialogContentText, Hidden } from '@material-ui/core';
import Delimited from '../utils/Delimited';
import { connect } from 'react-redux';
import { Server, ReduxState, Status } from '../../api/server';
import Hr from '../../common/Hr';
import SilentIcon from '@material-ui/icons/Web';
import EmailIcon from '@material-ui/icons/Email';
/** Alternatives: PhonelinkRing, Vibration */
import MobilePushIcon from '@material-ui/icons/PhonelinkRing';
/** Alternatives: NotificationsActive, Web */
import WebPushIcon from '@material-ui/icons/NotificationsActive';
import WebNotification from '../../common/notification/webNotification';
import MobileNotification, { Device } from '../../common/notification/mobileNotification';
import { withSnackbar, WithSnackbarProps } from 'notistack';
import withMobileDialog, { InjectedProps } from '@material-ui/core/withMobileDialog';
import { WithWidth } from '@material-ui/core/withWidth';
import VisibilityIcon from '@material-ui/icons/Visibility';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';
type WithMobileDialogProps = InjectedProps & Partial<WithWidth>;

enum NotificationType {
  Email = 'email',
  Browser = 'browser',
  Ios = 'ios',
  Android = 'android',
  Silent = 'silent',
}

const styles = (theme:Theme) => createStyles({
  content: {
    display: 'flex',
  },
  notificationList: {
    padding: '0px',
  },
  accountFieldsContainer: {
    display: 'flex',
    transition: theme.transitions.create(['max-width', 'max-height']),
    width: 'min-content',
    overflow: 'hidden',
  },
  noWrap: {
    whiteSpace: 'nowrap',
  },
  allowButton: {
    margin: 'auto',
    display: 'block',
  },
});

export interface Props {
  server:Server;
  open?:boolean;
  onClose:()=>void;
  onLoggedInAndClose:()=>void;
}

interface ConnectProps {
  configver?:string;
  config?:Client.Config;
  isLoggedIn:boolean;
}

interface State {
  open?:boolean;
  notificationType?:NotificationType
  notificationDataAndroid?:string
  notificationDataIos?:string
  notificationDataBrowser?:string
  displayName?:string;
  email?:string;
  pass?:string;
  revealPassword?:boolean;
  isSubmitting?:boolean;
}

class LogIn extends Component<Props&ConnectProps&WithStyles<typeof styles, true>&WithSnackbarProps&WithMobileDialogProps, State> {
  state:State={};

  render() {
    if(!this.props.open) return null;

    const notifOpts:Set<NotificationType> = new Set();
    if(this.props.config) {
      if(this.props.config.users.onboarding.notificationMethods.mobilePush === true
        && MobileNotification.getInstance().canAskPermission()) {
        switch(MobileNotification.getInstance().getDevice()) {
          case Device.Android:
            notifOpts.add(NotificationType.Android);
            break;
          case Device.Ios:
            notifOpts.add(NotificationType.Ios);
            break;
        }
      }
      if(this.props.config.users.onboarding.notificationMethods.browserPush === true
        && WebNotification.getInstance().canAskPermission()) {
        notifOpts.add(NotificationType.Browser);
      }
      if(this.props.config.users.onboarding.notificationMethods.anonymous
        && (this.props.config.users.onboarding.notificationMethods.anonymous.onlyShowIfPushNotAvailable !== true
          || (!notifOpts.has(NotificationType.Android) && !notifOpts.has(NotificationType.Ios) && !notifOpts.has(NotificationType.Browser)))) {
        notifOpts.add(NotificationType.Silent)
      }
      if(this.props.config.users.onboarding.notificationMethods.email) {
        notifOpts.add(NotificationType.Email);
      }
    }

    var dialogContent;
    if(this.props.isLoggedIn) {
      dialogContent = [
        <DialogContent>
          <DialogContentText>Oops, you are already logged in</DialogContentText>
        </DialogContent>,
        <DialogActions>
          <Button onClick={e => this.props.onLoggedInAndClose.bind(this)}>Close</Button>
        </DialogActions>,
      ];
    } else if(notifOpts.size === 0) {
      dialogContent = [
        <DialogContent>
          <DialogContentText>Sign ups are currently disabled</DialogContentText>
        </DialogContent>,
        <DialogActions>
          <Button onClick={this.props.onClose.bind(this)}>Cancel</Button>
        </DialogActions>,
      ];
    } else {
      const onlySingleOption = notifOpts.size === 1;
      const singleColumnLayout = this.props.fullScreen || onlySingleOption;

      const selectedNotificationType = (this.state.notificationType && notifOpts.has(this.state.notificationType))
        ? this.state.notificationType
        : (onlySingleOption ? notifOpts.values().next().value : undefined);

      const showEmailInput = selectedNotificationType === NotificationType.Email;
      const showDisplayNameInput = this.props.config && this.props.config.users.onboarding.accountFields.displayName !== Client.AccountFieldsDisplayNameEnum.None;
      const isDisplayNameRequired = this.props.config && this.props.config.users.onboarding.accountFields.displayName === Client.AccountFieldsDisplayNameEnum.Required;
      const showAccountFields = showEmailInput || showDisplayNameInput;
      const showPasswordInput = this.props.config && this.props.config.users.onboarding.notificationMethods.email && this.props.config.users.onboarding.notificationMethods.email.password !== Client.EmailSignupPasswordEnum.None;
      const isPasswordRequired = this.props.config && this.props.config.users.onboarding.notificationMethods.email && this.props.config.users.onboarding.notificationMethods.email.password === Client.EmailSignupPasswordEnum.Required;
      const isSubmittable = selectedNotificationType
        && (selectedNotificationType !== NotificationType.Android || this.state.notificationDataAndroid)
        && (selectedNotificationType !== NotificationType.Ios || this.state.notificationDataIos)
        && (selectedNotificationType !== NotificationType.Browser || this.state.notificationDataBrowser)
        && (!isDisplayNameRequired || this.state.displayName)
        && (selectedNotificationType !== NotificationType.Email || this.state.email)
        && (!isPasswordRequired || this.state.pass);

      const onlySingleOptionRequiresAllow = onlySingleOption &&
        ((selectedNotificationType === NotificationType.Android && !this.state.notificationDataAndroid)
        || (selectedNotificationType === NotificationType.Ios && !this.state.notificationDataIos)
        || (selectedNotificationType === NotificationType.Browser && !this.state.notificationDataBrowser));

      dialogContent = [
        <DialogContent>
          <div
            className={this.props.classes.content}
            style={singleColumnLayout ? { flexDirection: 'column' } : undefined}
          >
            <List component="nav" className={this.props.classes.notificationList}>
              <ListSubheader className={this.props.classes.noWrap} component="div">
                {onlySingleOption ? "We'll notify you of changes" : 'Get notified of changes'}
              </ListSubheader>
              <Collapse in={notifOpts.has(NotificationType.Email)}>
                <ListItem 
                  button={!onlySingleOption}
                  selected={!onlySingleOption && selectedNotificationType === NotificationType.Email}
                  onClick={!onlySingleOption ? e => this.setState({notificationType: NotificationType.Email}) : undefined}
                  disabled={this.state.isSubmitting}
                >
                  <ListItemIcon><EmailIcon /></ListItemIcon>
                  <ListItemText inset primary='Email' className={this.props.classes.noWrap} />
                </ListItem>
              </Collapse>
              <Collapse in={notifOpts.has(NotificationType.Android) || notifOpts.has(NotificationType.Ios)}>
                <ListItem
                  button={!onlySingleOption}
                  selected={!onlySingleOption && (selectedNotificationType === NotificationType.Android || selectedNotificationType === NotificationType.Ios)}
                  onClick={!onlySingleOption ? this.onClickMobileNotif.bind(this) : undefined}
                  disabled={onlySingleOptionRequiresAllow || this.state.isSubmitting}
                >
                  <ListItemIcon><MobilePushIcon /></ListItemIcon>
                  <ListItemText inset primary='Mobile Push' className={this.props.classes.noWrap} />
                </ListItem>
                <Collapse in={onlySingleOptionRequiresAllow}>
                  <Button className={this.props.classes.allowButton} onClick={this.onClickMobileNotif.bind(this)}>Allow</Button>
                </Collapse>
              </Collapse>
              <Collapse in={notifOpts.has(NotificationType.Browser)}>
                <ListItem
                  button={!onlySingleOption}
                  selected={!onlySingleOption && selectedNotificationType === NotificationType.Browser}
                  onClick={!onlySingleOption ? this.onClickWebNotif.bind(this) : undefined}
                  disabled={onlySingleOptionRequiresAllow || this.state.isSubmitting}
                >
                  <ListItemIcon><WebPushIcon /></ListItemIcon>
                  <ListItemText inset primary='Browser Push' className={this.props.classes.noWrap} />
                </ListItem>
                <Collapse in={onlySingleOptionRequiresAllow}>
                  <Button className={this.props.classes.allowButton} onClick={this.onClickWebNotif.bind(this)}>Allow</Button>
                </Collapse>
              </Collapse>
              <Collapse in={notifOpts.has(NotificationType.Silent)}>
                <ListItem
                  button={!onlySingleOption}
                  selected={!onlySingleOption && selectedNotificationType === NotificationType.Silent}
                  onClick={!onlySingleOption ? e => this.setState({notificationType: NotificationType.Silent}) : undefined}
                  disabled={this.state.isSubmitting}
                >
                  <ListItemIcon><SilentIcon /></ListItemIcon>
                  <ListItemText inset primary={onlySingleOption ? 'In-App' : 'In-App Only'} />
                </ListItem>
              </Collapse>
            </List>
            <div
              className={this.props.classes.accountFieldsContainer} 
              style={{
                maxWidth: showAccountFields ? '400px' : '0px',
                maxHeight: showAccountFields ? '400px' : '0px',
              }}
            >
              {!singleColumnLayout && (<Hr vertical length='25%' />)}
              <div>
                <ListSubheader className={this.props.classes.noWrap} component="div">Your information</ListSubheader>
                {showDisplayNameInput && (
                  <TextField
                    fullWidth
                    required={isDisplayNameRequired}
                    value={this.state.displayName || ''}
                    onChange={e => this.setState({displayName: e.target.value})}
                    label='Display name'
                    helperText={(<div className={this.props.classes.noWrap}>How others see you</div>)}
                    margin='normal'
                    classes={{ root: this.props.classes.noWrap }}
                    style={{marginTop: '0px'}}
                    disabled={this.state.isSubmitting}
                  />
                )}
                <Collapse in={showEmailInput} unmountOnExit>
                  <div>
                    <TextField
                      fullWidth
                      required
                      value={this.state.email || ''}
                      onChange={e => this.setState({email: e.target.value})}
                      label='Email'
                      type='email'
                      helperText={(<div className={this.props.classes.noWrap}>Where to send you notifications</div>)}
                      margin='normal'
                      style={{marginTop: showDisplayNameInput ? undefined : '0px'}}
                      disabled={this.state.isSubmitting}
                    />
                    {showPasswordInput && (
                      <TextField
                        fullWidth
                        required={isPasswordRequired}
                        value={this.state.pass || ''}
                        onChange={e => this.setState({pass: e.target.value})}
                        label='Password'
                        helperText={(<div className={this.props.classes.noWrap}>
                          {isPasswordRequired
                            ? 'Secure your account'
                            : 'Optionally secure your account'}
                        </div>)}
                        type={this.state.revealPassword ? 'text' : 'password'}
                        InputProps={{ endAdornment: (
                          <InputAdornment position='end'>
                            <IconButton
                              aria-label='Toggle password visibility'
                              onClick={() => this.setState({revealPassword: !this.state.revealPassword})}
                            >
                              {this.state.revealPassword ? <VisibilityIcon fontSize='small' /> : <VisibilityOffIcon fontSize='small' />}
                            </IconButton>
                          </InputAdornment>
                        )}}
                        margin='normal'
                        disabled={this.state.isSubmitting}
                      />
                    )}
                  </div>
                </Collapse>
              </div>
            </div>
          </div>
        </DialogContent>,
        <DialogActions>
          <Button
            onClick={this.props.onClose.bind(this)}
            disabled={this.state.isSubmitting}
          >Cancel</Button>
          <Button
            color='primary'
            disabled={!isSubmittable || this.state.isSubmitting}
            onClick={this.onSubmit.bind(this)}
          >Submit</Button>
        </DialogActions>,
      ];
    }
    
    return (
      <Dialog
        fullScreen={this.props.fullScreen}
        open={!!this.props.open}
        onClose={this.props.onClose}
        scroll='body'
        PaperProps={{
          style: { width: !this.props.fullScreen ? 'fit-content' : undefined },
        }}
      >
        {dialogContent}
      </Dialog>
    );
  }

  onSubmit() {
    this.setState({isSubmitting: true});
    this.props.server.dispatch().userCreate({
      projectId: this.props.server.getProjectId(),
      create: {
        name: this.state.displayName,
        email: this.state.email,
        password: this.state.pass,
        iosPushToken: this.state.notificationDataIos,
        androidPushToken: this.state.notificationDataAndroid,
        browserPushToken: this.state.notificationDataBrowser,
      },
    }).then(() => {
      this.setState({isSubmitting: false});
      this.props.onLoggedInAndClose();
    }).catch(() => {
      this.setState({isSubmitting: false});
    });
  }

  onClickMobileNotif() {
    const device = MobileNotification.getInstance().getDevice();
    if(device === Device.None) return;
    this.setState({
      notificationType: device === Device.Android ? NotificationType.Android : NotificationType.Ios,
    });
    MobileNotification.getInstance().askPermission().then(r => {
      if(r.type === 'success') {
        this.setState({
          ...(r.device === Device.Android ? { notificationDataAndroid: r.token } : {}),
          ...(r.device === Device.Ios ? { notificationDataIos: r.token } : {}),
        });
      } else if(r.type === 'error') {
        if(r.userFacingMsg) {
          this.props.enqueueSnackbar(r.userFacingMsg || 'Failed to setup mobile push', { variant: 'error', preventDuplicate: true });
        }
        this.forceUpdate();
      }
    })
  }

  onClickWebNotif() {
    this.setState({
      notificationType: NotificationType.Browser,
    });
    WebNotification.getInstance().askPermission().then(r => {
      if(r.type === 'success') {
        this.setState({
          notificationDataBrowser: r.token,
        });
      } else if(r.type === 'error') {
        if(r.userFacingMsg) {
          this.props.enqueueSnackbar(r.userFacingMsg || 'Failed to setup browser notifications', { variant: 'error', preventDuplicate: true });
        }
        this.forceUpdate();
      }
    });
  }
}

export default connect<ConnectProps,{},Props,ReduxState>((state, ownProps) => {return {
  configver: state.conf.ver, // force rerender on config change
  config: state.conf.conf,
  isLoggedIn: state.users.loggedIn.status === Status.FULFILLED,
}})(withStyles(styles, { withTheme: true })(withSnackbar(withMobileDialog<Props&ConnectProps&WithStyles<typeof styles, true>&WithSnackbarProps>()(LogIn))));