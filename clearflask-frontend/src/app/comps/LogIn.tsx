import { Button, Collapse, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, InputAdornment, List, ListItem, ListItemIcon, ListItemText, ListSubheader, TextField } from '@material-ui/core';
import { DialogProps } from '@material-ui/core/Dialog';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import withMobileDialog, { InjectedProps } from '@material-ui/core/withMobileDialog';
import { WithWidth } from '@material-ui/core/withWidth';
import EmailIcon from '@material-ui/icons/Email';
/** Alternatives: NotificationsActive, Web */
import WebPushIcon from '@material-ui/icons/NotificationsActive';
/** Alternatives: PhonelinkRing, Vibration */
import MobilePushIcon from '@material-ui/icons/PhonelinkRing';
import VisibilityIcon from '@material-ui/icons/Visibility';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';
import SilentIcon from '@material-ui/icons/Web';
import { withSnackbar, WithSnackbarProps } from 'notistack';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../../api/client';
import { ReduxState, Server, Status } from '../../api/server';
import AcceptTerms from '../../common/AcceptTerms';
import Hr from '../../common/Hr';
import MobileNotification, { Device } from '../../common/notification/mobileNotification';
import WebNotification from '../../common/notification/webNotification';
import { saltHashPassword } from '../../common/util/auth';
import { BIND_SUCCESS_LOCALSTORAGE_EVENT_KEY } from '../App';
type WithMobileDialogProps = InjectedProps & Partial<WithWidth>;

enum NotificationType {
  Email = 'email',
  Browser = 'browser',
  Ios = 'ios',
  Android = 'android',
  Silent = 'silent',
}

const styles = (theme: Theme) => createStyles({
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
  loginFieldsContainer: {
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
  bold: {
    fontWeight: 'bold',
  },
});

export interface Props {
  server: Server;
  open?: boolean;
  onClose: () => void;
  onLoggedInAndClose: () => void;
  actionTitle?: string;
  overrideWebNotification?: WebNotification;
  overrideMobileNotification?: MobileNotification;
  DialogProps?: Partial<DialogProps>;
  forgotEmailDialogProps?: Partial<DialogProps>;
}

interface ConnectProps {
  configver?: string;
  config?: Client.Config;
  loggedInUser?: Client.UserMe;
}

interface State {
  open?: boolean;
  notificationType?: NotificationType
  notificationDataAndroid?: string
  notificationDataIos?: string
  notificationDataBrowser?: string
  displayName?: string;
  email?: string;
  pass?: string;
  revealPassword?: boolean;
  isLogin?: boolean;
  checkForgotEmailDialogOpen?: boolean;
  isSubmitting?: boolean;
}

class LogIn extends Component<Props & ConnectProps & WithStyles<typeof styles, true> & WithSnackbarProps & WithMobileDialogProps, State> {
  state: State = {};
  storageListener?: any;

  componentWillUnmount() {
    this.storageListener && window.removeEventListener('storage', this.storageListener);
  }

  render() {
    if (!this.props.open) return null;

    const notifOpts: Set<NotificationType> = new Set();
    if (this.props.config) {
      // if (this.props.config.users.onboarding.notificationMethods.mobilePush === true
      //   && (this.props.overrideMobileNotification || MobileNotification.getInstance()).canAskPermission()) {
      //   switch ((this.props.overrideMobileNotification || MobileNotification.getInstance()).getDevice()) {
      //     case Device.Android:
      //       notifOpts.add(NotificationType.Android);
      //       break;
      //     case Device.Ios:
      //       notifOpts.add(NotificationType.Ios);
      //       break;
      //   }
      // }
      if (this.props.config.users.onboarding.notificationMethods.browserPush === true
        && (this.props.overrideWebNotification || WebNotification.getInstance()).canAskPermission()) {
        notifOpts.add(NotificationType.Browser);
      }
      if (this.props.config.users.onboarding.notificationMethods.anonymous
        && (this.props.config.users.onboarding.notificationMethods.anonymous.onlyShowIfPushNotAvailable !== true
          || (!notifOpts.has(NotificationType.Android) && !notifOpts.has(NotificationType.Ios) && !notifOpts.has(NotificationType.Browser)))) {
        notifOpts.add(NotificationType.Silent)
      }
      if (this.props.config.users.onboarding.notificationMethods.email) {
        notifOpts.add(NotificationType.Email);
      }
    }

    var dialogContent;
    if (!!this.props.loggedInUser) {
      dialogContent = (
        <React.Fragment>
          <DialogContent>
            <DialogContentText>You are logged in as <span className={this.props.classes.bold}>{this.props.loggedInUser.name || this.props.loggedInUser.email || 'Anonymous'}</span></DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={this.props.onClose.bind(this)}>Cancel</Button>
            <Button color='primary' onClick={this.props.onLoggedInAndClose.bind(this)}>Continue</Button>
          </DialogActions>
        </React.Fragment>
      );
    } else {
      const noSignupOption = notifOpts.size <= 0;
      const isLogin = this.state.isLogin || noSignupOption;
      const onlySingleOption = notifOpts.size === 1;
      const singleColumnLayout = this.props.fullScreen || onlySingleOption;

      const selectedNotificationType = !isLogin && (this.state.notificationType && notifOpts.has(this.state.notificationType))
        ? this.state.notificationType
        : (onlySingleOption ? notifOpts.values().next().value : undefined);

      const showEmailInput = selectedNotificationType === NotificationType.Email;
      const showDisplayNameInput = this.props.config && this.props.config.users.onboarding.accountFields.displayName !== Client.AccountFieldsDisplayNameEnum.None;
      const isDisplayNameRequired = this.props.config && this.props.config.users.onboarding.accountFields.displayName === Client.AccountFieldsDisplayNameEnum.Required;
      const showAccountFields = !isLogin && (showEmailInput || showDisplayNameInput);
      const showPasswordInput = this.props.config && this.props.config.users.onboarding.notificationMethods.email && this.props.config.users.onboarding.notificationMethods.email.password !== Client.EmailSignupPasswordEnum.None;
      const isPasswordRequired = this.props.config && this.props.config.users.onboarding.notificationMethods.email && this.props.config.users.onboarding.notificationMethods.email.password === Client.EmailSignupPasswordEnum.Required;
      const isSignupSubmittable = selectedNotificationType
        && (selectedNotificationType !== NotificationType.Android || this.state.notificationDataAndroid)
        && (selectedNotificationType !== NotificationType.Ios || this.state.notificationDataIos)
        && (selectedNotificationType !== NotificationType.Browser || this.state.notificationDataBrowser)
        && (!isDisplayNameRequired || this.state.displayName)
        && (selectedNotificationType !== NotificationType.Email || this.state.email)
        && (!isPasswordRequired || this.state.pass);
      const isLoginSubmittable = !!this.state.email;
      const isSubmittable = isLogin ? isLoginSubmittable : isSignupSubmittable;

      const onlySingleOptionRequiresAllow = onlySingleOption &&
        ((selectedNotificationType === NotificationType.Android && !this.state.notificationDataAndroid)
          || (selectedNotificationType === NotificationType.Ios && !this.state.notificationDataIos)
          || (selectedNotificationType === NotificationType.Browser && !this.state.notificationDataBrowser));

      dialogContent = (
        <React.Fragment>
          <DialogContent>
            <Collapse in={!isLogin}>
              <div
                className={this.props.classes.content}
                style={singleColumnLayout ? { flexDirection: 'column' } : undefined}
              >
                <List component="nav" className={this.props.classes.notificationList}>
                  <ListSubheader className={this.props.classes.noWrap} component="div">{this.props.actionTitle || 'Sign up'}</ListSubheader>
                  <Collapse in={notifOpts.has(NotificationType.Android) || notifOpts.has(NotificationType.Ios)}>
                    <ListItem
                      // https://github.com/mui-org/material-ui/pull/15049
                      button={!onlySingleOption as any}
                      selected={!onlySingleOption && (selectedNotificationType === NotificationType.Android || selectedNotificationType === NotificationType.Ios)}
                      onClick={!onlySingleOption ? this.onClickMobileNotif.bind(this) : undefined}
                      disabled={onlySingleOptionRequiresAllow || this.state.isSubmitting}
                    >
                      <ListItemIcon><MobilePushIcon /></ListItemIcon>
                      <ListItemText primary='Mobile Push' className={this.props.classes.noWrap} />
                    </ListItem>
                    <Collapse in={onlySingleOptionRequiresAllow}>
                      <Button className={this.props.classes.allowButton} onClick={this.onClickMobileNotif.bind(this)}>Allow</Button>
                    </Collapse>
                  </Collapse>
                  <Collapse in={notifOpts.has(NotificationType.Browser)}>
                    <ListItem
                      button={!onlySingleOption as any}
                      selected={!onlySingleOption && selectedNotificationType === NotificationType.Browser}
                      onClick={!onlySingleOption ? this.onClickWebNotif.bind(this) : undefined}
                      disabled={onlySingleOptionRequiresAllow || this.state.isSubmitting}
                    >
                      <ListItemIcon><WebPushIcon /></ListItemIcon>
                      <ListItemText primary='Browser Push' className={this.props.classes.noWrap} />
                    </ListItem>
                    <Collapse in={onlySingleOptionRequiresAllow}>
                      <Button className={this.props.classes.allowButton} onClick={this.onClickWebNotif.bind(this)}>Allow</Button>
                    </Collapse>
                  </Collapse>
                  <Collapse in={notifOpts.has(NotificationType.Email)}>
                    <ListItem
                      button={!onlySingleOption as any}
                      selected={!onlySingleOption && selectedNotificationType === NotificationType.Email}
                      onClick={!onlySingleOption ? e => this.setState({ notificationType: NotificationType.Email }) : undefined}
                      disabled={this.state.isSubmitting}
                    >
                      <ListItemIcon><EmailIcon /></ListItemIcon>
                      <ListItemText primary='Email' className={this.props.classes.noWrap} />
                    </ListItem>
                  </Collapse>
                  <Collapse in={notifOpts.has(NotificationType.Silent)}>
                    <ListItem
                      button={!onlySingleOption as any}
                      selected={!onlySingleOption && selectedNotificationType === NotificationType.Silent}
                      onClick={!onlySingleOption ? e => this.setState({ notificationType: NotificationType.Silent }) : undefined}
                      disabled={this.state.isSubmitting}
                    >
                      <ListItemIcon><SilentIcon /></ListItemIcon>
                      <ListItemText primary={onlySingleOption ? 'In-App' : 'In-App Only'} />
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
                    <ListSubheader className={this.props.classes.noWrap} component="div">Your info</ListSubheader>
                    {showDisplayNameInput && (
                      <TextField
                        fullWidth
                        required={isDisplayNameRequired}
                        value={this.state.displayName || ''}
                        onChange={e => this.setState({ displayName: e.target.value })}
                        label='Display name'
                        helperText={(<div className={this.props.classes.noWrap}>How others see you</div>)}
                        margin='normal'
                        classes={{ root: this.props.classes.noWrap }}
                        style={{ marginTop: '0px' }}
                        disabled={this.state.isSubmitting}
                      />
                    )}
                    <Collapse in={showEmailInput} unmountOnExit>
                      <div>
                        <TextField
                          fullWidth
                          required
                          value={this.state.email || ''}
                          onChange={e => this.setState({ email: e.target.value })}
                          label='Email'
                          type='email'
                          helperText={(<div className={this.props.classes.noWrap}>Where to send you updates</div>)}
                          margin='normal'
                          style={{ marginTop: showDisplayNameInput ? undefined : '0px' }}
                          disabled={this.state.isSubmitting}
                        />
                        {showPasswordInput && (
                          <TextField
                            fullWidth
                            required={isPasswordRequired}
                            value={this.state.pass || ''}
                            onChange={e => this.setState({ pass: e.target.value })}
                            label='Password'
                            helperText={(<div className={this.props.classes.noWrap}>
                              {isPasswordRequired
                                ? 'Secure your account'
                                : 'Optionally secure your account'}
                            </div>)}
                            type={this.state.revealPassword ? 'text' : 'password'}
                            InputProps={{
                              endAdornment: (
                                <InputAdornment position='end'>
                                  <IconButton
                                    aria-label='Toggle password visibility'
                                    onClick={() => this.setState({ revealPassword: !this.state.revealPassword })}
                                  >
                                    {this.state.revealPassword ? <VisibilityIcon fontSize='small' /> : <VisibilityOffIcon fontSize='small' />}
                                  </IconButton>
                                </InputAdornment>
                              )
                            }}
                            margin='normal'
                            disabled={this.state.isSubmitting}
                          />
                        )}
                      </div>
                    </Collapse>
                  </div>
                </div>
              </div>
              <AcceptTerms overrideTerms={this.props.config?.users.onboarding.terms?.documents} />
            </Collapse>
            <Collapse in={!!isLogin}>
              <div className={this.props.classes.loginFieldsContainer}>
                <ListSubheader className={this.props.classes.noWrap} component="div">Login</ListSubheader>
                <div>
                  <TextField
                    fullWidth
                    required
                    value={this.state.email || ''}
                    onChange={e => this.setState({ email: e.target.value })}
                    label='Email'
                    type='email'
                    helperText={(<div className={this.props.classes.noWrap}>Email you used to sign up</div>)}
                    margin='normal'
                    style={{ marginTop: '0px' }}
                    disabled={this.state.isSubmitting}
                  />
                  <TextField
                    fullWidth
                    value={this.state.pass || ''}
                    onChange={e => this.setState({ pass: e.target.value })}
                    label='Password'
                    helperText={(<div className={this.props.classes.noWrap}>Leave blank if you forgot</div>)}
                    type={this.state.revealPassword ? 'text' : 'password'}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position='end'>
                          <IconButton
                            aria-label='Toggle password visibility'
                            onClick={() => this.setState({ revealPassword: !this.state.revealPassword })}
                          >
                            {this.state.revealPassword ? <VisibilityIcon fontSize='small' /> : <VisibilityOffIcon fontSize='small' />}
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                    margin='normal'
                    disabled={this.state.isSubmitting}
                  />
                </div>
              </div>
            </Collapse>
          </DialogContent>
          <DialogActions>
            {!noSignupOption && (
              <Button
                onClick={() => this.setState({ isLogin: !isLogin })}
                disabled={this.state.isSubmitting}
              >{isLogin ? 'Or Signup' : 'Or Login'}</Button>
            )}
            <Button
              color='primary'
              disabled={!isSubmittable || this.state.isSubmitting}
              onClick={() => {
                if (!!isLogin && !this.state.pass) {
                  this.storageListener = (ev: StorageEvent) => {
                    if (ev.key !== BIND_SUCCESS_LOCALSTORAGE_EVENT_KEY) return;
                    this.props.server.dispatch().userBind({
                      projectId: this.props.server.getProjectId(),
                    });
                  }
                  window.addEventListener('storage', this.storageListener);
                  this.props.server.dispatch().forgotPassword({
                    projectId: this.props.server.getProjectId(),
                    forgotPassword: {
                      email: this.state.email!,
                    },
                  }).then(() => {
                    this.setState({ isSubmitting: false, checkForgotEmailDialogOpen: true });
                  }).catch(() => {
                    this.setState({ isSubmitting: false });
                  });
                } else if (!!isLogin && !!this.state.pass) {
                  this.setState({ isSubmitting: true });
                  this.props.server.dispatch().userLogin({
                    projectId: this.props.server.getProjectId(),
                    userLogin: {
                      email: this.state.email!,
                      password: saltHashPassword(this.state.pass),
                    },
                  }).then(() => {
                    this.setState({ isSubmitting: false });
                    this.props.onLoggedInAndClose();
                  }).catch(() => {
                    this.setState({ isSubmitting: false });
                  });
                } else {
                  this.setState({ isSubmitting: true });
                  this.props.server.dispatch().userCreate({
                    projectId: this.props.server.getProjectId(),
                    userCreate: {
                      name: this.state.displayName,
                      email: this.state.email,
                      password: this.state.pass ? saltHashPassword(this.state.pass) : undefined,
                      iosPushToken: selectedNotificationType === NotificationType.Ios ? this.state.notificationDataIos : undefined,
                      androidPushToken: selectedNotificationType === NotificationType.Android ? this.state.notificationDataAndroid : undefined,
                      browserPushToken: selectedNotificationType === NotificationType.Browser ? this.state.notificationDataBrowser : undefined,
                    },
                  }).then(() => {
                    this.setState({ isSubmitting: false });
                    this.props.onLoggedInAndClose();
                  }).catch(() => {
                    this.setState({ isSubmitting: false });
                  });
                }
              }}
            >Continue</Button>
          </DialogActions>
          <Dialog
            open={!!this.state.checkForgotEmailDialogOpen}
            onClose={() => this.setState({ checkForgotEmailDialogOpen: false })}
            maxWidth='xs'
            {...this.props.forgotEmailDialogProps}
          >
            <DialogTitle>Awaiting confirmation...</DialogTitle>
            <DialogContent>
              <DialogContentText>We sent an email to <span className={this.props.classes.bold}>{this.state.email}</span>. After clicking the confirmation link in your email, return to this page.</DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => this.setState({ checkForgotEmailDialogOpen: false })}>Cancel</Button>
            </DialogActions>
          </Dialog>
        </React.Fragment>
      );
    }

    return (
      <Dialog
        open={!!this.props.open}
        onClose={this.props.onClose}
        scroll='body'
        PaperProps={{
          style: {
            width: 'fit-content',
            marginLeft: 'auto',
            marginRight: 'auto',
          },
        }}
        {...this.props.DialogProps}
      >
        {dialogContent}
      </Dialog>
    );
  }

  onClickMobileNotif() {
    const device = (this.props.overrideMobileNotification || MobileNotification.getInstance()).getDevice();
    if (device === Device.None) return;
    this.setState({
      notificationType: device === Device.Android ? NotificationType.Android : NotificationType.Ios,
    });
    (this.props.overrideMobileNotification || MobileNotification.getInstance()).askPermission().then(r => {
      if (r.type === 'success') {
        this.setState({
          ...(r.device === Device.Android ? { notificationDataAndroid: r.token } : {}),
          ...(r.device === Device.Ios ? { notificationDataIos: r.token } : {}),
        });
      } else if (r.type === 'error') {
        if (r.userFacingMsg) {
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
    (this.props.overrideWebNotification || WebNotification.getInstance()).askPermission().then(r => {
      if (r.type === 'success') {
        this.setState({
          notificationDataBrowser: r.token,
        });
      } else if (r.type === 'error') {
        if (r.userFacingMsg) {
          this.props.enqueueSnackbar(r.userFacingMsg || 'Failed to setup browser notifications', { variant: 'error', preventDuplicate: true });
        }
        this.forceUpdate();
      }
    });
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  return {
    configver: state.conf.ver, // force rerender on config change
    config: state.conf.conf,
    loggedInUser: state.users.loggedIn.status === Status.FULFILLED ? state.users.loggedIn.user : undefined,
  }
})(withStyles(styles, { withTheme: true })(withSnackbar(withMobileDialog<Props & ConnectProps & WithStyles<typeof styles, true> & WithSnackbarProps>({ breakpoint: 'xs' })(LogIn))));
