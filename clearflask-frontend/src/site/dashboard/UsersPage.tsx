import { Button, IconButton, InputAdornment, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import AndroidIcon from '@material-ui/icons/Android';
import IosIcon from '@material-ui/icons/Apple';
import EmailIcon from '@material-ui/icons/Email';
import NotificationsOffIcon from '@material-ui/icons/NotificationsOff';
import VisibilityIcon from '@material-ui/icons/Visibility';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';
import BrowserIcon from '@material-ui/icons/Web';
import React, { Component } from 'react';
import TimeAgo from 'react-timeago';
import * as Admin from '../../api/admin';
import { Server } from '../../api/server';
import ExplorerTemplate from '../../app/comps/ExplorerTemplate';
import Loader from '../../app/utils/Loader';
import CreditView from '../../common/config/CreditView';
import debounce from '../../common/util/debounce';

const styles = (theme: Theme) => createStyles({
  searchInput: {
    margin: theme.spacing(1),
    width: 100,
  },
  addIcon: {
    cursor: 'text',
    height: '24px',
    fontSize: '24px',
    color: theme.palette.text.hint,
  },
  nothing: {
    margin: theme.spacing(4),
    color: theme.palette.text.hint,
  },
  createFormFields: {
    display: 'flex',
    flexDirection: 'column',
    marginRight: theme.spacing(2),
  },
  createFormField: {
    margin: theme.spacing(1),
    width: 'auto',
    flexGrow: 1,
  },
  createField: {
    minWidth: 100,
    marginRight: theme.spacing(3),
  },
  resultContainer: {
    margin: theme.spacing(2),
  },
  userProperties: {
    margin: theme.spacing(2),
  },
  key: {
    margin: theme.spacing(1),
  },
  value: {
    margin: theme.spacing(1),
  },
});

interface Props {
  server: Server;
}

interface State {
  createRefFocused?: boolean;
  newUserName?: string;
  newUserEmail?: string;
  newUserPassword?: string;
  revealPassword?: boolean;
  newUserBalance?: number
  newUserIsSubmitting?: boolean;
  createFormHasExpanded?: boolean;
  searchInput?: string;
  searchText?: string;
  searchResult?: Admin.UserAdmin[];
  searchCursor?: string;
}

class UsersPage extends Component<Props & WithStyles<typeof styles, true>, State> {
  readonly updateSearchText: (name?: string, email?: string) => void;
  readonly createInputRef: React.RefObject<HTMLInputElement> = React.createRef();

  constructor(props) {
    super(props);
    this.state = {};
    this.updateSearchText = debounce(this.search.bind(this), 500);
    this.search();
  }

  render() {
    const expand = !!this.state.createRefFocused || !!this.state.newUserName;
    const enableSubmit = !!this.state.newUserName;

    return (
      <ExplorerTemplate
        createSize={expand ? '364px' : '116px'}
        createShown={expand}
        createVisible={(
          <TextField
            disabled={this.state.newUserIsSubmitting}
            className={`${this.props.classes.createFormField} ${this.props.classes.createField}`}
            label='Create'
            placeholder='Name'
            value={this.state.newUserName || ''}
            onChange={e => {
              this.setState({ newUserName: e.target.value });
              this.updateSearchText(e.target.value, this.state.newUserEmail);
            }}
            InputProps={{
              inputRef: this.createInputRef,
              onBlur: () => this.setState({ createRefFocused: false }),
              onFocus: () => this.setState({ createRefFocused: true }),
              endAdornment: (
                <InputAdornment position="end">
                  <AddIcon
                    className={this.props.classes.addIcon}
                    onClick={() => this.createInputRef.current?.focus()}
                  />
                </InputAdornment>
              ),
            }}
          />
        )}
        createCollapsible={(
          <div className={this.props.classes.createFormFields}>
            <TextField
              disabled={this.state.newUserIsSubmitting}
              className={this.props.classes.createFormField}
              placeholder='Email'
              value={this.state.newUserEmail || ''}
              onChange={e => {
                this.setState({ newUserEmail: e.target.value });
                this.updateSearchText(this.state.newUserName, e.target.value);
              }}
            />
            <TextField
              disabled={this.state.newUserIsSubmitting}
              className={this.props.classes.createFormField}
              placeholder='Password'
              value={this.state.newUserPassword || ''}
              onChange={e => this.setState({ newUserPassword: e.target.value })}
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
            />
            <Button
              color='primary'
              disabled={!enableSubmit || this.state.newUserIsSubmitting}
              onClick={e => {
                if (!enableSubmit) return;
                this.setState({ newUserIsSubmitting: true });
                this.props.server.dispatchAdmin().then(d => d.userCreateAdmin({
                  projectId: this.props.server.getProjectId(),
                  userCreateAdmin: {
                    name: this.state.newUserName,
                    email: this.state.newUserEmail,
                    password: this.state.newUserPassword,
                    balance: this.state.newUserBalance,
                  },
                })).then(user => this.setState({
                  createRefFocused: false,
                  newUserName: undefined,
                  newUserEmail: undefined,
                  newUserPassword: undefined,
                  revealPassword: undefined,
                  newUserBalance: undefined,
                  newUserIsSubmitting: false,
                  searchInput: undefined,
                  searchResult: [user],
                })).catch(e => this.setState({
                  newUserIsSubmitting: false,
                }));
              }}
              style={{
                alignSelf: 'flex-end',
              }}
            >
              Submit
            </Button>
          </div>
        )}
        search={(
          <TextField
            className={this.props.classes.searchInput}
            label='Search'
            value={this.state.searchInput || ''}
            onChange={e => {
              this.setState({
                searchInput: e.target.value,
                searchText: e.target.value,
              });
              this.updateSearchText(e.target.value);
            }}
          />
        )}
        content={(
          <div className={this.props.classes.resultContainer}>
            {this.state.searchResult && this.state.searchResult.length > 0
              ? (
                <React.Fragment>
                  <Table size='small' className={this.props.classes.userProperties}>
                    <TableHead>
                      <TableRow>
                        <TableCell key='created'>Created</TableCell>
                        <TableCell key='name'>Name</TableCell>
                        <TableCell key='email'>Email</TableCell>
                        <TableCell key='notifications'>Notifications</TableCell>
                        <TableCell key='balance'>Account balance</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {this.state.searchResult.map((user, index) => (
                        <TableRow key={index}>
                          <TableCell><Typography><TimeAgo date={user.created} /></Typography></TableCell>
                          <TableCell><Typography>{user.name}</Typography></TableCell>
                          <TableCell><Typography>{user.email}</Typography></TableCell>
                          <TableCell><Typography>
                            {!user.emailNotify && !user.browserPush && !user.iosPush && !user.androidPush && (<NotificationsOffIcon fontSize='inherit' />)}
                            {user.emailNotify && (<EmailIcon fontSize='inherit' />)}
                            {user.browserPush && (<BrowserIcon fontSize='inherit' />)}
                            {user.iosPush && (<IosIcon fontSize='inherit' />)}
                            {user.androidPush && (<AndroidIcon fontSize='inherit' />)}
                          </Typography></TableCell>
                          <TableCell><Typography>
                            {!!user.balance && (<CreditView
                              val={user.balance}
                              credits={this.props.server.getStore().getState().conf.conf?.credits || { increment: 1 }} />)}
                          </Typography></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {!!this.state.searchCursor && (
                    <Button
                      style={{ margin: 'auto', display: 'block' }}
                      onClick={() => this.search(this.state.searchText, undefined, this.state.searchCursor)}
                    >
                      Show more
                    </Button>
                  )}
                </React.Fragment>
              ) : (
                <div className={this.props.classes.nothing}>
                  <Loader loaded={this.state.searchResult !== undefined}>
                    <Typography variant='overline'>No users found</Typography>
                  </Loader>
                </div>
              )}
          </div>
        )}
      />
    );
  }

  search(name?: string, email?: string, cursor?: string) {
    this.props.server.dispatchAdmin()
      .then(d => d.userSearchAdmin({
        projectId: this.props.server.getProjectId(),
        cursor: cursor,
        userSearchAdmin: {
          searchText: `${name || ''} ${email || ''}`.trim(),
        },
      }))
      .then(result => this.setState({
        searchResult: cursor
          ? [...(this.state.searchResult || []), ...result.results]
          : result.results,
        searchCursor: result.cursor,
      }));
  }
}

export default withStyles(styles, { withTheme: true })(UsersPage);
